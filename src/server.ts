import mongoose from "mongoose";
import { app } from "./app.js";
import { config } from "./config/index.js";

async function startServer(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);

  const server = app.listen(config.PORT, () => {
    console.info(`Doctor Tracker API listening on port ${config.PORT}`);
  });

  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`Received ${signal}, closing the API server`);

    server.close((error) => {
      void mongoose.disconnect().finally(() => {
        if (error) {
          console.error("HTTP server failed to close cleanly", error);
          process.exitCode = 1;
        }
      });
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  console.error("Failed to start Doctor Tracker API", error);
  process.exitCode = 1;
});
