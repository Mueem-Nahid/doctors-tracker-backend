import type { PatientInput, PatientListQuery } from "@doctor-tracker/contracts";
import { ApiError } from "../../../errors/ApiError.js";
import { pageMeta } from "../../../shared/queryUtils.js";
import { DoctorService } from "../doctors/doctor.service.js";
import { PatientRepository } from "./patient.repository.js";

async function createForDoctor(doctorId: string, input: PatientInput) {
  await DoctorService.assertExists(doctorId);
  const patient = await PatientRepository.create(doctorId, input as unknown as Record<string, unknown>);
  const doctor = await DoctorService.getById(doctorId);
  return { ...patient.toObject(), _id: patient._id.toString(), doctorId, doctorName: doctor.name };
}

async function listForDoctor(doctorId: string, query: PatientListQuery) {
  await DoctorService.assertExists(doctorId);
  const { rows, total } = await PatientRepository.list(doctorId, query);
  return { data: rows, meta: pageMeta(query.page, query.pageSize, total) };
}

async function deleteForDoctor(doctorId: string, patientId: string) {
  const deleted = await PatientRepository.deleteForDoctor(doctorId, patientId);
  if (!deleted) throw new ApiError(404, "NOT_FOUND", "Patient not found for this doctor");
}

export const PatientService = { createForDoctor, listForDoctor, deleteForDoctor };
