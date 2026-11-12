import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { requireObjectIds } from "../../middlewares/requireObjectIds.js";
import { PatientController } from "./patient.controller.js";
import { globalPatientCreateValidation, globalPatientListValidation, patientCreateValidation, patientDeleteValidation, patientIdValidation, patientListValidation, patientUpdateValidation } from "./patient.validation.js";

export const patientRouter = Router({ mergeParams: true });
patientRouter.get("/", validateRequest(patientListValidation), PatientController.list);
patientRouter.post("/", validateRequest(patientCreateValidation), PatientController.create);
patientRouter.delete("/:patientId", requireObjectIds, validateRequest(patientDeleteValidation), PatientController.remove);

export const globalPatientRouter = Router();
globalPatientRouter.get("/", validateRequest(globalPatientListValidation), PatientController.listGlobal);
globalPatientRouter.post("/", validateRequest(globalPatientCreateValidation), PatientController.createGlobal);
globalPatientRouter.get("/:id", validateRequest(patientIdValidation), PatientController.getById);
globalPatientRouter.patch("/:id", validateRequest(patientUpdateValidation), PatientController.update);
globalPatientRouter.delete("/:id", validateRequest(patientIdValidation), PatientController.deleteGlobal);
