import { objectIdSchema, patientInputSchema, patientListQuerySchema } from "@doctor-tracker/contracts";
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
