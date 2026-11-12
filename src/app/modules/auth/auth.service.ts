import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { SessionModel } from "./session.model.js";
import { UserModel } from "./user.model.js";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(email: string, password: string) {
  const user = await UserModel.findOne({ email: email.trim().toLowerCase(), isActive: true })
    .select("+passwordHash")
    .lean();

  const isValid = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
  if (!user || !isValid) return null;

  const token = randomBytes(32).toString("base64url");
  await SessionModel.create({
    tokenDigest: digestToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  return {
    token,
    user: { _id: user._id.toString(), email: user.email, name: user.name, role: "admin" as const },
  };
}

export async function authenticate(token: string) {
  const session = await SessionModel.findOne({ tokenDigest: digestToken(token), expiresAt: { $gt: new Date() } })
    .select("userId")
    .lean();
  if (!session) return null;

  const user = await UserModel.findOne({ _id: session.userId, isActive: true }).select("email name role").lean();
  if (!user) return null;
  return { _id: user._id.toString(), email: user.email, name: user.name, role: "admin" as const };
}

export async function revokeSession(token: string): Promise<void> {
  await SessionModel.deleteOne({ tokenDigest: digestToken(token) });
}
