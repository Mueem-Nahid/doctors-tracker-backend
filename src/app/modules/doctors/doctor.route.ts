import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { requireObjectIds } from "../../middlewares/requireObjectIds.js";
import { DoctorController } from "./doctor.controller.js";
import {
  doctorCreateValidation,
  doctorIdValidation,
  doctorListValidation,
} from "./doctor.validation.js";
import { patientRouter } from "../patients/patient.route.js";

export const doctorRouter = Router();
doctorRouter.get("/", validateRequest(doctorListValidation), DoctorController.list);
doctorRouter.post("/", validateRequest(doctorCreateValidation), DoctorController.create);
doctorRouter.get(
  "/:id",
  requireObjectIds,
  validateRequest(doctorIdValidation),
  DoctorController.getById,
);
doctorRouter.use("/:id/patients", requireObjectIds, patientRouter);
