import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { apiRouter } from "./app/routes/index.js";
import { errorHandler } from "./app/middlewares/errorHandler.js";
import { config } from "./config/index.js";
import { requestId } from "./app/middlewares/requestId.js";
import { ApiError } from "./errors/ApiError.js";

const requireJsonForMutation: RequestHandler = (request, response, next) => {
  const hasBody =
    Number(request.headers["content-length"] ?? 0) > 0 ||
    request.headers["transfer-encoding"] !== undefined;

  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
    hasBody &&
    !request.is("application/json")
  ) {
    next(new Error("UNSUPPORTED_MEDIA_TYPE"));
    return;
  }
  next();
};

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY_HOPS);
app.use(requestId);
app.use(express.json({ limit: "32kb", type: "application/json" }));
app.use(cookieParser());
app.use(requireJsonForMutation);
app.use("/api/v1", (_request, response, next) => {
  response.setHeader("Cache-Control", "private, no-store");
  next();
});
app.use("/api/v1", apiRouter);

app.use("/api", (_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "API endpoint not found"));
});

app.use(errorHandler);

export default app;
