// Reads the full job payload (user code + test harness, already assembled by
// javascript.runner.ts) from stdin, evaluates it, and lets it print its own
// single JSON results line to stdout. This file intentionally does almost
// nothing — the isolation comes from the container boundary (§5 of the
// architecture spec: no network, memory/CPU/pid caps, read-only filesystem,
// wall-clock timeout enforced by the worker), not from anything clever here.

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    // eslint-disable-next-line no-eval
    eval(input);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }
});
