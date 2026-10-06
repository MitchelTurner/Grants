import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useOrg } from "../auth";
import { canEdit } from "../components/shell";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";
import { interactionLabel, messageFrom, todayInput, toIso } from "../lib/money-labels";

type Funder = { id: string; name: string };
type Interaction = {
  id: string;
  funderName: string | null;
  contactName: string;
  contactEmail: string | null;
  date: string | null;
  type: string;
  summary: string;
  followUpAt: string | null;
};

export function RelationshipsPage() {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [date, setDate] = useState(todayInput());
  const [type, setType] = useState("CALL");
  const [summary, setSummary] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [funderId, setFunderId] = useState("");
  const interactions = useQuery({
    queryKey: ["interactions", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Interaction[] }>(`/orgs/${org?.id}/interactions`),
  });
  const funders = useQuery({
    queryKey: ["funders"],
    queryFn: () => api<{ items: Funder[] }>("/funders"),
  });
  if (!org) return null;
  const organization = org;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/orgs/${organization.id}/interactions`, {
        method: "POST",
        json: {
          funderId: funderId || null,
          contactName,
          contactEmail: contactEmail.trim() || null,
          date,
          type,
          summary,
          followUpAt: toIso(followUpAt),
        },
      });
      setContactName("");
      setContactEmail("");
      setSummary("");
      setFollowUpAt("");
      await queryClient.invalidateQueries({ queryKey: ["interactions", organization.id] });
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  return (
    <Page title="Funder log" lede="Calls, emails, and the follow-up you do not want to lose.">
      {error ? <Notice>{error}</Notice> : null}
      {canEdit(organization.role) ? (
        <form onSubmit={(event) => void submit(event)}>
          <Field label="Contact">
            <input
              className={controlClass}
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
            />
          </Field>
          <Field label="Email" hint="Optional.">
            <input
              className={controlClass}
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </Field>
          <Field label="Funder" hint="Optional.">
            <select
              className={controlClass}
              value={funderId}
              onChange={(event) => setFunderId(event.target.value)}
            >
              <option value="">Not in the directory</option>
              {(funders.data?.items ?? []).map((funder) => (
                <option key={funder.id} value={funder.id}>
                  {funder.name}
                </option>
              ))}
            </select>
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
          <Field label="Kind">
            <select
              className={controlClass}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="SITE_VISIT">Site visit</option>
            </select>
          </Field>
          <Field label="What happened">
            <textarea
              className={controlClass}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              required
            />
          </Field>
          <Field label="Follow up" hint="Optional. Editors are reminded.">
            <input
              className={controlClass}
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
            />
          </Field>
          <Button type="submit">Save note</Button>
        </form>
      ) : null}
      <ul className="mt-6 space-y-2">
        {(interactions.data?.items ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
            <p className="font-medium">
              {interactionLabel(row.type)} with {row.contactName}
              {row.funderName ? ` · ${row.funderName}` : ""}
            </p>
            <p>
              {when(row.date)}
              {row.followUpAt ? ` · follow up ${when(row.followUpAt)}` : ""}
            </p>
            <p>{row.summary}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
