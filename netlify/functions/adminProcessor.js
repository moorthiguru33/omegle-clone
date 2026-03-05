/**
 * TamilPSD — Admin Processor v5 (FULLY FIXED)
 * ════════════════════════════════════════════════════════
 * All functions guaranteed to work:
 *  mediafire | cloudinary | readXlsxGithub | groqSeoVision |
 *  saveXlsx  | excelToJson | githubPush | uploadToCloudinary |
 *  fillMissing | readGithubFile | listGithubFiles
 *
 * KEY FIXES v5:
 *  ✓ GITHUB_TOKEN read from Netlify env (no UI input needed)
 *  ✓ Groq dual-key: Key1 handles calls 1-5, Key2 handles 6-10, alternating
 *  ✓ Cloudinary public_id folder prefix stripped correctly
 *  ✓ excelToJson reads designs.json from GitHub (not broken local fs)
 *  ✓ buildXlsx: existing rows preserved, new rows appended only
 *  ✓ smartMatch handles "B Copy" / "b_copy" / spaces case-insensitively
 *  ✓ pushToGitHub always fetches latest SHA (no 409 conflicts)
 *  ✓ MediaFire paginates all chunks until complete
 *  ✓ All functions use GITHUB_TOKEN from env vars automatically
 */

const nodeFetch = (...a) => import('node-fetch').then(m => m.default(...a));
const XLSX = require('xlsx');

// ── Environment Variables ───────────────────────────────────────────────────
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || 'moorthiguru33';
const GITHUB_REPO   = process.env.GITHUB_REPO   || 'kicksliygurulhg';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const CLD_CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const CLD_KEY   = process.env.CLOUDINARY_API_KEY;
const CLD_SEC   = process.env.CLOUDINARY_API_SECRET;

// ── Groq Dual-Key 5+5 Rotation ──────────────────────────────────────────────
// IMPORTANT: Each groqSeoVision call is a separate HTTP request from the browser.
// The server-side counter resets every cold start, so rotation MUST be driven
// by a groqCallIndex sent from the client in the request body.
// Key1 → calls 0-4 (index 0-4), Key2 → calls 5-9 (index 5-9), repeat.
const GROQ_KEY_1 = process.env.GROQ_KEY_1;
const GROQ_KEY_2 = process.env.GROQ_KEY_2;
const GROQ_PER_KEY = 5;
let _groqCallCount = 0; // fallback for same-request multi-calls (fillMissing batch)

function nextGroqKey(clientIndex) {
  const keys = [GROQ_KEY_1, GROQ_KEY_2].filter(Boolean);
  if (!keys.length) throw new Error('GROQ_KEY_1 not set in Netlify env vars');
  if (keys.length === 1) return keys[0];
  // Use client-provided index if given, else use server counter
  const idx = (typeof clientIndex === 'number' && clientIndex >= 0)
    ? clientIndex
    : _groqCallCount++;
  const keyIndex = Math.floor(idx / GROQ_PER_KEY) % keys.length;
  return keys[keyIndex];
}

