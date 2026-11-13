import { DoctorModel } from "../doctors/doctor.model.js";
import { PatientModel } from "../patients/patient.model.js";

async function doctorsSummary() {
  const [result] = await DoctorModel.aggregate([
    { $facet: {
      total: [{ $count: "value" }],
      specializations: [
        { $group: { _id: "$specializationNormalized", label: { $first: "$specialization" }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
      ],
    } },
  ]);
  return result as { total: Array<{ value: number }>; specializations: Array<{ _id: string; label: string; count: number }> };
}

async function patientsSummary() {
  const [result] = await PatientModel.aggregate([
    { $facet: {
      total: [{ $count: "value" }],
      conditions: [
        { $group: { _id: "$condition", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ],
      doctors: [
        { $group: { _id: "$doctorId", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 8 },
        { $lookup: { from: "doctors", localField: "_id", foreignField: "_id", pipeline: [{ $project: { name: 1 } }], as: "doctor" } },
        { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: false } },
        { $project: { _id: 1, count: 1, name: "$doctor.name" } },
      ],
    } },
  ]);
  return result as {
    total: Array<{ value: number }>;
    conditions: Array<{ _id: string; count: number }>;
    doctors: Array<{ _id: { toString(): string }; name: string; count: number }>;
  };
}

async function patientWindows(from: Date, currentFrom: Date, now: Date, timezone: string, unit: "day" | "week" | "month") {
  const [result] = await PatientModel.aggregate([
    { $match: { createdAt: { $gte: from, $lt: now } } },
    { $facet: {
      counts: [{ $group: {
        _id: null,
        current: { $sum: { $cond: [{ $gte: ["$createdAt", currentFrom] }, 1, 0] } },
        previous: { $sum: { $cond: [{ $lt: ["$createdAt", currentFrom] }, 1, 0] } },
      } }],
      buckets: [
        { $match: { createdAt: { $gte: currentFrom } } },
        { $group: { _id: { $dateTrunc: { date: "$createdAt", unit, ...(unit === "week" ? { startOfWeek: "monday" } : {}), timezone } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    } },
  ]);
  return result as { counts: Array<{ current: number; previous: number }>; buckets: Array<{ _id: Date; count: number }> };
}

async function recentPatients() {
  return PatientModel.aggregate([
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 5 },
    { $lookup: { from: "doctors", localField: "doctorId", foreignField: "_id", pipeline: [{ $project: { name: 1 } }], as: "doctor" } },
    { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: false } },
    { $project: { _id: 1, name: 1, doctorId: 1, doctorName: "$doctor.name", condition: 1, status: 1, createdAt: 1 } },
  ]) as Promise<Array<{ _id: { toString(): string }; doctorId: { toString(): string }; name: string; doctorName: string; condition: string; status: string; createdAt: Date }>>;
}

export const DashboardRepository = { doctorsSummary, patientsSummary, patientWindows, recentPatients };
