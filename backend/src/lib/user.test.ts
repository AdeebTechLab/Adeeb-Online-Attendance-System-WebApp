import { describe, expect, it } from "vitest";
import { publicUser } from "./user.js";
import { User } from "../models/User.js";

const base = { _id: "507f1f77bcf86cd799439011", name: "Salman Adeeb", email: "salman@example.com", phone: "+92 300 1234567", city: "Bahawalpur", institutionName: "Adeeb Public School", role: "TEACHER", createdAt: new Date("2026-08-29") };

describe("public user designation mapping", () => {
  it("returns the new designation field without exposing department", () => {
    const result = publicUser({ ...base, designation: "Teacher", department: "Science" });
    expect(result.designation).toBe("Teacher");
    expect(result.city).toBe("Bahawalpur");
    expect(result.institutionName).toBe("Adeeb Public School");
    expect(result).not.toHaveProperty("department");
  });

  it("uses legacy stored department data when designation is absent", () => {
    const result = publicUser({ ...base, department: "CR" });
    expect(result.designation).toBe("CR");
    expect(result).not.toHaveProperty("department");
  });

  it("keeps legacy records without city or institution readable", () => {
    const { city: _city, institutionName: _institution, ...legacy } = base;
    const result = publicUser(legacy);
    expect(result.city).toBe("");
    expect(result.institutionName).toBe("");
  });

  it("requires city and institution when validating new teacher records", () => {
    const complete = new User({ ...base, passwordHash: "hashed-password" });
    expect(complete.validateSync()).toBeUndefined();
    const incomplete = new User({ ...base, city: undefined, institutionName: undefined, passwordHash: "hashed-password" });
    const error = incomplete.validateSync();
    expect(error?.errors).toHaveProperty("city");
    expect(error?.errors).toHaveProperty("institutionName");
  });

  it("rejects a blank password hash at the persistence boundary", () => {
    const record = new User({ ...base, passwordHash: "   " });
    expect(record.validateSync()?.errors).toHaveProperty("passwordHash");
  });
});
