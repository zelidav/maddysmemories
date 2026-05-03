import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MODEL = process.env.OCR_MODEL || 'claude-opus-4-7';

const SYSTEM_PROMPT = `You transcribe recipe cards. Many are handwritten, old, faded, stained, or written in cursive.

Rules:
- Output ONLY the transcribed text. No preamble, no commentary, no markdown fences.
- Preserve the original line breaks and visual structure (title, ingredient list, steps).
- Keep original spelling, abbreviations (tsp, T., doz., oz.), and quirks. Do not modernize or clean up.
- For a word you genuinely cannot read, write [?]. Do not guess.
- If the image is not a recipe card, return the literal string: NOT_A_RECIPE`;

const client = new Anthropic();

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
  return { mediaType, data: m[3] };
}

app.post('/ocr', async (req, res) => {
  try {
    const { image } = req.body || {};
    const parsed = parseDataUrl(image);
    if (!parsed) {
      return res.status(400).json({ error: 'Expected { image: "data:image/...;base64,..." }' });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
            },
            { type: 'text', text: 'Transcribe this recipe card.' },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (text === 'NOT_A_RECIPE') {
      return res.json({ text: '', not_a_recipe: true });
    }

    res.json({
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error('OCR error:', err);
    if (err instanceof Anthropic.BadRequestError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited, try again in a moment.' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 502).json({ error: err.message });
    }
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`OCR proxy listening on :${PORT} (model=${MODEL})`);
});
