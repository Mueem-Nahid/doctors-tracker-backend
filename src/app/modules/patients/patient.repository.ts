import mongoose from "mongoose";
import type { PatientListQuery } from "@doctor-tracker/contracts";
import { config } from "../../../config/index.js";
import { buildCreatedAtRange, escapeRegex, toPhoneDigits } from "../../../shared/queryUtils.js";
import { PatientModel, type PatientRecord } from "./patient.model.js";
import { DoctorModel } from "../doctors/doctor.model.js";

type PatientFilter = mongoose.QueryFilter<PatientRecord>;
function filterFor(query: PatientListQuery, doctorId: string): PatientFilter {
  const filter: PatientFilter = { doctorId: new mongoose.Types.ObjectId(doctorId) };
  if (query.q) {
    const prefix = new RegExp(`^${escapeRegex(query.q)}`, "i");
    const digits = /^[+\d\s().-]+$/.test(query.q) ? toPhoneDigits(query.q) : "";
    filter.$or = [
      { name: prefix }, { email: prefix },
      ...(digits ? [{ phoneSearch: { $regex: `^${escapeRegex(digits)}` } }] : []),
    ];
  }
  if (query.condition.length) filter.condition = { $in: query.condition as PatientRecord["condition"][] };
  if (query.status.length) filter.status = { $in: query.status as PatientRecord["status"][] };
  const createdAt = buildCreatedAtRange(query.from, query.to, config.REPORTING_TIME_ZONE);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

function sortFor(sort: PatientListQuery["sort"]) {
  const [field, direction] = sort.split(".") as [string, "asc" | "desc"];
  return { [field]: direction === "asc" ? 1 : -1, _id: direction === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
}

async function create(doctorId: string, input: Record<string, unknown>) {
  return PatientModel.create({
    ...input,
    doctorId: new mongoose.Types.ObjectId(doctorId),
    nameSearch: String(input.name).toLowerCase(),
    phoneSearch: toPhoneDigits(String(input.phone)),
  });
}

async function list(doctorId: string, query: PatientListQuery) {
  const filter = filterFor(query, doctorId);
  const [rows, total] = await Promise.all([
    PatientModel.find(filter).sort(sortFor(query.sort)).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    PatientModel.countDocuments(filter),
  ]);
  const doctor = await DoctorModel.findById(doctorId).select("name").lean();
  return {
    rows: rows.map((row) => ({ ...row, _id: row._id.toString(), doctorId, doctorName: doctor?.name ?? "" })),
    total,
  };
}

async function deleteForDoctor(doctorId: string, patientId: string) {
  return PatientModel.findOneAndDelete({ _id: patientId, doctorId: new mongoose.Types.ObjectId(doctorId) }).lean();
}

export const PatientRepository = { create, list, deleteForDoctor };
