import type { DoctorInput, DoctorListQuery } from "@doctor-tracker/contracts";
import mongoose from "mongoose";
import { DoctorModel, type DoctorRecord } from "./doctor.model.js";
import { PatientModel } from "../patients/patient.model.js";
import { buildCreatedAtRange, escapeRegex, toPhoneDigits } from "../../../shared/queryUtils.js";
import { config } from "../../../config/index.js";

type DoctorFilter = mongoose.QueryFilter<DoctorRecord>;
function filterFor(query: DoctorListQuery): DoctorFilter {
  const filter: DoctorFilter = {};
  if (query.q) {
    const prefix = new RegExp(`^${escapeRegex(query.q)}`, "i");
    const digits = /^[+\d\s().-]+$/.test(query.q) ? toPhoneDigits(query.q) : "";
    filter.$or = [
      { name: prefix },
      { hospital: prefix },
      { email: prefix },
      ...(digits ? [{ phoneSearch: { $regex: `^${escapeRegex(digits)}` } }] : []),
    ];
  }
  if (query.specialization.length)
    filter.specializationNormalized = { $in: query.specialization.map((v) => v.toLowerCase()) };
  if (query.hospital.length)
    filter.hospitalNormalized = { $in: query.hospital.map((v) => v.toLowerCase()) };
  const createdAt = buildCreatedAtRange(query.from, query.to, config.REPORTING_TIME_ZONE);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

function sortFor(sort: DoctorListQuery["sort"]) {
  const [field, direction] = sort.split(".") as [string, "asc" | "desc"];
  return { [field]: direction === "asc" ? 1 : -1, _id: direction === "asc" ? 1 : -1 } as Record<
    string,
    1 | -1
  >;
}

async function create(input: DoctorInput) {
  const doctor = await DoctorModel.create({
    ...input,
    specializationNormalized: input.specialization.toLowerCase(),
    hospitalNormalized: input.hospital.toLowerCase(),
    phoneSearch: toPhoneDigits(input.phone),
  });
  return doctor.toObject();
}

async function list(query: DoctorListQuery) {
  const filter = filterFor(query);
  const offset = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    DoctorModel.countDocuments(filter),
    query.sort.startsWith("patients.")
      ? patientCountSortedPage(filter, query, offset)
      : DoctorModel.find(filter)
          .sort(sortFor(query.sort))
          .skip(offset)
          .limit(query.pageSize)
          .lean(),
  ]);
  const ids = rows.map((row) => row._id);
  const counts = await PatientModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { doctorId: { $in: ids } } },
    { $group: { _id: "$doctorId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((entry) => [entry._id.toString(), entry.count]));
  return {
    rows: rows.map((row) => ({
      ...row,
      _id: row._id.toString(),
      patientCount: countMap.get(row._id.toString()) ?? 0,
    })),
    total,
  };
}

async function patientCountSortedPage(
  filter: DoctorFilter,
  query: DoctorListQuery,
  offset: number,
) {
  const direction = query.sort === "patients.asc" ? 1 : -1;
  const rows = await DoctorModel.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: PatientModel.collection.name,
        localField: "_id",
        foreignField: "doctorId",
        as: "patients",
      },
    },
    { $addFields: { patientCount: { $size: "$patients" } } },
    { $sort: { patientCount: direction, _id: direction } },
    { $skip: offset },
    { $limit: query.pageSize },
    { $project: { patients: 0 } },
  ]);
  return rows;
}

async function findById(id: string) {
  return DoctorModel.findById(id).lean();
}

async function countPatients(doctorId: string) {
  return PatientModel.countDocuments({ doctorId: new mongoose.Types.ObjectId(doctorId) });
}

async function filterOptions() {
  const [specializations, hospitals] = await Promise.all([
    DoctorModel.aggregate<{ _id: string; label: string }>([
      { $group: { _id: "$specializationNormalized", label: { $min: "$specialization" } } },
      { $sort: { _id: 1 } },
    ]),
    DoctorModel.aggregate<{ _id: string; label: string }>([
      { $group: { _id: "$hospitalNormalized", label: { $min: "$hospital" } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return {
    specializations: specializations.map((x) => x.label),
    hospitals: hospitals.map((x) => x.label),
  };
}

export const DoctorRepository = { create, list, findById, countPatients, filterOptions };
