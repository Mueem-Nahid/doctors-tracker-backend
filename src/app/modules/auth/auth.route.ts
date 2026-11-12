import { Router } from "express";
import { browserMutationGuard, createLoginRateLimiter } from "../../middlewares/browserMutationGuard.js";
import { requireAdmin } from "./auth.middleware.js";
import { AuthController } from "./auth.controller.js";

export const authRouter = Router();
authRouter.post("/login", createLoginRateLimiter(), browserMutationGuard, AuthController.login);
authRouter.get("/me", requireAdmin, AuthController.me);
authRouter.post("/logout", browserMutationGuard, AuthController.logout);
