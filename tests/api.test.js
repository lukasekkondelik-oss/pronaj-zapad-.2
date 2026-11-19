'use strict';
// Spuštění: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createMock } = require('./mock-supabase');

const mock = createMock();
let port, core;
const JPEG = (n = 2000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]);
const GOOD = { jmeno: 'Jana Nováková', telefon: '603 111 222', email: 'jana@example.cz', typ: 'Byt', mesto: 'Cheb', souhlas: true, popis: 'Pěkný byt', fotek: 2, otevreno: Date.now() - 10000 };

const call = (method, q, body, headers = {}, ip = '1.2.3.4') => core.handlePodklady({
  method, query: new URLSearchParams(q), ip, headers: { host: 'localhost', ...headers },
  stream: Readable.from(body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))]),
});
async function start(over = {}) {
  const r = await call('POST', '', { ...GOOD, ...over }, {}, over.__ip || '9.9.9.' + Math.floor(Math.random() * 250));
  return r;
}

test.before(async () => {
  port = await mock.listen();
  Object.assign(process.env, {
    SUPABASE_URL: 'http://127.0.0.1:' + port, SUPABASE_SERVICE_KEY: 'svc', MAKE_WEBHOOK_URL: `http://127.0.0.1:${port}/hook`, MAKE_WEBHOOK_URL_ZAJEMCE: `http://127.0.0.1:${port}/hook`,
    ALLOW_NO_CAPTCHA: '1', IP_SALT: 'test', CRON_SECRET: 'cron', PUBLIC_URL: 'https://example.cz',
  });
  core = require('../lib/core');
});
test.after(() => mock.close());

test('validace: chybné údaje vrátí 422 se seznamem polí', async () => {
  const r = await start({ jmeno: 'J', telefon: 'abc', email: 'x', souhlas: false });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.chyby.sort(), ['email', 'jmeno', 'souhlas', 'telefon']);
});

test('honeypot: bot dostane „úspěch“, nic se neuloží', async () => {
  const before = mock.rows.length;
  const r = await start({ web: 'http://spam' });
  assert.equal(r.status, 200); assert.equal(mock.rows.length, before);
});

test('časová past: příliš rychlé odeslání je odmítnuto', async () => {
  const r = await start({ otevreno: Date.now() - 500 });
  assert.equal(r.status, 400);
});

test('celý tok: zahájit, nahrát 2 fotky, dokončit, upozornění Make', async () => {
  const hooks0 = mock.hooks.length;
  const s = await start({ jmeno: 'Petr Test' });
  assert.equal(s.status, 200); assert.ok(s.body.id && s.body.token);
  const row = mock.rows.find((x) => x.id === s.body.id);
  assert.equal(row.status, 'rozpracovano');
  assert.notEqual(row.finalize_hash, s.body.token, 'token se neukládá v čitelné podobě');
  for (const n of [2, 1]) {
    const u = await call('PUT', `akce=foto&id=${s.body.id}&n=${n}`, JPEG(), { 'x-token': s.body.token });
    assert.equal(u.status, 200);
  }
  const d = await call('POST', 'akce=dokoncit', { id: s.body.id, token: s.body.token });
  assert.equal(d.status, 200); assert.equal(d.body.fotek, 2);
  assert.equal(row.status, 'nova');
  assert.deepEqual(row.photo_paths, [`${s.body.id}/1.jpg`, `${s.body.id}/2.jpg`]);
  assert.equal(mock.hooks.length, hooks0 + 1);
  const h = mock.hooks.at(-1);
  assert.equal(h.formular, 'majitel'); assert.equal(h.pocet_fotek, 2); assert.equal(h.jmeno, 'Petr Test');
  assert.equal(h.odkaz, `https://example.cz/admin/#${s.body.id}`);
  assert.equal(row.notified, true);
  const again = await call('POST', 'akce=dokoncit', { id: s.body.id, token: s.body.token });
  assert.equal(again.status, 200); assert.equal(mock.hooks.length, hooks0 + 1, 'opakované dokončení neposílá e-mail znovu');
});

test('zneužití nahrávání: špatný token, falešný JPEG, velký soubor, špatné číslo', async () => {
  const s = await start();
  const p = (n, body, token = s.body.token) => call('PUT', `akce=foto&id=${s.body.id}&n=${n}`, body, { 'x-token': token });
  assert.equal((await p(1, JPEG(), 'spatny')).status, 403);
  assert.equal((await p(1, Buffer.from('<?php echo 1; ?>'.repeat(200)))).status, 415);
  assert.equal((await p(1, JPEG(3 * 1024 * 1024))).status, 413);
  assert.equal((await p(13, JPEG())).status, 400);
  assert.equal((await p(0, JPEG())).status, 400);
  assert.equal((await call('PUT', 'akce=foto&id=../../etc&n=1', JPEG(), { 'x-token': 'x' })).status, 400);
  assert.equal(mock.files.has(`${s.body.id}/1.jpg`), false);
});

