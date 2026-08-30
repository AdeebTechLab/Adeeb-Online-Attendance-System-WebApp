import { app } from "./app.js";
import { config } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db.js";

let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  try {
    console.log("Starting Adeeb Attendance API...");

    // Connect MongoDB first
    await connectDatabase();

    server = app.listen(config.PORT, "0.0.0.0", () => {
      console.log(
        `Adeeb Attendance API listening on port ${config.PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error(error);

    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down...`);

  try {
    if (server) {
      server.close(async () => {
        try {
          await disconnectDatabase();
          console.log("Server and database disconnected successfully.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });
    } else {
      await disconnectDatabase();
      process.exit(0);
    }

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:");
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:");
  console.error(reason);
  process.exit(1);
});

void startServer();