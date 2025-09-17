# Podcasty — AI‑powered podcast generation

Turn links and files into polished podcast episodes with scripting, TTS, and post‑processing.

## How Podcast Creation Works

Podcasty transforms various content sources into professional podcast episodes through a multi-stage AI-powered pipeline:

### 1. Content Ingestion
- **YouTube Videos**: Extracts transcripts, titles, and descriptions using `youtube-transcript-api` and `ytdl-core`
- **Web Pages**: Uses Mozilla's Readability library to extract clean article content
- **PDF Files**: Processes uploaded PDFs to extract text content
- **Text Prompts**: Direct text input for custom content creation

### 2. AI Script Generation
- **Primary LLM**: OpenAI GPT-4o-mini (fallback: Anthropic Claude-3.5-Sonnet)
- **Script Modes**: 
  - **Summary**: Condensed overview of source material
  - **Readthrough**: Full content presentation
  - **Discussion**: Two-speaker dialogue format with opposing viewpoints
- **Output**: Structured SSML (Speech Synthesis Markup Language) with chapters, show notes, and speaker turns

### 3. Text-to-Speech Synthesis
- **Service**: ElevenLabs API
- **Models**: 
  - `eleven_multilingual_v2` (primary)
  - `eleven_turbo_v2` (fallback for short content)
- **Features**: 
  - Single narrator or dual-speaker dialogue
  - Custom voice selection
  - SSML support for natural pacing and breaks

### 4. Audio Post-Processing
- **FFmpeg**: Audio normalization and format conversion
- **Loudness Normalization**: Ensures consistent audio levels
- **Format**: MP3 output at 44.1kHz/160kbps

### 5. Video Generation (Optional)
- **Service**: Wavespeed AI
- **Process**: 
  - Splits audio into 30-second segments
  - Generates talking head videos using provided character images
  - Combines segments into final video
- **Features**: Lip-sync technology with custom character prompts

### 6. Content Delivery
- **Storage**: S3-compatible storage (AWS S3, Cloudflare R2, etc.)
- **Streaming**: Byte-range support for efficient audio/video playback
- **RSS Feeds**: Automatic podcast feed generation
- **Sharing**: Public episode sharing with custom URLs

## AI Models & Services Used

| Service | Purpose | Models/Features |
|---------|---------|-----------------|
| **OpenAI** | Script generation | GPT-4o-mini (primary) |
| **Anthropic** | Script generation | Claude-3.5-Sonnet (fallback) |
| **ElevenLabs** | Text-to-speech | eleven_multilingual_v2, eleven_turbo_v2 |
| **Wavespeed AI** | Video generation | Multitalk lip-sync technology |
| **Mozilla Readability** | Web content extraction | Article parsing and cleaning |
| **YouTube APIs** | Video content extraction | Transcript and metadata extraction |

## Overview
- Web app (Next.js 14) deployed on Vercel
- Background worker (Node) deployed on Render
- Shared S3‑compatible storage for audio files
- PostgreSQL via Prisma
- Optional: Redis (BullMQ) for queueing

## Prerequisites
- PostgreSQL database URL
- OpenAI and ElevenLabs API keys (as used by your project)
- S3‑compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.)

## Environment Variables
Set these in BOTH Vercel (web) and Render (worker):

- DATABASE_URL: PostgreSQL connection string
- NEXTAUTH_SECRET: any long random string
- NEXTAUTH_URL: https://your-domain.vercel.app (Vercel will set this automatically; optional)
- APP_URL: https://your-domain.vercel.app (no trailing slash)

S3 storage (required for shared audio):
- S3_BUCKET: your bucket name (e.g., podcastys3)
- S3_REGION: bucket region (e.g., us-east-2)
- S3_ACCESS_KEY_ID: access key ID with read/write to the bucket
- S3_SECRET_ACCESS_KEY: secret access key
- S3_ENDPOINT: leave empty for AWS S3; set for other providers (e.g., R2/B2/Spaces)

Optional (for queueing with BullMQ):
- REDIS_URL: Upstash/Redis connection URL

Other provider keys (if used by your project):
- OPENAI_API_KEY
- ELEVENLABS_API_KEY
- Any storage-specific credentials your code expects

