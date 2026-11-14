import mongoose from "mongoose";
import type {
  GlobalPatientListQuery,
  PatientListQuery,
  PatientPatch,
} from "@doctor-tracker/contracts";
import { config } from "../../../config/index.js";
import { buildCreatedAtRange, escapeRegex, toPhoneDigits } from "../../../shared/queryUtils.js";
import { PatientModel, type PatientRecord } from "./patient.model.js";
import { DoctorModel } from "../doctors/doctor.model.js";

type PatientFilter = mongoose.QueryFilter<PatientRecord>;
function filterFor(
  query: PatientListQuery | GlobalPatientListQuery,
  doctorId?: string,
): PatientFilter {
  const filter: PatientFilter = {};
  if (doctorId) filter.doctorId = new mongoose.Types.ObjectId(doctorId);
  else if ("doctorId" in query && query.doctorId.length)
    filter.doctorId = { $in: query.doctorId.map((id) => new mongoose.Types.ObjectId(id)) };
  if (query.q) {
    const prefix = new RegExp(`^${escapeRegex(query.q.toLowerCase())}`);
    const digits = /^[+\d\s().-]+$/.test(query.q) ? toPhoneDigits(query.q) : "";
    filter.$or = [
      { nameSearch: prefix },
      { email: prefix },
      ...(digits ? [{ phoneSearch: { $regex: `^${escapeRegex(digits)}` } }] : []),
    ];
  }
  if (query.condition.length)
    filter.condition = { $in: query.condition as PatientRecord["condition"][] };
  if (query.status.length) filter.status = { $in: query.status as PatientRecord["status"][] };
  const createdAt = buildCreatedAtRange(query.from, query.to, config.REPORTING_TIME_ZONE);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

function sortFor(sort: PatientListQuery["sort"]) {
  const [field, direction] = sort.split(".") as [string, "asc" | "desc"];
  return { [field]: direction === "asc" ? 1 : -1, _id: direction === "asc" ? 1 : -1 } as Record<
    string,
    1 | -1
  >;
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
  const offset = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    PatientModel.find(filter)
      .select("-notes -nameSearch -phoneSearch")
      .sort(sortFor(query.sort))
      .skip(offset)
      .limit(query.pageSize)
      .lean(),
    PatientModel.countDocuments(filter),
  ]);
  const doctor = await DoctorModel.findById(doctorId).select("name").lean();
  return {
    rows: rows.map((row) => ({
      ...row,
      _id: row._id.toString(),
      doctorId,
      doctorName: doctor?.name ?? "",
    })),
    total,
  };
}

async function listGlobal(query: GlobalPatientListQuery) {
  const filter = filterFor(query);
  const total = await PatientModel.countDocuments(filter);
  const offset = (query.page - 1) * query.pageSize;
  if (offset >= total) return { rows: [], total };

  const rows = await PatientModel.find(filter)
    .select("-notes -nameSearch -phoneSearch")
    .sort(sortFor(query.sort))
    .skip(offset)
    .limit(query.pageSize)
    .lean();
  const doctorIds = [...new Set(rows.map((row) => row.doctorId.toString()))];
  const doctors = await DoctorModel.find({ _id: { $in: doctorIds } })
    .select("name")
    .lean();
  const names = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor.name]));
  return {
    rows: rows.map((row) => ({
      ...row,
      _id: row._id.toString(),
      doctorId: row.doctorId.toString(),
      doctorName: names.get(row.doctorId.toString()) ?? "",
    })),
    total,
  };
}

async function findById(id: string) {
  return PatientModel.findById(id).select("-nameSearch -phoneSearch").lean();
}

async function update(id: string, input: PatientPatch & Record<string, unknown>) {
  const set: Record<string, unknown> = { ...input };
  const unset: Record<string, 1> = {};
  delete set.email;
  delete set.notes;
  if (input.email === null) unset.email = 1;
  else if (input.email !== undefined) set.email = input.email;
  if (input.notes === null) unset.notes = 1;
  else if (input.notes !== undefined) set.notes = input.notes;
  if (input.doctorId) set.doctorId = new mongoose.Types.ObjectId(input.doctorId);
  if (input.name !== undefined) set.nameSearch = input.name.toLowerCase();
  if (input.phone !== undefined) set.phoneSearch = toPhoneDigits(input.phone);
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  return PatientModel.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .select("-nameSearch -phoneSearch")
    .lean();
}

async function deleteById(id: string) {
  return PatientModel.findByIdAndDelete(id).lean();
}

async function deleteForDoctor(doctorId: string, patientId: string) {
  return PatientModel.findOneAndDelete({
    _id: patientId,
    doctorId: new mongoose.Types.ObjectId(doctorId),
  }).lean();
}

export const PatientRepository = {
  create,
  list,
  listGlobal,
  findById,
  update,
  deleteById,
  deleteForDoctor,
};
