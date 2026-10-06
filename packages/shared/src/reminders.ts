import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DOCUMENT_EXPIRY_OFFSETS = [45, 14, 3] as const;
export const SMS_MAX_OFFSET_DAYS = 2;

/**
 * If the instant falls in quiet hours (quietStart inclusive through quietEnd exclusive,
 * wrapping midnight), move it to quietEndHour local time.
 */
export function shiftSmsToQuietEnd(
  instant: Date,
  timeZone: string,
  quietStartHour: number,
  quietEndHour: number,
): Date {
  const local = formatInTimeZone(instant, timeZone, "yyyy-MM-dd HH");
  const [datePart, hourPart] = local.split(" ");
  const hour = Number(hourPart);
  if (!datePart || Number.isNaN(hour)) {
    return instant;
  }
  const inQuiet = isQuietHour(hour, quietStartHour, quietEndHour);
  if (!inQuiet) {
    return instant;
  }
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    return instant;
  }
  const endIsNextDay = hour >= quietStartHour && quietStartHour > quietEndHour;
  const target = new Date(Date.UTC(year, month - 1, day));
  if (endIsNextDay) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const hh = String(quietEndHour).padStart(2, "0");
  return fromZonedTime(`${y}-${m}-${d} ${hh}:00:00`, timeZone);
}

function isQuietHour(hour: number, quietStartHour: number, quietEndHour: number): boolean {
  if (quietStartHour === quietEndHour) {
    return false;
  }
  if (quietStartHour < quietEndHour) {
    return hour >= quietStartHour && hour < quietEndHour;
  }
  return hour >= quietStartHour || hour < quietEndHour;
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 24 * 60 * 60 * 1000);
}

export function smsBody(input: {
  title: string;
  days: number;
  itemsLeft: number | null;
  link: string;
}): string {
  const when = input.days === 1 ? "1 day" : `${input.days} days`;
  const items =
    input.itemsLeft == null
      ? ""
      : ` (${input.itemsLeft} item${input.itemsLeft === 1 ? "" : "s"} left)`;
  const prefix = `SE Grants: ${input.title} due in ${when}${items}. `;
  const room = 160 - prefix.length;
  if (room >= input.link.length) {
    return `${prefix}${input.link}`;
  }
  const shortTitle = input.title.slice(
    0,
    Math.max(8, input.title.length - (input.link.length - room) - 1),
  );
  const retry = `SE Grants: ${shortTitle} due in ${when}${items}. `;
  return `${retry}${input.link}`.slice(0, 160);
}