## Local Development
1. Copy `.env.example` to `.env` and fill in values
2. Install: `npm install`
3. Generate Prisma Client: `npm run prisma:generate` (runs automatically on install)
4. Migrate (dev): `npm run prisma:migrate`
5. Dev server: `npm run dev` (http://localhost:3000 or 3001)
6. Worker (optional locally): `npm run worker`

## Production Deployment

### 1) Storage (S3) setup
Use any S3‑compatible storage. Create a bucket (e.g., `podcastys3`) and an access key with read/write.

- AWS S3: leave `S3_ENDPOINT` empty
- Cloudflare R2: set `S3_ENDPOINT` to `https://<accountid>.r2.cloudflarestorage.com`
- Backblaze B2: set `S3_ENDPOINT` to your region endpoint (e.g., `https://s3.us-west-002.backblazeb2.com`)
- DigitalOcean Spaces: set `S3_ENDPOINT` to region endpoint (e.g., `https://nyc3.digitaloceanspaces.com`)

Recommended bucket CORS (adjust AllowedOrigins):
- AllowedMethods: GET
- AllowedHeaders: Range, Authorization, Content-Type, Origin
- ExposeHeaders: Accept-Ranges, Content-Range, Content-Length
- AllowedOrigins: https://your-domain.vercel.app

### 2) Deploy the Web App (Vercel)
- Connect GitHub repo
- Ensure `package.json` has `postinstall: prisma generate` and `build: prisma generate && next build` (already configured)
- Add env vars (see list above) in Vercel Project → Settings → Environment Variables
- Redeploy

Notes
- Dynamic API routes are marked force-dynamic; no special config needed
- Audio is streamed via `GET /api/proxy/[...key]` with byte‑range headers

### Stripe (Billing and Webhooks)
Prerequisites
- In Vercel Project → Settings → Environment Variables, set:
  - `STRIPE_SECRET_KEY`: your Stripe secret API key (e.g., `sk_live_...` or `sk_test_...`)
  - `STRIPE_WEBHOOK_SECRET`: set after creating the webhook endpoint (below)

Webhook endpoint (production)
1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Select events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Create endpoint, then Reveal the Signing secret
5. Copy the signing secret and set it in Vercel as `STRIPE_WEBHOOK_SECRET`
6. Redeploy the web app

Local development (Stripe CLI)
1. Install Stripe CLI: https://stripe.com/docs/cli
2. In your project directory, run:
   - `stripe login`
   - `stripe listen --events "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted" --forward-to http://localhost:3000/api/webhooks/stripe`
3. The CLI prints a secret like `whsec_...`. Put it in `.env` as `STRIPE_WEBHOOK_SECRET=whsec_...`
4. Ensure `STRIPE_SECRET_KEY` is set in `.env`

Plan price IDs
- In the app, go to Admin → Plans and set your Stripe Price IDs for monthly/yearly on each plan.
- Pricing page uses these IDs to create Checkout Sessions.

### 3) Deploy the Worker (Render)
- Render Dashboard → New → Background Worker
- Repo: this project (root)
- Build Command:
  - `npm ci && npx prisma generate && npm run build`
- Start Command:
  - `npm run worker`
- Environment:
  - Set all env vars as in Vercel (DATABASE_URL, APP_URL, S3_*, OPENAI_API_KEY, ELEVENLABS_API_KEY, etc.)
  - Optional: `REDIS_URL` if using BullMQ queueing
- Create service and deploy

Important
- APP_URL must be your Vercel site URL (e.g., `https://your-domain.vercel.app`)
- After changing env vars, redeploy the worker so it picks them up

### 4) Verify
- Create a new episode in the web app
- In Render logs, you should see: Start → Generate script → Synthesize TTS → Post‑process → Done
- In AWS S3 (or your provider), verify a new object under `episodes/<uuid>.mp3`
- In the app, the player should show the correct duration and play

### 5) Queueing (Optional, Recommended)
If you want event‑driven processing (enqueue on web, consume on worker):
- Provision Upstash Redis (or another Redis)
- Set `REDIS_URL` in both Vercel and Render
- Ensure your worker consumes BullMQ jobs and your API enqueues jobs

## Troubleshooting
- Audio shows 0 seconds: usually means the file isn’t accessible. Ensure S3 env vars are set on BOTH Vercel and Render, redeploy both, and generate a new episode
- Vercel build errors on Prisma: ensure `postinstall: prisma generate` and `build: prisma generate && next build` exist
- Worker runs but nothing happens in prod: Vercel serverless can’t run long tasks after responding; you need the Render worker
- S3 NoSuchKey: object wasn’t uploaded to S3 (worker didn’t have S3 env vars or wasn’t redeployed). Fix env, redeploy worker, and generate a new episode

## Scripts
- `npm run dev` — start Next.js dev server
- `npm run build` — prisma generate + next build
- `npm run start` — start Next.js
- `npm run worker` — start background worker
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:migrate` — run migrations in dev

## API Endpoints (selected)
- `POST /api/episodes` — create an episode
- `GET /api/episodes` — list user episodes
- `GET /api/episodes/:id/status` — status polling
- `GET /api/episodes/:id/events` — events
- `GET /api/proxy/[...key]` — stream audio via storage proxy
- `GET /api/rss?token=...` — user feed
