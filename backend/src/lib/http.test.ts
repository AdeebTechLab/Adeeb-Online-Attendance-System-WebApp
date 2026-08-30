import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { dateOnly, nonBlankPassword, objectId, phoneNumber, validate } from "./http.js";
import { signAccessToken } from "../middleware/auth.js";
import { config } from "../config.js";

describe("request validation primitives", () => {
  it("accepts real calendar dates and rejects normalized invalid dates", () => {
    expect(dateOnly.safeParse("2026-02-28").success).toBe(true);
    expect(dateOnly.safeParse("2026-02-30").success).toBe(false);
    expect(dateOnly.safeParse("29-08-2026").success).toBe(false);
  });

  it("accepts MongoDB object ids only", () => {
    expect(objectId.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
    expect(objectId.safeParse("not-an-id").success).toBe(false);
  });

  it("requires a plausible teacher phone number", () => {
    expect(phoneNumber.safeParse("+92 300 1234567").success).toBe(true);
    expect(phoneNumber.safeParse("(021) 123-4567").success).toBe(true);
    expect(phoneNumber.safeParse("").success).toBe(false);
    expect(phoneNumber.safeParse("12345").success).toBe(false);
    expect(phoneNumber.safeParse("call-me-now").success).toBe(false);
  });

  it("allows one-character passwords but rejects blank values", () => {
    expect(nonBlankPassword.safeParse("a").success).toBe(true);
    expect(nonBlankPassword.safeParse("1").success).toBe(true);
    expect(nonBlankPassword.safeParse("").success).toBe(false);
    expect(nonBlankPassword.safeParse("   \t\n").success).toBe(false);
  });

  it("supports validated query values with the Express 5 read-only query getter", () => {
    const req = { body: {}, params: {} } as Request;
    Object.defineProperty(req, "query", { configurable: true, get: () => ({ page: "2" }) });
    let nextError: unknown;
    validate(z.object({ query: z.object({ page: z.coerce.number() }) }))(req, {} as Response, ((error?: unknown) => { nextError = error; }) as NextFunction);
    expect(nextError).toBeUndefined();
    expect(req.query.page).toBe(2);
  });
});

describe("authentication token", () => {
  it("is signed, expiring, and contains only the required authorization claims", () => {
    const token = signAccessToken("507f1f77bcf86cd799439011", "TEACHER");
    const claims = jwt.verify(token, config.JWT_SECRET, { issuer: "adeeb-attendance" }) as jwt.JwtPayload;
    expect(claims.sub).toBe("507f1f77bcf86cd799439011");
    expect(claims.role).toBe("TEACHER");
    expect(claims.exp).toBeGreaterThan(claims.iat!);
    expect(claims).not.toHaveProperty("email");
  });
});
