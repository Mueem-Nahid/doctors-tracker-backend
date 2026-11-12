import { z } from "zod";
import { loginSchema } from "@doctor-tracker/contracts";

export const loginRequestSchema = z.object({
  body: loginSchema.strict(),
});