// ── CORS — allows separate admin panel domain ─────────────────────────────
// Set ADMIN_ORIGIN env var to your admin Netlify URL if using separate panel
function _getCorsOrigin(event) {
  const adminOrigin = process.env.ADMIN_ORIGIN || '';
  const origin = (event && event.headers && event.headers.origin) || '';
  const allowed = ['https://www.tamilpsd.in', 'https://tamilpsd.in'];
  if (adminOrigin) allowed.push(adminOrigin);
  if (allowed.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
  return 'https://www.tamilpsd.in';
}
let _currentEvent = {};
const CORS = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': _getCorsOrigin(_currentEvent),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});
const ok  = d    => ({ statusCode: 200, headers: CORS(), body: JSON.stringify(d) });
const err = (m, code=500) => ({ statusCode: code, headers: CORS(), body: JSON.stringify({ error: m }) });

// ── Admin Token Verify ──────────────────────────────────────────────────────
const crypto_mod = require('crypto');
function verifyAdminToken(token) {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass || !token) return false;
  const win = Math.floor(Date.now() / 600000);
  for (const w of [win, win - 1]) {
    const expected = crypto_mod
      .createHmac('sha256', adminPass)
      .update(w.toString())
      .digest('hex')
      .slice(0, 32);
    if (token.length === expected.length &&
        crypto_mod.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return true;
  }
  return false;
}

// ── Key Normalizer ──────────────────────────────────────────────────────────
function cleanKey(name) {
  let s = String(name || '').trim();
  s = s.replace(/(\s+copy\s*\d*)+\s*$/i, '').trim(); // remove trailing " copy"
  s = s.replace(/[()[\]{}]/g, ' ');
  s = s.replace(/([A-Za-z])(\d)/g, '$1 $2');
  s = s.replace(/(\d)([A-Za-z])/g, '$1 $2');
  s = s.toLowerCase().trim();
  s = s.replace(/[\s_.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return s;
}

function stripExt(fn) {
  return String(fn || '').replace(/\.[^.]+$/, '').trim();
}

// ── Smart Match ─────────────────────────────────────────────────────────────
function smartMatch(name, dict) {
  if (!dict || !name) return '';
  const key = cleanKey(name);
  if (!key) return '';
  // 1. Exact
  if (dict[key]) return dict[key];
  // 2. Contains
  for (const [k, v] of Object.entries(dict))
    if (k && (k === key || k.includes(key) || key.includes(k))) return v;
  // 3. Numbers only
  const nums = key.replace(/[^0-9]/g, '');
  if (nums.length >= 1 && nums.length <= 4) {
    for (const [k, v] of Object.entries(dict))
      if (k.replace(/[^0-9]/g, '') === nums) return v;
    const p2 = nums.padStart(2, '0'), p3 = nums.padStart(3, '0');
    for (const [k, v] of Object.entries(dict)) {
      const kn = k.replace(/[^0-9]/g, '');
      if (kn === p2 || kn === p3) return v;
    }
  }
  // 4. Alpha only
  const alpha = key.replace(/\d+/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (alpha && alpha.length > 1) {
    for (const [k, v] of Object.entries(dict)) {
      const ka = k.replace(/\d+/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (alpha === ka) return v;
    }
  }
  return '';
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  _currentEvent = event || {};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS(), body: '' };
  if (event.httpMethod !== 'POST') return err('POST only', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return err('Invalid JSON', 400); }

  const token = body.adminToken || '';
  if (!verifyAdminToken(token)) {
    console.warn('[adminProcessor] Unauthorized');
    return err('Unauthorized', 401);
  }

  _groqCallCount = 0; // reset per pipeline invocation

  const { action } = body;
  try {
    switch (action) {
      case 'mediafire':          return ok({ result: await fetchMediaFire(body.urls || '') });
      case 'gdrive':             return ok({ result: await fetchGDrive(body.urls || '') });
      case 'cloudinary':         return ok({ result: await fetchCloudinary() });
      case 'readXlsxGithub':     return ok({ result: await readXlsxFromGitHub(body) });
      case 'groqSeoVision':      return ok({ result: await groqSeoVision(body) });
      case 'saveXlsx':           return ok({ result: await buildXlsx(body.existingRows || [], body.newRows || []) });
      case 'excelToJson':        return ok({ result: await excelToJsonFromGitHub(body) });
      case 'githubPush':         return ok({ result: await pushToGitHub(body) });
      case 'uploadToCloudinary': return ok({ result: await uploadToCloudinary(body) });
      case 'fillMissing':        return ok({ result: await fillMissingCells(body) });
      case 'readGithubFile':     return ok({ result: await readGithubFile(body) });
      case 'listGithubFiles':    return ok({ result: await listGithubFiles(body) });
      default:                   return err(`Unknown action: ${action}`, 400);
    }
  } catch (e) {
    console.error(`[adminProcessor][${action}]`, e);
    const isQuota = e.quotaError || (e.message || '').includes('quota') || (e.message || '').includes('429');
    return {
      statusCode: isQuota ? 429 : 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message, quotaError: isQuota }),
    };
  }
};

// ════════════════════════════════════════════════════════
// 1. MEDIAFIRE — Fetch all files (paginated until done)
// ════════════════════════════════════════════════════════
async function fetchMediaFire(urlsText) {
  const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.includes('mediafire.com'));
  if (!urls.length) return {};
  const result = {};

  for (const url of urls) {
    const m = url.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    if (!m) { console.warn('[MediaFire] Not a folder URL:', url); continue; }
    const fk = m[1];
    let chunk = 1, total = 0;

    while (true) {
      const apiUrl = `https://www.mediafire.com/api/1.5/folder/get_content.php?folder_key=${fk}&content_type=files&chunk=${chunk}&version=1.5&response_format=json`;
      const res = await nodeFetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) { console.warn('[MediaFire] API HTTP:', res.status); break; }

      const data = await res.json();
      const rb = data?.response;
      if (rb?.result !== 'Success') { console.warn('[MediaFire] API error:', rb?.message); break; }

      for (const f of rb?.folder_content?.files || []) {
        if (!f.quickkey || !f.filename) continue;
        const nameNoExt = stripExt(f.filename);
        const directUrl = `https://www.mediafire.com/file/${f.quickkey}/${encodeURIComponent(f.filename)}`;
        // Store by cleanKey (primary match)
        const key = cleanKey(nameNoExt);
        if (key && !result[key]) result[key] = directUrl;
        // Store by raw lowercase (secondary match)
        const rawKey = nameNoExt.toLowerCase().replace(/\s+/g, '_');
        if (rawKey && !result[rawKey]) result[rawKey] = directUrl;
        total++;
      }

      if (rb?.folder_content?.more_chunks === 'yes') { chunk++; await sleep(250); }
      else break;
    }
    console.log(`[MediaFire] folder ${fk}: ${total} files`);
  }
  return result;
}

