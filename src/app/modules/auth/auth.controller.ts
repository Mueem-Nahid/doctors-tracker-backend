import type { RequestHandler } from "express";
import { loginSchema } from "@doctor-tracker/contracts";
import { login as loginWithCredentials, revokeSession } from "./auth.service.js";

const cookieName = process.env.NODE_ENV === "production"
  ? "__Host-doctor_tracker_session"
  : "doctor_tracker_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 12 * 60 * 60 * 1000,
};

const login: RequestHandler = async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "Check the submitted fields" },
    });
    return;
  }

  const session = await loginWithCredentials(parsed.data.email, parsed.data.password);
  if (!session) {
    response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
    return;
  }

  response.cookie(cookieName, session.token, cookieOptions);
  response.status(200).json({ data: session.user });
};

const me: RequestHandler = (request, response) => {
  response.status(200).json({ data: request.admin });
};

const logout: RequestHandler = async (request, response) => {
  const token = request.cookies?.[cookieName];
  if (token) await revokeSession(token);

  response.clearCookie(cookieName, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
  });
  response.status(204).end();
};

export const AuthController = { login, me, logout };
