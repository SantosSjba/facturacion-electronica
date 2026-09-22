import { parseApiError, type ApiError } from "./errors";

const REFRESH_KEY = "factosys.refresh_token";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface HttpClientOptions {
  baseUrl?: string;
  getAccessToken: () => string | null;
  setAccessToken: (token: string | null) => void;
  onAuthFailure: () => void;
}

let accessTokenMemory: string | null = null;
let refreshInFlight: Promise<TokenPair | null> | null = null;

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getAccessTokenMemory(): string | null {
  return accessTokenMemory;
}

export function setAccessTokenMemory(token: string | null): void {
  accessTokenMemory = token;
}

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) || "http://localhost:3000";
}

async function refreshTokens(): Promise<TokenPair | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    setStoredRefreshToken(null);
    setAccessTokenMemory(null);
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  setAccessTokenMemory(data.access_token);
  setStoredRefreshToken(data.refresh_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function ensureRefreshed(): Promise<TokenPair | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  /** Skip silent refresh retry (used by refresh itself). */
  skipRefresh?: boolean;
}

type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler = () => undefined;

export function setAuthFailureHandler(handler: AuthFailureHandler): void {
  onAuthFailure = handler;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    auth = true,
    skipRefresh = false,
    headers: initHeaders,
    ...rest
  } = options;

  const headers = new Headers(initHeaders);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getAccessTokenMemory();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...rest,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !skipRefresh) {
    const refreshed = await ensureRefreshed();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    onAuthFailure();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    const err: ApiError = parseApiError(res.status, json);
    if (res.status === 401 && auth) onAuthFailure();
    throw err;
  }

  return json as T;
}

export async function loginRequest(input: {
  email: string;
  password: string;
  organization_slug: string;
}): Promise<TokenPair> {
  const data = await apiRequest<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>("/auth/login", {
    method: "POST",
    auth: false,
    body: input,
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return;
  try {
    await apiRequest<void>("/auth/logout", {
      method: "POST",
      auth: false,
      body: { refresh_token: refreshToken },
      skipRefresh: true,
    });
  } catch {
    /* revoke best-effort */
  }
}
