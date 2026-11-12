import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../../errors/ApiError.js";

declare module "express-serve-static-core" {
  interface Request {
    validated?: unknown;
  }
}

export function validateRequest<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse({
      body: request.body,
      query: request.query,
      params: request.params,
      cookies: request.cookies,
    });

    if (!result.success) {
      const fields = Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path.at(-1) ?? "request"), issue.message]),
      );
      next(new ApiError(422, "VALIDATION_ERROR", "Check the submitted fields", fields));
      return;
    }

    request.validated = result.data;
    next();
  };
}
