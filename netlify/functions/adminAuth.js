/**
 * TamilPSD — Admin Auth Function v2
 * FIX: Brute force protection — max 5 attempts per IP per 15 minutes
 * Password stored in ADMIN_PASSWORD env var (never in client code)
 */

const crypto  = require('crypto');
const admin   = require('firebase-admin');

const cleanKey = (k) => {
  if (!k) return '';
  let s = k.trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s.replace(/\\n/g, '\n');
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  cleanKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

const db = admin.firestore();

const CORS_fn = (event) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': (() => {
    const adminOrigin = process.env.ADMIN_ORIGIN || '';
    const origin = event?.headers?.origin || '';
    const allowed = ['https://www.tamilpsd.in', 'https://tamilpsd.in'];
    if (adminOrigin) allowed.push(adminOrigin);
    return (allowed.includes(origin) || origin.includes('localhost')) ? origin : 'https://www.tamilpsd.in';
  })(),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_fn(event), body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_fn(event), body: JSON.stringify({ error: 'POST only' }) };

  // Get client IP for rate limiting
  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
          || event.headers?.['client-ip']
          || 'unknown';

  // ── Brute Force Protection ─────────────────────────────────────
  try {
    const windowStart  = new Date(Date.now() - WINDOW_MS);
    const attemptsRef  = db.collection('admin_login_attempts');
    const recentSnap   = await attemptsRef
      .where('ip', '==', ip)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .get();

    if (recentSnap.size >= MAX_ATTEMPTS) {
      console.warn('[adminAuth] Brute force blocked. IP:', ip, '| Attempts:', recentSnap.size);
      return {
        statusCode: 429,
        headers: CORS_fn(event),
        body: JSON.stringify({ error: 'Too many attempts. Try again in 15 minutes.' }),
      };
    }
  } catch (e) { /* skip rate limit on DB error, don't block admin */ }

  // ── Parse body ─────────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: CORS_fn(event), body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { password } = body;

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    console.error('[adminAuth] ADMIN_PASSWORD env var not set!');
    return { statusCode: 500, headers: CORS_fn(event), body: JSON.stringify({ error: 'Admin not configured.' }) };
  }

  // ── Log this attempt (before checking password) ────────────────
  try {
    await db.collection('admin_login_attempts').add({
      ip,
      timestamp:  admin.firestore.FieldValue.serverTimestamp(),
      userAgent:  event.headers?.['user-agent'] || '',
    });
  } catch (e) { /* ignore */ }

  // ── Timing-safe password comparison ───────────────────────────
  let match = false;
  try {
    if (password && password.length === adminPass.length) {
      match = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPass));
    }
  } catch (e) { match = false; }

  if (!match) {
    console.warn('[adminAuth] Failed attempt. IP:', ip);
    return { statusCode: 401, headers: CORS_fn(event), body: JSON.stringify({ error: 'Wrong password' }) };
  }

  // ── Success — clear attempts for this IP ───────────────────────
  try {
    const windowStart = new Date(Date.now() - WINDOW_MS);
    const old = await db.collection('admin_login_attempts')
      .where('ip', '==', ip)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .get();
    const batch = db.batch();
    old.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (e) { /* ignore */ }

  // FIX: No IP in token (Netlify edge nodes differ per call).
  // FIX2: Math.floor(Date.now()/600000) = real 10-min window.
  //       slice(0,-4) was only ~10 seconds — login at :09, API at :11 = different window = 401!
  const token = crypto
    .createHmac('sha256', adminPass)
    .update(Math.floor(Date.now() / 600000).toString())
    .digest('hex')
    .slice(0, 32);

  console.log('[adminAuth] ✅ Admin login success. IP:', ip);
  return { statusCode: 200, headers: CORS_fn(event), body: JSON.stringify({ success: true, token }) };
};
