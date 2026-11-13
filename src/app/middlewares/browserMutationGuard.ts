import type { RequestHandler } from "express";
import { config } from "../../config/index.js";
import { ApiError } from "../../errors/ApiError.js";

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
    next(new ApiError(403, "FORBIDDEN", "Request origin is not allowed"));
    return;
  }

  next();
};

export function createLoginRateLimiter(windowMs = 60_000, maxRequests = 5): RequestHandler {
  const attempts = new Map<string, number[]>();
  let lastCleanupAt = 0;

  return (request, response, next) => {
    const now = Date.now();

    // A stream of unique account names or IPs must not leave expired keys in memory forever.
    if (now - lastCleanupAt >= windowMs) {
      for (const [key, timestamps] of attempts) {
        const recentTimestamps = timestamps.filter((time) => now - time < windowMs);
        if (recentTimestamps.length === 0) attempts.delete(key);
        else attempts.set(key, recentTimestamps);
      }
      lastCleanupAt = now;
    }

    const clientIp = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const email =
      typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const keys = [`ip:${clientIp}`];
    if (email) keys.push(`account:${email}`);

    const recentAttempts = keys.map((key) => ({
      key,
      times: (attempts.get(key) ?? []).filter((time) => now - time < windowMs),
    }));

    const limitedAttempt = recentAttempts.find(({ times }) => times.length >= maxRequests);
    if (limitedAttempt) {
      const oldestAttempt = limitedAttempt.times[0] ?? now;
      const retryAfter = Math.max(1, Math.ceil((oldestAttempt + windowMs - now) / 1000));
      response.setHeader("Retry-After", String(retryAfter));
      next(new ApiError(429, "RATE_LIMITED", "Too many login attempts. Try again later."));
      return;
    }

    for (const attempt of recentAttempts) {
      attempt.times.push(now);
      attempts.set(attempt.key, attempt.times);
    }
    next();
  };
}
