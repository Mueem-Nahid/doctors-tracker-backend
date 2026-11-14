import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const reportingRangeSchema = z.enum(["7d", "30d", "90d", "12m"]);

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

const dateQuerySchema = z.iso.date();
const repeatedTextFacetSchema = z.preprocess(
  (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
  z.array(z.string().trim().min(1).max(100)).max(10),
);
const repeatedEnumFacetSchema = (values: readonly string[]) =>
  z.preprocess(
    (value) => {
      const parts =
        value === undefined
          ? []
          : Array.isArray(value)
            ? value.flatMap((part) => (typeof part === "string" ? part.split(",") : [part]))
            : typeof value === "string"
              ? value.split(",")
              : [value];
      return parts
        .filter((part) => typeof part !== "string" || part.trim() !== "")
        .map((part) => (typeof part === "string" ? part.trim() : part));
    },
    z.array(z.enum(values)).max(10),
  );

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource ID");
const phoneSchema = z.string().regex(/^\d{11}$/, "Phone number must be exactly 11 digits");

export const doctorInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    specialization: z.string().trim().min(2).max(100),
    hospital: z.string().trim().min(2).max(160),
    phone: phoneSchema,
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export const doctorSortSchema = z.enum([
  "name.asc",
  "name.desc",
  "specialization.asc",
  "specialization.desc",
  "hospital.asc",
  "hospital.desc",
  "patients.asc",
  "patients.desc",
  "createdAt.asc",
  "createdAt.desc",
]);

export const doctorListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: paginationQuerySchema.shape.page,
    pageSize: paginationQuerySchema.shape.pageSize,
    sort: doctorSortSchema.default("createdAt.desc"),
    from: dateQuerySchema.optional(),
    to: dateQuerySchema.optional(),
    specialization: repeatedTextFacetSchema,
    hospital: repeatedTextFacetSchema,
  })
  .strict()
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after start date",
      });
    }
  });

export const doctorIdParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
});

export const doctorCreateRequestSchema = z.object({
  body: doctorInputSchema,
});

export const doctorListRequestSchema = z.object({
  query: doctorListQuerySchema,
});

export const doctorSchema = z.object({
  _id: z.string(),
  name: z.string(),
  specialization: z.string(),
  hospital: z.string(),
  phone: z.string(),
  email: z.email(),
  patientCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const genderValues = ["male", "female", "other"] as const;
const patientStatusValues = ["Active", "Under observation", "Discharged"] as const;
const patientConditionValues = [
  "Hypertension",
  "Diabetes",
  "Asthma",
  "Cardiac",
  "Orthopedic",
  "Neurological",
  "Dermatological",
  "Respiratory",
  "Other",
] as const;
export const genderSchema = z.enum(genderValues);
export const patientStatusSchema = z.enum(patientStatusValues);
export const patientConditionSchema = z.enum(patientConditionValues);

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .email()
    .trim()
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
);

export const patientInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    age: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(0).max(120),
    ),
    gender: genderSchema,
    phone: phoneSchema,
    email: optionalEmailSchema,
    condition: patientConditionSchema,
    status: patientStatusSchema.default("Active"),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const patientSortSchema = z.enum([
  "name.asc",
  "name.desc",
  "age.asc",
  "age.desc",
  "condition.asc",
  "condition.desc",
  "status.asc",
  "status.desc",
  "createdAt.asc",
  "createdAt.desc",
]);

export const patientListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: paginationQuerySchema.shape.page,
    pageSize: paginationQuerySchema.shape.pageSize,
    sort: patientSortSchema.default("createdAt.desc"),
    from: dateQuerySchema.optional(),
    to: dateQuerySchema.optional(),
    condition: repeatedEnumFacetSchema(patientConditionValues),
    status: repeatedEnumFacetSchema(patientStatusValues),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after start date",
      });
    }
  });

