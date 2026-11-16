'use strict';
// Adaptér pro Vercel. Veškerá logika je v lib/core.js (kvůli případnému přepnutí hostingu).
const { handlePodklady } = require('../lib/core');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim();
  const out = await handlePodklady({ method: req.method, query: url.searchParams, headers: req.headers, ip, stream: req });
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out.body));
};
