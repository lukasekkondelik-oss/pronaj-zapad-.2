'use strict';
// Adaptér pro Vercel: formulář „Mám zájem“. Logika je v lib/core.js.
const { handlePoptavka } = require('../lib/core');

module.exports = async (req, res) => {
  const ip = String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim();
  const out = await handlePoptavka({ method: req.method, headers: req.headers, ip, stream: req });
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out.body));
};
