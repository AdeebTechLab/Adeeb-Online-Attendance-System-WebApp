const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error { constructor(message: string, public status: number, public details?: unknown) { super(message); } }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch {
    throw new ApiError("The attendance service is unavailable. Please check that the backend is running, then try again.", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || (response.status >= 500 ? "The attendance service is unavailable. Please check that the backend is running, then try again." : "We could not complete that request. Please try again."), response.status, data.details);
  return data;
}

export async function downloadPdf(path: string, filename: string) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ApiError(data.message || "Could not download PDF.", response.status); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
