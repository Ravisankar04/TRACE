import { ApiClientError } from "./errors";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Browser calls same-origin `/api/*` (rewritten to the Fastify API). */

export { ApiClientError };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      data?.error?.message || `Request failed (${res.status})`,
      res.status,
      data?.error?.code,
    );
  }
  return data as T;
}
