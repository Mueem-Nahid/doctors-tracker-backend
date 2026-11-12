import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "../modules/auth/auth.route.js";
import { requireAdmin } from "../modules/auth/auth.middleware.js";
import { browserMutationGuard } from "../middlewares/browserMutationGuard.js";
import { ApiError } from "../../errors/ApiError.js";
import { doctorRouter } from "../modules/doctors/doctor.route.js";
import { metaRouter } from "../modules/meta/meta.route.js";

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

apiRouter.use("/auth", authRouter);
apiRouter.use(browserMutationGuard, requireAdmin);
apiRouter.use("/meta", metaRouter);
apiRouter.use("/doctors", doctorRouter);
apiRouter.use((_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "API endpoint not found"));
});
