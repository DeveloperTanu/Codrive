import dotenv from "dotenv";
dotenv.config();

import { QueueConsumer } from "./queue-consumer";

const consumer = new QueueConsumer();

consumer.start().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});

// Graceful shutdown — finish in-flight jobs' containers via their own
// AutoRemove/kill handling, just stop picking up new ones.
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received, stopping after in-flight jobs...");
  consumer.stop();
});
process.on("SIGINT", () => {
  console.log("[worker] SIGINT received, stopping after in-flight jobs...");
  consumer.stop();
});
