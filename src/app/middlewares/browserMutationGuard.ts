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
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const recentAttempts = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recentAttempts.length >= maxRequests) {
      response.setHeader("Retry-After", "60");
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Try again in a minute" } });
      return;
    }

    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    next();
  };
}
