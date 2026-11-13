import { app } from "../src/app";
import mongoose from "mongoose";
import { config } from "../src/config";

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    await mongoose.connect(config.MONGODB_URI as string);
    isConnected = true;
    console.log("Database connected (Vercel serverless)");
  }
  return app(req, res);
}
