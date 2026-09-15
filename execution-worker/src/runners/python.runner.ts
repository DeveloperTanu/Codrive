import { LanguageRunner, ExecutionJob, ExecutionResult } from "../types";

export const pythonRunner: LanguageRunner = {
  image: "codrive-sandbox-python:latest",
  command: ["python", "/sandbox/entrypoint.py"],

  buildPayload(job: ExecutionJob): string {
    return `
import json

${job.code}

test_cases = ${JSON.stringify(job.testCases)}
results = []
for tc in test_cases:
    try:
        # Same note as the JS runner: the real harness looks up each
        # problem's declared entry-point function name rather than
        # hard-coding one here.
        results.append({"passed": False, "actualOutput": None})
    except Exception as e:
        results.append({"passed": False, "actualOutput": str(e)})

print(json.dumps({"__codrive_results__": results}))
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
