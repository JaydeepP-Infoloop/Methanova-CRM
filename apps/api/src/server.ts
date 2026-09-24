import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { connectDb } from "./db/connection.js";
import { seed } from "./db/seed/index.js";
import { registerDefaultJobs } from "./jobs/index.js";

async function main(): Promise<void> {
  await connectDb();
  await seed();
  registerDefaultJobs();
  const app = createApp();
  app.listen(config.port, () => {
    console.info(`methanova-api listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
