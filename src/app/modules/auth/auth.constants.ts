import { config } from "../../../config/index.js";

export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME =
  config.NODE_ENV === "production" ? "__Host-doctor_tracker_session" : "doctor_tracker_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_MS,
};
