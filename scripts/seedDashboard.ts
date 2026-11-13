import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { DoctorModel } from "../src/app/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/app/modules/patients/patient.model.js";

const specializations = [
  "Cardiology",
  "Neurology",
  "Pediatrics",
  "Internal Medicine",
  "Orthopedics",
  "Dermatology",
  "Respiratory",
  "Cardiology",
];
const conditions = [
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
const demoDoctorCount = 500;
const demoPatientCount = 30_000;
const minimumPatientsPerDoctor = 15;

function buildPatientQuotas(): number[] {
  const weights = Array.from({ length: demoDoctorCount }, (_, index) => demoDoctorCount - index);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const patientsToDistribute = demoPatientCount - demoDoctorCount * minimumPatientsPerDoctor;
  const extraPatients = weights.map((weight) =>
    Math.floor((patientsToDistribute * weight) / totalWeight),
  );
  let remaining = patientsToDistribute - extraPatients.reduce((sum, count) => sum + count, 0);
  const remainderOrder = weights
    .map((weight, index) => ({
      index,
      remainder: (patientsToDistribute * weight) % totalWeight,
    }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (const { index } of remainderOrder) {
    if (remaining === 0) break;
    extraPatients[index]! += 1;
    remaining -= 1;
  }

  return extraPatients.map((count) => count + minimumPatientsPerDoctor);
}

function syntheticCreatedAt(patientNumber: number, totalPatients: number, now: Date): Date {
  const start = Date.UTC(2025, 0, 1);
  const end = now.getTime();

  if (patientNumber === 1) return new Date(start);
  if (patientNumber === totalPatients) return now;

  let value = patientNumber >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;

  const fraction = value / 0x1_0000_0000;
  return new Date(start + Math.floor(fraction * (end - start)));
}

async function seedDashboard(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  const seededDoctors = await DoctorModel.find({ email: /^dashboard-demo-\d+@example\.test$/ })
    .select("_id")
    .lean();
  if (seededDoctors.length)
    await PatientModel.deleteMany({ doctorId: { $in: seededDoctors.map((doctor) => doctor._id) } });
  await DoctorModel.deleteMany({ email: /^dashboard-demo-\d+@example\.test$/ });

  const doctors = await DoctorModel.insertMany(
    Array.from({ length: demoDoctorCount }, (_, index) => {
      const sequence = String(index + 1).padStart(3, "0");
      const specialization = specializations[index % specializations.length]!;
      const name = `Dr. Dashboard ${sequence}`;
      const phone = String(17_000_000_000 + index);
      const hospital = `Demo Hospital ${(index % 12) + 1}`;
      return {
        name,
        specialization,
        specializationNormalized: specialization.toLowerCase(),
        hospital,
        hospitalNormalized: hospital.toLowerCase(),
        phone,
        phoneSearch: phone.replace(/\D/g, ""),
        email: `dashboard-demo-${sequence}@example.test`,
      };
    }),
  );
  const patientQuotas = buildPatientQuotas();
  const totalPatients = patientQuotas.reduce((sum, quota) => sum + quota, 0);
  const now = new Date();
  let patientNumber = 0;
  const records = patientQuotas.flatMap((quota, doctorIndex) =>
    Array.from({ length: quota }, (_, patientIndex) => {
      patientNumber += 1;
      const createdAt = syntheticCreatedAt(patientNumber, totalPatients, now);
      const phone = String(18_000_000_000 + patientNumber);
      return {
        doctorId: doctors[doctorIndex]!._id,
        name: `Dashboard Demo Patient ${String(patientNumber).padStart(5, "0")}`,
        nameSearch: `dashboard demo patient ${String(patientNumber).padStart(5, "0")}`,
        age: 18 + (patientNumber % 68),
        gender: (["female", "male", "other"] as const)[patientNumber % 3]!,
        phone,
        phoneSearch: phone.replace(/\D/g, ""),
        ...(patientIndex % 4 === 0 ? { email: `demo-patient-${patientNumber}@example.test` } : {}),
        condition: conditions[(patientNumber * 7) % conditions.length]!,
        status: (["Active", "Under observation", "Discharged"] as const)[patientNumber % 3]!,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
  await PatientModel.insertMany(records);
  console.info(
    `Seeded ${doctors.length} demo doctors and ${totalPatients} demo patients across the last 12 months.`,
  );
}

seedDashboard()
  .catch((error: unknown) => {
    console.error("Dashboard seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
