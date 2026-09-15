import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { ensureSeedData } from "./seed/seed";

async function main() {
  await connectDB();
  await ensureSeedData();
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[server] Codrive API listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
