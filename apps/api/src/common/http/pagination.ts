export type Cursor = { t: string; id: string };

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "t" in parsed &&
      "id" in parsed &&
      typeof parsed.t === "string" &&
      typeof parsed.id === "string"
    ) {
      return { t: parsed.t, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

export function cursorFilter(cursor: string | undefined): Record<string, unknown> | undefined {
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    return undefined;
  }
  const createdAt = new Date(decoded.t);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: decoded.id } }],
  };
}
