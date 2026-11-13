import type { RequestHandler } from "express";
import { ApiError } from "../../errors/ApiError.js";

export const requireObjectIds: RequestHandler = (request, _response, next) => {
  const ids = [request.params.id, request.params.patientId].filter(
    (value): value is string => typeof value === "string",
  );
  if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
    next(new ApiError(404, "NOT_FOUND", "Resource not found"));
    return;
  }
  next();
};
