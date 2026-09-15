import express from "express";
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

  app.get("/", (_req, res) => {
    res.json({
      service: "Codrive API",
      status: "ok",
      health: "/health",
      api: "/api",
    });
  });
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", routes);

  // Must be registered last — Express only treats a 4-arg middleware as an
  // error handler if nothing else comes after it.
  app.use(errorMiddleware);

  return app;
}
