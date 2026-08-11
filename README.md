# English Idiom & Vocabulary Auto-Posting Bot

An automated content pipeline for AbS Tech Connect. On every trigger it
generates a batch of 5 English-learning posts (vocabulary words or idioms),
renders each one into a branded infographic (AbS purple `#4B2ED1`), uploads
the image, and publishes the finished post to an external website's API.

It runs 3× per day (morning / afternoon / night) → 15 posts/day, with **zero
manual intervention** after setup. Scheduling lives in GitHub Actions; the
service itself is a stateless HTTP API hosted on Render.

## Tech stack

- **Runtime:** Node.js (LTS) + TypeScript
- **Web framework:** Express
- **Content generation:** Groq API (`groq-sdk`), model `llama-3.3-70b-versatile`
- **Database:** MongoDB Atlas (free M0 tier) via Mongoose
- **Image rendering:** node-canvas (no Puppeteer — keeps Render free-tier RAM usage low)
- **Image storage:** Cloudinary
- **Hosting:** Render free Web Service
- **Scheduler:** GitHub Actions (cron) → `POST /run-batch`

## Project structure

```
src/
├── config/env.ts              # validates & exports all env vars
├── db/
│   ├── connect.ts             # MongoDB connection singleton
│   └── models/
│       ├── LetterProgress.ts  # singleton doc: current letter, used words
│       ├── UsedIdiom.ts       # flat collection of used idioms
│       └── Post.ts            # audit log of every generated + posted item
├── content/
│   ├── groqClient.ts          # Groq SDK client + JSON-with-retry helper
│   ├── generateWord.ts        # Track A: A→Z word cycle with letter advancement
│   └── generateIdiom.ts       # Track B: common idioms, never repeated
├── render/
│   ├── theme.ts               # AbS brand constants, fonts, layout dims
│   ├── illustrations.ts       # mood → cached Cloudinary illustration URLs
│   └── renderCard.ts          # node-canvas infographic → PNG buffer
├── storage/
│   └── uploadImage.ts         # Cloudinary upload (with retry)
├── publish/
│   └── postToSite.ts          # POSTs finished content to the target website
├── orchestrator/
│   └── runBatch.ts            # generate → render → upload → post → log
├── routes/
│   └── batch.ts               # POST /run-batch, GET /batch-status/:id
└── server.ts                  # Express entrypoint, GET /health
```

## Environment variables

Copy `.env.example` to `.env` and fill everything in. All required variables
must be present or the service refuses to boot.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no (default `3000`) | HTTP port |
| `NODE_ENV` | no (default `development`) | `development` / `production` |
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `GROQ_API_KEY` | yes | Groq API key |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret |
| `SITE_POST_ENDPOINT` | yes | The website URL posts are sent to (currently the dev API) |
| `SITE_API_KEY` | yes | Bearer token the website expects |
| `TRIGGER_AUTH_TOKEN` | yes | Secret required on `/run-batch` (`Authorization: Bearer`) |
| `WORDS_PER_LETTER` | no (default `5`) | Words used per letter before advancing A→Z |
| `GROQ_MODEL` | no (default `llama-3.3-70b-versatile`) | Override the Groq model |

## Running locally

```bash
npm install
cp .env.example .env   # then fill in every value
npm run build          # compile TypeScript
npm run dev            # start with tsx watch (hot reload)
```

Verify the server is up:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### Testing a batch locally

Trigger a single-item batch (this calls Groq, renders a PNG, uploads to
Cloudinary, POSTs to the site, and writes a `Post` document):

```bash
curl -X POST http://localhost:3000/run-batch \
  -H "Authorization: Bearer <TRIGGER_AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "slot": "morning"}'
# {"batchId":"...","status":"accepted"}
```

Poll the result:

```bash
curl http://localhost:3000/batch-status/<batchId>
```

### Endpoints

- `POST /run-batch` — body `{ "count": number, "slot": "morning"|"afternoon"|"night" }`,
  requires `Authorization: Bearer <TRIGGER_AUTH_TOKEN>`. Returns `202` immediately,
  runs the batch in the background. `401` if the token is missing/incorrect.
- `GET /batch-status/:id` — in-memory status/summary of a batch run.
- `GET /health` — uptime check, returns `{ "status": "ok" }`.

## How it works

**Track A (words):** `generateWord` asks Groq for a word starting with the
current letter, avoiding already-used words. Each success is appended to
`LetterProgress.usedWords`; once `usedWords.length >= wordsPerLetter` the
current letter advances (Z → A increments `cycleCount`, which can be used to
request harder vocabulary on later passes).

**Track B (idioms):** `generateIdiom` asks Groq for a common idiom not in the
recent ~100 used idioms, then checks the **full** list case-insensitively in
code and regenerates once if a collision is detected. `UsedIdiom.idiom` has a
unique index as a final safety net.

**Rendering:** `renderCard` draws the full infographic (header banner, MEANING
box, "Think of it as" callout, EXAMPLES divider, two numbered example panels
with mood-matched illustrations, and a GOOD TO KNOW / USED IN footer) at
1200×1500 px and returns a PNG buffer.

**Posting:** `postToSite` uploads the rendered PNG as `multipart/form-data`
(`images` file, `content` caption, `visibilityType: "Everyone"`) to
`SITE_POST_ENDPOINT` with `Authorization: Bearer <SITE_API_KEY>`, matching the
target site's `create-quill-post-new` API. Non-2xx responses are treated as
failures and logged to the `Post` collection. The whole payload is assembled in
one function — `postToSite()` in `src/publish/postToSite.ts`.

**Failure isolation:** every item in a batch is wrapped in its own try/catch —
a single failed generation/render/upload/post never crashes the rest of the batch.

## Deployment (Render)

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm start` (runs compiled `dist/server.js`)
5. Add every env var from the table above in Render's dashboard.
6. Free tier spins down after 15 min idle — fine here, since it's only woken by
   the 3×/day GitHub Actions trigger. Cold start can take up to ~60s, which the
   workflow's `--max-time 120` accommodates.

## Scheduling (GitHub Actions)

`.github/workflows/post-schedule.yml` triggers at 06:00 / 12:00 / 18:00 UTC
(adjust the cron to your WAT/UTC offset). A bash step determines the slot from
the current UTC hour so each cron fires exactly one batch, and `workflow_dispatch`
lets you run a batch manually.

Add these two **GitHub repo secrets**:

- `BOT_TRIGGER_URL` — your Render service URL (e.g. `https://your-app.onrender.com`)
- `TRIGGER_AUTH_TOKEN` — the same value as `TRIGGER_AUTH_TOKEN` in the service env

## Before first production run (open items)

- **Site payload schema:** posts use the target site's `create-quill-post-new`
  API as `multipart/form-data` (`images`, `content`, `visibilityType`). If the
  production API differs, update `postToSite()` in
  `src/publish/postToSite.ts` — everything lives in one function.
- **Illustrations:** pre-generate 10 mood images (3 positive, 3 negative, 4
  neutral) and upload them to Cloudinary under `idiom-bot/illustrations/`
  (`positive-1.png`, …, `neutral-4.png`). `src/render/illustrations.ts`
  references them by URL — until they exist, `renderCard` draws a colored
  placeholder box instead.
- **`wordsPerLetter`:** tune `WORDS_PER_LETTER` for your desired pacing
  through the alphabet (default 5).
