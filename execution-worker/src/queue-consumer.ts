import Redis from "ioredis";
import { ExecutionJob, ExecutionResult, LanguageRunner } from "./types";
import { runInSandbox } from "./docker-runner";
import { javascriptRunner } from "./runners/javascript.runner";
import { pythonRunner } from "./runners/python.runner";
import { javaRunner } from "./runners/java.runner";

const QUEUE_URL = process.env.EXECUTION_QUEUE_URL || "redis://localhost:6379";
const QUEUE_NAME = process.env.EXECUTION_QUEUE_NAME || "codrive:execution-jobs";
const RESULT_PREFIX = process.env.RESULT_STORE_PREFIX || "codrive:execution-result:";
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "4", 10);
const RESULT_TTL_SECONDS = 60 * 10; // results only need to live long enough for the API to poll them

const runners: Record<ExecutionJob["language"], LanguageRunner> = {
  javascript: javascriptRunner,
  python: pythonRunner,
  java: javaRunner,
};

// This worker and the main API communicate ONLY through this queue and the
// paired result store — never a direct function call, never a shared
// process. That's what lets this worker restart, scale, or crash
// independently of the API per §5 of the architecture spec.
export class QueueConsumer {
  private redis: Redis;
  private activeJobs = 0;
  private stopping = false;

  constructor() {
    this.redis = new Redis(QUEUE_URL);
  }

  async start() {
    console.log(`[worker] listening on "${QUEUE_NAME}", max ${MAX_CONCURRENT_JOBS} concurrent jobs`);
    while (!this.stopping) {
      if (this.activeJobs >= MAX_CONCURRENT_JOBS) {
        await sleep(200);
        continue;
      }

      // BLPOP blocks until a job arrives rather than polling in a tight loop.
      const popped = await this.redis.blpop(QUEUE_NAME, 5);
      if (!popped) continue; // timed out waiting — loop and check `stopping` again

      const [, raw] = popped;
      this.activeJobs++;
      this.handleJob(raw).finally(() => { this.activeJobs--; });
    }
  }

  stop() {
    this.stopping = true;
  }

  private async handleJob(raw: string) {
    let job: ExecutionJob;
    try {
      job = JSON.parse(raw);
    } catch {
      console.error("[worker] received malformed job payload, dropping it");
      return;
    }

    const runner = runners[job.language];
    if (!runner) {
      await this.writeResult(job.jobId, {
        jobId: job.jobId,
        status: "failed",
        stdout: "",
        stderr: `Unsupported language: ${job.language}`,
        exitCode: null,
        testResults: [],
        durationMs: 0,
      });
      return;
    }

    console.log(`[worker] running job ${job.jobId} (${job.language})`);
    const result = await runInSandbox(job, runner);
    await this.writeResult(job.jobId, result);
    console.log(`[worker] job ${job.jobId} finished: ${result.status} (${result.durationMs}ms)`);
  }

  private async writeResult(jobId: string, result: ExecutionResult) {
    // Result never includes container internals, env vars, or the host
    // filesystem — only stdout/stderr/exit code/test results, exactly what
    // the API contract in execution.service.ts expects back.
    await this.redis.set(RESULT_PREFIX + jobId, JSON.stringify(result), "EX", RESULT_TTL_SECONDS);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
