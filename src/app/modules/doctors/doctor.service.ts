import type { DoctorInput, DoctorListQuery } from "@doctor-tracker/contracts";
import { ApiError } from "../../../errors/ApiError.js";
import { pageMeta } from "../../../shared/queryUtils.js";
import { DoctorRepository } from "./doctor.repository.js";

let cachedFilterOptions: Awaited<ReturnType<typeof DoctorRepository.filterOptions>> | undefined;
let filterOptionsExpiresAt = 0;

async function create(input: DoctorInput) {
  try {
    const doctor = await DoctorRepository.create(input);
    cachedFilterOptions = undefined;
    filterOptionsExpiresAt = 0;
    return { ...doctor, _id: doctor._id.toString(), patientCount: 0 };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new ApiError(409, "CONFLICT", "A doctor with this email already exists", {
        email: "Email already in use",
      });
    }
    throw error;
  }
}

async function list(query: DoctorListQuery) {
  const { rows, total } = await DoctorRepository.list(query);
  return { data: rows, meta: pageMeta(query.page, query.pageSize, total) };
}

async function getById(id: string) {
  const doctor = await DoctorRepository.findById(id);
  if (!doctor) throw new ApiError(404, "NOT_FOUND", "Doctor not found");
  const patientCount = await DoctorRepository.countPatients(id);
  return { ...doctor, _id: doctor._id.toString(), patientCount };
}

async function assertExists(id: string) {
  if (!(await DoctorRepository.findById(id)))
    throw new ApiError(404, "NOT_FOUND", "Doctor not found");
}

async function filterOptions() {
  if (!cachedFilterOptions || Date.now() >= filterOptionsExpiresAt) {
    cachedFilterOptions = await DoctorRepository.filterOptions();
    filterOptionsExpiresAt = Date.now() + 5 * 60_000;
  }
  return cachedFilterOptions;
}

export const DoctorService = { create, list, getById, assertExists, filterOptions };
