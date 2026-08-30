import { Schema, model } from "mongoose";

export type UserRole = "TEACHER" | "ADMIN";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
  passwordHash: { type: String, required: true, select: false, validate: { validator: (value: string) => value.trim().length > 0, message: "Password hash cannot be blank" } },
  phone: {
    type: String, trim: true, maxlength: 30,
    required: function (this: { role?: UserRole }) { return this.role === "TEACHER"; },
    validate: { validator: (value?: string) => !value || (/^[+0-9() .-]+$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15), message: "Enter a valid phone number" },
  },
  city: { type: String, trim: true, maxlength: 100, required: function (this: { role?: UserRole }) { return this.role === "TEACHER"; } },
  institutionName: { type: String, trim: true, maxlength: 200, required: function (this: { role?: UserRole }) { return this.role === "TEACHER"; } },
  designation: { type: String, trim: true, maxlength: 100 },
  // Legacy compatibility only. New writes and API responses use `designation`.
  department: { type: String, trim: true, maxlength: 100 },
  role: { type: String, enum: ["TEACHER", "ADMIN"], default: "TEACHER", required: true },
}, { timestamps: true });

export const User = model("User", userSchema);
