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

export async function streamApi(
  path: string,
  json: unknown,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-csrf-token", csrfToken || (await loadCsrf()));
  const response = await fetch(`/api/v1${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(json),
  });
  if (!response.ok) {
    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { error?: { code?: string; message?: string } })
      : null;
    throw new ApiError(
      data?.error?.message ?? "Something went wrong. Try again.",
      response.status,
      data?.error?.code,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
    }
  }
}
