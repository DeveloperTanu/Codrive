# Codrive — Full Stack

Everything: 11 frontend pages, the Express + MongoDB API, and the Docker execution worker. This is the real, connected version — the frontend calls the actual backend over HTTP, the backend reads/writes actual MongoDB collections, and auth is real signup/login with bcrypt + JWT, not a browser-storage simulation.

## Quick start

**1. Start MongoDB** — a local `mongod`, a Docker container (`docker run -d -p 27017:27017 mongo`), or an Atlas connection string all work.

**2. Start the backend**
```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGODB_URI, generate two secrets for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
# (e.g. `openssl rand -hex 32` for each), and set FRONTEND_ORIGIN to match step 3 below
npm run seed      # populates JavaScript Promises, Python Decorators, one full problem
npm run dev        # API now listening on :4000
```

**3. Serve the frontend** — don't open the HTML files directly (`file://`). The login/session flow depends on an httpOnly cookie, which browsers only send on real HTTP origins. Serve the folder instead:
```bash
cd frontend
npx serve .
# or: python3 -m http.server 5500
```
Whatever port that gives you, put it in the backend's `FRONTEND_ORIGIN` and restart the backend.

**4. Open it** — go to the served address, click through to `codrive-auth.html`, sign up. Your real name now appears everywhere; bookmarks, reviews, and progress are real MongoDB documents from that point on.

## What's real vs. what's still local-only

| Feature | Status |
|---|---|
| Signup / login / logout / session persistence | **Real** — bcrypt + JWT, httpOnly refresh cookie, MongoDB `User` documents |
| Bookmarks | **Real** — MongoDB `Bookmark` documents, visible identically on the bookmarks page, search results, and the practice page |
| Concept review / spaced revision | **Real** — `RevisionRecord` documents, drives the dashboard's due-for-review list and the progress page |
| Progress stats & mastery | **Real** — computed fresh from your actual data on every request, not a stored counter |
| Language/concept catalog | **Real** — fetched from MongoDB via `GET /api/languages` and `GET /api/concepts/:lang/:category` |
| Project files (builder mode) | **Real** — `ProjectFile` documents, one per file, saved via the Save button |
| Problem submission (Run/Submit on the practice page) | **Real**, but the actual code execution is an in-memory placeholder in `execution.service.ts` until the Docker worker is wired in — see below |
| Teacher AI chat | **Real**, if you paste a Groq key into AI Teacher settings — calls `POST /api/teacher/chat`, which calls Groq's actual API. Without a key, falls back to scripted mentor replies so the panel still demonstrates the intended behavior |
| Debugger trace | **Local only, by design** — a fixed instructional trace of a specific buggy loop, the same way a seed script ships one worked example. Not personal data; nothing to make "real" without live execution |
| Builder's terminal output on Run | **Simulated** — prints a plausible line, doesn't invoke the execution worker yet |

## Wiring in real code execution (the one piece still disconnected)

`backend/src/services/execution.service.ts` defines the queue contract; `execution-worker/` implements the actual Docker sandboxing against that same contract. They're not connected to each other yet in this package — connecting them means:
1. Running Redis (or swapping in whatever queue you prefer).
2. Building the three sandbox images: `docker build -t codrive-sandbox-javascript execution-worker/docker/sandbox-javascript` (same for python/java).
3. Replacing the in-memory stand-in in `execution.service.ts`'s `enqueueExecution`/`getExecutionResult` with real pushes/reads against that queue.
4. Starting the worker: `cd execution-worker && npm install && npm run dev`.

Each piece works and is documented in its own README (`backend/README.md`, `execution-worker/README.md`) — this is genuinely the last connection to make, not a stub pretending to be finished.

## Layout

```
frontend/            11 static HTML pages, real API calls, no build step
backend/              Express + TypeScript + MongoDB API
execution-worker/      Docker-sandboxed code runner (separate deployable)
docs/
  codrive-backend-spec.md   full architecture spec this was built from
```