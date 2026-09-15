import { randomUUID } from "crypto";

// This service ONLY enqueues jobs — it never executes user code in this
// process. The actual sandboxing (Docker, resource limits, timeouts) lives in
// the separate `execution-worker` deployable described in the architecture
// spec (§5). This file is the thin contract between the API and that queue.

export interface ExecutionJob {
  jobId: string;
  language: string;
  code: string;
  testCases: Array<{ input: unknown; expectedOutput: unknown }>;
}

export interface ExecutionResult {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "timeout";
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  testResults?: Array<{ passed: boolean; actualOutput: unknown }>;
}

// In-memory stand-in for the real queue/result-store (Redis, SQS, etc.) so
// this scaffold runs without extra infrastructure. Swap the body of these
// two functions for real queue calls — the route/controller layer doesn't
// need to change.
const jobResults = new Map<string, ExecutionResult>();

export async function enqueueExecution(language: string, code: string, testCases: ExecutionJob["testCases"]): Promise<string> {
  const jobId = randomUUID();
  jobResults.set(jobId, { jobId, status: "queued" });

  // Placeholder: a real implementation pushes { jobId, language, code, testCases }
  // onto EXECUTION_QUEUE_URL and returns immediately. The worker consumes it,
  // runs it in a locked-down Docker container (see §5 — no network, memory and
  // CPU caps, wall-clock timeout, read-only filesystem), and writes the result
  // back keyed by jobId.
  return jobId;
}

export async function getExecutionResult(jobId: string): Promise<ExecutionResult | null> {
  return jobResults.get(jobId) ?? null;
}
