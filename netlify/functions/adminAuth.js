/**
 * TamilPSD — Admin Auth v6
 * Generates a time-based HMAC token from ADMIN_PASSWORD
 * Works for BOTH main site AND separate admin panel
 */
const crypto = require('crypto');

function getCorsOrigin(event) {
  const adminOrigin = process.env.ADMIN_ORIGIN || 'https://www.tamilpsd.in';
  const origin = event.headers?.origin || '';
  const allowed = [adminOrigin, 'https://www.tamilpsd.in', 'https://tamilpsd.in'];
  if (allowed.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
  return adminOrigin;
}

exports.handler = async (event) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(event),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { password } = body;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminPass) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ADMIN_PASSWORD not set in Netlify env vars' }) };
  if (!password || password !== adminPass) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const win = Math.floor(Date.now() / 600000);
  const token = crypto
    .createHmac('sha256', adminPass)
    .update(win.toString())
    .digest('hex')
    .slice(0, 32);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ token, expires_in: 600 }),
  };
};
