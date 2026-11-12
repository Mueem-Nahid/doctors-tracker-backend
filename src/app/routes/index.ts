import { Router } from "express";
import mongoose from "mongoose";

export const apiRouter = Router();

apiRouter.get("/health/live", (_request, response) => {
  response.status(200).json({ data: { status: "ok" } });
});

apiRouter.get("/health/ready", (_request, response) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;
  response.status(isDatabaseConnected ? 200 : 503).json({
    data: { status: isDatabaseConnected ? "ok" : "unavailable" },
  });
});
