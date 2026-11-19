'use strict';
/**
 * Serverová logika pro formulář majitele s fotkami (fáze 5). Nezávisí na hostingu:
 * adaptéry (api/*.js pro Vercel, případně netlify/functions/*.js) jen předají požadavek sem.
 *
 * Tok: zahájit (údaje + antispam) → nahrát fotky jednu po jedné → dokončit (uložit a upozornit Make).
 * Vše v databázi a v neveřejném úložišti Supabase, přes service klíč, který je jen na serveru.
 */
const crypto = require('node:crypto');

const BUCKET = 'submissions';
const MAX_PHOTOS = 12;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_JSON_BYTES = 32 * 1024;
const MIN_FILL_MS = 3000;                 // rychlejší odeslání je bot
const UPLOAD_WINDOW_MS = 2 * 60 * 60 * 1000;
const RATE_PER_HOUR = 5;                  // zahájených podkladů na jednu IP za hodinu
const GLOBAL_PER_HOUR = 300;              // pojistka proti zahlcení

// Po kolika dnech se podklady mažou (null = nemažou se). Měřeno od posledního pohybu (u rozpracovaných od vzniku).
const RETENTION_DAYS = { rozpracovano: 1, nova: 90, v_reseni: 90, zamitnuto: 30, prevzato: 90 };

const INQUIRY_PER_HOUR = 5;                // „Mám zájem“ z jedné IP za hodinu
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const env = (n, d = '') => (process.env[n] || d).trim();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

