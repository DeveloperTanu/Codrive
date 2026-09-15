# Codrive — Backend Architecture Specification

This document covers everything the frontend prototypes assume but can't show: database schema, API structure, authentication, the sandboxed code-execution pipeline, and the spaced-revision system. It's written to be implementable directly — one architectural decision per section, with the reasoning attached.

---

## 1. Project structure

Keep frontend, API routes, business logic, and data access in separate layers so the codebase scales past a handful of features.

```
codrive/
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── api/                 # typed fetch wrappers, one per resource
│
├── backend/
│   └── src/
│       ├── routes/              # thin — parse request, call service, shape response
│       │   ├── auth.routes.ts
│       │   ├── concepts.routes.ts
│       │   ├── problems.routes.ts
│       │   ├── projects.routes.ts
│       │   ├── revision.routes.ts
│       │   └── execution.routes.ts
│       │
│       ├── controllers/         # request/response glue only
│       ├── services/            # actual business logic, framework-agnostic
│       │   ├── auth.service.ts
│       │   ├── revision.service.ts      # spaced-repetition scheduling
│       │   ├── execution.service.ts     # talks to the job queue, never runs code itself
│       │   └── groq.service.ts          # optional proxy, see §6
│       │
│       ├── models/               # Mongoose schemas
│       ├── middleware/           # auth guard, rate limiting, error handler
│       ├── utils/
│       └── config/
│
├── execution-worker/              # separate process/deployable, see §5
│   ├── queue-consumer.ts
│   └── runners/
│       ├── javascript.runner.ts
│       ├── python.runner.ts
│       └── java.runner.ts
│
└── docker/
    ├── sandbox-javascript/Dockerfile
    ├── sandbox-python/Dockerfile
    └── sandbox-java/Dockerfile
```

The execution worker is intentionally a separate deployable from the main API — it's the one component that runs untrusted code, so it should be able to fail, restart, or scale independently without taking the API down with it.

---

## 2. Database schema (MongoDB)

Reference by ObjectId rather than embedding, except where data is genuinely owned by one parent and never queried independently (e.g. hints belong to a problem).

### `users`
```js
{
  _id: ObjectId,
  email: String,          // unique index
  passwordHash: String,   // bcrypt, cost factor 12 — never store plaintext, never log this field
  name: String,
  createdAt: Date,
  lastActiveAt: Date,
  preferences: {
    theme: "light" | "dark" | "system",
    defaultLanguage: ObjectId  // ref: languages
  }
}
```
Index: `{ email: 1 }` unique.

### `languages`
```js
{
  _id: ObjectId,
  slug: String,        // "javascript" — used in URLs
  name: String,        // "JavaScript"
  categories: [        // configurable per spec §14 — not hard-coded in the UI
    { slug: "fundamentals", name: "Fundamentals", order: 1 },
    { slug: "promises", name: "Promises & Async", order: 8 }
  ]
}
```

### `frameworks`
```js
{
  _id: ObjectId,
  slug: String,             // "express"
  name: String,
  languageId: ObjectId,     // ref: languages
  categories: [ /* same shape as languages.categories */ ]
}
```

### `concepts`
```js
{
  _id: ObjectId,
  slug: String,
  title: String,                     // "Promises"
  languageId: ObjectId,               // ref: languages (nullable if framework-scoped)
  frameworkId: ObjectId,               // ref: frameworks (nullable if language-scoped)
  categorySlug: String,
  difficulty: "beginner" | "intermediate" | "advanced",
  estimatedMinutes: Number,
  content: {
    whatIsIt: String,          // markdown
    syntax: String,            // markdown w/ code fences
    mentalModel: String,
    commonMistakes: [{ title: String, body: String }],
    remember: String,
    quickCheck: {
      question: String,
      options: [String],
      correctIndex: Number
    }
  }
}
```
Indexes: `{ languageId: 1, categorySlug: 1 }`, `{ frameworkId: 1, categorySlug: 1 }`.

### `problems`
```js
{
  _id: ObjectId,
  conceptIds: [ObjectId],     // a problem can reinforce multiple concepts
  title: String,
  type: "easy" | "normal" | "hard" | "challenger" | "builder",
  description: String,
  requirements: [String],
  examples: [{ input: String, output: String }],
  constraints: [String],
  starterCode: { [language: String]: String },
  testCases: [{ input: Mixed, expectedOutput: Mixed, hidden: Boolean }]
}
```

