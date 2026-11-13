import { app } from "../src/app.js";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { config } from "../src/config/index.js";

let isConnected = false;

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isConnected) {
    await mongoose.connect(config.MONGODB_URI as string);
    isConnected = true;
    console.log("Database connected (Vercel serverless)");
  }
  app(req, res);
}