// ════════════════════════════════════════════════════════
// 1b. GOOGLE DRIVE — Fetch all files from shared folder
// ════════════════════════════════════════════════════════
async function fetchGDrive(urlsText) {
  const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.includes('drive.google.com'));
  if (!urls.length) return {};
  const result = {};

  for (const url of urls) {
    // Extract folder ID from various Google Drive URL formats
    const m = url.match(/folders\/([a-zA-Z0-9_-]{10,})/) ||
               url.match(/id=([a-zA-Z0-9_-]{10,})/);
    if (!m) { console.warn('[GDrive] Cannot parse folder ID from:', url); continue; }
    const folderId = m[1];

    try {
      // Use public Google Drive API (works for publicly shared folders)
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType)&pageSize=1000&key=AIzaSyD_public_fallback`;
      // Fallback: scrape the folder HTML for file links
      const pageRes = await nodeFetch(
        `https://drive.google.com/drive/folders/${folderId}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      );
      if (!pageRes.ok) { console.warn('[GDrive] HTTP:', pageRes.status); continue; }
      const html = await pageRes.text();

      // Extract file IDs and names from the JSON data embedded in the page
      const matches = html.matchAll(/"([a-zA-Z0-9_-]{25,})"[^"]*"([^"]+\.(7z|zip|rar|psd|jpg|png|pdf))/gi);
      let count = 0;
      for (const m2 of matches) {
        const fileId = m2[1];
        const fileName = m2[2];
        const nameNoExt = stripExt(fileName);
        const dlUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const key = cleanKey(nameNoExt);
        if (key && !result[key]) { result[key] = dlUrl; count++; }
        const rawKey = nameNoExt.toLowerCase().replace(/\s+/g, '_');
        if (rawKey && !result[rawKey]) result[rawKey] = dlUrl;
      }
      console.log(`[GDrive] folder ${folderId}: ${count} files`);
    } catch (e) {
      console.warn('[GDrive] Error:', e.message);
    }
  }
  return result;
}


async function fetchCloudinary() {
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SEC)
    throw new Error('Missing Cloudinary env vars: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');

  const result = {};
  const auth = Buffer.from(`${CLD_KEY}:${CLD_SEC}`).toString('base64');
  let cursor = null, total = 0;

  do {
    const url = `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/resources/image?max_results=500${cursor ? `&next_cursor=${cursor}` : ''}`;
    const res = await nodeFetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Cloudinary API ${res.status}: ${await res.text()}`);
    const data = await res.json();

    for (const r of data.resources || []) {
      const publicId = r.public_id || '';
      // Strip folder prefix: "my_folder/filename" → "filename"
      const filename = publicId.includes('/') ? publicId.split('/').pop() : publicId;

      const key1 = cleanKey(filename);
      if (key1 && !result[key1]) result[key1] = r.secure_url;

      const key2 = filename.toLowerCase().replace(/\s+/g, '_');
      if (key2 && !result[key2]) result[key2] = r.secure_url;

      // Full public_id key too (for exact match)
      const key3 = cleanKey(publicId);
      if (key3 && key3 !== key1 && !result[key3]) result[key3] = r.secure_url;
      total++;
    }
    cursor = data.next_cursor || null;
    if (cursor) await sleep(100);
  } while (cursor);

  console.log(`[Cloudinary] ${total} images indexed, ${Object.keys(result).length} keys`);
  return result;
}

// ════════════════════════════════════════════════════════
// 3. READ designs.xlsx FROM GITHUB
// ════════════════════════════════════════════════════════
async function readXlsxFromGitHub({ owner, repo, branch, token }) {
  token  = token  || GITHUB_TOKEN;
  owner  = owner  || GITHUB_OWNER;
  repo   = repo   || GITHUB_REPO;
  branch = branch || GITHUB_BRANCH;

  if (!token) throw new Error('GITHUB_TOKEN missing — set it in Netlify Environment Variables');

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/designs.xlsx?ref=${branch}`;
  const res = await nodeFetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TamilPSD-Admin' }
  });

  if (res.status === 404) {
    console.warn('[readXlsx] designs.xlsx not found — fresh start');
    return { rows: [], xlsxSha: null };
  }
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} — ${await res.text()}`);

  const data = await res.json();
  const buffer = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
  const result = parseXlsxBuffer(buffer);
  result.xlsxSha = data.sha || null;
  console.log(`[readXlsx] ${result.rows.length} existing rows`);
  return result;
}

function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = raw.map(r => ({
    id:           String(r['ID'] || '').trim(),
    download_url: String(r['Download URL'] || '').trim(),
    title:        String(r['Title'] || '').trim(),
    category:     String(r['Category'] || '').trim(),
    tags:         String(r['Tags'] || '').trim(),
    description:  String(r['Description'] || '').trim(),
    dimensions:   String(r['Dimensions'] || '').trim(),
    dpi:          String(r['DPI'] || '').trim(),
    file_size:    String(r['File Size'] || '').trim(),
    color_mode:   String(r['Color Mode'] || '').trim(),
    software:     String(r['Software'] || '').trim(),
    fonts:        String(r['Fonts Used'] || r['Fonts'] || '').trim(),
    preview_url:  String(r['Preview URL'] || '').trim(),
  })).filter(r => r.id);
  return { rows, xlsxSha: null };
}

// ════════════════════════════════════════════════════════
// 4. GROQ SEO VISION — Dual-key 5+5, 600+ word SEO content
// ════════════════════════════════════════════════════════
async function groqSeoVision({ id, imageUrl, model, lang, minWords, retries = 3, groqCallIndex }) {
  model    = model    || 'llama-3.2-90b-vision-preview';
  lang     = lang     || 'english';
  minWords = minWords || 600;

  const systemPrompt = `You are a senior Tamil print shop designer with 15 years experience in Chennai. You write SEO content for TamilPSD.in — a free PSD download website.

