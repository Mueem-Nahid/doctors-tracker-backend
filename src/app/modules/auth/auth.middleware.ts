import type { RequestHandler } from "express";
import { AuthService } from "./auth.service.js";
import { SESSION_COOKIE_NAME } from "./auth.constants.js";
import { ApiError } from "../../../errors/ApiError.js";
import type { AdminIdentity } from "./auth.interface.js";

declare module "express-serve-static-core" {
  interface Request {
    admin?: AdminIdentity;
  }
}

export const requireAdmin: RequestHandler = async (request, response, next) => {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue");
  }

  const admin = await AuthService.authenticate(token);
  if (!admin) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue");
  }

  request.admin = admin;
  next();
};