### `hints`
```js
{
  _id: ObjectId,
  problemId: ObjectId,   // ref: problems
  order: Number,          // 1, 2, 3 — revealed progressively, never all at once
  text: String
}
```

### `solutions`
```js
{
  _id: ObjectId,
  problemId: ObjectId,
  language: String,
  code: String,
  explanation: {
    whyItWorks: String,
    alternatives: String,
    commonMistakes: String
  }
}
```
Kept in a separate collection from `problems` (not embedded) so a solution-reveal request never risks over-fetching and accidentally exposing it early.

### `projects` / `projectFiles`
```js
// projects
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,          // "Task API"
  templateSlug: String,   // "rest-api-express"
  status: "in_progress" | "completed",
  createdAt: Date,
  updatedAt: Date
}

// projectFiles — one document per file, not one giant blob per project
{
  _id: ObjectId,
  projectId: ObjectId,     // ref: projects
  path: String,             // "backend/controllers/taskController.ts"
  content: String,
  updatedAt: Date
}
```
Index: `{ projectId: 1, path: 1 }` unique — this is what makes rename/save operations cheap and avoids the "entire app in one document" anti-pattern.

### `submissions`
```js
{
  _id: ObjectId,
  userId: ObjectId,
  problemId: ObjectId,
  code: String,
  language: String,
  passed: Boolean,
  testResults: [{ testCaseIndex: Number, passed: Boolean, actualOutput: Mixed }],
  usedHints: Number,        // tracked per spec §18 — did they solve it independently?
  viewedSolution: Boolean,
  submittedAt: Date
}
```
Index: `{ userId: 1, problemId: 1, submittedAt: -1 }`.

### `progress`
One document per user per concept — not a running log, a current-state snapshot.
```js
{
  _id: ObjectId,
  userId: ObjectId,
  conceptId: ObjectId,
  timesReviewed: Number,
  problemsSolved: Number,
  problemsAttempted: Number,
  lastReviewedAt: Date
}
```
Index: `{ userId: 1, conceptId: 1 }` unique.

### `revisionRecords`
Drives the spaced-revision system — see §4 for the scheduling logic that reads/writes this.
```js
{
  _id: ObjectId,
  userId: ObjectId,
  conceptId: ObjectId,
  intervalDays: Number,      // current interval before next review
  dueAt: Date,
  lastResult: "strong" | "review_soon" | "needs_revision",
  history: [{ reviewedAt: Date, result: String }]   // capped, see note below
}
```
Index: `{ userId: 1, dueAt: 1 }` — this is the query the dashboard's "due for review" section runs on every load, so it needs to be fast.

To keep documents from growing unbounded, cap `history` at the most recent ~20 entries (push + `$slice: -20` in the update) rather than storing every review forever.

### `bookmarks`
```js
{
  _id: ObjectId,
  userId: ObjectId,
  targetType: "concept" | "problem" | "project",
  targetId: ObjectId,
  createdAt: Date
}
```
Index: `{ userId: 1, targetType: 1, targetId: 1 }` unique.

---

## 3. Authentication

- Passwords hashed with **bcrypt**, cost factor 12. Never store, log, or return plaintext at any point in the request lifecycle.
- Sessions via short-lived **JWT access token** (~15 min) + longer-lived **refresh token** stored as an httpOnly, secure, sameSite cookie. Access tokens live in memory on the client, not localStorage, to reduce XSS exposure.
- Rate-limit `/auth/login` and `/auth/forgot-password` per IP and per email to blunt credential-stuffing attempts.
- Forgot-password flow issues a single-use, time-limited token emailed to the user; never reveal whether an email exists in the system in the response (same message either way).

---

## 4. Spaced revision — scheduling logic

Per the brief: start simple and honest about what it is, structure it so a real algorithm (SM-2 or similar) can replace it later without a schema migration.