// ---------- Supabase (REST + Storage) ----------
async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new HttpError(500, 'Chybí konfigurace databáze.');
  const res = await fetch(url + path, {
    method, body,
    headers: { apikey: key, Authorization: 'Bearer ' + key, ...headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new HttpError(502, `Databáze odpověděla ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const json = (o) => ({ body: JSON.stringify(o), headers: { 'Content-Type': 'application/json' } });
const dbSelect = (query) => sb('/rest/v1/submissions?' + query);
const dbInsert = (row) => sb('/rest/v1/submissions', { method: 'POST', body: JSON.stringify(row), headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
const dbPatch = (id, patch) => sb('/rest/v1/submissions?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch), headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
const evInsert = (row) => sb('/rest/v1/inquiry_events', { method: 'POST', body: JSON.stringify(row), headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
const evSelect = (query) => sb('/rest/v1/inquiry_events?' + query);
const evPurge = (iso) => sb('/rest/v1/inquiry_events?created_at=lt.' + encodeURIComponent(iso), { method: 'DELETE' });
const dbDelete = (id) => sb('/rest/v1/submissions?id=eq.' + id, { method: 'DELETE' });
const listFiles = (id) => sb(`/storage/v1/object/list/${BUCKET}`, { method: 'POST', body: JSON.stringify({ prefix: id, limit: 100 }), headers: { 'Content-Type': 'application/json' } });
const uploadFile = (path, buf) => sb(`/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', body: buf, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } });
const removeFiles = (paths) => paths.length ? sb(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes: paths }), headers: { 'Content-Type': 'application/json' } }) : null;

// ---------- pomocné ----------
async function readBody(stream, max) {
  const chunks = []; let size = 0;
  for await (const c of stream) {
    size += c.length;
    if (size > max) throw new HttpError(413, 'Příliš velký požadavek.');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
function sameOrigin(headers) {
  const origin = headers.origin;
  if (!origin) return true;
  const host = headers['x-forwarded-host'] || headers.host || '';
  try { return new URL(origin).host === host; } catch { return false; }
}
function tokenOk(token, hash) {
  if (!token || !hash) return false;
  const a = Buffer.from(sha256(String(token)), 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function verifyTurnstile(token, ip) {
  const secret = env('TURNSTILE_SECRET');
  if (!secret) {
    if (env('ALLOW_NO_CAPTCHA') === '1') return true;     // jen vývoj
    throw new HttpError(500, 'Chybí konfigurace antispamu.');
  }
  if (!token) return false;
  const r = await fetch(env('TURNSTILE_VERIFY_URL', 'https://challenges.cloudflare.com/turnstile/v0/siteverify'), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: String(token), remoteip: ip || '' }), signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}
const intOrNull = (v, max) => { const n = parseInt(String(v == null ? '' : v).replace(/\s/g, ''), 10); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };

function validate(b) {
  const d = {
    name: clean(b.jmeno, 100), phone: clean(b.telefon, 30), email: clean(b.email, 120).toLowerCase(),
    property_type: clean(b.typ, 40), disposition: clean(b.dispozice, 20) || null, city: clean(b.mesto, 80),
    area_m2: intOrNull(b.plocha, 100000), rent_czk: intOrNull(b.najemne, 10000000),
    available_from: /^\d{4}-\d{2}-\d{2}$/.test(String(b.od || '')) ? String(b.od) : null,
    description: clean(b.popis, 2000) || null, help: clean(b.pomoc, 100) || null, source: clean(b.zdroj, 200) || null,
  };
  const err = [];
  if (d.name.length < 2) err.push('jmeno');
  if (!/^[+0-9 ()-]{7,30}$/.test(d.phone)) err.push('telefon');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) err.push('email');
  if (!d.city) err.push('mesto');
  if (!d.property_type) err.push('typ');
  if (!(b.souhlas === true || b.souhlas === 'on' || b.souhlas === 'true')) err.push('souhlas');
  return { d, err };
}

// ---------- POST/PUT /api/podklady ----------
async function zahajit(req) {
  const raw = await readBody(req.stream, MAX_JSON_BYTES);
  let b; try { b = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Neplatný požadavek.'); }
  if (b.web) return { status: 200, body: { ok: true, id: crypto.randomUUID(), token: 'x' } };        // honeypot: tváříme se, že vše prošlo
  if (!(Number(b.otevreno) > 0) || Date.now() - Number(b.otevreno) < MIN_FILL_MS) throw new HttpError(400, 'Formulář byl odeslán příliš rychle. Zkuste to prosím znovu.');

  const { d, err } = validate(b);
  if (err.length) return { status: 422, body: { ok: false, chyby: err } };
  const fotek = intOrNull(b.fotek, MAX_PHOTOS);
  if (fotek === null) throw new HttpError(400, 'Neplatný počet fotek.');

  if (!(await verifyTurnstile(b.turnstile, req.ip))) throw new HttpError(403, 'Ověření proti spamu selhalo. Obnovte stránku a zkuste to znovu.');

  const ipHash = sha256(env('IP_SALT', 'dev') + '|' + (req.ip || '')).slice(0, 32);
  const since = encodeURIComponent(new Date(Date.now() - 3600 * 1000).toISOString());
  const mine = await dbSelect(`ip_hash=eq.${ipHash}&created_at=gte.${since}&select=id&limit=${RATE_PER_HOUR + 1}`);
  if (mine.length >= RATE_PER_HOUR) throw new HttpError(429, 'Příliš mnoho odeslání. Zkuste to později, nebo nám zavolejte.');
  const all = await dbSelect(`status=eq.rozpracovano&created_at=gte.${since}&select=id&limit=${GLOBAL_PER_HOUR + 1}`);
  if (all.length >= GLOBAL_PER_HOUR) throw new HttpError(503, 'Služba je dočasně přetížená. Zavolejte nám prosím.');

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('base64url');
  await dbInsert({ id, status: 'rozpracovano', ...d, finalize_hash: sha256(token), ip_hash: ipHash, consent_at: new Date().toISOString(), notified: false });
  return { status: 200, body: { ok: true, id, token, maxFotek: fotek } };
}

async function nahrat(req) {
  const id = req.query.get('id') || '', n = parseInt(req.query.get('n') || '', 10);
  if (!UUID.test(id) || !(n >= 1 && n <= MAX_PHOTOS)) throw new HttpError(400, 'Neplatný požadavek.');
  const rows = await dbSelect(`id=eq.${id}&select=id,status,finalize_hash,created_at&limit=1`);
  const row = rows[0];
  if (!row || row.status !== 'rozpracovano' || !tokenOk(req.headers['x-token'], row.finalize_hash)) throw new HttpError(403, 'Nepovolený požadavek.');
  if (Date.now() - Date.parse(row.created_at) > UPLOAD_WINDOW_MS) throw new HttpError(410, 'Nahrávání vypršelo. Odešlete formulář znovu.');
  const buf = await readBody(req.stream, MAX_PHOTO_BYTES);
  if (buf.length < 1000 || !(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw new HttpError(415, 'Soubor není platný JPEG.');
  await uploadFile(`${id}/${n}.jpg`, buf);
  return { status: 200, body: { ok: true } };
}

async function notifyMake(row, photoCount) {
  const hook = env('MAKE_WEBHOOK_URL');
  if (!hook) return false;
  const base = env('ADMIN_URL') || (env('PUBLIC_URL').replace(/\/$/, '') + '/admin/');
  try {
    const r = await fetch(hook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        projekt: env('PROJECT', 'pronajemzapad'), formular: 'majitel', podklady_id: row.id, odkaz: `${base}#${row.id}`,
        jmeno: row.name, telefon: row.phone, email: row.email, typ: row.property_type, dispozice: row.disposition, mesto: row.city,
        plocha: row.area_m2, najemne: row.rent_czk, od: row.available_from, popis: row.description, pomoc: row.help,
        pocet_fotek: photoCount, souhlas: true, zdroj: row.source, odeslano: row.created_at,
      }),
    });
    return r.ok;
  } catch (e) { console.error('Make webhook selhal:', e.message); return false; }
}

async function dokoncit(req) {
  const raw = await readBody(req.stream, MAX_JSON_BYTES);
  let b; try { b = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Neplatný požadavek.'); }
  const id = String(b.id || '');
  if (!UUID.test(id)) throw new HttpError(400, 'Neplatný požadavek.');
  const rows = await dbSelect(`id=eq.${id}&select=*&limit=1`);
  const row = rows[0];
  if (!row || !tokenOk(b.token, row.finalize_hash)) throw new HttpError(403, 'Nepovolený požadavek.');
  if (row.status !== 'rozpracovano') return { status: 200, body: { ok: true } };          // už dokončeno (opakované volání)
  const files = (await listFiles(id) || []).map((f) => f.name).filter((n) => /^\d{1,2}\.jpg$/.test(n)).sort((a, c) => parseInt(a, 10) - parseInt(c, 10));
  const paths = files.map((n) => `${id}/${n}`);
  const now = new Date().toISOString();
  await dbPatch(id, { status: 'nova', photo_paths: paths, status_changed_at: now });
  const notified = await notifyMake({ ...row, created_at: row.created_at }, paths.length);
  if (notified) await dbPatch(id, { notified: true }).catch(() => {});
  return { status: 200, body: { ok: true, fotek: paths.length } };
}

// ---------- POST /api/poptavka („Mám zájem“ pod nabídkou) ----------
async function poptavka(req) {
  const raw = await readBody(req.stream, MAX_JSON_BYTES);
  let b; try { b = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Neplatný požadavek.'); }
  if (b.web) return { status: 200, body: { ok: true } };                                   // honeypot
  if (!(Number(b.otevreno) > 0) || Date.now() - Number(b.otevreno) < MIN_FILL_MS) throw new HttpError(400, 'Formulář byl odeslán příliš rychle. Zkuste to prosím znovu.');

  const d = { name: clean(b.jmeno, 100), phone: clean(b.telefon, 30), email: clean(b.email, 120).toLowerCase(), message: clean(b.zprava, 2000) };
  const err = [];
  if (d.name.length < 2) err.push('jmeno');
  if (!/^[+0-9 ()-]{7,30}$/.test(d.phone)) err.push('telefon');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) err.push('email');
  if (!(b.souhlas === true || b.souhlas === 'on' || b.souhlas === 'true')) err.push('souhlas');
  if (err.length) return { status: 422, body: { ok: false, chyby: err } };

  if (!(await verifyTurnstile(b.turnstile, req.ip))) throw new HttpError(403, 'Ověření proti spamu selhalo. Obnovte stránku a zkuste to znovu.');

  const hook = env('MAKE_WEBHOOK_URL_ZAJEMCE');
  if (!hook) throw new HttpError(500, 'Chybí konfigurace odesílání.');

  const ipHash = sha256(env('IP_SALT', 'dev') + '|inq|' + (req.ip || '')).slice(0, 32);
  const since = encodeURIComponent(new Date(Date.now() - 3600 * 1000).toISOString());
  const mine = await evSelect(`ip_hash=eq.${ipHash}&created_at=gte.${since}&select=ip_hash&limit=${INQUIRY_PER_HOUR + 1}`);
  if (mine.length >= INQUIRY_PER_HOUR) throw new HttpError(429, 'Příliš mnoho odeslání. Zkuste to později, nebo nám zavolejte.');
  const all = await evSelect(`created_at=gte.${since}&select=ip_hash&limit=${GLOBAL_PER_HOUR + 1}`);
  if (all.length >= GLOBAL_PER_HOUR) throw new HttpError(503, 'Služba je dočasně přetížená. Zavolejte nám prosím.');
  await evInsert({ ip_hash: ipHash });

  let ok = false;
  try {
    const r = await fetch(hook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        projekt: env('PROJECT', 'pronajemzapad'), formular: 'zajemce', jmeno: d.name, telefon: d.phone, email: d.email, zprava: d.message,
        nabidka_id: clean(b.nabidka_id, 80), nabidka: clean(b.nabidka, 200), nabidka_url: clean(b.nabidka_url, 300), kontakt: clean(b.kontakt, 80),
        souhlas: 'on', zdroj: clean(b.zdroj, 200), odeslano: new Date().toISOString(),
      }),
    });
    ok = r.ok;
  } catch (e) { console.error('Make webhook (zájemce) selhal:', e.message); }
  if (!ok) throw new HttpError(502, 'Odeslání se nepovedlo. Zavolejte nám prosím.');
  return { status: 200, body: { ok: true } };
}

async function handlePoptavka(req) {
  try {
    if (!sameOrigin(req.headers)) throw new HttpError(403, 'Nepovolený původ požadavku.');
    if (req.method !== 'POST') throw new HttpError(405, 'Metoda není povolena.');
    return await poptavka(req);
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { ok: false, chyba: e.message } };
    console.error(e);
    return { status: 500, body: { ok: false, chyba: 'Nastala chyba. Zavolejte nám prosím.' } };
  }
}

