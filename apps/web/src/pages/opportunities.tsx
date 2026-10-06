import { FOCUS_AREAS, formatMoney, funderTypeLabel, type FunderType } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useOrg } from "../auth";
import { canEdit } from "../components/shell";
import { Button, Card, Empty, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { toast } from "../lib/toast";

type Opportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  url: string | null;
  fundingForm: string;
  minAmount: string | null;
  maxAmount: string | null;
  deadline: { primary: string; original: string | null; timezonesDiffer: boolean } | null;
  lastVerifiedAt: string | null;
  caution: string | null;
  samWarning: string | null;
  fit: { label: string; text: string; reasons: string[] } | null;
  funder: { name: string; slug: string; type: string };
  status: string;
};

type PageResult = { items: Opportunity[]; nextCursor: string | null };

export function OpportunitiesPage() {
  const org = useOrg();
  const [q, setQ] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [within, setWithin] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({ q: "", focusArea: "", within: "", status: "" });
  const list = useQuery({
    queryKey: ["opportunities", org?.id, filters],
    enabled: Boolean(org),
    queryFn: () => {
      const params = new URLSearchParams();
      if (org) params.set("fitForOrgId", org.id);
      if (filters.q) params.set("q", filters.q);
      if (filters.focusArea) params.set("focusArea", filters.focusArea);
      if (filters.within) params.set("deadlineWithinDays", filters.within);
      if (filters.status) params.set("status", filters.status);
      return api<PageResult>(`/opportunities?${params.toString()}`);
    },
  });

  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters({ q, focusArea, within, status });
  }

  if (!org) return null;
  const items = list.data?.items ?? [];

  return (
    <Page
      title="Opportunities"
      lede="Published programs, with a plain-language fit label for this organization."
    >
      <form className="mb-4 grid gap-3 md:grid-cols-4" onSubmit={apply}>
        <Field label="Search">
          <input
            className={controlClass}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </Field>
        <Field label="Focus area">
          <select
            className={controlClass}
            value={focusArea}
            onChange={(event) => setFocusArea(event.target.value)}
          >
            <option value="">Any</option>
            {FOCUS_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className={controlClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Open or upcoming</option>
            <option value="OPEN">Open</option>
            <option value="UPCOMING">Upcoming</option>
          </select>
        </Field>
        <Field label="Deadline within days">
          <input
            className={controlClass}
            inputMode="numeric"
            value={within}
            onChange={(event) => setWithin(event.target.value)}
          />
        </Field>
        <Button type="submit">Filter</Button>
      </form>
      {items.length === 0 && !list.isLoading ? (
        <Empty title="No opportunities match">
          <p>
            Try clearing a filter. Curators publish records after they verify them, so a new program
            may not be listed yet.
          </p>
        </Empty>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <Link
                className="text-lg font-semibold"
                to={`/o/${org.slug}/opportunities/${item.slug}`}
              >
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">
                {item.funder.name} · {funderTypeLabel(item.funder.type as FunderType)}
              </p>
              <Deadline deadline={item.deadline} />
              {item.fit ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">{item.fit.text}.</span> {item.fit.reasons.join(" ")}
                </p>
              ) : null}
              {item.caution ? <p className="mt-2 text-sm">{item.caution}</p> : null}
              {item.samWarning ? <p className="mt-2 text-sm">{item.samWarning}</p> : null}
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function OpportunityDetailPage() {
  const org = useOrg();
  const { slug = "" } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["opportunity", slug, org?.id],
    enabled: Boolean(org && slug),
    queryFn: () => api<Opportunity>(`/opportunities/${slug}?fitForOrgId=${org?.id ?? ""}`),
  });
  const item = detail.data;
  if (!org) return null;

  async function watch() {
    if (!item || !org) return;
    try {
      await api(`/orgs/${org.id}/watches/${item.id}`, { method: "PUT" });
      toast("Watching this opportunity. It is on your calendar.");
      await queryClient.invalidateQueries({ queryKey: ["calendar", org.id] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not watch that opportunity.");
    }
  }

  async function startApplication() {
    if (!item || !org) return;
    const created = await api<{ id: string }>(
      `/orgs/${org.id}/applications/from-opportunity/${item.id}`,
      { method: "POST" },
    );
    window.location.assign(`/app/o/${org.slug}/applications/${created.id}`);
  }

  return (
    <Page title={item?.title ?? "Opportunity"} lede={item ? item.funder.name : "Loading…"}>
      {error ? <Notice>{error}</Notice> : null}
      {item ? (
        <>
          <Deadline deadline={item.deadline} />
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{item.summary}</p>
          <p className="mt-3 text-sm">
            Amount {item.minAmount ? formatMoney(item.minAmount) : "not listed"}
            {item.maxAmount ? ` to ${formatMoney(item.maxAmount)}` : ""}
          </p>
          <p className="mt-2 text-sm">
            Last verified:{" "}
            {item.lastVerifiedAt
              ? new Date(item.lastVerifiedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "not yet"}
          </p>
          <p className="mt-1 text-sm">
            <Link className="text-accent underline" to={`/o/${org.slug}/opportunities`}>
              Back
            </Link>
            {" · "}
            <a className="text-accent underline" href={`/funders/${item.funder.slug}`}>
              Funder page
            </a>
          </p>
          {item.fit ? (
            <p className="mt-3 text-sm">
              <span className="font-medium">{item.fit.text}.</span> {item.fit.reasons.join(" ")}
            </p>
          ) : null}
          {item.caution ? <p className="mt-2 text-sm">{item.caution}</p> : null}
          {item.samWarning ? <p className="mt-2 text-sm">{item.samWarning}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {canEdit(org.role) ? <Button onClick={() => void watch()}>Watch</Button> : null}
            {canEdit(org.role) ? (
              <Button tone="quiet" onClick={() => void startApplication()}>
                Start an application
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </Page>
  );
}

function Deadline({ deadline }: { deadline: Opportunity["deadline"] }) {
  if (!deadline) return <p className="mt-2 text-sm">No fixed deadline listed.</p>;
  return (
    <p className="mt-2 text-sm">
      {deadline.primary}
      {deadline.timezonesDiffer && deadline.original ? (
        <span className="ml-2 rounded-full border border-line bg-paper px-2 py-1">
          ({deadline.original})
        </span>
      ) : null}
    </p>
  );
}
