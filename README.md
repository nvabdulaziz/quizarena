# QuizArena — live Kahoot-style quiz platform

React + Vite + Tailwind + Framer Motion (client) · Express + Socket.IO + Prisma/PostgreSQL (server).
Teachers register; students join anonymously with a 6-digit PIN and a nickname. Languages: Uzbek (default), Russian, English.

```
server/   Express REST API, Socket.IO game engine, Prisma schema + migration
client/   React app (teacher dashboard, editor, live host screen, student screens, podium)
render.yaml, server/railway.json   deployment blueprints
```

## Run locally

Requirements: Node 18+ and PostgreSQL.

```bash
# 1. Backend
cd server
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy       # creates all tables
npm run dev                     # http://localhost:4000  (health: /health)

# 2. Frontend (new terminal)
cd client
cp .env.example .env            # VITE_API_URL=http://localhost:4000
npm install
npm run dev                     # http://localhost:5173
```

Try it: register a teacher → *New quiz* → add questions → *Start live game* → open `/join` on a phone (or the QR code) → play.
Tests: `cd server && npm test` (scoring, importer, and a full multi-client Socket.IO game flow).

## Deploy

**Database + backend (Render):** push the repo, create a *Blueprint* from `render.yaml`. After the first deploy set
`CLIENT_ORIGINS` and `CLIENT_URL` to your Vercel URL (no trailing slash). Migrations run automatically (`preDeployCommand`).
*Railway:* create a Postgres plugin + a service with root `server/`; `railway.json` is included; set the same env vars.

**Frontend (Vercel):** import the repo, root directory `client/`, framework Vite, env `VITE_API_URL=https://<your-backend>`.
`vercel.json` rewrites all routes to the SPA. HTTPS/WSS is automatic on both platforms; the client connects to the API URL you give it.

### Environment variables (server)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | long random string (teacher auth) |
| `CLIENT_ORIGINS` | comma-separated allowed origins for CORS + Socket.IO |
| `CLIENT_URL` | public frontend URL |
| `MAX_PLAYERS` | players per game (default 200) |
| `UPLOAD_DIR` | where question images are stored — **use a persistent disk** (Render config included) |
| `REDIS_URL` | optional, enables the Socket.IO Redis adapter |

## How it works

* **Server-authoritative:** the server owns the timer, validates every answer, computes all points and rankings. Correct answers are never sent to clients until a question closes. One answer per player per question; late/paused answers are rejected.
* **Scoring:** up to the question's points (default 1000), linearly decreasing to 50% at the last moment; streak bonus = `(streak-1) × bonus` (capped at 5 steps, bonus configurable when starting a game). Multi-answer questions require the exact correct set.
* **Reconnection:** each player gets a private token stored in the browser; refreshing or losing signal re-attaches to the same player. The host can also reload and reclaim the game.
* **Protection:** rate limits on PIN lookup (HTTP) and join/rejoin (socket), login limiter, nickname sanitising, CSV formula-injection guard on export, Helmet, strict CORS.
* **Persistence:** quizzes, players, every answer, per-question scores and final results are stored in PostgreSQL; history and Excel/CSV export read from there.
* **Import:** `.xlsx`, `.csv`, `.json` with row-level validation errors shown before anything is saved; template download in the editor.

## Known limits (read before scaling)

* **Live game state is held in server memory** (and persisted per question). One backend instance is fully supported. With several instances, enable `REDIS_URL` (broadcast adapter) **and** route all sockets/HTTP for a given game to the same instance (sticky routing); otherwise a PIN created on one instance isn't visible on another. A server restart ends games in progress (their partial data stays in the DB).
* Uploaded images are stored on disk (`UPLOAD_DIR`); switch to S3/R2 if you run without a persistent disk.
"# quizarena" 
