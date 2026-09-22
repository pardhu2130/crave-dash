import type { AuthSession } from "@/lib/types";

/**
 * Every browser call goes through the Spring Cloud API Gateway, which resolves
 * AUTH-SERVICE / RESTAURANT-SERVICE / ORDER-SERVICE / PAYMENT-SERVICE through
 * Eureka + the load balancer. Point VITE_API_GATEWAY_URL at the gateway host.
 *
 * This client deliberately uses the browser's native `fetch` — no HTTP library
 * is bundled into the preview, so the app runs the same whether the Spring
 * stack is up or the offline demo backend answers instead.
 */
export const GATEWAY_URL: string =
  (import.meta.env.VITE_API_GATEWAY_URL as string | undefined)?.replace(
    /\/+$/,
    "",
  ) || "http://localhost:8080";

const SESSION_KEY = "cravedash.session";

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface RequestConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the gateway, e.g. `/api/orders`. */
  url: string;
  /** JSON request body. */
  data?: unknown;
  /** Query parameters; `undefined` values are skipped. */
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

/** Marker so `describeError` can tell an aborted request from a real failure. */
class TimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "TimeoutError";
  }
}

function buildUrl(
  url: string,
  params?: RequestConfig["params"],
): string {
  const base = `${GATEWAY_URL}${url}`;
  if (!params) return base;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.append(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `${base}?${encoded}` : base;
}

export function readSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* storage unavailable (private mode) — the in-memory session still works */
  }
}

export function clearSession(): void {
  writeSession(null);
}

/** Reads the `message` field of the services' ErrorResponse body when present. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TimeoutError) {
    return "The request timed out. Is the API gateway running?";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request was cancelled.";
  }
  if (error instanceof TypeError) {
    return `Cannot reach the API gateway at ${GATEWAY_URL}.`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Performs a gateway request and unwraps the JSON body. Non-2xx responses are
 * turned into `ApiError` whose `message` comes from the service's
 * ErrorResponse body, so callers can show it directly.
 */
export async function request<T>(config: RequestConfig): Promise<T> {
  const {
    method = "GET",
    url,
    data,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = config;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (data !== undefined) headers["Content-Type"] = "application/json";

  const session = readSession();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(url, params), {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(describeError(new TimeoutError()), 0);
    }
    throw new ApiError(describeError(error), 0);
  } finally {
    window.clearTimeout(timer);
  }

  const body = await readBody(response);

  if (!response.ok) {
    const payload = body as { message?: string; error?: string } | undefined;
    const message =
      (typeof payload === "object" && payload?.message) ||
      (typeof payload === "object" && payload?.error) ||
      (typeof body === "string" && body) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

/**
 * True when the gateway answers at all. A 401/404 still counts as reachable —
 * only a transport failure (offline, CORS, DNS, timeout) means demo mode.
 */
export async function pingGateway(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${GATEWAY_URL}/api/restaurants`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
