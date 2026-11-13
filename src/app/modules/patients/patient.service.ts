import type {
  GlobalPatientInput,
  GlobalPatientListQuery,
  PatientInput,
  PatientListQuery,
  PatientPatch,
} from "@doctor-tracker/contracts";
import { ApiError } from "../../../errors/ApiError.js";
import { pageMeta } from "../../../shared/queryUtils.js";
import { DoctorService } from "../doctors/doctor.service.js";
import { PatientRepository } from "./patient.repository.js";

async function createForDoctor(doctorId: string, input: PatientInput) {
  await DoctorService.assertExists(doctorId);
  const patient = await PatientRepository.create(
    doctorId,
    input as unknown as Record<string, unknown>,
  );
  const doctor = await DoctorService.getById(doctorId);
  const record = patient.toObject();
  Reflect.deleteProperty(record, "nameSearch");
  Reflect.deleteProperty(record, "phoneSearch");
  return { ...record, _id: patient._id.toString(), doctorId, doctorName: doctor.name };
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

async function listGlobal(query: GlobalPatientListQuery) {
  const { rows, total } = await PatientRepository.listGlobal(query);
  return { data: rows, meta: pageMeta(query.page, query.pageSize, total) };
}

async function assertPatientDoctorExists(doctorId: string) {
  try {
    await DoctorService.assertExists(doctorId);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404)
      throw new ApiError(422, "VALIDATION_ERROR", "The selected doctor does not exist", {
        doctorId: "Select an existing doctor",
      });
    throw error;
  }
}

async function createGlobal(input: GlobalPatientInput) {
  const { doctorId, ...patientInput } = input;
  await assertPatientDoctorExists(doctorId);
  const patient = await PatientRepository.create(
    doctorId,
    patientInput as PatientInput as unknown as Record<string, unknown>,
  );
  const doctor = await DoctorService.getById(doctorId);
  const record = patient.toObject();
  Reflect.deleteProperty(record, "nameSearch");
  Reflect.deleteProperty(record, "phoneSearch");
  return { ...record, _id: patient._id.toString(), doctorId, doctorName: doctor.name };
}

async function getById(id: string) {
  const patient = await PatientRepository.findById(id);
  if (!patient) throw new ApiError(404, "NOT_FOUND", "Patient not found");
  const doctor = await DoctorService.getById(patient.doctorId.toString());
  return {
    ...patient,
    _id: patient._id.toString(),
    doctorId: patient.doctorId.toString(),
    doctorName: doctor.name,
  };
}

async function update(id: string, input: PatientPatch) {
  if (input.doctorId) await assertPatientDoctorExists(input.doctorId);
  const patient = await PatientRepository.update(
    id,
    input as PatientPatch & Record<string, unknown>,
  );
  if (!patient) throw new ApiError(404, "NOT_FOUND", "Patient not found");
  const doctor = await DoctorService.getById(patient.doctorId.toString());
  return {
    ...patient,
    _id: patient._id.toString(),
    doctorId: patient.doctorId.toString(),
    doctorName: doctor.name,
  };
}

async function deleteById(id: string) {
  if (!(await PatientRepository.deleteById(id)))
    throw new ApiError(404, "NOT_FOUND", "Patient not found");
}

export const PatientService = {
  createForDoctor,
  listForDoctor,
  deleteForDoctor,
  listGlobal,
  createGlobal,
  getById,
  update,
  deleteById,
};
