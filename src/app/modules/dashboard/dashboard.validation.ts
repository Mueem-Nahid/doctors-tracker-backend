import { reportingRangeSchema } from "@doctor-tracker/contracts";
import { z } from "zod";

export const dashboardSummaryValidation = z.object({
  query: z.object({ range: reportingRangeSchema.default("30d") }).strict(),
});
