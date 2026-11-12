import { Router } from "express";
import { sendData } from "../../../shared/sendResponse.js";
import { DoctorService } from "../doctors/doctor.service.js";

export const metaRouter = Router();
metaRouter.get("/filters", async (_request, response) => {
  sendData(response, 200, await DoctorService.filterOptions());
});
