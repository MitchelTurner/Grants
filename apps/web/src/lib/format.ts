/** Relative plus absolute, never a raw ISO string. */
export function when(value: string | null | undefined): string {
  if (!value) return "No date yet";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  const absolute = date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Juneau",
  });
  if (days === 0) return `today · ${absolute}`;
  if (days === 1) return `in 1 day · ${absolute}`;
  if (days > 1) return `in ${days} days · ${absolute}`;
  if (days === -1) return `1 day ago · ${absolute}`;
  return `${Math.abs(days)} days ago · ${absolute}`;
}

export function daysLeft(days: number | null): string {
  if (days == null) return "No deadline yet";
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Due today";
  return `${Math.abs(days)} days overdue`;
}
