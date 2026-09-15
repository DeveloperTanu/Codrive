# Java needs a JDK to compile, unlike the interpreted languages — everything
# else about the sandboxing (resource limits, no network, read-only fs) is
# identical and enforced the same way by docker-runner.ts at container
# creation time, not by anything in this image.
FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox
USER sandbox

WORKDIR /sandbox
COPY entrypoint.sh /sandbox/entrypoint.sh
