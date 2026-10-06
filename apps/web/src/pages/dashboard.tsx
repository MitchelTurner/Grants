import {
  applicationStatusLabel,
  documentKindLabel,
  type ApplicationStatus,
  type DocumentKind,
} from "@se-grants/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useOrg } from "../auth";
import { Card, Empty, Page } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";

type Action = { type: string; title: string; dueAt: string; href: string };
type Dashboard = {
  nextActions: Action[];
  upcomingDeadlines: Action[];
  applicationsByStatus: Record<string, number>;
  completeness: { percent: number; missing: { label: string; reason: string }[] };
  packetMissing: string[];
  expiringDocuments: { id: string; title: string; expiresAt: string | null }[];
};

export function DashboardPage() {
  const org = useOrg();
  const dashboard = useQuery({
    queryKey: ["dashboard", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Dashboard>(`/orgs/${org?.id}/dashboard`),
  });
  if (!org) return null;
  const data = dashboard.data;

  return (
    <Page title={org.name} lede={`${org.community}. Here is what needs attention.`}>
      {!data ? <p>Loading the dashboard…</p> : null}
      {data && data.nextActions.length === 0 ? (
        <Empty title="Nothing is due right now">
          <p>Watch an opportunity or add an application so the next deadline shows up here.</p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center text-accent underline"
            to={`/o/${org.slug}/opportunities`}
          >
            Browse opportunities
          </Link>
        </Empty>
      ) : null}
      {data && data.nextActions.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">Next actions</h2>
          <ul className="mt-3 space-y-3">
            {data.nextActions.map((action) => (
              <li key={`${action.type}-${action.title}-${action.dueAt}`}>
                <Link className="block min-h-11" to={action.href.replace(/^\/app/, "")}>
                  <span className="font-medium">{action.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    {labelType(action.type)} · {when(action.dueAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {data ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Profile</h2>
            <p className="mt-2 text-sm">{data.completeness.percent}% complete</p>
            <ul className="mt-2 space-y-2 text-sm text-ink-soft">
              {data.completeness.missing.map((item) => (
                <li key={item.label}>
                  <span className="text-ink">{item.label}.</span> {item.reason}
                </li>
              ))}
            </ul>
            <Link
              className="mt-3 inline-flex min-h-11 items-center text-sm text-accent underline"
              to={`/o/${org.slug}/settings`}
            >
              Finish the profile
            </Link>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Applications</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(data.applicationsByStatus).map(([status, count]) => (
                <li key={status}>
                  {applicationStatusLabel(status as ApplicationStatus)}: {count}
                </li>
              ))}
              {Object.keys(data.applicationsByStatus).length === 0 ? <li>None yet.</li> : null}
            </ul>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Funder packet</h2>
            {data.packetMissing.length === 0 ? (
              <p className="mt-2 text-sm">The standard documents are in the vault.</p>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {data.packetMissing.map((kind) => (
                  <li key={kind}>{documentKindLabel(kind as DocumentKind)} is missing</li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Coming up</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {data.upcomingDeadlines.slice(0, 6).map((item) => (
                <li key={`${item.title}-${item.dueAt}`}>
                  {item.title} · {when(item.dueAt)}
                </li>
              ))}
              {data.upcomingDeadlines.length === 0 ? <li>Nothing in the next 14 days.</li> : null}
            </ul>
          </Card>
        </div>
      ) : null}
    </Page>
  );
}

function labelType(type: string): string {
  if (type === "compliance") return "Compliance";
  if (type === "application") return "Application";
  if (type === "document") return "Document";
  return "Opportunity";
}

export function MorePage() {
  const org = useOrg();
  if (!org) return null;
  const links = [
    ["Opportunities", "opportunities"],
    ["Documents", "documents"],
    ["Writing", "content"],
    ["Compliance", "compliance"],
    ["Settings", "settings"],
    ["Account", "/me"],
  ] as const;
  return (
    <Page title="More">
      <ul className="space-y-2">
        {links.map(([label, path]) => (
          <li key={label}>
            <Link
              className="flex min-h-11 items-center rounded-lg border border-line bg-white px-4"
              to={path.startsWith("/") ? path : `/o/${org.slug}/${path}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
