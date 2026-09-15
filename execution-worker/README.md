# Codrive Execution Worker

The one piece of Codrive that runs untrusted user code — deliberately kept as its own deployable, separate from the main API, per §5 of the architecture spec. If this crashes or gets overwhelmed, it never takes the API down with it.

## How it fits together

```
Main API (execution.service.ts)
    → pushes a job onto Redis list `codrive:execution-jobs`
    → returns a jobId to the browser immediately

This worker
    → BLPOP's a job off that list
    → picks the right runner (javascript.runner.ts / python.runner.ts / java.runner.ts)
    → creates a single-use, locked-down Docker container from that language's
      sandbox image (docker-runner.ts applies all the resource limits)
    → captures stdout/stderr/exit code, parses test results
    → writes the result to Redis under `codrive:execution-result:<jobId>`, TTL 10 minutes

Main API
    → polls or subscribes for that key, relays it back to the browser
```

## What's real vs. what's a placeholder

**Real and load-bearing:**
- The container resource limits in `docker-runner.ts` — memory cap, CPU share, no network, pid limit, read-only filesystem, wall-clock timeout enforced by the worker itself (not trusted to the code being run).
- The queue/result-store contract — this is the actual interface the main API's `execution.service.ts` should be pointed at once both are deployed.
- The three Dockerfiles — buildable as-is, minimal images, unprivileged user inside each container.

**Deliberately left as a placeholder — needs real per-problem wiring:**
- Each runner's `buildPayload`/`parseOutput` currently has a generic stand-in test harness. A real implementation needs each `Problem` document (see the main API's schema) to declare its expected function/class entry point so the harness can call it with each test case's input and compare the result — that mapping is product-specific enough that it didn't make sense to guess at here.
- The Java entrypoint assumes a public class named `Solution`; real problems would need this convention documented wherever problem content gets authored.

## Building the sandbox images

```bash
docker build -t codrive-sandbox-javascript:latest docker/sandbox-javascript
docker build -t codrive-sandbox-python:latest docker/sandbox-python
docker build -t codrive-sandbox-java:latest docker/sandbox-java
```

These are the image tags `javascript.runner.ts`, `python.runner.ts`, and `java.runner.ts` reference — build them before starting the worker, or job execution will fail with an "image not found" error.

## Running it

```bash
npm install
cp .env.example .env
npm run dev
```

Requires a reachable Redis instance and a reachable Docker daemon (the worker talks to Docker via the local socket — see the note in `docker-compose.yml` about what that implies for where you deploy this).

Or via Docker Compose, after building the three sandbox images above:
```bash
npm run build
docker compose up
```

## Adding a new language

1. Write a Dockerfile + entrypoint under `docker/sandbox-<language>/`, following the existing three as a template.
2. Write a runner in `src/runners/<language>.runner.ts` implementing `LanguageRunner` from `src/types.ts`.
3. Register it in the `runners` map in `queue-consumer.ts`.

Nothing else changes — not the queue contract, not the API, not the frontend's editor.
