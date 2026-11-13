import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { DashboardController } from "./dashboard.controller.js";
import { dashboardSummaryValidation } from "./dashboard.validation.js";

export const dashboardRouter = Router();
dashboardRouter.get(
  "/summary",
  validateRequest(dashboardSummaryValidation),
  DashboardController.summary,
);
