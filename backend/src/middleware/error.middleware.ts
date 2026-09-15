import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Never leak stack traces or internals in production. Also: never log
  // req.body wholesale on auth routes — see the scrubber note in
  // rateLimit.middleware.ts and the backend spec's §6 on the Groq proxy.
  console.error("[unhandled error]", err);
  const message = env.nodeEnv === "production" ? "Something went wrong." : String(err);
  res.status(500).json({ error: message });
}
