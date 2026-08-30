import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { UserRole } from "../models/User.js";
import { AppError } from "../lib/http.js";

type Claims = { sub: string; role: UserRole };

export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.access_token;
  if (!token) return next(new AppError(401, "Please sign in to continue."));
  try {
    const claims = jwt.verify(token, config.JWT_SECRET) as Claims;
    req.auth = { userId: claims.sub, role: claims.role };
    next();
  } catch {
    next(new AppError(401, "Your session has expired. Please sign in again."));
  }
};

export const requireAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== "ADMIN") return next(new AppError(403, "Administrator access is required."));
  next();
};

export function signAccessToken(userId: string, role: UserRole) {
  return jwt.sign({ role }, config.JWT_SECRET, { subject: userId, expiresIn: "8h", issuer: "adeeb-attendance" });
}
