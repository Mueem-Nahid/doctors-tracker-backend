import { Router } from "express";
import { loginSchema } from "@doctor-tracker/contracts";
import { browserMutationGuard, createLoginRateLimiter } from "../../middlewares/browserMutationGuard.js";
import { requireAdmin } from "./auth.middleware.js";
import { authenticate, login, revokeSession } from "./auth.service.js";

export const authRouter = Router();
const COOKIE_NAME = "__Host-doctor_tracker_session";
const LOCAL_COOKIE_NAME = "doctor_tracker_session";
const localDevelopment = process.env.NODE_ENV !== "production";
const cookieName = localDevelopment ? LOCAL_COOKIE_NAME : COOKIE_NAME;
const cookieOptions = {
  httpOnly: true,
  secure: !localDevelopment,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 12 * 60 * 60 * 1000,
};

authRouter.post("/login", createLoginRateLimiter(), browserMutationGuard, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "Check the submitted fields" },
    });
    return;
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
    return;
  }

  response.cookie(cookieName, result.token, cookieOptions);
  response.status(200).json({ data: result.user });
});

authRouter.get("/me", requireAdmin, (request, response) => {
  response.status(200).json({ data: request.admin });
});

authRouter.post("/logout", browserMutationGuard, async (request, response) => {
  const token = request.cookies?.[COOKIE_NAME] ?? request.cookies?.[LOCAL_COOKIE_NAME];
  if (token) await revokeSession(token);
  response.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  response.status(204).end();
});
