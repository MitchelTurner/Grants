import {
  FUNDER_TYPES,
  defaultDeadlineZone,
  funderTypeLabel,
  type FunderType,
} from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { RequireAuth, useAuth } from "../auth";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";

type Funder = { id: string; name: string; type: string; isPublished: boolean; slug: string };
type Issue = { id: string; subject: string; bodyMd: string; status: string };
type QueueItem = { id: string; title?: string; name?: string; slug: string };
type Queue = { opportunities: QueueItem[]; funders: QueueItem[] };

export function AdminPage() {
  return (
    <RequireAuth>
      <AdminBody />
    </RequireAuth>
  );
}

function AdminBody() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FunderType>("PRIVATE_FOUNDATION");
  const [funderId, setFunderId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [deadline, setDeadline] = useState("");
  const [zone, setZone] = useState("America/Juneau");
  const [csv, setCsv] = useState("funderSlug,title,summary,deadlineType\n");
  const [preview, setPreview] = useState<string>("");
  const funders = useQuery({
    queryKey: ["admin-funders"],
    queryFn: () => api<{ items: Funder[] }>("/admin/funders"),
  });
  const queue = useQuery({
    queryKey: ["admin-queue"],
    queryFn: () => api<Queue>("/admin/verification-queue"),
  });
  const issues = useQuery({
    queryKey: ["admin-issues"],
    queryFn: () => api<Issue[]>("/admin/digest-issues"),
  });
  const superadmin = me?.platformRole === "SUPERADMIN";
  const settings = useQuery({
    queryKey: ["admin-settings"],
    enabled: superadmin,
    queryFn: () => api<{ key: string; value: string }[]>("/admin/settings"),
  });
  const [lookup, setLookup] = useState("");
  const [users, setUsers] = useState<string>("");

  if (me && me.platformRole !== "CURATOR" && me.platformRole !== "SUPERADMIN") {
    return <Page title="Curator">This page is for curators.</Page>;
  }

  return (
    <Page
      title="Curator"
      lede="Verify a record before it appears on the public site. Nothing in the digest sends until you approve it."
    >
      {note ? <Notice>{note}</Notice> : null}
      <form
        className="mb-6"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void api("/admin/funders", {
            method: "POST",
            json: { name, type, isPublished: false },
          }).then(() => {
            setName("");
            return queryClient.invalidateQueries({ queryKey: ["admin-funders"] });
          });
        }}
      >
        <h2 className="text-lg font-semibold">Funders</h2>
        <Field label="Name">
          <input
            className={controlClass}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Type">
          <select
            className={controlClass}
            value={type}
            onChange={(event) => setType(event.target.value as FunderType)}
          >
            {FUNDER_TYPES.map((item) => (
              <option key={item} value={item}>
                {funderTypeLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit">Add funder</Button>
        <ul className="mt-3 space-y-2 text-sm">
          {(funders.data?.items ?? []).map((funder) => (
            <li
              key={funder.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3"
            >
              <span>
                {funder.name} · {funder.isPublished ? "Published" : "Unpublished"}
              </span>
              <Button
                tone="quiet"
                onClick={() =>
                  void api(`/admin/funders/${funder.id}/verify`, { method: "POST" }).then(() =>
                    setNote("Funder verified."),
                  )
                }
              >
                Verify
              </Button>
              <Button
                tone="quiet"
                onClick={() =>
                  void api(`/admin/funders/${funder.id}`, {
                    method: "PATCH",
                    json: { isPublished: !funder.isPublished },
                  }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-funders"] }))
                }
              >
                {funder.isPublished ? "Unpublish" : "Publish"}
              </Button>
            </li>
          ))}
        </ul>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void api("/admin/opportunities", {
            method: "POST",
            json: {
              funderId,
              title,
              summary,
              deadlineType: deadline ? "FIXED" : "ROLLING",
              deadlineAt: deadline ? new Date(deadline).toISOString() : null,
              deadlineTimezone: zone,
              status: "OPEN",
              isPublic: true,
            },
          }).then(() => setNote("Opportunity saved."));
        }}
      >
        <h2 className="text-lg font-semibold">Opportunity</h2>
        <Field label="Funder">
          <select
            className={controlClass}
            value={funderId}
            onChange={(event) => {
              setFunderId(event.target.value);
              const funder = funders.data?.items.find((item) => item.id === event.target.value);
              if (funder) setZone(defaultDeadlineZone(funder.type));
            }}
          >
            <option value="">Choose</option>
            {(funders.data?.items ?? []).map((funder) => (
              <option key={funder.id} value={funder.id}>
                {funder.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input
            className={controlClass}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={controlClass}
            required
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Field>
        <Field label="Deadline">
          <input
            className={controlClass}
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </Field>
        <Field
          label="Time zone"
          hint="Federal programs default to Eastern. Others default to Alaska."
        >
          <select
            className={controlClass}
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            {[
              "America/Juneau",
              "America/Anchorage",
              "America/Los_Angeles",
              "America/Chicago",
              "America/New_York",
              "Pacific/Honolulu",
              "UTC",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Button type="submit">Save opportunity</Button>
      </form>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Needs verification</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(queue.data?.opportunities ?? []).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-3"
            >
              <span>{item.title}</span>
              <Button
                tone="quiet"
                onClick={() =>
                  void api(`/admin/opportunities/${item.id}/verify`, { method: "POST" }).then(() =>
                    queryClient.invalidateQueries({ queryKey: ["admin-queue"] }),
                  )
                }
              >
                Verify
              </Button>
            </li>
          ))}
          {(queue.data?.opportunities.length ?? 0) === 0 ? <li>The queue is clear.</li> : null}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">CSV import</h2>
        <p className="text-sm text-ink-soft">Preview first. Nothing is saved until you commit.</p>
        <textarea
          className={`${controlClass} min-h-32 font-mono`}
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <Button
            tone="quiet"
            onClick={() =>
              void api<unknown>("/admin/opportunities/import", {
                method: "POST",
                json: { csv },
              }).then((result) => setPreview(JSON.stringify(result, null, 2)))
            }
          >
            Preview
          </Button>
          <Button
            onClick={() =>
              void api<unknown>("/admin/opportunities/import?dryRun=false", {
                method: "POST",
                json: { csv },
              }).then((result) => setPreview(JSON.stringify(result, null, 2)))
            }
          >
            Commit
          </Button>
        </div>
        {preview ? (
          <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs">{preview}</pre>
        ) : null}
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Digest</h2>
        {(issues.data ?? []).map((issue) => (
          <article key={issue.id} className="mt-3 rounded-xl border border-line bg-white p-4">
            <p className="text-sm">{issue.status}</p>
            <Field label="Subject">
              <input
                className={controlClass}
                defaultValue={issue.subject}
                id={`subject-${issue.id}`}
              />
            </Field>
            <Field label="Body">
              <textarea
                className={`${controlClass} min-h-32`}
                defaultValue={issue.bodyMd}
                id={`body-${issue.id}`}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                tone="quiet"
                onClick={() => {
                  const subject = (
                    document.getElementById(`subject-${issue.id}`) as HTMLInputElement
                  ).value;
                  const bodyMd = (
                    document.getElementById(`body-${issue.id}`) as HTMLTextAreaElement
                  ).value;
                  void api(`/admin/digest-issues/${issue.id}`, {
                    method: "PATCH",
                    json: { subject, bodyMd },
                  });
                }}
              >
                Save edits
              </Button>
              <Button
                tone="quiet"
                onClick={() =>
                  void api(`/admin/digest-issues/${issue.id}/approve`, { method: "POST" }).then(
                    () => queryClient.invalidateQueries({ queryKey: ["admin-issues"] }),
                  )
                }
              >
                Approve
              </Button>
              <Button
                onClick={() =>
                  void api(`/admin/digest-issues/${issue.id}/send`, { method: "POST" }).then(() =>
                    setNote("Send queued. It goes only to confirmed subscribers."),
                  )
                }
              >
                Send
              </Button>
            </div>
          </article>
        ))}
      </section>
      {superadmin ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Platform settings</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {(settings.data ?? []).map((setting) => (
              <li key={setting.key}>
                {setting.key}: {setting.value || "(empty)"}
              </li>
            ))}
          </ul>
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void api(`/admin/users?email=${encodeURIComponent(lookup)}`).then((result) =>
                setUsers(JSON.stringify(result, null, 2)),
              );
            }}
          >
            <Field label="Look up a user (read only)">
              <input
                className={controlClass}
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
              />
            </Field>
            <Button type="submit">Search</Button>
          </form>
          {users ? <pre className="mt-3 overflow-auto text-xs">{users}</pre> : null}
        </section>
      ) : null}
    </Page>
  );
}
