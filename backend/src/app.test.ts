import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("HTTP application boundary", () => {
  it("redirects the API root to the frontend application", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://localhost:5173");
  });

  it("exposes a deployment health check without database access", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("blocks state-changing requests from untrusted browser origins", async () => {
    const response = await request(app).post("/api/auth/login").set("Origin", "https://malicious.example").send({ email: "teacher@example.com", password: "Password1" });
    expect(response.status).toBe(403);
  });
});
