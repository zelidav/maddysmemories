# Mom's Recipes

Mobile-first PWA for photographing handwritten recipe cards, transcribing them with Claude vision, dictating provenance ("From Aunt Rose, 1962"), and sharing them.

## Layout

- `index.html`, `styles.css`, `app.js`, `config.js`, `manifest.json`, `sw.js` — the static site (deploy to GitHub Pages).
- `server/` — Cloud Run OCR proxy that calls Claude vision. Keeps the API key off the device.

## Local dev

Open `index.html` directly, or serve it: `python3 -m http.server 8000` then visit `http://localhost:8000`. Without a backend the photo and dictate flows still work — only auto-transcription is gated on the OCR endpoint.

## Deploy the OCR backend

One-time:

```sh
cd server
export ANTHROPIC_API_KEY=sk-ant-...
./deploy.sh
```

Copy the Cloud Run URL it prints, then set `config.js`:

```js
window.GRANDMA_OCR_ENDPOINT = 'https://grandma-recipes-ocr-xxxxx-uc.a.run.app/ocr';
```

For tighter CORS, redeploy with `ALLOWED_ORIGIN=https://<user>.github.io ./deploy.sh`.

## Deploy the site (GitHub Pages)

```sh
git init
git add .
git commit -m "initial"
gh repo create grandma-recipes --public --source=. --push
gh repo edit --enable-pages --pages-branch main --pages-path /
```
