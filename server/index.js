import express from 'express';
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MODEL = process.env.OCR_MODEL || 'claude-opus-4-7';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const FAMILY_PASSWORD = process.env.FAMILY_PASSWORD || '';
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const BUCKET = process.env.GCS_BUCKET || 'maddysmemories-photos';

const SYSTEM_PROMPT = `You transcribe and structure recipe cards. Many are handwritten, old, faded, stained, or in cursive.

Return JSON with these fields:
- not_a_recipe: true only if the image is clearly not a recipe (a portrait, a landscape, a screenshot, etc.). Otherwise false.
- title: the recipe's title as written (e.g. "Grandma's Apple Pie"). Empty string if no title is visible.
- source: any attribution like "From Aunt Rose, 1962" written on the card. Empty string if absent.
- category: one of breakfast, lunch, dinner, dessert, snacks, drinks, or other. Best guess from the dish.
- prep_time: any cook/prep/bake time written on the card (e.g. "30 min", "Bake 1 hr at 350°"). Empty string if absent.
- ingredients: an array of strings, one ingredient per item, each as written on the card with its quantity and unit (e.g. "1 1/2 cups flour", "3 eggs", "pinch of salt"). Preserve original abbreviations (tsp, T., oz., doz.).
- instructions: an array of strings, one step per item, in order, as written.
- raw_text: the verbatim transcription of the entire card, preserving the original line breaks and visual structure.

Rules for transcription:
- Preserve original spelling and quirks. Do not modernize.
- For a word you genuinely cannot read, write [?] in raw_text and either omit it from ingredients/instructions or include "[?]" in place of the word.
- Do not invent ingredients, steps, quantities, or temperatures.
- If the card has only ingredients (no instructions) or only instructions (no ingredients), still fill the other field as an empty array.

Output JSON only. No commentary, no markdown fences.`;

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    not_a_recipe: { type: 'boolean' },
    title: { type: 'string' },
    source: { type: 'string' },
    category: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'dessert', 'snacks', 'drinks', 'other'] },
    prep_time: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'array', items: { type: 'string' } },
    raw_text: { type: 'string' },
  },
  required: ['not_a_recipe', 'title', 'source', 'category', 'prep_time', 'ingredients', 'instructions', 'raw_text'],
  additionalProperties: false,
};

const anthropic = new Anthropic();
const db = new Firestore();
const storage = new Storage();

