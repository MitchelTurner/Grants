export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken = "";

async function loadCsrf(): Promise<string> {
  const response = await fetch("/api/v1/auth/csrf", { credentials: "include" });
  const body = (await response.json()) as { token?: string };
  csrfToken = body.token ?? "";
  return csrfToken;
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown; retry?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    headers.set("x-csrf-token", csrfToken || (await loadCsrf()));
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: { code?: string; message?: string } }) : null;
  if (response.status === 403 && !init.retry && data?.error?.message?.includes("Refresh")) {
    csrfToken = "";
    await loadCsrf();
    return api<T>(path, { ...init, retry: true });
  }
  if (!response.ok) {
    throw new ApiError(
      data?.error?.message ?? "Something went wrong. Try again.",
      response.status,
      data?.error?.code,
    );
  }
  return data as T;
}

export function resetCsrf(): void {
  csrfToken = "";
}
