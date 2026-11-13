import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { DoctorModel } from "../src/app/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/app/modules/patients/patient.model.js";
import { SessionModel } from "../src/app/modules/auth/session.model.js";
import { UserModel } from "../src/app/modules/auth/user.model.js";

async function deployIndexes(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  await Promise.all([
    UserModel.createIndexes(),
    SessionModel.createIndexes(),
    DoctorModel.createIndexes(),
    PatientModel.createIndexes(),
  ]);
  console.info("Declared Doctor Tracker indexes are ready.");
}

deployIndexes()
  .catch((error: unknown) => {
    console.error("Index deployment failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