const app = express();
app.use(express.json({ limit: '20mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ============ Auth ============ */

function makeToken(role) {
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(role).digest('hex').slice(0, 32);
  return `${role}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [role, sig] = token.split('.');
  if (!role || !sig) return null;
  if (role !== 'admin' && role !== 'family') return null;
  const expected = makeToken(role).split('.')[1];
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return role;
}

function getRole(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/);
  return m ? verifyToken(m[1]) : null;
}

function requireAdmin(req, res, next) {
  const r = getRole(req);
  if (r !== 'admin') return res.status(401).json({ error: 'Admin required.' });
  req.role = r;
  next();
}
function requireAuthenticated(req, res, next) {
  const r = getRole(req);
  if (!r) return res.status(401).json({ error: 'Sign in required.' });
  req.role = r;
  next();
}

/* ============ Utility: doc shape ============ */

const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const now = () => Date.now();

/* ============ Health + auth ============ */

app.get('/', (_req, res) => res.json({ ok: true, model: MODEL }));

app.get('/whoami', (req, res) => {
  res.json({ role: getRole(req) || 'guest' });
});

app.post('/login', (req, res) => {
  const { password, kind } = req.body || {};
  if (!password || !kind) return res.status(400).json({ error: 'Missing password or kind.' });
  if (kind === 'admin') {
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "That's not Maddy's password." });
    }
    return res.json({ token: makeToken('admin'), role: 'admin' });
  }
  if (kind === 'family') {
    if (!FAMILY_PASSWORD || password !== FAMILY_PASSWORD) {
      return res.status(401).json({ error: "That's not the family password." });
    }
    return res.json({ token: makeToken('family'), role: 'family' });
  }
  res.status(400).json({ error: 'Unknown kind.' });
});

/* ============ OCR ============ */

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
  return { mediaType, data: m[3] };
}

app.post('/ocr', requireAdmin, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) return res.status(400).json({ error: 'Expected { image: dataURL }.' });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: RECIPE_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } },
          { type: 'text', text: 'Transcribe and structure this recipe card.' },
        ],
      }],
    });
    const raw = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    let parsedJson;
    try {
      parsedJson = JSON.parse(raw);
    } catch (parseErr) {
      console.warn('OCR JSON parse failed, returning text only:', raw.slice(0, 200));
      return res.json({ text: raw, not_a_recipe: false });
    }
    res.json({
      not_a_recipe: !!parsedJson.not_a_recipe,
      title: parsedJson.title || '',
      source: parsedJson.source || '',
      category: parsedJson.category || 'other',
      prep_time: parsedJson.prep_time || '',
      ingredients: Array.isArray(parsedJson.ingredients) ? parsedJson.ingredients : [],
      instructions: Array.isArray(parsedJson.instructions) ? parsedJson.instructions : [],
      text: parsedJson.raw_text || '',
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    });
  } catch (err) {
    console.error('OCR error:', err);
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 502).json({ error: err.message });
    }
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ============ Photo upload ============ */

async function uploadImageToGcs(parsed, prefix) {
  const buf = Buffer.from(parsed.data, 'base64');
  const id = newId(prefix);
  const bucket = storage.bucket(BUCKET);
  const main = await sharp(buf).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, progressive: true }).toBuffer();
  const thumb = await sharp(buf).rotate().resize(640, 640, { fit: 'cover' }).jpeg({ quality: 80, progressive: true }).toBuffer();
  const meta = await sharp(main).metadata();
  const mainObj = bucket.file(`${prefix}/${id}.jpg`);
  const thumbObj = bucket.file(`${prefix}/${id}-thumb.jpg`);
  await Promise.all([
    mainObj.save(main, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000, immutable' } }),
    thumbObj.save(thumb, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000, immutable' } }),
  ]);
  return {
    id,
    photoUrl: `https://storage.googleapis.com/${BUCKET}/${prefix}/${id}.jpg`,
    photoThumbUrl: `https://storage.googleapis.com/${BUCKET}/${prefix}/${id}-thumb.jpg`,
    width: meta.width || 0,
    height: meta.height || 0,
    mainKey: `${prefix}/${id}.jpg`,
    thumbKey: `${prefix}/${id}-thumb.jpg`,
  };
}

app.post('/upload', requireAdmin, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) return res.status(400).json({ error: 'Expected { image: dataURL }.' });
    const r = await uploadImageToGcs(parsed, 'photos');
    res.json({ photoUrl: r.photoUrl, photoThumbUrl: r.photoThumbUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ============ Family Photos (rotating gallery) ============ */

const familyPhotosCol = () => db.collection('family_photos');

app.get('/photos', requireAuthenticated, async (_req, res) => {
  const snap = await familyPhotosCol().orderBy('createdAt', 'desc').get();
  res.json({ photos: snap.docs.map((d) => d.data()) });
});

app.post('/photos', requireAuthenticated, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) return res.status(400).json({ error: 'Expected { image: dataURL }.' });
    const r = await uploadImageToGcs(parsed, 'family');
    const aspect = r.width && r.height ? r.width / r.height : 1;
    const photo = {
      id: r.id,
      src: r.photoUrl,
      thumb: r.photoThumbUrl,
      width: r.width,
      height: r.height,
      aspect,
      portrait: r.height > r.width,
      caption: (req.body.caption || '').toString().slice(0, 280),
      uploaderName: (req.body.uploaderName || '').toString().slice(0, 60),
      uploaderRole: req.role,
      uploaderId: (req.body.uploaderId || '').toString().slice(0, 64),
      mainKey: r.mainKey,
      thumbKey: r.thumbKey,
      createdAt: now(),
    };
    await familyPhotosCol().doc(r.id).set(photo);
    res.json(photo);
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.delete('/photos/:id', requireAuthenticated, async (req, res) => {
  try {
    const ref = familyPhotosCol().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found.' });
    const photo = doc.data();
    const ownsIt = req.body?.uploaderId && photo.uploaderId === req.body.uploaderId;
    if (req.role !== 'admin' && !ownsIt) {
      return res.status(403).json({ error: 'Only Maddy or the uploader can remove this photo.' });
    }
    const bucket = storage.bucket(BUCKET);
    if (photo.mainKey) await bucket.file(photo.mainKey).delete().catch(() => {});
    if (photo.thumbKey) await bucket.file(photo.thumbKey).delete().catch(() => {});
    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('Photo delete error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ============ Recipes ============ */

const recipesCol = () => db.collection('recipes');

app.get('/recipes', requireAuthenticated, async (_req, res) => {
  const snap = await recipesCol().orderBy('updatedAt', 'desc').get();
  res.json({ recipes: snap.docs.map((d) => d.data()) });
});

app.get('/recipes/:id', requireAuthenticated, async (req, res) => {
  const doc = await recipesCol().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found.' });
  res.json(doc.data());
});

app.post('/recipes', requireAdmin, async (req, res) => {
  const id = newId('rec');
  const recipe = {
    id,
    title: (req.body.title || 'Untitled').toString(),
    source: (req.body.source || '').toString(),
    forWhom: (req.body.forWhom || '').toString(),
    category: (req.body.category || 'other').toString(),
    prepTime: (req.body.prepTime || '').toString(),
    ingredients: (req.body.ingredients || '').toString(),
    instructions: (req.body.instructions || '').toString(),
    text: (req.body.text || '').toString(),
    photoUrl: (req.body.photoUrl || '').toString(),
    photoThumbUrl: (req.body.photoThumbUrl || '').toString(),
    createdAt: now(),
    updatedAt: now(),
  };
  await recipesCol().doc(id).set(recipe);
  res.json(recipe);
});

app.put('/recipes/:id', requireAdmin, async (req, res) => {
  const ref = recipesCol().doc(req.params.id);
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Not found.' });
  const prev = existing.data();
  const recipe = {
    ...prev,
    title: req.body.title ?? prev.title,
    source: req.body.source ?? prev.source,
    forWhom: req.body.forWhom ?? prev.forWhom,
    category: req.body.category ?? prev.category,
    prepTime: req.body.prepTime ?? prev.prepTime,
    ingredients: req.body.ingredients ?? prev.ingredients,
    instructions: req.body.instructions ?? prev.instructions,
    text: req.body.text ?? prev.text,
    photoUrl: req.body.photoUrl ?? prev.photoUrl,
    photoThumbUrl: req.body.photoThumbUrl ?? prev.photoThumbUrl,
    updatedAt: now(),
  };
  await ref.set(recipe);
  res.json(recipe);
});

app.delete('/recipes/:id', requireAdmin, async (req, res) => {
  await recipesCol().doc(req.params.id).delete();
  res.json({ ok: true });
});

/* ============ Journal ============ */

const journalCol = () => db.collection('journal');

app.get('/journal', requireAuthenticated, async (_req, res) => {
  const snap = await journalCol().orderBy('date', 'desc').get();
  res.json({ entries: snap.docs.map((d) => d.data()) });
});

app.get('/journal/:id', requireAuthenticated, async (req, res) => {
  const doc = await journalCol().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found.' });
  res.json(doc.data());
});

app.post('/journal', requireAdmin, async (req, res) => {
  const id = newId('jnl');
  const entry = {
    id,
    title: (req.body.title || 'Untitled').toString(),
    body: (req.body.body || '').toString(),
    date: (req.body.date || new Date().toISOString().slice(0, 10)).toString(),
    createdAt: now(),
    updatedAt: now(),
  };
  await journalCol().doc(id).set(entry);
  res.json(entry);
});

app.put('/journal/:id', requireAdmin, async (req, res) => {
  const ref = journalCol().doc(req.params.id);
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Not found.' });
  const prev = existing.data();
  const entry = {
    ...prev,
    title: req.body.title ?? prev.title,
    body: req.body.body ?? prev.body,
    date: req.body.date ?? prev.date,
    updatedAt: now(),
  };
  await ref.set(entry);
  res.json(entry);
});

app.delete('/journal/:id', requireAdmin, async (req, res) => {
  await journalCol().doc(req.params.id).delete();
  res.json({ ok: true });
});

/* ============ Comments ============ */

const commentsCol = () => db.collection('comments');

app.get('/comments', requireAuthenticated, async (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) return res.status(400).json({ error: 'targetType, targetId required.' });
  const snap = await commentsCol()
    .where('targetType', '==', targetType)
    .where('targetId', '==', targetId)
    .orderBy('createdAt', 'asc')
    .get();
  res.json({ comments: snap.docs.map((d) => d.data()) });
});

app.post('/comments', requireAuthenticated, async (req, res) => {
  const id = newId('cmt');
  const c = {
    id,
    targetType: req.body.targetType,
    targetId: req.body.targetId,
    name: (req.body.name || 'Anonymous').toString().slice(0, 80),
    body: (req.body.body || '').toString().slice(0, 4000),
    createdAt: now(),
  };
  if (!c.targetType || !c.targetId || !c.body.trim()) {
    return res.status(400).json({ error: 'targetType, targetId, body required.' });
  }
  await commentsCol().doc(id).set(c);
  res.json(c);
});

app.delete('/comments/:id', requireAdmin, async (req, res) => {
  await commentsCol().doc(req.params.id).delete();
  res.json({ ok: true });
});

/* ============ Public OG / link-preview endpoints ============
 * These are unauthenticated so Facebook's scraper, iMessage, Slack, etc.
 * can read OG tags. The body redirects humans to the gated /family/* SPA URL.
 */

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ogPage({ title, description, image, redirectUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)} — Maddy's Memories</title>
<meta name="description" content="${escHtml(description)}">
<meta property="og:site_name" content="Maddy's Memories">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:image" content="${escHtml(image)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${escHtml(redirectUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(image)}">
<meta http-equiv="refresh" content="0; url=${escHtml(redirectUrl)}">
<style>body{font-family:Georgia,serif;background:#FAF3E0;color:#2C2A26;text-align:center;padding:3rem 1rem;line-height:1.5}a{color:#E8574A}</style>
</head>
<body>
<p>Opening <a href="${escHtml(redirectUrl)}">${escHtml(title)}</a> in Maddy's Memories…</p>
<script>location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

app.get('/share/recipes/:id', async (req, res) => {
  try {
    const doc = await recipesCol().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).type('text/plain').send('Recipe not found.');
    const r = doc.data();
    const facets = [
      r.source && `— ${r.source}`,
      r.category && r.category !== 'other' && r.category[0].toUpperCase() + r.category.slice(1),
      r.prepTime,
    ].filter(Boolean).join(' • ');
    const desc = facets || (r.text || '').replace(/\s+/g, ' ').slice(0, 200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(ogPage({
      title: r.title || 'A recipe from Maddy',
      description: desc || "From Madeline's recipe box.",
      image: r.photoUrl || 'https://maddysmemories.com/maddy-avatar.jpg',
      redirectUrl: `https://maddysmemories.com/family/recipes/${r.id}`,
    }));
  } catch (err) {
    console.error('OG recipe error:', err);
    res.status(500).type('text/plain').send('Could not load this recipe.');
  }
});

app.get('/share/journal/:id', async (req, res) => {
  try {
    const doc = await journalCol().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).type('text/plain').send('Entry not found.');
    const e = doc.data();
    const desc = (e.body || '').replace(/\s+/g, ' ').slice(0, 240);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(ogPage({
      title: e.title || 'A story from Maddy',
      description: desc || "From Madeline's journal.",
      image: 'https://maddysmemories.com/maddy-avatar.jpg',
      redirectUrl: `https://maddysmemories.com/family/journal/${e.id}`,
    }));
  } catch (err) {
    console.error('OG journal error:', err);
    res.status(500).type('text/plain').send('Could not load this entry.');
  }
});

/* ============ Listen ============ */

app.listen(PORT, () => {
  console.log(`Maddy's Memories API listening on :${PORT} (model=${MODEL}, bucket=${BUCKET})`);
});
