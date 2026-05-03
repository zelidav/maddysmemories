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

const SYSTEM_PROMPT = `You transcribe recipe cards. Many are handwritten, old, faded, stained, or written in cursive.

Rules:
- Output ONLY the transcribed text. No preamble, no commentary, no markdown fences.
- Preserve the original line breaks and visual structure (title, ingredient list, steps).
- Keep original spelling, abbreviations (tsp, T., doz., oz.), and quirks. Do not modernize or clean up.
- For a word you genuinely cannot read, write [?]. Do not guess.
- If the image is not a recipe card, return the literal string: NOT_A_RECIPE`;

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
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } },
          { type: 'text', text: 'Transcribe this recipe card.' },
        ],
      }],
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (text === 'NOT_A_RECIPE') return res.json({ text: '', not_a_recipe: true });
    res.json({
      text,
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

app.post('/upload', requireAdmin, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) return res.status(400).json({ error: 'Expected { image: dataURL }.' });

    const buf = Buffer.from(parsed.data, 'base64');
    const id = newId('img');
    const bucket = storage.bucket(BUCKET);

    const main = await sharp(buf).rotate().jpeg({ quality: 88 }).toBuffer();
    const thumb = await sharp(buf).rotate().resize(640, 640, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();

    const mainObj = bucket.file(`photos/${id}.jpg`);
    const thumbObj = bucket.file(`photos/${id}-thumb.jpg`);
    await mainObj.save(main, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000, immutable' } });
    await thumbObj.save(thumb, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000, immutable' } });

    const photoUrl = `https://storage.googleapis.com/${BUCKET}/photos/${id}.jpg`;
    const photoThumbUrl = `https://storage.googleapis.com/${BUCKET}/photos/${id}-thumb.jpg`;
    res.json({ photoUrl, photoThumbUrl });
  } catch (err) {
    console.error('Upload error:', err);
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

/* ============ Listen ============ */

app.listen(PORT, () => {
  console.log(`Maddy's Memories API listening on :${PORT} (model=${MODEL}, bucket=${BUCKET})`);
});
