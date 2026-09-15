import Docker from "dockerode";
import { Writable } from "stream";
import { LanguageRunner, ExecutionJob, ExecutionResult } from "./types";

const docker = new Docker(); // connects to the local Docker socket

const WALL_CLOCK_TIMEOUT_MS = 10_000;
const MAX_STDOUT_BYTES = 64 * 1024; // truncate runaway output rather than let it grow unbounded

// Runs one job in a single-use, locked-down container and returns the
// captured result. This is the only function in the whole system that
// touches Docker directly — nothing upstream of this (API, queue) ever
// executes code itself.
export async function runInSandbox(job: ExecutionJob, runner: LanguageRunner): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const payload = runner.buildPayload(job);

  const container = await docker.createContainer({
    Image: runner.image,
    Cmd: runner.command,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: true,
    StdinOnce: true,
    HostConfig: {
      // --- resource limits, per §5 of the architecture spec ---
      Memory: 128 * 1024 * 1024, // 128MB hard cap
      MemorySwap: 128 * 1024 * 1024, // no additional swap beyond the memory limit
      NanoCpus: 0.5 * 1e9, // 0.5 CPU
      PidsLimit: 64, // blocks fork-bombs
      NetworkMode: "none", // no network access at all from inside the sandbox
      ReadonlyRootfs: true,
      Tmpfs: { "/tmp": "size=16m" }, // small writable scratch space only
      AutoRemove: true,
    },
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  try {
    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    await container.start();

    docker.modem.demuxStream(
      stream,
      new Writable({
        write(chunk, _encoding, callback) {
          stdout = (stdout + chunk.toString()).slice(0, MAX_STDOUT_BYTES);
          callback();
        },
      }),
      new Writable({
        write(chunk, _encoding, callback) {
          stderr = (stderr + chunk.toString()).slice(0, MAX_STDOUT_BYTES);
          callback();
        },
      })
    );

    stream.end(payload);

    const waitPromise = container.wait();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("EXECUTION_TIMEOUT")), WALL_CLOCK_TIMEOUT_MS);
    });

    const { StatusCode } = await Promise.race([waitPromise, timeoutPromise]) as { StatusCode: number };

    return {
      jobId: job.jobId,
      status: "completed",
      stdout,
      stderr,
      exitCode: StatusCode,
      testResults: runner.parseOutput(stdout, job),
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    timedOut = err instanceof Error && err.message === "EXECUTION_TIMEOUT";

    // Kill the container ourselves on timeout — AutoRemove only cleans up
    // containers that exit on their own, not ones we're forcibly abandoning.
    if (timedOut) {
      try { await container.kill(); } catch { /* already gone — fine */ }
    }

    return {
      jobId: job.jobId,
      status: timedOut ? "timeout" : "failed",
      stdout,
      stderr: timedOut ? "Execution exceeded the time limit." : String(err),
      exitCode: null,
      testResults: [],
      durationMs: Date.now() - startedAt,
    };
  }
}
