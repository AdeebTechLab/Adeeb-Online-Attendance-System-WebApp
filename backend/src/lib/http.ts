import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const validate = (schema: z.ZodTypeAny): RequestHandler => (req: Request, _res: Response, next: NextFunction) => {
  const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!parsed.success) return next(new AppError(400, "Please check the submitted information.", parsed.error.flatten()));
  const data = parsed.data as { body?: unknown; params?: unknown; query?: unknown };
  if (data.body) req.body = data.body;
  if (data.params) req.params = data.params as typeof req.params;
  // Express 5 exposes `req.query` through a getter. Define a request-local value
  // instead of assigning to the getter so validated/coerced query data is usable.
  if (data.query) Object.defineProperty(req, "query", { configurable: true, enumerable: true, writable: true, value: data.query });
  next();
};

export const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
export const nonBlankPassword = z.string().refine((value) => value.trim().length > 0, "Password cannot be blank");
export const phoneNumber = z.string().trim().min(7, "Phone is required").max(30).regex(/^[+0-9() .-]+$/, "Enter a valid phone number").refine((value) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}, "Phone must contain 7 to 15 digits");
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");
