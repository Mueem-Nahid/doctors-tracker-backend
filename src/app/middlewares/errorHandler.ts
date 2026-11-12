import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
    response.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the size limit" },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      error: { code: "BAD_REQUEST", message: "Request body contains invalid JSON" },
    });
    return;
  }

  if (error instanceof Error && error.message === "UNSUPPORTED_MEDIA_TYPE") {
    response.status(415).json({
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send a JSON request body" },
    });
    return;
  }

  console.error("Unhandled request error", error);
  response.status(500).json({
    error: { code: "INTERNAL", message: "An unexpected error occurred" },
  });
};
