import type { RequestHandler } from "express";
import { sendData } from "../../../shared/sendResponse.js";
import { DashboardService } from "./dashboard.service.js";

const summary: RequestHandler = async (request, response) => {
  const { query } = request.validated as { query: { range: "7d" | "30d" | "90d" | "12m" } };
  sendData(response, 200, await DashboardService.summary(query.range));
};

export const DashboardController = { summary };
