import { Response } from "express";
import { proxyTeacherChat } from "../services/groq.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { AuthedRequest } from "../middleware/auth.middleware";

// This route is the fallback path described in groq.service.ts — the
// preferred path is the browser calling Groq directly with the key held
// client-side. Either way, the key arrives in a header on this one request
// and is discarded the moment the response is sent; nothing here persists it.
export const chat = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const apiKey = req.headers["x-groq-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    throw new ApiError(400, "Missing X-Groq-Api-Key header.");
  }

  const { message, context, history } = req.body;
  if (!message || typeof message !== "string") {
    throw new ApiError(400, "message is required.");
  }

  try {
    const result = await proxyTeacherChat({ apiKey, message, context: context || {}, history });
    res.json(result);
  } catch (err) {
    // Errors from groq.service.ts are already scrubbed of the key and any
    // raw internals — safe to relay their message directly.
    throw new ApiError(502, err instanceof Error ? err.message : "Teacher AI request failed.");
  }
});
