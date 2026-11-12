import { nestedPatientDeleteRequestSchema, patientCreateRequestSchema, patientListRequestSchema } from "@doctor-tracker/contracts";
export const patientCreateValidation = patientCreateRequestSchema;
export const patientListValidation = patientListRequestSchema;
export const patientDeleteValidation = nestedPatientDeleteRequestSchema;
