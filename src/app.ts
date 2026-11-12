import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { apiRouter } from "./app/routes/index.js";
import { errorHandler } from "./app/middlewares/errorHandler.js";

const requireJsonForMutation: RequestHandler = (request, response, next) => {
  if (["POST", "PUT", "PATCH"].includes(request.method) && !request.is("application/json")) {
    next(new Error("UNSUPPORTED_MEDIA_TYPE"));
    return;
  }
  next();
};

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb", type: "application/json" }));
app.use(cookieParser());
app.use(requireJsonForMutation);
app.use("/api/v1", apiRouter);

app.use("/api", (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "API endpoint not found" },
  });
});

app.use(errorHandler);
