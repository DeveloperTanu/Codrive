# Minimal Node image — no shell utilities beyond what's needed, no network
# tools, nothing that helps an escape attempt. Rebuild regularly from a
# pinned base tag for security patches.
FROM node:20-alpine

# Run as an unprivileged user, not root, even inside the container.
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox
USER sandbox

WORKDIR /sandbox
COPY entrypoint.js /sandbox/entrypoint.js

# No CMD here — dockerode's createContainer call in docker-runner.ts sets
# the Cmd explicitly per run, keeping the image itself inert.