test('po dokončení už nejde nahrávat další fotky', async () => {
  const s = await start();
  await call('POST', 'akce=dokoncit', { id: s.body.id, token: s.body.token });
  const u = await call('PUT', `akce=foto&id=${s.body.id}&n=1`, JPEG(), { 'x-token': s.body.token });
  assert.equal(u.status, 403);
});

test('dokončení se špatným tokenem je odmítnuto', async () => {
  const s = await start();
  assert.equal((await call('POST', 'akce=dokoncit', { id: s.body.id, token: 'nope' })).status, 403);
});

test('výpadek Make: data se uloží, e-mail se označí jako neodeslaný', async () => {
  mock.setMakeDown(true);
  try {
    const s = await start();
    const d = await call('POST', 'akce=dokoncit', { id: s.body.id, token: s.body.token });
    assert.equal(d.status, 200);
    const row = mock.rows.find((x) => x.id === s.body.id);
    assert.equal(row.status, 'nova'); assert.equal(row.notified, false);
  } finally { mock.setMakeDown(false); }
});

test('omezení počtu odeslání z jedné IP', async () => {
  const ip = '7.7.7.7', codes = [];
  for (let i = 0; i < 7; i++) codes.push((await call('POST', '', { ...GOOD }, {}, ip)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});

test('cizí původ požadavku je odmítnut', async () => {
  const r = await call('POST', '', { ...GOOD }, { origin: 'https://evil.example', host: 'localhost' });
  assert.equal(r.status, 403);
});

test('Turnstile: bez tokenu a se špatným tokenem 403, správný projde, bez konfigurace chyba', async () => {
  const keep = { s: process.env.TURNSTILE_SECRET, a: process.env.ALLOW_NO_CAPTCHA };
  process.env.TURNSTILE_SECRET = 'sekret'; process.env.TURNSTILE_VERIFY_URL = `http://127.0.0.1:${port}/ts`;
  try {
    assert.equal((await start()).status, 403);
    assert.equal((await start({ turnstile: 'bad' })).status, 403);
    assert.equal((await start({ turnstile: 'ok-token' })).status, 200);
    delete process.env.TURNSTILE_SECRET; delete process.env.ALLOW_NO_CAPTCHA;
    assert.equal((await start()).status, 500, 'bez konfigurace se antispam nikdy nevypíná potichu');
  } finally {
    delete process.env.TURNSTILE_VERIFY_URL;
    if (keep.s) process.env.TURNSTILE_SECRET = keep.s; else delete process.env.TURNSTILE_SECRET;
    process.env.ALLOW_NO_CAPTCHA = keep.a;
  }
});

test('cleanup: vyžaduje tajný klíč a maže podle lhůt (i převzaté po 90 dnech)', async () => {
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const seed = (id, status, created, changed) => { mock.rows.push({ id, status, created_at: created, status_changed_at: changed, name: id, photo_paths: [`${id}/1.jpg`] }); mock.files.set(`${id}/1.jpg`, JPEG()); };
  seed('00000000-0000-4000-8000-0000000000a1', 'rozpracovano', daysAgo(2), daysAgo(2));   // smazat
  seed('00000000-0000-4000-8000-0000000000a2', 'rozpracovano', daysAgo(0.1), daysAgo(0.1)); // nechat
  seed('00000000-0000-4000-8000-0000000000b1', 'nova', daysAgo(100), daysAgo(95));          // smazat
  seed('00000000-0000-4000-8000-0000000000b2', 'nova', daysAgo(100), daysAgo(10));          // nechat (nedávný pohyb)
  seed('00000000-0000-4000-8000-0000000000c1', 'v_reseni', daysAgo(120), daysAgo(91));      // smazat
  seed('00000000-0000-4000-8000-0000000000d1', 'zamitnuto', daysAgo(40), daysAgo(31));      // smazat
  seed('00000000-0000-4000-8000-0000000000d2', 'zamitnuto', daysAgo(40), daysAgo(5));       // nechat
  seed('00000000-0000-4000-8000-0000000000e1', 'prevzato', daysAgo(500), daysAgo(95));      // smazat (převzato se maže po 90 dnech)
  seed('00000000-0000-4000-8000-0000000000e2', 'prevzato', daysAgo(500), daysAgo(20));      // nechat
  assert.equal((await core.handleCleanup({ headers: {} })).status, 401);
  assert.equal((await core.handleCleanup({ headers: { authorization: 'Bearer jiny' } })).status, 401);
  const r = await core.handleCleanup({ headers: { authorization: 'Bearer cron' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.smazano.nova, 1); assert.equal(r.body.smazano.v_reseni, 1); assert.equal(r.body.smazano.zamitnuto, 1); assert.equal(r.body.smazano.prevzato, 1);
  const ids = mock.rows.map((x) => x.id);
  for (const gone of ['a1', 'b1', 'c1', 'd1', 'e1']) { assert.ok(!ids.includes(`00000000-0000-4000-8000-0000000000${gone}`), gone); assert.ok(!mock.files.has(`00000000-0000-4000-8000-0000000000${gone}/1.jpg`), gone + ' soubor'); }
  for (const kept of ['a2', 'b2', 'd2', 'e2']) { assert.ok(ids.includes(`00000000-0000-4000-8000-0000000000${kept}`), kept); }
});

// ---------- „Mám zájem“ (/api/poptavka) ----------
const GOODQ = { jmeno: 'Eva Zájemce', telefon: '602 111 222', email: 'eva@example.cz', zprava: 'Chci se přijít podívat', souhlas: 'on', nabidka_id: 'abc-1', nabidka: 'Byt 2+kk', nabidka_url: 'https://example.cz/nabidky/byt/', kontakt: 'Vít Čirik', zdroj: '/nabidky/byt/', otevreno: Date.now() - 10000 };
const ask = (over = {}, ip = '8.8.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250), headers = {}) => core.handlePoptavka({
  method: over.__method || 'POST', headers: { host: 'localhost', ...headers }, ip,
  stream: Readable.from([Buffer.from(JSON.stringify({ ...GOODQ, ...over }))]),
});

test('Mám zájem: platné odeslání předá poptávku do Make ve správném tvaru', async () => {
  const n = mock.hooks.length;
  const r = await ask({ jmeno: 'Eva Test' });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.equal(mock.hooks.length, n + 1);
  const h = mock.hooks.at(-1);
  assert.equal(h.formular, 'zajemce'); assert.equal(h.jmeno, 'Eva Test'); assert.equal(h.email, 'eva@example.cz');
  assert.equal(h.kontakt, 'Vít Čirik'); assert.equal(h.nabidka, 'Byt 2+kk'); assert.equal(h.souhlas, 'on'); assert.equal(h.projekt, 'pronajemzapad');
  assert.ok(Date.parse(h.odeslano) > Date.now() - 60000, 'čas odeslání nastavuje server, ne prohlížeč');
});

test('Mám zájem: validace, honeypot a časová past', async () => {
  const n = mock.hooks.length;
  const bad = await ask({ jmeno: 'E', telefon: 'x', email: 'nic', souhlas: false });
  assert.equal(bad.status, 422); assert.deepEqual(bad.body.chyby.sort(), ['email', 'jmeno', 'souhlas', 'telefon']);
  assert.equal((await ask({ web: 'spam' })).status, 200);
  assert.equal((await ask({ otevreno: Date.now() - 300 })).status, 400);
  assert.equal(mock.hooks.length, n, 'nic z toho se nesmí dostat do Make');
});

test('Mám zájem: omezení počtu odeslání z jedné IP a cizí původ', async () => {
  const ip = '6.6.6.6', codes = [];
  for (let i = 0; i < 7; i++) codes.push((await ask({}, ip)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
  assert.equal((await ask({}, undefined, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await ask({ __method: 'GET' })).status, 405);
});

test('Mám zájem: Turnstile se vyžaduje a výpadek Make vrátí chybu místo tichého ztracení', async () => {
  const keep = process.env.TURNSTILE_SECRET;
  process.env.TURNSTILE_SECRET = 'sekret'; process.env.TURNSTILE_VERIFY_URL = `http://127.0.0.1:${port}/ts`;
  try {
    assert.equal((await ask({})).status, 403);
    assert.equal((await ask({ turnstile: 'ok-token' })).status, 200);
  } finally { delete process.env.TURNSTILE_VERIFY_URL; if (keep) process.env.TURNSTILE_SECRET = keep; else delete process.env.TURNSTILE_SECRET; }
  mock.setMakeDown(true);
  try { assert.equal((await ask({})).status, 502, 'návštěvník se dozví, že se odeslání nepovedlo'); } finally { mock.setMakeDown(false); }
  const keepHook = process.env.MAKE_WEBHOOK_URL_ZAJEMCE; delete process.env.MAKE_WEBHOOK_URL_ZAJEMCE;
  try { assert.equal((await ask({})).status, 500); } finally { process.env.MAKE_WEBHOOK_URL_ZAJEMCE = keepHook; }
});

test('cleanup maže i záznamy pro omezení počtu odeslání starší než den', async () => {
  const old = new Date(Date.now() - 2 * 86400000).toISOString();
  mock.tables.inquiry_events.push({ ip_hash: 'stary', created_at: old }, { ip_hash: 'novy', created_at: new Date().toISOString() });
  const r = await core.handleCleanup({ headers: { authorization: 'Bearer cron' } });
  assert.equal(r.status, 200);
  const left = mock.tables.inquiry_events.map((e) => e.ip_hash);
  assert.ok(!left.includes('stary')); assert.ok(left.includes('novy'));
});
