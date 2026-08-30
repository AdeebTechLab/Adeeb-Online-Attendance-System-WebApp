import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../db.js";
import { User } from "../models/User.js";
import { nonBlankPassword } from "../lib/http.js";

const values = z.object({ ADMIN_NAME: z.string().min(2), ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: nonBlankPassword }).parse(process.env);
await connectDatabase();
try {
  const email = values.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(values.ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate({ email }, { name: values.ADMIN_NAME, email, passwordHash, role: "ADMIN" }, { upsert: true, runValidators: true });
  console.log(`Admin account is ready for ${email}.`);
} finally {
  await disconnectDatabase();
}
