import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { apiRouter } from "./app/routes/index.js";
import { errorHandler } from "./app/middlewares/errorHandler.js";
import { config } from "./config/index.js";

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
app.use(express.json({ limit: "32kb", type: "application/json" }));
app.use(cookieParser());
app.use(requireJsonForMutation);
app.use("/api/v1", (_request, response, next) => {
  response.setHeader("Cache-Control", "private, no-store");
  next();
});
app.use("/api/v1", apiRouter);

app.use("/api", (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "API endpoint not found" },
  });
});

app.use(errorHandler);
