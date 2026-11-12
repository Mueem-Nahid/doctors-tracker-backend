import type { RequestHandler } from "express";
import { config } from "../../config/index.js";

export const browserMutationGuard: RequestHandler = (request, response, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    next();
    return;
  }

  const originHeader = request.get("origin");
  const refererHeader = request.get("referer");
  let requestOrigin = originHeader;

  if (!requestOrigin && refererHeader) {
    try {
      requestOrigin = new URL(refererHeader).origin;
    } catch {
      requestOrigin = undefined;
    }
  }

  if (requestOrigin !== config.PUBLIC_APP_ORIGIN) {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Request origin is not allowed" } });
    return;
  }

  next();
};

export function createLoginRateLimiter(windowMs = 60_000, maxRequests = 5): RequestHandler {
  const attempts = new Map<string, number[]>();

  return (request, response, next) => {
    const now = Date.now();
    const clientIp = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const email = typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
    const keys = [`ip:${clientIp}`];
    if (email) keys.push(`account:${email}`);

    const recentAttempts = keys.map((key) => ({
      key,
      times: (attempts.get(key) ?? []).filter((time) => now - time < windowMs),
    }));

    if (recentAttempts.some(({ times }) => times.length >= maxRequests)) {
      response.setHeader("Retry-After", "60");
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Try again in a minute" } });
      return;
    }

    for (const attempt of recentAttempts) {
      attempt.times.push(now);
      attempts.set(attempt.key, attempt.times);
    }
    next();
  };
}
