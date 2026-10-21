import type { ApiEnvelope } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "azashop.token";

export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: the user simply has to log in again */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Query;
  body?: unknown;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function headers(json: boolean): HeadersInit {
  const token = tokenStore.get();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** A 401 on anything but the login call means the token is missing/expired: drop it and go to /login. */
function handleUnauthorized(path: string) {
  if (path === "/auth/login") return;
  tokenStore.clear();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    // Hard navigation on purpose: it also discards every in-memory query cache from the dead session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?expired=1";
  }
}

export async function api<T = unknown>(path: string, { method = "GET", query, body }: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke server. Periksa koneksi Anda.", 0);
  }

  if (response.status === 204) return { success: true, message: "OK", data: undefined as T };

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(path);
    throw new ApiError(payload?.message ?? `Terjadi kesalahan (${response.status})`, response.status, payload?.errors);
  }

  return payload as ApiEnvelope<T>;
}

/** Authenticated file download (the Bearer header rules out a plain <a href>). */
export async function download(path: string, query: Query, filename: string): Promise<void> {
  const response = await fetch(buildUrl(path, query), { headers: headers(false) });
  if (response.status === 401) handleUnauthorized(path);
  if (!response.ok) throw new ApiError("Gagal mengunduh file", response.status);

  const href = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

/** First server-side validation message per field, e.g. { customer_name: "..." }. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]));
}
