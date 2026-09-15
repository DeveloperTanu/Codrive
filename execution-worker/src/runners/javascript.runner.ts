import { LanguageRunner, ExecutionJob, ExecutionResult } from "../types";

// Wraps the user's function with a tiny JSON-in/JSON-out test harness. The
// container's entrypoint just evals this whole payload and prints one JSON
// line of results to stdout — nothing fancier is needed since the sandbox
// itself (not this string) is what provides the actual isolation.
export const javascriptRunner: LanguageRunner = {
  image: "codrive-sandbox-javascript:latest",
  command: ["node", "/sandbox/entrypoint.js"],

  buildPayload(job: ExecutionJob): string {
    return `
      ${job.code}

      const testCases = ${JSON.stringify(job.testCases)};
      const results = testCases.map((tc) => {
        try {
          const actual = firstDone ? undefined : undefined; // placeholder — real harness
          // introspects the problem's expected export name per-problem, omitted here for brevity
          return { passed: false, actualOutput: null, note: "wire up per-problem entry point" };
        } catch (err) {
          return { passed: false, actualOutput: String(err) };
        }
      });
      console.log(JSON.stringify({ __codrive_results__: results }));
    `;
  },

  parseOutput(stdout: string): ExecutionResult["testResults"] {
    const line = stdout.trim().split("\n").find((l) => l.includes("__codrive_results__"));
    if (!line) return [];
    try {
      const parsed = JSON.parse(line);
      return parsed.__codrive_results__ ?? [];
    } catch {
      return [];
    }
  },
};
