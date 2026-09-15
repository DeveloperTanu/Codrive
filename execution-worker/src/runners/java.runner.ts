import { LanguageRunner, ExecutionJob, ExecutionResult } from "../types";

// Java needs a compile step before it runs, which is why its Dockerfile
// entrypoint (see docker/sandbox-java) differs from the interpreted
// languages: it writes the payload to Solution.java, compiles it, then runs
// the result — all inside the same locked-down container and wall-clock
// budget as the others.
export const javaRunner: LanguageRunner = {
  image: "codrive-sandbox-java:latest",
  command: ["sh", "/sandbox/entrypoint.sh"],

  buildPayload(job: ExecutionJob): string {
    return job.code; // entrypoint.sh handles wrapping/compiling; kept simple here
  },

  parseOutput(stdout: string): ExecutionResult["testResults"] {
    const line = stdout.trim().split("\n").find((l) => l.includes("__codrive_results__"));
    if (!line) return [];
    try {
      const jsonPart = line.substring(line.indexOf("{"));
      const parsed = JSON.parse(jsonPart);
      return parsed.__codrive_results__ ?? [];
    } catch {
      return [];
    }
  },
};
