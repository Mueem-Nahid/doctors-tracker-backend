import {
  doctorInputSchema,
  doctorListQuerySchema,
  objectIdSchema,
} from "@doctor-tracker/contracts";
import { z } from "zod";

export const doctorCreateValidation = z.object({ body: doctorInputSchema });
export const doctorIdValidation = z.object({ params: z.object({ id: objectIdSchema }).strict() });
export const doctorListValidation = z.object({ query: doctorListQuerySchema });
