import type { RequestHandler } from "express";
import { AuthService } from "./auth.service.js";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "./auth.constants.js";
import type { LoginRequest } from "./auth.interface.js";
import { sendData } from "../../../shared/sendResponse.js";

const login: RequestHandler = async (request, response) => {
  const { body } = request.validated as LoginRequest;
  const session = await AuthService.login(body.email, body.password);
  if (!session) {
    response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
    return;
  }

  response.cookie(SESSION_COOKIE_NAME, session.token, SESSION_COOKIE_OPTIONS);
  sendData(response, 200, session.user);
};

const me: RequestHandler = (request, response) => {
  sendData(response, 200, request.admin);
};

const logout: RequestHandler = async (request, response) => {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (token) await AuthService.revokeSession(token);

  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
    secure: SESSION_COOKIE_OPTIONS.secure,
    sameSite: SESSION_COOKIE_OPTIONS.sameSite,
    path: SESSION_COOKIE_OPTIONS.path,
  });
  response.status(204).end();
};

export const AuthController = { login, me, logout };
