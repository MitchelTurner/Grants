import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const ZONE_NAMES: Record<string, string> = {
  "America/Juneau": "Alaska",
  "America/Anchorage": "Alaska",
  "America/Sitka": "Alaska",
  "America/Yakutat": "Alaska",
  "America/Metlakatla": "Alaska",
  "America/Nome": "Alaska",
  "America/Adak": "Hawaii-Aleutian",
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Phoenix": "Arizona",
  "Pacific/Honolulu": "Hawaii",
  UTC: "UTC",
};

export function timezoneName(timeZone: string): string {
  return ZONE_NAMES[timeZone] ?? timeZone.replaceAll("_", " ");
}

export function formatDeadlineInstant(instant: Date, timeZone: string): string {
  const clock = formatInTimeZone(instant, timeZone, "EEE, MMM d · h:mm a");
  return `${clock} ${timezoneName(timeZone)}`;
}

export type DeadlineDisplay = {
  primary: string;
  original: string | null;
  timezonesDiffer: boolean;
};

/**
 * Viewer zone first. When the funder stated a different zone, keep the original
 * in parentheses. SPEC §8 F6.
 */
export function displayDeadline(
  instant: Date,
  viewerTimeZone: string,
  funderTimeZone: string | null,
): DeadlineDisplay {
  const primary = formatDeadlineInstant(instant, viewerTimeZone);
  if (!funderTimeZone || funderTimeZone === viewerTimeZone) {
    return { primary, original: null, timezonesDiffer: false };
  }
  return {
    primary,
    original: formatDeadlineInstant(instant, funderTimeZone),
    timezonesDiffer: true,
  };
}

export function defaultDeadlineZone(funderType: string): string {
  return funderType === "FEDERAL" ? "America/New_York" : "America/Juneau";
}

/** Subtract Mon–Fri days, leaving the clock time in the given zone. */
export function subtractBusinessDays(instant: Date, days: number, timeZone: string): Date {
  const marker = formatInTimeZone(instant, timeZone, "yyyy-MM-dd HH:mm:ss");
  const [datePart, timePart] = marker.split(" ");
  if (!datePart || !timePart) {
    return instant;
  }
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    return instant;
  }
  const cursor = new Date(Date.UTC(year, month - 1, day));
  let left = days;
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      left -= 1;
    }
  }
  const y = cursor.getUTCFullYear();
  const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const d = String(cursor.getUTCDate()).padStart(2, "0");
  return fromZonedTime(`${y}-${m}-${d} ${timePart}`, timeZone);
}

/** Calendar date (YYYY-MM-DD) at a local hour, as a UTC instant. */
export function zonedDateTime(date: string, hour: number, timeZone: string): Date {
  const hh = String(hour).padStart(2, "0");
  return fromZonedTime(`${date} ${hh}:00:00`, timeZone);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
    return true;
  } catch {
    return false;
  }
}

export function localParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number; hour: number } {
  const text = formatInTimeZone(instant, timeZone, "yyyy-MM-dd HH i");
  const [datePart, hourPart, weekdayPart] = text.split(" ");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  return {
    year: year ?? 0,
    month: month ?? 0,
    day: day ?? 0,
    hour: Number(hourPart ?? 0),
    weekday: Number(weekdayPart ?? 1) % 7,
  };
}
