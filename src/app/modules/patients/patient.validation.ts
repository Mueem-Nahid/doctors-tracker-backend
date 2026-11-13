import {
  globalPatientInputSchema,
  globalPatientListQuerySchema,
  objectIdSchema,
  patientInputSchema,
  patientListQuerySchema,
  patientPatchSchema,
} from "@doctor-tracker/contracts";
import { z } from "zod";

export const patientCreateValidation = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
  body: patientInputSchema,
});
export const patientListValidation = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
  query: patientListQuerySchema,
});
export const patientDeleteValidation = z.object({
  params: z.object({ id: objectIdSchema, patientId: objectIdSchema }).strict(),
});
export const globalPatientListValidation = z.object({ query: globalPatientListQuerySchema });
export const globalPatientCreateValidation = z.object({ body: globalPatientInputSchema });
export const patientIdValidation = z.object({ params: z.object({ id: objectIdSchema }).strict() });
export const patientUpdateValidation = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
  body: patientPatchSchema,
});
