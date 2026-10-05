import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NextFunction, Request, Response } from "express";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (value && SAFE_REQUEST_ID.test(value)) {
    return value;
  }
  return randomUUID();
}

export function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
  const id = resolveRequestId(req.headers["x-request-id"]);
  res.setHeader("x-request-id", id);
  return id;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  assignRequestId(req, res);
  next();
}
