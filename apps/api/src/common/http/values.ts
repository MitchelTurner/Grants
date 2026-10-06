export function moneyOut(value: { toString(): string } | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}

export function dateOnlyOut(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function dateOnlyIn(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
