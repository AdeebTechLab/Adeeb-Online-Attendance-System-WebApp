import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("HTTP application boundary", () => {
  it("describes the running API at its root", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Adeeb Online Attendance System API", status: "running" });
  });

  it("exposes a deployment health check without database access", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "Adeeb Attendance API" });
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("blocks state-changing requests from untrusted browser origins", async () => {
    const response = await request(app).post("/api/auth/login").set("Origin", "https://malicious.example").send({ email: "teacher@example.com", password: "Password1" });
    expect(response.status).toBe(403);
  });
});
