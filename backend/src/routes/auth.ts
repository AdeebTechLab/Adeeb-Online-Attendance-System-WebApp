import { Router } from "express";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { authenticate, signAccessToken } from "../middleware/auth.js";
import { AppError, nonBlankPassword, optionalText, phoneNumber, validate } from "../lib/http.js";
import { config } from "../config.js";
import { publicUser } from "../lib/user.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

const cookieOptions = { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "lax" as const, maxAge: 8 * 60 * 60_000, path: "/" };

router.post("/signup", authLimiter, validate(z.object({ body: z.object({
  name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()), password: nonBlankPassword,
  phone: phoneNumber, city: z.string().trim().min(2).max(100), institutionName: z.string().trim().min(2).max(200), designation: optionalText(100),
}) })), async (req: Request, res: Response) => {
  if (await User.exists({ email: req.body.email })) throw new AppError(409, "An account already exists for this email.");
  const user = await User.create({ ...req.body, password: undefined, passwordHash: await bcrypt.hash(req.body.password, 12), role: "TEACHER" });
  res.cookie("access_token", signAccessToken(String(user._id), "TEACHER"), cookieOptions).status(201).json({ user: publicUser(user) });
});

router.post("/login", authLimiter, validate(z.object({ body: z.object({ email: z.string().trim().email().transform((v) => v.toLowerCase()), password: nonBlankPassword }) })), async (req: Request, res: Response) => {
  const user = await User.findOne({ email: req.body.email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new AppError(401, "Email or password is incorrect.");
  if (user.role === "TEACHER" && user.isActive === false) throw new AppError(403, "This account has been stopped by an administrator.");
  res.cookie("access_token", signAccessToken(String(user._id), user.role as "TEACHER" | "ADMIN"), cookieOptions).json({ user: publicUser(user) });
});

router.post("/logout", (_req: Request, res: Response) => res.clearCookie("access_token", { ...cookieOptions, maxAge: undefined }).status(204).end());
router.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw new AppError(401, "Account no longer exists.");
  res.json({ user: publicUser(user) });
});

export default router;
