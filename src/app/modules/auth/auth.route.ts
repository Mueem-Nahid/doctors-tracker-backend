import { Router } from "express";
import { browserMutationGuard, createLoginRateLimiter } from "../../middlewares/browserMutationGuard.js";
import { requireAdmin } from "./auth.middleware.js";
import { AuthController } from "./auth.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { loginRequestSchema } from "./auth.validation.js";

export const authRouter = Router();
authRouter.post("/login", createLoginRateLimiter(), browserMutationGuard, validateRequest(loginRequestSchema), AuthController.login);
authRouter.get("/me", requireAdmin, AuthController.me);
authRouter.post("/logout", browserMutationGuard, AuthController.logout);
