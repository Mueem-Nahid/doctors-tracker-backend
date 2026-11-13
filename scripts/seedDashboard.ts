import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { DoctorModel } from "../src/app/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/app/modules/patients/patient.model.js";

const specializations = ["Cardiology", "Neurology", "Pediatrics", "Internal Medicine", "Orthopedics", "Dermatology", "Respiratory", "Cardiology"];
const conditions = ["Hypertension", "Diabetes", "Asthma", "Cardiac", "Orthopedic", "Neurological", "Dermatological", "Respiratory", "Other"] as const;
const patientQuotas = [38, 30, 25, 20, 16, 12, 8, 4];

async function seedDashboard(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  const seededDoctors = await DoctorModel.find({ email: /^dashboard-demo-\d+@example\.test$/ }).select("_id").lean();
  if (seededDoctors.length) await PatientModel.deleteMany({ doctorId: { $in: seededDoctors.map((doctor) => doctor._id) } });
  await DoctorModel.deleteMany({ email: /^dashboard-demo-\d+@example\.test$/ });

  const doctors = await DoctorModel.insertMany(specializations.map((specialization, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const name = `Dr. Dashboard ${sequence}`;
    const phone = `+880 1900 000${sequence}`;
    return {
      name, specialization, specializationNormalized: specialization.toLowerCase(),
      hospital: `Demo Hospital ${index % 3 + 1}`, hospitalNormalized: `demo hospital ${index % 3 + 1}`,
      phone, phoneSearch: phone.replace(/\D/g, ""), email: `dashboard-demo-${sequence}@example.test`,
    };
  }));
  const totalPatients = patientQuotas.reduce((sum, quota) => sum + quota, 0);
  const now = new Date();
  let patientNumber = 0;
  const records = patientQuotas.flatMap((quota, doctorIndex) => Array.from({ length: quota }, (_, patientIndex) => {
    patientNumber += 1;
    const ageDays = (patientNumber * 29) % 365;
    const createdAt = new Date(now.getTime() - ageDays * 86_400_000);
    const phone = `+880 1800 ${String(patientNumber).padStart(6, "0")}`;
    return {
      doctorId: doctors[doctorIndex]!._id,
      name: `Dashboard Demo Patient ${String(patientNumber).padStart(3, "0")}`,
      nameSearch: `dashboard demo patient ${String(patientNumber).padStart(3, "0")}`,
      age: 18 + patientNumber % 68,
      gender: (["female", "male", "other"] as const)[patientNumber % 3]!,
      phone, phoneSearch: phone.replace(/\D/g, ""),
      ...(patientIndex % 4 === 0 ? { email: `demo-patient-${patientNumber}@example.test` } : {}),
      condition: conditions[(patientNumber * 7) % conditions.length]!,
      status: (["Active", "Under observation", "Discharged"] as const)[patientNumber % 3]!,
      createdAt, updatedAt: createdAt,
    };
  }));
  await PatientModel.insertMany(records);
  console.info(`Seeded ${doctors.length} demo doctors and ${totalPatients} demo patients across the last 12 months.`);
}

seedDashboard()
  .catch((error: unknown) => { console.error("Dashboard seed failed", error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
