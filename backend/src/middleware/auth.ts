import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { UserRole } from "../models/User.js";
import { AppError } from "../lib/http.js";
import { User } from "../models/User.js";

type Claims = { sub: string; role: UserRole };

export const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.access_token;
  if (!token) return next(new AppError(401, "Please sign in to continue."));
  let claims: Claims;
  try {
    claims = jwt.verify(token, config.JWT_SECRET) as Claims;
  } catch {
    return next(new AppError(401, "Your session has expired. Please sign in again."));
  }
  const user = await User.findById(claims.sub).select("role isActive").lean();
  if (!user) return next(new AppError(401, "Account no longer exists."));
  if (user.role === "TEACHER" && user.isActive === false) return next(new AppError(403, "This account has been stopped by an administrator."));
  req.auth = { userId: claims.sub, role: user.role as UserRole };
  next();
};

export const requireAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== "ADMIN") return next(new AppError(403, "Administrator access is required."));
  next();
};

export function signAccessToken(userId: string, role: UserRole) {
  return jwt.sign({ role }, config.JWT_SECRET, { subject: userId, expiresIn: "8h", issuer: "adeeb-attendance" });
}