async function handlePodklady(req) {
  try {
    if (!sameOrigin(req.headers)) throw new HttpError(403, 'Nepovolený původ požadavku.');
    const akce = req.query.get('akce') || '';
    if (req.method === 'PUT' && akce === 'foto') return await nahrat(req);
    if (req.method === 'POST') {
      // akce je v těle (zahájit/dokončit); rozlišíme podle query, aby šlo tělo číst jen jednou
      if (akce === 'dokoncit') return await dokoncit(req);
      return await zahajit(req);
    }
    throw new HttpError(405, 'Metoda není povolena.');
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { ok: false, chyba: e.message } };
    console.error(e);
    return { status: 500, body: { ok: false, chyba: 'Nastala chyba. Zavolejte nám prosím.' } };
  }
}

// ---------- /api/cleanup (denní cron) ----------
async function handleCleanup(req) {
  try {
    const secret = env('CRON_SECRET');
    if (!secret) throw new HttpError(500, 'Chybí CRON_SECRET.');
    if (req.headers.authorization !== 'Bearer ' + secret) throw new HttpError(401, 'Neautorizováno.');
    const out = {};
    for (const [status, days] of Object.entries(RETENTION_DAYS)) {
      if (!days) continue;
      const cutoff = encodeURIComponent(new Date(Date.now() - days * 86400 * 1000).toISOString());
      const col = status === 'rozpracovano' ? 'created_at' : 'status_changed_at';
      const old = await dbSelect(`status=eq.${status}&${col}=lt.${cutoff}&select=id&limit=200`);
      for (const { id } of old) {
        const files = (await listFiles(id) || []).map((f) => `${id}/${f.name}`);
        await removeFiles(files);
        await dbDelete(id);
      }
      out[status] = old.length;
    }
    await evPurge(new Date(Date.now() - 86400 * 1000).toISOString());                    // záznamy pro omezení počtu odeslání
    return { status: 200, body: { ok: true, smazano: out } };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { ok: false, chyba: e.message } };
    console.error(e);
    return { status: 500, body: { ok: false } };
  }
}

module.exports = { handlePodklady, handlePoptavka, handleCleanup, RETENTION_DAYS, MAX_PHOTOS, MAX_PHOTO_BYTES };
