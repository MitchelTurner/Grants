import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  checklistKindLabel,
  documentKindLabel,
  formatMoney,
  type ApplicationStatus,
  type ChecklistKind,
  type DocumentKind,
} from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useOrg } from "../auth";
import { canContribute, canEdit } from "../components/shell";
import { Button, Empty, Field, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { daysLeft, when } from "../lib/format";
import { toast } from "../lib/toast";

type ChecklistItem = {
  id: string;
  label: string;
  kind: string;
  dueAt: string | null;
  assigneeId: string | null;
  doneAt: string | null;
  linkedDocumentId: string | null;
  sortOrder: number;
};

type Application = {
  id: string;
  title: string;
  status: string;
  funderName: string | null;
  amountRequested: string | null;
  amountAwarded: string | null;
  funderDeadlineAt: string | null;
  internalDueAt: string | null;
  declineFeedback: string | null;
  checklist: ChecklistItem[];
  daysRemaining?: number | null;
  openChecklist?: number;
  packetMissing?: string[];
};

type List = { items: Application[] };
type Member = { id: string; userId: string; name: string | null; email: string };
type Doc = { id: string; title: string };

export function ApplicationsPage() {
  const org = useOrg();
  const [view, setView] = useState<"board" | "list">("board");
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["applications", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<List>(`/orgs/${org?.id}/applications`),
  });
  if (!org) return null;
  const organization = org;
  const items = list.data?.items ?? [];

  async function create(event: FormEvent) {
    event.preventDefault();
    await api(`/orgs/${organization.id}/applications`, { method: "POST", json: { title } });
    setTitle("");
    await queryClient.invalidateQueries({ queryKey: ["applications", organization.id] });
  }

  async function move(id: string, status: string, extra: Record<string, string> = {}) {
    const previous = queryClient.getQueryData<List>(["applications", organization.id]);
    queryClient.setQueryData<List>(["applications", organization.id], (current) =>
      current
        ? { items: current.items.map((item) => (item.id === id ? { ...item, status } : item)) }
        : current,
    );
    try {
      await api(`/orgs/${organization.id}/applications/${id}`, {
        method: "PATCH",
        json: { status, ...extra },
      });
    } catch (error) {
      queryClient.setQueryData(["applications", organization.id], previous);
      toast(error instanceof Error ? error.message : "Could not update that application.");
    }
  }

  return (
    <Page title="Applications" lede="Move work across the board. On a phone, use the status menu.">
      {canEdit(org.role) ? (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void create(event)}
        >
          <Field label="Custom application">
            <input
              className={controlClass}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Harbor lights grant"
            />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      ) : null}
      <div className="mb-4 flex gap-2">
        <Button tone={view === "board" ? "primary" : "quiet"} onClick={() => setView("board")}>
          Board
        </Button>
        <Button tone={view === "list" ? "primary" : "quiet"} onClick={() => setView("list")}>
          List
        </Button>
      </div>
      {items.length === 0 ? (
        <Empty title="No applications yet">
          <p>Start one from an opportunity, or add a custom application above.</p>
          <Link
            className="mt-2 inline-flex min-h-11 items-center text-accent underline"
            to={`/o/${org.slug}/opportunities`}
          >
            Find an opportunity
          </Link>
        </Empty>
      ) : null}
      {view === "list" ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-white p-4">
              <Link className="font-medium" to={`/o/${org.slug}/applications/${item.id}`}>
                {item.title}
              </Link>
              <p className="text-sm text-ink-soft">
                {applicationStatusLabel(item.status as ApplicationStatus)} ·{" "}
                {item.funderName ?? "Custom"} · {when(item.funderDeadlineAt)}
              </p>
              <StatusControl item={item} onMove={move} enabled={canEdit(org.role)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {APPLICATION_STATUSES.map((status) => (
            <section
              key={status}
              className="w-64 shrink-0 rounded-xl border border-line bg-paper p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("text/plain");
                if (id) void move(id, status);
              }}
            >
              <h2 className="px-2 py-2 text-sm font-semibold">{applicationStatusLabel(status)}</h2>
              <ul className="space-y-2">
                {items
                  .filter((item) => item.status === status)
                  .map((item) => (
                    <li
                      key={item.id}
                      draggable={canEdit(org.role)}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                      className="rounded-lg border border-line bg-white p-3"
                    >
                      <Link className="font-medium" to={`/o/${org.slug}/applications/${item.id}`}>
                        {item.title}
                      </Link>
                      <p className="text-xs text-ink-soft">
                        {when(item.internalDueAt ?? item.funderDeadlineAt)}
                      </p>
                      <div className="md:hidden">
                        <StatusControl item={item} onMove={move} enabled={canEdit(org.role)} />
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function StatusControl({
  item,
  onMove,
  enabled,
}: {
  item: Application;
  onMove: (id: string, status: string, extra?: Record<string, string>) => Promise<void>;
  enabled: boolean;
}) {
  const [status, setStatus] = useState(item.status);
  const [feedback, setFeedback] = useState(item.declineFeedback ?? "");
  const [amount, setAmount] = useState(item.amountAwarded ?? "");
  if (!enabled) return null;
  return (
    <div className="mt-2">
      <label className="text-sm">
        Status
        <select
          className={`${controlClass} mt-1`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {APPLICATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {applicationStatusLabel(value)}
            </option>
          ))}
        </select>
      </label>
      {status === "DECLINED" ? (
        <label className="mt-2 block text-sm">
          What did the funder say?
          <textarea
            className={`${controlClass} mt-1`}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
      ) : null}
      {status === "AWARDED" ? (
        <label className="mt-2 block text-sm">
          Amount awarded
          <input
            className={`${controlClass} mt-1`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="10000.00"
          />
        </label>
      ) : null}
      <Button
        onClick={() => {
          const extra: Record<string, string> = {};
          if (status === "DECLINED") extra.declineFeedback = feedback;
          if (status === "AWARDED" && amount) extra.amountAwarded = amount;
          void onMove(item.id, status, extra);
        }}
      >
        Update status
      </Button>
    </div>
  );
}

export function ApplicationDetailPage() {
  const org = useOrg();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const detail = useQuery({
    queryKey: ["application", org?.id, id],
    enabled: Boolean(org && id),
    queryFn: () => api<Application>(`/orgs/${org?.id}/applications/${id}`),
  });
  const members = useQuery({
    queryKey: ["members", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Member[]>(`/orgs/${org?.id}/members`),
  });
  const documents = useQuery({
    queryKey: ["documents", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Doc[] }>(`/orgs/${org?.id}/documents`),
  });
  if (!org) return null;
  const organization = org;
  const item = detail.data;

  async function patchItem(itemId: string, json: Record<string, unknown>) {
    if (!item) return;
    const previous = item;
    queryClient.setQueryData<Application>(["application", organization.id, id], {
      ...item,
      checklist: item.checklist.map((row) =>
        row.id === itemId
          ? {
              ...row,
              ...json,
              doneAt:
                json.done === true
                  ? new Date().toISOString()
                  : json.done === false
                    ? null
                    : row.doneAt,
            }
          : row,
      ),
    });
    try {
      await api(`/orgs/${organization.id}/applications/${id}/checklist/${itemId}`, {
        method: "PATCH",
        json,
      });
      await queryClient.invalidateQueries({ queryKey: ["application", organization.id, id] });
    } catch (error) {
      queryClient.setQueryData(["application", organization.id, id], previous);
      toast(error instanceof Error ? error.message : "Could not save that checklist change.");
    }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    await api(`/orgs/${organization.id}/applications/${id}/checklist`, {
      method: "POST",
      json: { label, kind: "OTHER" },
    });
    setLabel("");
    await queryClient.invalidateQueries({ queryKey: ["application", organization.id, id] });
  }

  async function reorder(ids: string[]) {
    await api(`/orgs/${organization.id}/applications/${id}/checklist/reorder`, {
      method: "POST",
      json: { ids },
    });
    await queryClient.invalidateQueries({ queryKey: ["application", organization.id, id] });
  }

  return (
    <Page title={item?.title ?? "Application"} lede={item?.funderName ?? ""}>
      {item ? (
        <>
          <p>{daysLeft(item.daysRemaining ?? null)}</p>
          <p className="text-sm text-ink-soft">
            Internal due {when(item.internalDueAt)} · Funder deadline {when(item.funderDeadlineAt)}
            {item.amountRequested ? ` · Requested ${formatMoney(item.amountRequested)}` : ""}
          </p>
          <p className="mt-2 text-sm">{item.openChecklist ?? 0} checklist items still open.</p>
          {item.packetMissing && item.packetMissing.length > 0 ? (
            <p className="mt-2 text-sm">
              Missing from the funder packet:{" "}
              {item.packetMissing.map((kind) => documentKindLabel(kind as DocumentKind)).join(", ")}
              .
            </p>
          ) : null}
          <StatusControl
            item={item}
            enabled={canEdit(org.role)}
            onMove={async (applicationId, status, extra) => {
              await api(`/orgs/${organization.id}/applications/${applicationId}`, {
                method: "PATCH",
                json: { status, ...extra },
              });
              await queryClient.invalidateQueries({
                queryKey: ["application", organization.id, id],
              });
            }}
          />
          <h2 className="mt-6 text-lg font-semibold">Checklist</h2>
          <ul className="mt-3 space-y-3">
            {item.checklist.map((row, index) => (
              <li key={row.id} className="rounded-xl border border-line bg-white p-3">
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(row.doneAt)}
                    disabled={!canContribute(org.role)}
                    onChange={(event) => void patchItem(row.id, { done: event.target.checked })}
                  />
                  <span className={row.doneAt ? "line-through" : ""}>{row.label}</span>
                  <span className="text-sm text-ink-soft">
                    {checklistKindLabel(row.kind as ChecklistKind)}
                  </span>
                </label>
                {canEdit(org.role) ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <label className="text-sm">
                      Due
                      <input
                        className={controlClass}
                        type="date"
                        value={row.dueAt?.slice(0, 10) ?? ""}
                        onChange={(event) =>
                          void patchItem(row.id, {
                            dueAt: event.target.value
                              ? `${event.target.value}T17:00:00.000Z`
                              : null,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Assigned to
                      <select
                        className={controlClass}
                        value={row.assigneeId ?? ""}
                        onChange={(event) =>
                          void patchItem(row.id, { assigneeId: event.target.value || null })
                        }
                      >
                        <option value="">Unassigned</option>
                        {(members.data ?? []).map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.name ?? member.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Linked document
                      <select
                        className={controlClass}
                        value={row.linkedDocumentId ?? ""}
                        onChange={(event) =>
                          void patchItem(row.id, { linkedDocumentId: event.target.value || null })
                        }
                      >
                        <option value="">None</option>
                        {(documents.data?.items ?? []).map((document) => (
                          <option key={document.id} value={document.id}>
                            {document.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        tone="quiet"
                        disabled={index === 0}
                        onClick={() => {
                          const ids = item.checklist.map((entry) => entry.id);
                          const swap = ids[index - 1];
                          const current = ids[index];
                          if (!swap || !current) return;
                          ids[index - 1] = current;
                          ids[index] = swap;
                          void reorder(ids);
                        }}
                      >
                        Move up
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit(org.role) ? (
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={(event) => void addItem(event)}
            >
              <Field label="New checklist item">
                <input
                  className={controlClass}
                  required
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              <Button type="submit">Add item</Button>
            </form>
          ) : null}
        </>
      ) : (
        <p>Loading…</p>
      )}
    </Page>
  );
}
