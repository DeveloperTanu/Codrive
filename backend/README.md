# Codrive API

Express + TypeScript + MongoDB backend for Codrive, implementing the architecture described in `codrive-backend-spec.md`.

## What's implemented

- **Auth** — signup/login/logout/forgot-password, bcrypt password hashing (cost 12), JWT access tokens (short-lived) + httpOnly refresh cookie, per-IP rate limiting on auth routes.
- **Models** — all 13 collections from the spec: `User`, `Language`, `Framework`, `Concept`, `Problem`, `Hint`, `Solution`, `Project`, `ProjectFile`, `Submission`, `Progress`, `RevisionRecord`, `Bookmark`, with the indexes called out in the spec.
- **Concepts & revision** — mark-as-reviewed endpoint that updates a `Progress` snapshot and schedules the next review via a real (if intentionally simple) spaced-interval algorithm in `revision.service.ts`.
- **Problems** — progressive hint endpoint (one hint per call, never the array), a separate solution-reveal endpoint that logs whether the solution was viewed, and a submission flow that enqueues execution rather than running code inline.
- **Execution** — `execution.service.ts` defines the job-queue contract described in the spec. The actual Docker sandbox is a separate deployable (`execution-worker/`, not included here) — this service currently resolves jobs with an in-memory stand-in so the API is runnable without extra infrastructure. Swap the two functions in that file for real queue calls when the worker exists.
- **Projects** — file-level CRUD (`ProjectFile` is one document per file, not one blob per project).
- **Bookmarks** — CRUD scoped to the authenticated user, with denormalized `title`/`sub` fields (see the comment in `Bookmark.ts` on why — `targetType` is polymorphic, so there's no single `populate()` path back to a display title).
- **Languages catalog** — `GET /api/languages` returns every seeded language with its categories, used by the language library and search pages to build their catalog instead of hardcoding one.
- **Progress summary** — `GET /api/progress/summary` is a single real aggregate (concepts reviewed, problems solved/attempted, day streak computed from actual revision timestamps, mastery per language, weak/strong concept lists, recent history, and a full per-concept status map) computed fresh from `Progress`/`Submission`/`RevisionRecord` on every call — nothing here is a stored, driftable counter.
- **Session refresh** — `POST /api/auth/refresh` exchanges the httpOnly refresh cookie for a new short-lived access token, and `GET /api/auth/me` returns the current user. Together these are what let a signed-in user open a different Codrive HTML page (or reload the same one) and still be recognized, since these are separate static pages rather than one single-page app with shared in-memory state.
- **Groq/Teacher AI proxy** — `POST /api/teacher/chat` calls Groq's real chat completions API (`groq.service.ts`), with a system prompt that encodes the mentor behavior rules from spec §33 (hints before answers, no shaming, give the solution once asked, etc.) and the learner's current concept/problem/code as context. The caller's Groq key travels in an `X-Groq-Api-Key` header on that one request and is discarded immediately after — never logged, never persisted to the `User` document. This is the fallback path only; the product spec's preferred path is still the browser calling Groq directly with the key held client-side.
- **Seed script** — realistic sample content (JavaScript Promises, Python Decorators, one full problem with hints and a solution) to exercise the frontend prototypes against a real API.

## What's intentionally stubbed

- **Real code execution** — no Docker, no worker process, no sandboxing in this repo. See `execution.service.ts` and §5 of the architecture spec for the intended design.
- **Email sending** for password reset — `auth.service.ts` generates the reset token but doesn't send it anywhere yet.

## CORS and cookies — running the frontend against this API

Set `FRONTEND_ORIGIN` in `.env` to whatever origin serves the HTML files (see the root `README.md` for how to serve them). The refresh flow relies on an httpOnly cookie, which browsers only send for real HTTP origins — opening an HTML file directly as `file://` will not work for anything past the login form. Serve the frontend folder with any static server (`npx serve frontend`, `python -m http.server`, etc.) and point `FRONTEND_ORIGIN` at that server's address.

## Running it

```bash
npm install
cp .env.example .env   # fill in a real MONGODB_URI and generate two JWT secrets
npm run seed            # populates sample languages/concepts/problems
npm run dev              # starts the API on :4000 with auto-reload
```

Requires a MongoDB instance reachable at `MONGODB_URI` — a local `mongod`, Docker container, or Atlas cluster all work.

## Project layout

```
src/
├── config/        # env loading, DB connection
├── models/        # Mongoose schemas — one file per collection
├── middleware/     # auth guard, error handler, rate limiter
├── services/       # business logic, framework-agnostic
├── controllers/    # request/response glue — thin, calls services
├── routes/         # route → controller wiring
├── utils/          # ApiError, asyncHandler
├── seed/           # sample data script
├── app.ts          # Express app construction (no listen())
└── server.ts        # entry point — connects DB, then listens
```

This mirrors the structure in the architecture spec: routes stay thin, services hold the actual logic and are framework-agnostic (testable without spinning up Express), and the one component that would run untrusted code is deliberately kept out of this process entirely.
