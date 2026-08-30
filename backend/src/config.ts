import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/adeeb-attendance"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-now"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
});

export const config = schema.parse(process.env);
if (config.NODE_ENV === "production") {
  for (const key of ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"] as const) {
    if (!process.env[key]) throw new Error(`${key} must be explicitly configured in production.`);
  }
}
