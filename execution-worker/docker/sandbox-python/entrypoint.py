# Same role as the JavaScript sandbox's entrypoint.js: read the assembled
# payload (user code + inline test harness, built by python.runner.ts) from
# stdin and exec it. The container boundary — not this script — is what
# actually provides isolation.
import sys

source = sys.stdin.read()
try:
    exec(source, {"__name__": "__main__"})
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
