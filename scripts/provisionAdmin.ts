import argon2 from "argon2";
import mongoose from "mongoose";
import { config } from "../src/config/index.js";
import { UserModel } from "../src/app/modules/auth/user.model.js";

async function provisionAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim();

  if (!email || !password || !name) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME in .env before provisioning.");
  }

  await mongoose.connect(config.MONGODB_URI);
  const existingAdmin = await UserModel.exists({ email });
  if (existingAdmin) {
    throw new Error(`An account already exists for ${email}. No changes were made.`);
  }

  await UserModel.create({ email, name, passwordHash: await argon2.hash(password), role: "admin" });
  console.info(`Provisioned the Doctor Tracker admin account for ${email}.`);
}

provisionAdmin()
  .catch((error: unknown) => {
    console.error("Admin provisioning failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
