import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useOrg } from "../auth";
import { Button, Page } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";

type Event = { id: string; kind: string; title: string; at: string; href: string };

const KINDS = ["opportunity", "application", "checklist", "compliance", "document"] as const;

export function CalendarPage() {
  const org = useOrg();
  const [cursor, setCursor] = useState(() => new Date());
  const [hidden, setHidden] = useState<string[]>([]);
  const range = useMemo(() => monthRange(cursor), [cursor]);
  const events = useQuery({
    queryKey: ["calendar", org?.id, range.from, range.to],
    enabled: Boolean(org),
    queryFn: () =>
      api<Event[]>(
        `/orgs/${org?.id}/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });
  if (!org) return null;
  const visible = (events.data ?? []).filter((event) => !hidden.includes(event.kind));
  const days = monthDays(cursor);

  return (
    <Page
      title="Calendar"
      lede="Deadlines, checklist dates, compliance, and documents that expire. On a phone this is a list."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          tone="quiet"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          Previous
        </Button>
        <p className="inline-flex min-h-11 items-center font-medium">
          {cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
        </p>
        <Button
          tone="quiet"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          Next
        </Button>
      </div>
      <fieldset className="mb-4 flex flex-wrap gap-3">
        <legend className="sr-only">Event types</legend>
        {KINDS.map((kind) => (
          <label key={kind} className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!hidden.includes(kind)}
              onChange={(event) => {
                setHidden(
                  event.target.checked ? hidden.filter((item) => item !== kind) : [...hidden, kind],
                );
              }}
            />
            {kindLabel(kind)}
          </label>
        ))}
      </fieldset>
      <ul className="space-y-2 md:hidden">
        {visible.map((event) => (
          <li key={event.id} className="rounded-lg border border-line bg-white p-3">
            <Link to={event.href.replace(/^\/app/, "")}>{event.title}</Link>
            <p className="text-sm text-ink-soft">
              {kindLabel(event.kind)} · {when(event.at)}
            </p>
          </li>
        ))}
        {visible.length === 0 ? <li>Nothing in this month.</li> : null}
      </ul>
      <div className="hidden md:grid md:grid-cols-7 md:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <p key={day} className="text-xs font-medium text-ink-soft">
            {day}
          </p>
        ))}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const mine = visible.filter((event) => event.at.slice(0, 10) === key);
          return (
            <div
              key={key}
              className={`min-h-24 rounded-lg border border-line bg-white p-1 text-sm ${day.getMonth() === cursor.getMonth() ? "" : "opacity-50"}`}
            >
              <p>{day.getUTCDate()}</p>
              {mine.map((event) => (
                <Link
                  key={event.id}
                  className="mt-1 block truncate text-xs"
                  to={event.href.replace(/^\/app/, "")}
                >
                  {kindLabel(event.kind)}: {event.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function kindLabel(kind: string): string {
  if (kind === "opportunity") return "Opportunity";
  if (kind === "application") return "Application";
  if (kind === "checklist") return "Checklist";
  if (kind === "compliance") return "Compliance";
  return "Document";
}

function monthRange(cursor: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), 1));
  const to = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

function monthDays(cursor: Date): Date[] {
  const start = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), 1));
  start.setUTCDate(1 - start.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
}
