# Maddy's Memories

A family heirloom: recipes &amp; stories from Madeline's kitchen.
Mobile-first PWA for the writer (Maddy), shared read-only Family Hub for the readers (everyone else).

- **Frontend:** Vite + React + TypeScript, deployed to GitHub Pages at https://maddysmemories.com/
- **Backend:** Express on Cloud Run (project `printful-manager`), Firestore for data, GCS for photos
- **OCR:** Claude Opus 4.7 vision transcribes handwritten recipe cards
- **Auth:** Two shared passwords (Maddy's admin + family read+comment)

## Layout

```
.
├── index.html               Vite entry
├── src/                     React app
├── public/                  Static assets (icons, manifest, CNAME, sw.js, 404.html)
├── server/                  Cloud Run API
└── .github/workflows/       Pages build + deploy on push
```

## Local development

```sh
npm install
npm run dev
```

Without `VITE_API_URL` set, the app runs in **localStorage-only mode** — no backend required.
You can build, click around, save recipes locally. OCR is disabled in this mode (paste/dictate works).

To run against the deployed backend locally:

```sh
VITE_API_URL=https://maddysmemories-api-XXX.run.app npm run dev
```

## Deploying the backend (one-time)

```sh
cd server
./bootstrap-secrets.sh
```

The script:
1. Generates a long random `AUTH_SECRET` (one-time)
2. Prompts you for the **Anthropic API key**, **Maddy's admin password**, and the **family password**
3. Saves them to `~/.maddysmemories.env` (chmod 600) so future redeploys reuse them
4. Runs `deploy.sh`, which deploys Cloud Run and prints the service URL

After it finishes, wire the frontend to the live API:

```sh
# Replace with the URL the script printed
gh variable set VITE_API_URL --body 'https://maddysmemories-api-XXX.run.app' --repo zelidav/maddysmemories
git commit --allow-empty -m "trigger rebuild" && git push
```

The GitHub Action will rebuild the site against the live backend.

## Subsequent backend redeploys

```sh
source ~/.maddysmemories.env
cd server
./deploy.sh
```

To rotate a password, edit `~/.maddysmemories.env` then redeploy.
To force-rotate every login token, generate a new `AUTH_SECRET`.

## Routes

- `/` — public welcome / role chooser
- `/login` — shared password entry (admin or family)
- `/recipes`, `/recipes/new`, `/recipes/:id`, `/recipes/:id/edit` — admin-only
- `/journal`, `/journal/new`, `/journal/:id`, `/journal/:id/edit` — admin-only
- `/family` — family hub (read + comment)
- `/family/recipes/:id`, `/family/journal/:id` — family read-only with Open Graph metadata for FB previews

## Costs

GCS + Firestore free tier covers years of family use. Cloud Run scales to zero.
The only meter that ticks is Claude Opus 4.7 vision when Maddy photographs a card —
roughly $0.05–0.10 per OCR'd card.
