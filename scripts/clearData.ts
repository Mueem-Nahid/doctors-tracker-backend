import mongoose from "mongoose";
import { config } from "../src/config";
import { SessionModel } from "../src/app/modules/auth/session.model.js";
import { DoctorModel } from "../src/app/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/app/modules/patients/patient.model.js";
import { UserModel } from "../src/app/modules/auth/user.model.js";

async function clearApplicationData(): Promise<void> {
  const [confirmationFlag, confirmedDatabaseName] = process.argv.slice(2);
  if (confirmationFlag !== "--confirm" || !confirmedDatabaseName) {
    throw new Error(
      "Usage: npm run data:clear -w @doctor-tracker/backend -- --confirm <database-name>",
    );
  }
  if (config.NODE_ENV === "production") {
    throw new Error("Refusing to clear data when NODE_ENV=production.");
  }

  await mongoose.connect(config.MONGODB_URI);
  const connectedDatabaseName = mongoose.connection.name;
  if (confirmedDatabaseName !== connectedDatabaseName) {
    throw new Error(
      `Database confirmation did not match the connected database (${connectedDatabaseName}). No data was deleted.`,
    );
  }

  const patients = await PatientModel.deleteMany({});
  const doctors = await DoctorModel.deleteMany({});
  const sessions = await SessionModel.deleteMany({});
  const adminsPreserved = await UserModel.countDocuments({ role: "admin" });

  console.info(
    `Cleared database "${connectedDatabaseName}": ${patients.deletedCount} patients, ${doctors.deletedCount} doctors, and ${sessions.deletedCount} sessions deleted; ${adminsPreserved} Admin account(s) preserved.`,
  );
}

clearApplicationData()
  .catch((error: unknown) => {
    console.error("Data reset failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
