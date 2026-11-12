import type { RequestHandler } from "express";
import { authenticate } from "./auth.service.js";

declare global {
  namespace Express {
    interface Request {
      admin?: { _id: string; email: string; name: string; role: "admin" };
    }
  }
}

export const requireAdmin: RequestHandler = async (request, response, next) => {
  const token = request.cookies?.["__Host-doctor_tracker_session"] ?? request.cookies?.doctor_tracker_session;
  if (!token) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } });
    return;
  }

  const admin = await authenticate(token);
  if (!admin) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } });
    return;
  }

  request.admin = admin;
  next();
};