export const globalPatientListQuerySchema = patientListQuerySchema
  .extend({
    doctorId: z.preprocess(
      (value) =>
        value === undefined
          ? []
          : Array.isArray(value)
            ? value
            : typeof value === "string"
              ? value.split(",").filter(Boolean)
              : [value],
      z.array(objectIdSchema).max(10),
    ),
  })
  .strict();

export const globalPatientInputSchema = patientInputSchema
  .extend({ doctorId: objectIdSchema })
  .strict();
export const patientPatchSchema = z
  .object({
    doctorId: objectIdSchema.optional(),
    name: patientInputSchema.shape.name.optional(),
    age: patientInputSchema.shape.age.optional(),
    gender: genderSchema.optional(),
    phone: patientInputSchema.shape.phone.optional(),
    email: z
      .union([
        z
          .email()
          .trim()
          .max(254)
          .transform((value) => value.toLowerCase()),
        z.literal(null),
      ])
      .optional(),
    condition: patientConditionSchema.optional(),
    status: patientStatusSchema.optional(),
    notes: z.union([z.string().trim().max(500), z.literal(null)]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const patientListRequestSchema = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
  query: patientListQuerySchema,
});

export const patientCreateRequestSchema = z.object({
  params: z.object({ id: objectIdSchema }).strict(),
  body: patientInputSchema,
});

export const nestedPatientDeleteRequestSchema = z.object({
  params: z.object({ id: objectIdSchema, patientId: objectIdSchema }).strict(),
});

export const patientRowSchema = z.object({
  _id: z.string(),
  doctorId: z.string(),
  doctorName: z.string(),
  name: z.string(),
  age: z.number().int(),
  gender: genderSchema,
  phone: z.string(),
  email: z.email().optional(),
  condition: patientConditionSchema,
  status: patientStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const patientDetailSchema = patientRowSchema.extend({
  notes: z.string().optional(),
});

export const dashboardSummarySchema = z.object({
  kpis: z.object({
    totalDoctors: z.number().int().nonnegative(),
    totalPatients: z.number().int().nonnegative(),
    avgPatientsPerDoctor: z.number().nonnegative(),
    newPatients: z.object({
      value: z.number().int().nonnegative(),
      previous: z.number().int().nonnegative(),
      deltaPct: z.number().nullable(),
    }),
  }),
  patientsOverTime: z.array(
    z.object({ date: z.iso.date(), count: z.number().int().nonnegative() }),
  ),
  patientsByCondition: z.array(
    z.object({
      condition: z.string(),
      count: z.number().int().nonnegative(),
      isGrouped: z.boolean().optional(),
    }),
  ),
  patientsPerDoctor: z.array(
    z.object({
      doctorId: z.string(),
      name: z.string(),
      count: z.number().int().positive(),
    }),
  ),
  doctorsBySpecialization: z.array(
    z.object({
      specialization: z.string(),
      count: z.number().int().nonnegative(),
      isGrouped: z.boolean().optional(),
    }),
  ),
  recentPatients: z.array(
    z.object({
      _id: z.string(),
      name: z.string(),
      doctorId: z.string(),
      doctorName: z.string(),
      condition: patientConditionSchema,
      status: patientStatusSchema,
      createdAt: z.iso.datetime(),
    }),
  ),
});

export const pageSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      pageCount: z.number().int(),
    }),
  });

export type DoctorInput = z.infer<typeof doctorInputSchema>;
export type Doctor = z.infer<typeof doctorSchema>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
export type PatientInput = z.infer<typeof patientInputSchema>;
export type PatientRow = z.infer<typeof patientRowSchema>;
export type PatientDetail = z.infer<typeof patientDetailSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
export type GlobalPatientListQuery = z.infer<typeof globalPatientListQuerySchema>;
export type GlobalPatientInput = z.infer<typeof globalPatientInputSchema>;
export type PatientPatch = z.infer<typeof patientPatchSchema>;
export type Page<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};

export type LoginInput = z.infer<typeof loginSchema>;
export type ReportingRange = z.infer<typeof reportingRangeSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
