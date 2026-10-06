import { formatMoney } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useOrg } from "../auth";
import { canContribute } from "../components/shell";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";
import { enqueueMatch, flushMatchQueue, listQueued, queuedMatch } from "../lib/match-queue";
import { messageFrom, todayInput } from "../lib/money-labels";

type Award = { id: string; title: string };
type MatchRow = {
  id: string;
  volunteerName: string;
  date: string | null;
  hours: string | null;
  inKindValue: string | null;
  description: string;
};
type MatchList = { items: MatchRow[]; volunteerRate: string | null };

export function MatchPage() {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [volunteerName, setVolunteerName] = useState("");
  const [date, setDate] = useState(todayInput());
  const [hours, setHours] = useState("");
  const [inKindValue, setInKindValue] = useState("");
  const [description, setDescription] = useState("");
  const [awardId, setAwardId] = useState("");
  const matches = useQuery({
    queryKey: ["matches", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<MatchList>(`/orgs/${org?.id}/matches`),
  });
  const awards = useQuery({
    queryKey: ["awards", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Award[] }>(`/orgs/${org?.id}/awards`),
  });

  useEffect(() => {
    if (!org) return;
    const organizationId = org.id;
    void listQueued(organizationId).then((rows) => setWaiting(rows.length));
    async function sendWaiting() {
      if (!navigator.onLine) return;
      const result = await flushMatchQueue(organizationId, async (entry) => {
        await api(`/orgs/${organizationId}/matches`, { method: "POST", json: entry });
      });
      if (result.sent > 0) {
        setNote(`Sent ${result.sent} saved match ${result.sent === 1 ? "log" : "logs"}.`);
        await queryClient.invalidateQueries({ queryKey: ["matches", organizationId] });
      }
      setWaiting(result.kept);
    }
    void sendWaiting();
    window.addEventListener("online", sendWaiting);
    return () => window.removeEventListener("online", sendWaiting);
  }, [org, queryClient]);

  if (!org) return null;
  const organization = org;
  const rate = matches.data?.volunteerRate ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const entry = queuedMatch(
      {
        awardId: awardId || null,
        volunteerName,
        date,
        hours: hours.trim() || null,
        inKindValue: inKindValue.trim() || null,
        rate: null,
        description,
        photoDocumentIds: [],
        lat: null,
        lng: null,
      },
      crypto.randomUUID().replaceAll("-", ""),
    );
    try {
      if (!navigator.onLine) {
        await enqueueMatch(organization.id, entry);
        setWaiting((count) => count + 1);
        setNote(
          "Saved on this device. It will send when you are back online. Add a photo from the vault after the connection returns.",
        );
      } else {
        await api(`/orgs/${organization.id}/matches`, { method: "POST", json: entry });
        setNote("Match logged.");
        await queryClient.invalidateQueries({ queryKey: ["matches", organization.id] });
      }
      setVolunteerName("");
      setHours("");
      setInKindValue("");
      setDescription("");
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  return (
    <Page title="Match log" lede="Volunteer hours and in-kind support, including from a phone.">
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice>{note}</Notice> : null}
      {waiting > 0 ? (
        <p className="mb-4 text-sm">
          {waiting} log{waiting === 1 ? "" : "s"} waiting to send.
        </p>
      ) : null}
      {rate ? (
        <p className="mb-4 text-sm">
          Hours are valued at {formatMoney(rate)} when you leave the dollar amount blank.
        </p>
      ) : (
        <p className="mb-4 text-sm">
          No volunteer hour rate is set, so hours are logged without a dollar value unless you enter
          one.
        </p>
      )}
      {canContribute(organization.role) ? (
        <form onSubmit={(event) => void submit(event)}>
          <Field label="Volunteer">
            <input
              className={controlClass}
              value={volunteerName}
              onChange={(event) => setVolunteerName(event.target.value)}
              required
            />
          </Field>
          <Field label="Date">
            <input
              className={controlClass}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Hours" hint="Optional if you enter a dollar value instead.">
            <input
              className={controlClass}
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Dollar value"
            hint="Optional. Leave blank to use hours and the platform rate."
          >
            <input
              className={controlClass}
              value={inKindValue}
              onChange={(event) => setInKindValue(event.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Award" hint="Optional.">
            <select
              className={controlClass}
              value={awardId}
              onChange={(event) => setAwardId(event.target.value)}
            >
              <option value="">Not tied to an award</option>
              {(awards.data?.items ?? []).map((award) => (
                <option key={award.id} value={award.id}>
                  {award.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What they did">
            <textarea
              className={controlClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </Field>
          <p className="mb-4 text-sm text-ink-soft">
            Photos have to already be in the document vault. A photo taken while offline is not
            uploaded from this form.
          </p>
          <Button type="submit">Log match</Button>
        </form>
      ) : null}
      <ul className="mt-6 space-y-2">
        {(matches.data?.items ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
            <p className="font-medium">{row.volunteerName}</p>
            <p>
              {when(row.date)}
              {row.hours ? ` · ${row.hours} hours` : ""}
              {row.inKindValue ? ` · ${formatMoney(row.inKindValue)}` : ""}
            </p>
            <p>{row.description}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
