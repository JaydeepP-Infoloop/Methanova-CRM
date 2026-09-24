const TOKEN_KEY = "methanova.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Carries the server's parsed body, not just its message. The lead intake
 * wizard needs `fieldErrors` to put each validation message back on the step
 * that owns the offending field; a bare Error would throw that away.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: { error?: string; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent
 * 401s share one in-flight refresh instead of each firing their own.
 */
function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        setToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiClient<T>(path: string, init: RequestInit = {}, _isRetry = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401 && !_isRetry && token && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiClient<T>(path, init, true);
    }
    clearToken();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
      fieldErrors?: Record<string, string[]>;
    };
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }
  return (await res.json()) as T;
}

/** Authenticated binary GET — logos cannot be loaded with an <img src> because the file route needs a Bearer token. */
export async function apiBinary(path: string, _isRetry = false): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { headers, credentials: "include" });

  if (res.status === 401 && !_isRetry && token && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiBinary(path, true);
    clearToken();
  }

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }
  return res.blob();
}
