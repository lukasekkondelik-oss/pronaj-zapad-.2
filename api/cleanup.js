'use strict';
const { handleCleanup } = require('../lib/core');

module.exports = async (req, res) => {
  const out = await handleCleanup({ headers: req.headers });
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out.body));
};