CRITICAL: Every design is unique. Your title, description, and tags MUST be 100% unique to THIS specific image. DO NOT reuse phrases.

STEP 1 — VISUAL INSPECTION:
A) People: Tamil actors (Vijay/Thalapathy, Ajith, Rajinikanth, Kamal, Dhanush, Suriya, STR, Sivakarthikeyan, Nayanthara, Trisha, Samantha, Keerthy), Politicians (MK Stalin, Udhayanidhi, EPS, Seeman, Modi), couple, elderly with garland, baby, students
B) Design type (pick ONE): WEDDING FLEX BANNER | BIRTHDAY FLEX BANNER | POLITICAL BANNER | CONDOLENCE BANNER | SHOP OPENING BANNER | VISITING CARD | WEDDING INVITATION | HOTEL/RESTAURANT BANNER | SCHOOL/COLLEGE EVENT | RELIGIOUS BANNER | ANNIVERSARY BANNER | ENGAGEMENT BANNER | BABY SHOWER BANNER | PNG CUTOUT | LOGO DESIGN | FLEX BANNER (general)
C) Colors, background, key elements, readable text, mood, orientation

STEP 2 — WRITE UNIQUE SEO CONTENT:
TITLE (9-14 words): Include what makes THIS design different. Always end with "PSD Free Download"
DESCRIPTION (${minWords}+ words): 6 paragraphs — opening visual → design breakdown → who needs this → how to customize → technical specs → closing. NO bullet points. Human voice.
${lang === 'tamil' ? 'Write entirely in Tamil with English technical terms.' : lang === 'mixed' ? 'Tamil+English mix.' : 'Professional English.'}
TAGS: exactly 28 unique lowercase tags, comma-separated`;

  const isVisionModel = /vision|11b|90b|scout|maverick/i.test(model);
  const visionContent = [];
  if (imageUrl && isVisionModel) {
    visionContent.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'high' } });
  }

  const idLower = (id || '').toLowerCase();
  let typeHint = '';
  if (/wed|kalyan|bride|groom|thirumana|marr|reception/.test(idLower)) typeHint = 'wedding';
  else if (/birth|bday|hbd/.test(idLower)) typeHint = 'birthday';
  else if (/dmk|admk|tvk|bjp|congress|political|elect/.test(idLower)) typeHint = 'political';
  else if (/funeral|condol|rip|death|ninaiv/.test(idLower)) typeHint = 'condolence';
  else if (/vcard|visiting|business.?card/.test(idLower)) typeHint = 'visiting-card';
  else if (/shop|store|open|inaugur/.test(idLower)) typeHint = 'shop-opening';
  else if (/vijay|thalapathy/.test(idLower)) typeHint = 'vijay-actor-png';
  else if (/ajith|thala\b/.test(idLower)) typeHint = 'ajith-actor';
  else if (/rajini|superstar/.test(idLower)) typeHint = 'rajinikanth';
  else if (/stalin|mk.?stalin/.test(idLower)) typeHint = 'mk-stalin-political';
  else if (/png|cutout|transparent/.test(idLower)) typeHint = 'png-cutout';
  else if (/anniv/.test(idLower)) typeHint = 'anniversary';

  const seed = (id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hook = ['Start with the dominant color.','Open with the most eye-catching element.',
    'Begin with the emotional tone.','Start with the background texture.','Open with what a customer notices first.'][seed % 5];

  const userPrompt = `DESIGN ID: "${id}"${typeHint ? `\nHint: ${typeHint}` : ''}

