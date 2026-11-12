import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { requireObjectIds } from "../../middlewares/requireObjectIds.js";
import { PatientController } from "./patient.controller.js";
import { patientCreateValidation, patientDeleteValidation, patientListValidation } from "./patient.validation.js";

export const patientRouter = Router({ mergeParams: true });
patientRouter.get("/", validateRequest(patientListValidation), PatientController.list);
patientRouter.post("/", validateRequest(patientCreateValidation), PatientController.create);
patientRouter.delete("/:patientId", requireObjectIds, validateRequest(patientDeleteValidation), PatientController.remove);
