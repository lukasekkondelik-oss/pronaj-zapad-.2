'use strict';
// Minimální náhrada Supabase (REST + Storage), webhooku Make a Cloudflare Turnstile pro testy.
const http = require('node:http');

const readAll = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });

function createMock({ key = 'svc' } = {}) {
  const rows = [], files = new Map(), hooks = [];
  let makeDown = false;
  const match = (row, params) => [...params].every(([k, v]) => {
    if (['select', 'limit', 'order'].includes(k)) return true;
    const i = v.indexOf('.'), op = v.slice(0, i), val = v.slice(i + 1);
    const cell = row[k] == null ? '' : String(row[k]);
    return op === 'eq' ? cell === val : op === 'gte' ? cell >= val : op === 'lt' ? cell < val : false;
  });
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), body = await readAll(req);
    const send = (s, o) => { res.statusCode = s; if (o !== undefined) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); } else res.end(); };
    if (u.pathname === '/hook') { if (makeDown) return send(500, {}); hooks.push(JSON.parse(body.toString())); return send(200, { ok: true }); }
    if (u.pathname === '/ts') { const p = new URLSearchParams(body.toString()); return send(200, { success: p.get('response') === 'ok-token' }); }
    if (req.headers.authorization !== 'Bearer ' + key) return send(401, { message: 'unauthorized' });
    if (u.pathname === '/rest/v1/submissions') {
      if (req.method === 'POST') {
        const now = new Date().toISOString();
        rows.push({ created_at: now, status_changed_at: now, photo_paths: [], notified: false, ...JSON.parse(body.toString()) });
        return send(201);
      }
      const hit = rows.filter((r) => match(r, u.searchParams));
      if (req.method === 'GET') {
        const sel = u.searchParams.get('select') || '*', lim = parseInt(u.searchParams.get('limit') || '1000', 10);
        return send(200, hit.slice(0, lim).map((r) => sel === '*' ? r : Object.fromEntries(sel.split(',').map((c) => [c, r[c]]))));
      }
      if (req.method === 'PATCH') { hit.forEach((r) => Object.assign(r, JSON.parse(body.toString()))); return send(204); }
      if (req.method === 'DELETE') { hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return send(204); }
    }
    const up = u.pathname.match(/^\/storage\/v1\/object\/submissions\/(.+)$/);
    if (up && req.method === 'POST' && !u.pathname.includes('/list/')) { files.set(decodeURIComponent(up[1]), body); return send(200, { Key: up[1] }); }
    if (u.pathname === '/storage/v1/object/list/submissions') {
      const { prefix } = JSON.parse(body.toString());
      return send(200, [...files.keys()].filter((p) => p.startsWith(prefix + '/')).map((p) => ({ name: p.slice(prefix.length + 1) })));
    }
    if (u.pathname === '/storage/v1/object/submissions' && req.method === 'DELETE') {
      JSON.parse(body.toString()).prefixes.forEach((p) => files.delete(p)); return send(200, []);
    }
    send(404, { message: 'nenalezeno ' + u.pathname });
  });
  return {
    rows, files, hooks, server,
    setMakeDown: (v) => { makeDown = v; },
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port))),
    close: () => new Promise((r) => server.close(r)),
  };
}
module.exports = { createMock };