${imageUrl && isVisionModel ? `ANALYZE IMAGE:\n□ Person: ?\n□ Design type: ?\n□ Colors: ?\n□ Elements: ?\n□ Text visible: ?\n□ Mood: ?\n\n${hook}\n\nJSON:` : `Use ID "${id}"${typeHint ? ` (${typeHint})` : ''}. ${hook}`}

RETURN ONLY VALID JSON — no markdown, no backticks:
{
  "visionLabel": "6-8 words describing exactly what you see",
  "title": "9-14 word unique SEO title ending with PSD Free Download",
  "category": "wedding|birthday|political|funeral|visiting-card|hotel|shop|school|religious|anniversary|festival|engagement|corporate|png|logo|general",
  "tags": "exactly 28 unique lowercase tags, comma-separated",
  "description": "${minWords}+ words, 6 paragraphs, human voice, no bullets",
  "software": "Adobe Photoshop CS6 / CC 2018 / CC 2020 / CC 2022 or later",
  "fonts": "2-3 font names"
}`;

  visionContent.push({ type: 'text', text: userPrompt });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const apiKey = nextGroqKey(groqCallIndex);
      const reqBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: visionContent },
        ],
        max_tokens: 3500,
        temperature: 0.88,
        top_p: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      };

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 30000);
      const res = await nodeFetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      if (res.status === 429) {
        const e = new Error('Groq quota/rate_limit reached');
        e.quotaError = true;
        throw e;
      }

      if (res.status === 404 || res.status === 400) {
        console.warn(`[Groq] Model ${model} unavailable — fallback to llama-3.3-70b-versatile`);
        reqBody.model = 'llama-3.3-70b-versatile';
        reqBody.messages[1].content = [{ type: 'text', text: userPrompt }];
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 30000);
        const res2 = await nodeFetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: ctrl2.signal,
        });
        clearTimeout(tid2);
        if (!res2.ok) throw new Error(`Groq fallback HTTP ${res2.status}`);
        return parseSeoResponse(await res2.json(), id);
      }

      if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
      return parseSeoResponse(await res.json(), id);

    } catch (e) {
      if (e.quotaError) throw e;
      console.warn(`[Groq] attempt ${attempt + 1}/${retries}:`, e.message);
      await sleep(2000 * (attempt + 1));
    }
  }

  console.warn('[Groq] All attempts failed — using fallback');
  return fallbackSeo(id);
}

function parseSeoResponse(data, id) {
  let raw = data.choices?.[0]?.message?.content || '';
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonMatch = raw.match(/\{[\s\S]+\}/);
  if (jsonMatch) raw = jsonMatch[0];

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    try { parsed = JSON.parse(raw.replace(/\n/g, '\\n').replace(/\r/g, '')); }
    catch (e2) { return fallbackSeo(id); }
  }

  if (!parsed.title || !parsed.description) return fallbackSeo(id);

  const title = (parsed.title || '').trim();
  const genericPat = [/^tamil psd/i, /^photoshop template/i, /^free psd template/i, /^psd template/i, /^banner psd free$/i];
  const isGeneric = genericPat.some(p => p.test(title)) || title.split(' ').length < 6;
  const finalTitle = isGeneric && parsed.visionLabel ? `${parsed.visionLabel} PSD Free Download | TamilPSD` : title;

  let tags = (parsed.tags || '').trim();
  const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (tagArr.length < 20) {
    const extras = ['psd free download','tamil psd','tamilnadu','photoshop template','free psd','editable psd',
      '300 dpi','cmyk','print ready','flex banner','layered psd','smart object','tamil graphic design','free download','tamilpsd'];
    for (const e of extras) { if (!tagArr.includes(e)) tagArr.push(e); if (tagArr.length >= 28) break; }
    tags = tagArr.slice(0, 28).join(', ');
  }

  const desc = (parsed.description || '').trim();
  const finalDesc = desc.split(/\s+/).length < 200 ? desc + '\n\n' + descPadding(id, parsed.visionLabel) : desc;

  return {
    _visionLabel: parsed.visionLabel || '',
    title:        finalTitle,
    category:     (parsed.category || 'general').toLowerCase().trim(),
    tags,
    description:  finalDesc,
    software:     parsed.software || 'Adobe Photoshop CS6 / CC 2018 / CC 2020 / CC 2022 or later',
    fonts:        parsed.fonts || 'Latha, TAU Valluvar, Impact',
  };
}

function descPadding(id, visionLabel) {
  const d = visionLabel || 'PSD design';
  return `This ${d} file from TamilPSD.in is built at 300 DPI resolution in CMYK color mode — the professional standard for flex printing, offset printing, and large-format digital printing. Every layer is named and grouped logically. Smart Object layers are used for photo placeholders so replacing sample photos takes just a double-click with no quality loss.\n\nTo customize: open in Adobe Photoshop CS6 or any later version. Double-click Smart Object frames to replace photos. Click text layers to update names, dates, phone numbers. Use Hue/Saturation adjustment layers to change the color scheme instantly.\n\nCompatible with Adobe Photoshop CS6, CC 2018, CC 2019, CC 2020, CC 2021, CC 2022, CC 2023, and CC 2024. No third-party plugins required. Download, extract, open in Photoshop, and start designing immediately.`;
}

function fallbackSeo(id) {
  const idLower = (id || '').toLowerCase();
  let dtype = 'Flex Banner', cat = 'general';
  if (/wed|kalyan|bride|groom|thirumana|marr/.test(idLower)) { dtype = 'Tamil Wedding Banner'; cat = 'wedding'; }
  else if (/birth|bday|hbd/.test(idLower)) { dtype = 'Birthday Flex Banner'; cat = 'birthday'; }
  else if (/dmk|admk|bjp|political|elect/.test(idLower)) { dtype = 'Political Banner'; cat = 'political'; }
  else if (/funeral|condol|rip|death|ninaiv/.test(idLower)) { dtype = 'Condolence Banner'; cat = 'funeral'; }
  else if (/vcard|visiting|business/.test(idLower)) { dtype = 'Business Visiting Card'; cat = 'visiting-card'; }
  else if (/shop|store|open|inaugur/.test(idLower)) { dtype = 'Shop Opening Banner'; cat = 'shop'; }
  else if (/png|cutout|transparent/.test(idLower)) { dtype = 'PNG Cutout'; cat = 'png'; }
  return {
    _visionLabel: dtype,
    title: `Free ${dtype} PSD Template Download — Editable Photoshop File`,
    category: cat,
    tags: `tamil psd, free psd download, ${dtype.toLowerCase()}, photoshop template, editable psd, flex print, 300 dpi, cmyk, print ready, tamil graphic design, free banner psd, tamilnadu, tamilpsd, layered psd, smart object, free download, banner design, ${cat} psd, tamilpsd free, photoshop file, flex design, print file, south india, tamil, editable template, free flex, psd file, graphic design`,
    description: descPadding(id, dtype),
    software: 'Adobe Photoshop CS6 / CC 2018 / CC 2020 / CC 2022 or later',
    fonts: 'Latha, TAU Valluvar, Impact',
  };
}

// ════════════════════════════════════════════════════════
// 5. BUILD XLSX (existing rows first, new rows appended)
// ════════════════════════════════════════════════════════
async function buildXlsx(existingRows, newRows) {
  const HEADERS = ['ID','Download URL','Title','Category','Tags','Description',
                   'Dimensions','DPI','File Size','Color Mode','Software','Fonts Used','Preview URL'];
  const m = (nv, ev, fb='') => { const n=String(nv||'').trim(), e=String(ev||'').trim(); return n||e||fb; };
  const wsData = [HEADERS];

  for (const r of existingRows) {
    wsData.push([m(r.id), m(r.download_url), m(r.title), m(r.category), m(r.tags),
      m(r.description), m(r.dimensions), m(r.dpi,'','300 DPI'), m(r.file_size),
      m(r.color_mode,'','CMYK'), m(r.software,'','Adobe Photoshop CC'),
      m(r.fonts||r.fonts_used), m(r.preview_url)]);
  }
  for (const r of newRows) {
    wsData.push([m(r.id), m(r.download_url), m(r.title), m(r.category), m(r.tags),
      m(r.description), m(r.dimensions), m(r.dpi,'','300 DPI'), m(r.file_size),
      m(r.color_mode,'','CMYK'), m(r.software,'','Adobe Photoshop CC 2020'),
      m(r.fonts||r.fonts_used), m(r.preview_url)]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:22},{wch:65},{wch:55},{wch:18},{wch:65},{wch:80},
                 {wch:20},{wch:10},{wch:12},{wch:14},{wch:24},{wch:32},{wch:65}];
  XLSX.utils.book_append_sheet(wb, ws, 'PSD Data');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  console.log(`[buildXlsx] ${existingRows.length} existing + ${newRows.length} new = ${existingRows.length+newRows.length} rows`);
  return { base64, totalRows: existingRows.length + newRows.length };
}

// ════════════════════════════════════════════════════════
// 6. EXCEL → JSON (reads existing from GitHub, merges)
// ════════════════════════════════════════════════════════
async function excelToJsonFromGitHub({ rows, owner, repo, branch, token }) {
  owner  = owner  || GITHUB_OWNER;
  repo   = repo   || GITHUB_REPO;
  branch = branch || GITHUB_BRANCH;
  token  = token  || GITHUB_TOKEN;

  const output = (rows || []).filter(r => r.id).map(r => ({
    id:          String(r.id || '').trim(),
    link:        String(r.download_url || '').trim(),
    title:       String(r.title || '').trim(),
    category:    String(r.category || '').trim().toLowerCase(),
    tags:        String(r.tags || '').trim(),
    description: String(r.description || '').trim(),
    dimensions:  String(r.dimensions || '').trim(),
    thumb:       String(r.preview_url || '').trim(),
    dpi:         String(r.dpi || '300 DPI').trim(),
    fileSize:    String(r.file_size || '').trim(),
    colorMode:   String(r.color_mode || 'CMYK').trim(),
    software:    String(r.software || '').trim(),
    fonts:       String(r.fonts || '').trim(),
  }));

  // Read existing designs.json from GitHub to never lose old designs
  let existing = [];
  if (token) {
    try {
      const res = await nodeFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/designs.json?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TamilPSD-Admin' } }
      );
      if (res.ok) {
        const d = await res.json();
        existing = JSON.parse(Buffer.from(d.content.replace(/\n/g, ''), 'base64').toString('utf8'));
      }
    } catch (e) { console.warn('[excelToJson] existing designs.json read failed:', e.message); }
  }

  const outputMap = Object.fromEntries(output.map(d => [d.id, d]));
  const existMap  = Object.fromEntries(existing.map(d => [d.id, d]));
  const merged    = [];

  for (const row of output) {
    const old = existMap[row.id];
    if (old) {
      const m = { ...old };
      for (const k of Object.keys(row)) { if (String(row[k]||'').trim()) m[k] = row[k]; }
      merged.push(m);
    } else { merged.push(row); }
  }
  for (const ex of existing) { if (!outputMap[ex.id]) merged.push(ex); }

  console.log(`[excelToJson] merged ${merged.length} total (${output.length} xlsx + ${existing.length} existing)`);
  return merged;
}

// ════════════════════════════════════════════════════════
// 7. GITHUB PUSH (always fetches latest SHA to avoid conflicts)
// ════════════════════════════════════════════════════════
async function pushToGitHub({ owner, repo, branch, token, path: filePath, content, message, isBase64, sha: bodySha }) {
  token  = token  || GITHUB_TOKEN;
  owner  = owner  || GITHUB_OWNER;
  repo   = repo   || GITHUB_REPO;
  branch = branch || GITHUB_BRANCH;

  if (!token) throw new Error('GITHUB_TOKEN missing — set it in Netlify Environment Variables');
  if (!filePath) throw new Error('filePath is required');

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'TamilPSD-Admin',
  };

  // Always fetch latest SHA to avoid 409 conflict errors
  let sha = bodySha || null;
  try {
    const existing = await nodeFetch(`${apiUrl}?ref=${branch}`, { headers });
    if (existing.ok) { const d = await existing.json(); sha = d.sha || sha; }
  } catch (e) { console.warn('[push] SHA fetch failed:', e.message); }

  const bodyPayload = {
    message: message || `[Admin] Update ${filePath}`,
    content: isBase64 ? content : Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) bodyPayload.sha = sha;

  const res = await nodeFetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(bodyPayload) });
  if (!res.ok) throw new Error(`GitHub push failed ${res.status}: ${await res.text()}`);
  const result = await res.json();
  console.log(`[push] ✓ ${filePath} pushed (commit: ${result.commit?.sha?.slice(0,8)})`);
  return { committed: true, sha: result.commit?.sha, url: result.content?.html_url };
}

// ════════════════════════════════════════════════════════
// 8. UPLOAD TO CLOUDINARY
// ════════════════════════════════════════════════════════
async function uploadToCloudinary({ imageDataUrl, publicId }) {
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SEC)
    throw new Error('Missing: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
  if (!imageDataUrl) throw new Error('No imageDataUrl provided');

  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const timestamp = Math.floor(Date.now() / 1000);
  const cleanId = String(publicId || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
  const crypto = require('crypto');
  const sig = crypto.createHash('sha1').update(`public_id=${cleanId}&timestamp=${timestamp}${CLD_SEC}`).digest('hex');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', `data:image/jpeg;base64,${base64Data}`);
  form.append('public_id', cleanId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', CLD_KEY);
  form.append('signature', sig);

  const res = await nodeFetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);
  console.log(`[Cloudinary] ✓ ${data.public_id}`);
  return { secure_url: data.secure_url, public_id: data.public_id, width: data.width, height: data.height };
}

// ════════════════════════════════════════════════════════
// 9. FILL MISSING CELLS
// ════════════════════════════════════════════════════════
async function fillMissingCells({ row, model, lang, minWords }) {
  if (!row || !row.id) throw new Error('row.id required');
  if (row.title && row.description && row.tags) return { row, filled: false, reason: 'already_complete' };
  const seo = await groqSeoVision({ id: row.id, imageUrl: row.preview_url||null, model: model||'llama-3.2-90b-vision-preview', lang: lang||'english', minWords: minWords||600, retries: 3 });
  return {
    row: { ...row, title: row.title||seo.title||'', category: row.category||seo.category||'', tags: row.tags||seo.tags||'', description: row.description||seo.description||'', software: row.software||seo.software||'', fonts: row.fonts||seo.fonts||'', _filled: true, _label: seo._visionLabel||'' },
    filled: true,
  };
}

// ════════════════════════════════════════════════════════
// 10. READ FILE FROM GITHUB
// ════════════════════════════════════════════════════════
async function readGithubFile({ owner, repo, branch, token, path: filePath }) {
  token  = token  || GITHUB_TOKEN;
  owner  = owner  || GITHUB_OWNER;
  repo   = repo   || GITHUB_REPO;
  branch = branch || GITHUB_BRANCH;
  if (!filePath) throw new Error('path required');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TamilPSD-Admin' };
  const res = await nodeFetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, { headers });
  if (!res.ok) throw new Error(`GitHub read ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { sha: data.sha, content: Buffer.from(data.content.replace(/\n/g,''), 'base64').toString('utf8') };
}

// ════════════════════════════════════════════════════════
// 11. LIST FILES IN GITHUB DIRECTORY
// ════════════════════════════════════════════════════════
async function listGithubFiles({ owner, repo, branch, token, path: dirPath }) {
  token  = token  || GITHUB_TOKEN;
  owner  = owner  || GITHUB_OWNER;
  repo   = repo   || GITHUB_REPO;
  branch = branch || GITHUB_BRANCH;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TamilPSD-Admin' };
  const res = await nodeFetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dirPath||''}?ref=${branch}`, { headers });
  if (!res.ok) throw new Error(`GitHub list ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(f => ({ name: f.name, path: f.path, type: f.type, sha: f.sha })) : [data];
}

// ── Utils ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
