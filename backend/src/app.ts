import express from "express";
import type { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
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

/* =========================================================
   FRONTEND URLs
========================================================= */

const allowedOrigins = [
  "https://adeeb-online-attendance-system.vercel.app",
  config.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
  .filter(Boolean)
  .map((origin) => origin.trim().replace(/\/$/, ""));

function isAllowedOrigin(origin?: string): boolean {
  // Allow requests from Postman, Render health checks, server-to-server, etc.
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.trim().replace(/\/$/, "");

  return allowedOrigins.includes(normalizedOrigin);
}

/* =========================================================
   CORS CONFIGURATION
========================================================= */

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    console.warn("Blocked CORS origin:", origin);

    callback(new AppError(403, "Request origin is not allowed."));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: [
    "Content-Disposition",
  ],

  optionsSuccessStatus: 204,
};

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

app.use(helmet());

/*
  CORS must run before routes.
*/
app.use(cors(corsOptions));

/*
  Handle browser preflight OPTIONS requests.
  Regex works safely with Express 5.
*/
app.options(/.*/, cors(corsOptions));

app.use(
  express.json({
    limit: "200kb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "200kb",
  })
);

app.use(cookieParser());

/* =========================================================
   EXTRA ORIGIN SECURITY
========================================================= */

app.use(
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const protectedMethods = [
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ];

    if (!protectedMethods.includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;

    if (origin && !isAllowedOrigin(origin)) {
      return next(
        new AppError(
          403,
          "Request origin is not allowed."
        )
      );
    }

    next();
  }
);

/* =========================================================
   ROOT
========================================================= */

app.get(
  "/",
  (_req: Request, res: Response) => {
    res.status(200).json({
      name: "Adeeb Online Attendance System API",
      status: "running",
      frontend: config.CLIENT_URL,
      backend:
        "https://adeeb-online-attendance-system.onrender.com",
    });
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "Adeeb Attendance API",
      timestamp: new Date().toISOString(),
    });
  }
);

/* =========================================================
   PUBLIC AUTH ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   TEACHER ROUTES
========================================================= */

app.use(
  "/api/classes",
  authenticate,
  classRoutes
);

app.use(
  "/api/classes/:classId/students",
  authenticate,
  studentRoutes
);

app.use(
  "/api/classes/:classId/attendance",
  authenticate,
  attendanceRoutes
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

app.use(
  "/api/admin",
  authenticate,
  requireAdmin,
  adminRoutes
);

/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(notFound);

app.use(errorHandler);
