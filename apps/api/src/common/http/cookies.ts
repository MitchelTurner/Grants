import type { Request, Response } from "express";

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export function secureCookies(appUrl: string): boolean {
  return appUrl.startsWith("https://");
}

export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAgeMs: number; secure: boolean },
): void {
  res.cookie(name, value, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeMs,
  });
}

export function clearCookie(res: Response, name: string, secure: boolean): void {
  res.clearCookie(name, { path: "/", sameSite: "lax", secure, httpOnly: name !== "se_csrf" });
}
