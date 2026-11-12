import { doctorCreateRequestSchema, doctorIdParamsSchema, doctorListRequestSchema } from "@doctor-tracker/contracts";
export const doctorCreateValidation = doctorCreateRequestSchema;
export const doctorIdValidation = doctorIdParamsSchema;
export const doctorListValidation = doctorListRequestSchema;
