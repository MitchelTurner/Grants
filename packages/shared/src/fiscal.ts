import { formatInTimeZone } from "date-fns-tz";

export function todayDate(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

/** Fiscal year that contains a calendar day, using the org's start month. */
export function fiscalYearContaining(
  startMonth: number,
  day: string,
): { start: string; end: string; label: string } {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const startYear = month >= startMonth ? year : year - 1;
  const start = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const nextStart = new Date(Date.UTC(startYear + 1, startMonth - 1, 1));
  nextStart.setUTCDate(nextStart.getUTCDate() - 1);
  const end = nextStart.toISOString().slice(0, 10);
  const label = startMonth === 1 ? String(startYear) : `${startYear}–${startYear + 1}`;
  return { start, end, label };
}

export function dateInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}
