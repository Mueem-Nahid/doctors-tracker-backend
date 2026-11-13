import mongoose from "mongoose";
import { config } from "./index.js";

let connectionPromise: Promise<typeof mongoose> | undefined;

mongoose.connection.on("disconnected", () => {
  connectionPromise = undefined;
});

export async function connectToDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.MONGODB_URI).catch((error: unknown) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
}
