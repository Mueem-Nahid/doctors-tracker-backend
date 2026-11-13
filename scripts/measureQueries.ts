import { performance } from "node:perf_hooks";
import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { DoctorModel } from "../src/app/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/app/modules/patients/patient.model.js";
import { DashboardService } from "../src/app/modules/dashboard/dashboard.service.js";

type ExplainResult = {
  executionStats?: {
    totalKeysExamined?: number;
    totalDocsExamined?: number;
    nReturned?: number;
    executionTimeMillis?: number;
  };
  queryPlanner?: { winningPlan?: unknown };
};

function containsBlockingSort(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsBlockingSort);
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.stage === "SORT" || Object.values(record).some(containsBlockingSort);
}

async function measureQueries(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  const firstDoctor = await DoctorModel.findOne().select("_id").lean();
  const prefixPattern = /^dashboard demo patient/i;
  const queryPlans: Array<{ name: string; explain: Promise<ExplainResult> }> = [
    {
      name: "doctor-default-page",
      explain: DoctorModel.find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .explain("executionStats") as Promise<ExplainResult>,
    },
    {
      name: "patient-default-page",
      explain: PatientModel.find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .explain("executionStats") as Promise<ExplainResult>,
    },
    {
      name: "patient-condition-default-sort",
      explain: PatientModel.find({ condition: "Diabetes" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .explain("executionStats") as Promise<ExplainResult>,
    },
    {
      name: "patient-prefix-search",
      explain: PatientModel.find({ $or: [{ name: prefixPattern }, { email: prefixPattern }] })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .explain("executionStats") as Promise<ExplainResult>,
    },
    ...(firstDoctor
      ? [
          {
            name: "patient-doctor-scoped-page",
            explain: PatientModel.find({ doctorId: firstDoctor._id })
              .sort({ createdAt: -1, _id: -1 })
              .limit(10)
              .explain("executionStats") as Promise<ExplainResult>,
          },
        ]
      : []),
    {
      name: "doctor-patient-count-sort",
      explain: DoctorModel.aggregate([
        {
          $lookup: {
            from: PatientModel.collection.name,
            localField: "_id",
            foreignField: "doctorId",
            as: "patients",
          },
        },
        { $addFields: { patientCount: { $size: "$patients" } } },
        { $sort: { patientCount: -1, _id: -1 } },
        { $limit: 10 },
      ]).explain("executionStats") as Promise<ExplainResult>,
    },
  ];
  const plans = await Promise.all(
    queryPlans.map(async ({ name, explain }) => {
      const result = await explain;
      const stats = result.executionStats;
      return {
        name,
        executionTimeMillis: stats?.executionTimeMillis ?? null,
        totalKeysExamined: stats?.totalKeysExamined ?? null,
        totalDocsExamined: stats?.totalDocsExamined ?? null,
        nReturned: stats?.nReturned ?? null,
        hasBlockingSort: containsBlockingSort(result.queryPlanner?.winningPlan),
      };
    }),
  );
  const dashboardStartedAt = performance.now();
  await DashboardService.summary("30d");
  const dashboardLatencyMs = Math.round((performance.now() - dashboardStartedAt) * 100) / 100;
  const [doctorCount, patientCount] = await Promise.all([
    DoctorModel.countDocuments(),
    PatientModel.countDocuments(),
  ]);
  console.info(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        seedOrDataset: { doctors: doctorCount, patients: patientCount },
        queryPlans: plans,
        dashboardSummary30dLatencyMs: dashboardLatencyMs,
      },
      null,
      2,
    ),
  );
}

measureQueries()
  .catch((error: unknown) => {
    console.error("Query measurement failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
