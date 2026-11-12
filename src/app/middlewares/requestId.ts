import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (request, response, next) => {
  const requestId = randomUUID();
  response.setHeader("X-Request-Id", requestId);
  response.locals.requestId = requestId;
  next();
};