**v1 algorithm** (lives in `revision.service.ts`, isolated behind a single function so it's swappable):

```ts
function computeNextInterval(current: RevisionRecord, result: "strong" | "review_soon" | "needs_revision"): number {
  if (result === "needs_revision") return 1;              // review again tomorrow
  if (result === "review_soon") return Math.max(3, Math.round(current.intervalDays * 1.3));
  return Math.round(current.intervalDays * 2.2);           // "strong" — push it out further
}
```

Starting interval for a never-reviewed concept: 1 day. This is a fixed-ratio interval system, not a memory-strength model — the UI should never claim otherwise. A future version can swap in SM-2 (tracking ease factor per concept) by changing only `computeNextInterval` and adding an `easeFactor` field to `revisionRecords`; nothing else in the schema needs to change.

The dashboard's "due for review" query is simply:
```js
db.revisionRecords.find({ userId, dueAt: { $lte: new Date() } }).sort({ dueAt: 1 })
```

---

## 5. Code execution — sandboxed runner

**Never** run user-submitted code inside the main Express process. The pipeline:

```
Browser → POST /api/execute → Express API (validates, enqueues job) → Job Queue
    → Execution Worker (separate process) → Docker container (per-language image)
    → stdout/stderr/exit code captured → written to job result store
    → Browser polls or subscribes (WebSocket) for the result
```

**Per-container limits** (Docker):
- `--memory=128m --memory-swap=128m` — hard memory cap, no swap
- `--cpus=0.5` — fractional CPU share
- `--network=none` — no network access from inside the sandbox at all
- `--pids-limit=64` — blocks fork-bombs
- `--read-only` filesystem with a small writable `/tmp` tmpfs
- Wall-clock timeout enforced by the worker (e.g. 10s), killing the container if exceeded, independent of any timeout the code itself might try to catch

**Per-language images**: one minimal base image per runtime (`node:alpine`, `python:slim`, etc.), pre-warmed/pooled where possible to cut cold-start latency, and rebuilt from a pinned base regularly for security patches.

**Extensibility**: adding a language means adding a Dockerfile + a thin runner adapter (how to invoke the interpreter, how to parse stdout into structured test results) — the queue, the API contract, and the frontend editor don't change.

**Job result never includes**: the container's environment variables, the host filesystem, or anything beyond stdout/stderr/exit code — this is as much about not leaking sandbox internals as it is about performance.

---

## 6. Groq / Teacher AI integration

Per the brief, the user's own Groq API key powers Teacher — Codrive never holds a shared key.

- **Preferred path**: the browser calls the Groq API directly with the user's key held client-side (localStorage/IndexedDB in production — see the note in the Teacher AI prototype about why this demo used an in-memory variable instead). The key never reaches Codrive's servers at all in this path.
- **If a backend proxy becomes necessary** (e.g. to attach server-side context like the current problem without shipping it back and forth, or to work around CORS on Groq's side): the proxy must be stateless per-request — it receives the key in a header on that single request, forwards it, and discards it immediately. It must never be persisted to `users`, written to logs, or included in error-tracking payloads. Add a request-body scrubber to the logging middleware specifically for this route as a second line of defense.
- Chat context sent to Groq is scoped to what's visible on the page (current concept or problem, optionally current editor contents) — never the user's full project tree or account data, per §32 of the product spec.

---

## 7. API route summary

| Route | Method | Notes |
|---|---|---|
| `/api/auth/signup`, `/login`, `/logout`, `/forgot-password` | POST | See §3 |
| `/api/concepts/:languageSlug/:categorySlug` | GET | Paginated |
| `/api/concepts/:id/review` | POST | Marks reviewed, triggers `revision.service` |
| `/api/problems/:id` | GET | Excludes `solutions` and hidden test cases |
| `/api/problems/:id/hints/:order` | GET | Returns one hint at a time, not the array |
| `/api/problems/:id/solution` | GET | Only after explicit reveal action; logs `viewedSolution` on the submission |
| `/api/execute` | POST | Enqueues a job, returns a job ID |
| `/api/execute/:jobId` | GET / WS | Poll or subscribe for result |
| `/api/projects`, `/api/projects/:id/files` | CRUD | File-level granularity, not whole-project blobs |
| `/api/revision/due` | GET | Backs the dashboard's "due for review" |
| `/api/bookmarks` | GET/POST/DELETE | |
| `/api/teacher/chat` | POST | Groq proxy fallback — key travels in `X-Groq-Api-Key` header, per-request only |

---

## 8. What's still a real decision, not yet made

- Whether refresh tokens live in Mongo (revocable, more DB load) or are purely stateless JWTs (cheaper, harder to revoke early) — worth deciding based on how important instant logout-everywhere is to you.
- Container pooling strategy for the execution worker (pre-warmed pool vs. cold-start per job) — affects both cost and perceived run latency.
- Whether `revisionRecords.history` needs to survive long-term for the Progress page's "revision history" view, or whether a separate lightweight `revisionEvents` append-log collection is worth splitting out once volume grows.
