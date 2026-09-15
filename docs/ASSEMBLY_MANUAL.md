# Codrive — Assembly Manual

This walks through putting the whole project together from the downloaded zip to a working, signed-in app in your browser. Follow it in order — each step depends on the one before it.

---

## 0. What you need installed first

| Tool | Why | Check with |
|---|---|---|
| Node.js 20+ | Runs the backend, the worker, and local dev tooling | `node -v` |
| npm | Comes with Node | `npm -v` |
| MongoDB | The database everything reads/writes to | see step 1 |
| A terminal | You'll run several long-lived processes side by side | — |

You do **not** need Docker or Redis to get the app itself working end to end — those are only needed for the optional last section (real sandboxed code execution). Skip ahead if you just want the app running.

---

## 1. Unzip and orient yourself

Unzip `codrive-final.zip` wherever you keep projects. You'll get:

```
codrive-final/
├── frontend/           the 11 HTML pages — open none of these directly yet
├── backend/             the Express + MongoDB API
├── execution-worker/     the Docker sandbox (optional, see §6)
├── docs/
│   ├── codrive-backend-spec.md   full architecture reference
│   └── ASSEMBLY_MANUAL.md         this file
└── README.md
```

Open a terminal and `cd` into this unzipped folder. You'll be opening three terminal tabs total by the end: one for MongoDB, one for the backend, one for serving the frontend.

---

## 2. Get MongoDB running

Pick whichever is easiest for you — the backend doesn't care which.

**Option A — Docker (simplest if you have Docker installed):**
```bash
docker run -d --name codrive-mongo -p 27017:27017 mongo
```

**Option B — a local MongoDB install:**
```bash
mongod --dbpath /some/folder/you/created
```
(Leave this running in its own terminal tab.)

**Option C — MongoDB Atlas (free cloud tier, no local install):**
Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), get its connection string (looks like `mongodb+srv://user:pass@cluster.mongodb.net/codrive`) — you'll paste this into the backend's `.env` in the next step instead of a local URI.

Either way, you should end up with **one MongoDB instance reachable at some URI.** Keep that URI handy.

---

## 3. Set up and start the backend

```bash
cd backend
npm install
```

Copy the example environment file and edit it:
```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in:

- `MONGODB_URI` — the URI from step 2 (e.g. `mongodb://localhost:27017/codrive` for Option A/B, or your Atlas string for Option C)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — two different long random strings. Generate each with:
  ```bash
  openssl rand -hex 32
  ```
  (Run it twice, paste one result into each field. If you don't have `openssl`, any long random string works — these just need to be unguessable and different from each other.)
- `FRONTEND_ORIGIN` — leave the default (`http://localhost:5173`) for now; you'll confirm this matches step 4 in a moment.

Seed the database with sample content (JavaScript Promises, Python Decorators, one full problem):
```bash
npm run seed
```
You should see `[seed] done.` printed. If this fails, it's almost always `MONGODB_URI` — double-check MongoDB is actually running and reachable.

Start the API:
```bash
npm run dev
```
You should see:
```
[db] connected to MongoDB
[server] Codrive API listening on :4000
```
**Leave this running.** Open a new terminal tab for the next step.

---

## 4. Serve the frontend

The frontend cannot be opened as a `file://` page — the login system depends on a browser cookie that only works over a real HTTP address. Serve the folder instead:

```bash
cd frontend
npx serve .
```

This will print an address, typically `http://localhost:3000`. **Note the exact port it gives you.**

If that port isn't `5173` (the backend's default `FRONTEND_ORIGIN`), go back to `backend/.env`, set `FRONTEND_ORIGIN` to whatever `npx serve` printed (e.g. `http://localhost:3000`), and restart the backend (`Ctrl+C` then `npm run dev` again in that tab).

*(Any static file server works here — `python3 -m http.server 5500`, VS Code's Live Server extension, etc. Just keep `FRONTEND_ORIGIN` in sync with whatever address you actually browse to.)*

---

## 5. Open it and sign up

Go to the address `npx serve` printed. You'll land on the Codrive landing page.

1. Click **Get Started** (or navigate directly to `codrive-auth.html`).
2. Click **Create an account**, fill in a name/email/password, submit.
3. You should land on your real profile page with your actual name and email.
4. Go to the dashboard — your name should appear in the sidebar instead of a placeholder.
5. Go to **Practice** → open the Promises concept → click the bookmark icon → go to **Bookmarks** and confirm it's actually there.
6. Back on Practice, click **Mark as reviewed** → go to the **Dashboard** or **Progress** page and confirm the numbers moved.

If all of that works, the full stack is connected correctly: frontend → backend → MongoDB, round trip.

---

## 6. (Optional) Wire in real sandboxed code execution

Everything above works without this section — problem submissions currently run through a lightweight in-memory check in `execution.service.ts`. This section connects the actual Docker sandbox described in the architecture spec. Skip it unless you specifically want real, isolated code execution.

**Requirements for this section only:** Docker, and Redis.

**6.1 — Start Redis:**
```bash
docker run -d --name codrive-redis -p 6379:6379 redis:7-alpine
```

**6.2 — Build the three sandbox images:**
```bash
cd execution-worker
docker build -t codrive-sandbox-javascript:latest docker/sandbox-javascript
docker build -t codrive-sandbox-python:latest docker/sandbox-python
docker build -t codrive-sandbox-java:latest docker/sandbox-java
```

**6.3 — Connect the backend to the queue:**
Open `backend/src/services/execution.service.ts`. Replace the in-memory `Map`-based `enqueueExecution`/`getExecutionResult` functions with real pushes/reads against the Redis queue — this is intentionally left as the one integration point, since it's a five-minute change once you've decided on your queue client, and forcing one choice on you here would be presumptuous. The worker already expects jobs on the `codrive:execution-jobs` Redis list and writes results to `codrive:execution-result:<jobId>`, matching the shape documented in `execution-worker/README.md`.

**6.4 — Start the worker:**
```bash
cd execution-worker
npm install
cp .env.example .env   # point EXECUTION_QUEUE_URL at your Redis instance if not localhost:6379
npm run dev
```

From here, problem submissions on the practice page will run in real, resource-limited, network-isolated containers instead of the local placeholder check.

---

## Troubleshooting

**"Couldn't reach the Codrive API" banner on any page**
The backend isn't running, or `FRONTEND_ORIGIN` doesn't match the address you're browsing to. Check the backend's terminal tab for errors, and confirm the exact URL bar address matches `FRONTEND_ORIGIN` in `.env`.

**Signup/login works but reloading the page signs you out**
Almost always a cookie/CORS mismatch — same fix as above. Also confirm you're not opening the page as `file://` (see step 4).

**`npm run seed` fails immediately**
`MONGODB_URI` is wrong, or MongoDB isn't running yet. Test the connection independently first (e.g. `mongosh "your-uri-here"`).

**Practice page says "Seed data not found"**
You started the backend before running `npm run seed`, or seeded against a different database than the one the backend is currently pointed at. Re-run `npm run seed` against the same `MONGODB_URI` the running backend uses.

**Bookmark/review buttons silently do nothing**
Open the browser console — the most common cause is `accessToken` expiring mid-session with no page reload to trigger a refresh. Reload the page; the silent-refresh flow on load should reauthenticate you against the still-valid refresh cookie.

---

## Reference

- `docs/codrive-backend-spec.md` — full database schema, API route list, and architecture reasoning.
- `backend/README.md` — backend-specific details, what's real vs. stubbed.
- `execution-worker/README.md` — sandbox internals, resource limits, adding a new language.
