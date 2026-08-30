import express from "express";
import type { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import classRoutes from "./routes/classes.js";
import studentRoutes from "./routes/students.js";
import attendanceRoutes from "./routes/attendance.js";
import adminRoutes from "./routes/admin.js";
import { authenticate, requireAdmin } from "./middleware/auth.js";
import { AppError } from "./lib/http.js";
import { errorHandler, notFound } from "./middleware/error.js";

export const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: config.CLIENT_URL, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.headers.origin && req.headers.origin !== config.CLIENT_URL) {
    return next(new AppError(403, "Request origin is not allowed."));
  }
  next();
});

app.get("/", (_req: Request, res: Response) => res.redirect(config.CLIENT_URL));
app.get("/api/health", (_req: Request, res: Response) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/classes", authenticate, classRoutes);
app.use("/api/classes/:classId/students", authenticate, studentRoutes);
app.use("/api/classes/:classId/attendance", authenticate, attendanceRoutes);
app.use("/api/admin", authenticate, requireAdmin, adminRoutes);
app.use(notFound);
app.use(errorHandler);
