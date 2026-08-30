import { app } from "./app.js";
import { config } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db.js";

await connectDatabase();
const server = app.listen(config.PORT, () => console.log(`Adeeb Attendance API listening on port ${config.PORT}`));

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => { await disconnectDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
