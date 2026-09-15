FROM python:3.12-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox
USER sandbox

WORKDIR /sandbox
COPY entrypoint.py /sandbox/entrypoint.py
