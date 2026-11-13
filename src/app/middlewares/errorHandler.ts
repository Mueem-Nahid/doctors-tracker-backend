import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { ApiError } from "../../errors/ApiError.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof SyntaxError && "body" in error) {
    apiError = new ApiError(400, "BAD_REQUEST", "Request body contains invalid JSON");
  } else if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
    apiError = new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the size limit");
  } else if (error instanceof Error && error.message === "UNSUPPORTED_MEDIA_TYPE") {
    apiError = new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send a JSON request body");
  } else if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [String(issue.path.at(-1) ?? "request"), issue.message]),
    );
    apiError = new ApiError(422, "VALIDATION_ERROR", "Check the submitted fields", fields);
  } else if (error instanceof mongoose.Error.CastError) {
    apiError = new ApiError(404, "NOT_FOUND", "Resource not found");
  } else if (error instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(
      Object.entries(error.errors).map(([key, issue]) => [key, issue.message]),
    );
    apiError = new ApiError(422, "VALIDATION_ERROR", "Check the submitted fields", fields);
  } else if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    const keyPattern =
      "keyPattern" in error && typeof error.keyPattern === "object" && error.keyPattern !== null
        ? error.keyPattern
        : {};
    const fields = Object.fromEntries(
      Object.keys(keyPattern).map((field) => [field, "Already in use"]),
    );
    apiError = new ApiError(409, "CONFLICT", "A record with these details already exists", fields);
  } else {
    console.error("Unhandled request error", error);
    apiError = new ApiError(500, "INTERNAL", "An unexpected error occurred");
  }

  response.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.fields ? { fields: apiError.fields } : {}),
    },
  });
};
