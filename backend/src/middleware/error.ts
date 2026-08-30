import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../lib/http.js";
import { config } from "../config.js";

export const notFound: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => next(new AppError(404, "Route not found."));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    res.status(409).json({ message: "A record with these unique details already exists." });
    return;
  }
  const status = error instanceof AppError ? error.status : 500;
  const message = error instanceof AppError ? error.message : "Something went wrong on the server.";
  if (status >= 500) console.error(error);
  res.status(status).json({ message, ...(error instanceof AppError && error.details ? { details: error.details } : {}), ...(config.NODE_ENV === "development" && status === 500 ? { debug: String(error) } : {}) });
};
