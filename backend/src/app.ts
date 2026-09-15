import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { env } from "./config/env";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", routes);

  // In production the API serves the static frontend too, so one Render web
  // service exposes the actual Codrive app at `/` rather than an API-only page.
  app.use(express.static(path.resolve(process.cwd(), "../frontend")));

  // Must be registered last — Express only treats a 4-arg middleware as an
  // error handler if nothing else comes after it.
  app.use(errorMiddleware);

  return app;
}
