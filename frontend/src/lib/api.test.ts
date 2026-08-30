import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("API client", () => {
  it("always sends session cookies and JSON headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await api("/classes", { method: "POST", body: JSON.stringify({ name: "Grade 8" }) });
    expect(fetchMock).toHaveBeenCalledWith("/api/classes", expect.objectContaining({ credentials: "include", headers: expect.objectContaining({ "Content-Type": "application/json" }) }));
  });

  it("surfaces safe API error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Class not found." }), { status: 404, headers: { "Content-Type": "application/json" } }));
    await expect(api("/classes/missing")).rejects.toEqual(expect.objectContaining({ message: "Class not found.", status: 404 }));
  });

  it("explains when the API service cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(api("/auth/signup", { method: "POST", body: "{}" })).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining("backend is running"), status: 0 }));
  });

  it("uses the same helpful message for an empty proxy error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    await expect(api("/auth/signup", { method: "POST", body: "{}" })).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining("attendance service is unavailable"), status: 500 }));
  });
});
