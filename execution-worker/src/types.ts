export interface ExecutionJob {
  jobId: string;
  language: "javascript" | "python" | "java";
  code: string;
  testCases: Array<{ input: unknown; expectedOutput: unknown }>;
}

export interface ExecutionResult {
  jobId: string;
  status: "completed" | "failed" | "timeout";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  testResults: Array<{ passed: boolean; actualOutput: unknown }>;
  durationMs: number;
}

// What every per-language runner must implement. Adding a new language means
// writing one of these plus a Dockerfile — nothing else in the worker,
// the queue contract, or the API changes.
export interface LanguageRunner {
  image: string; // Docker image tag, e.g. "codrive-sandbox-javascript:latest"
  command: string[]; // command that invokes this image's language-specific entrypoint
  /** Wraps user code + test harness into whatever the container's entrypoint expects on stdin. */
  buildPayload(job: ExecutionJob): string;
  /** Parses the container's raw stdout back into structured per-test results. */
  parseOutput(stdout: string, job: ExecutionJob): ExecutionResult["testResults"];
}
