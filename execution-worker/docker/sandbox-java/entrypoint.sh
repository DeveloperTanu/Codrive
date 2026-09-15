#!/bin/sh
# Writes the payload (java.runner.ts sends raw user code, expected to define
# a public class named Solution) to a file, compiles it, then runs it — all
# within the same wall-clock budget and resource caps as the other
# languages. Compile errors surface via stderr and a non-zero exit code,
# exactly like a runtime error would.
set -e

cat > /sandbox/Solution.java

javac /sandbox/Solution.java -d /sandbox 2>&1
java -cp /sandbox Solution
