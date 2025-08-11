Podcasty — Turn links and files into polished podcast episodes.

Getting Started
- Copy `.env.example` to `.env` and fill secrets
- Run database and redis, then `npm run prisma:migrate`
- Start dev server: `npm run dev`
- Start worker: `npm run worker`

MVP Endpoints
- `POST /api/episodes` — create and queue generation
- `GET /api/episodes` — list
- `GET /api/episodes/:id/status` — status
- `GET /api/rss?token=...` — per-user feed (token)
