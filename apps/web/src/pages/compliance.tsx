import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrg } from "../auth";
import { canEdit } from "../components/shell";
import { Button, Card, Empty, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";

type Item = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: string;
  kind: string;
  rrule: string | null;
};

type Template = {
  id: string;
  kind: string;
  title: string;
  explanation: string;
  officialUrl: string;
  rrule: string | null;
  suggestedDueAt: string | null;
};

const STATUS: Record<string, string> = {
  ok: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
  inactive: "Paused",
};

export function CompliancePage() {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [dates, setDates] = useState<Record<string, string>>({});
  const list = useQuery({
    queryKey: ["compliance", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Item[]>(`/orgs/${org?.id}/compliance`),
  });
  const profile = useQuery({
    queryKey: ["org", org?.id],
    enabled: Boolean(org),
    queryFn: () =>
      api<{ type: string; receivesFederalFunds: boolean; fiscalYearStartMonth: number }>(
        `/orgs/${org?.id}`,
      ),
  });
  const templates = useQuery({
    queryKey: ["templates", profile.data?.type, profile.data?.receivesFederalFunds],
    enabled: Boolean(profile.data),
    queryFn: () => {
      const data = profile.data;
      if (!data) return Promise.resolve([] as Template[]);
      const params = new URLSearchParams({
        orgType: data.type,
        receivesFederalFunds: String(data.receivesFederalFunds),
        fiscalYearStartMonth: String(data.fiscalYearStartMonth),
      });
      return api<Template[]>(`/compliance/templates?${params.toString()}`);
    },
  });
  if (!org) return null;
  const items = list.data ?? [];

  return (
    <Page
      title="Compliance"
      lede="Dates that keep the organization eligible. Marking one complete rolls a repeating date forward."
    >
      {items.length === 0 ? (
        <Empty title="No compliance dates yet">
          <p>
            Add insurance, the Form 990, or SAM.gov if they apply. Each one includes a short
            explanation.
          </p>
        </Empty>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm">
                {STATUS[item.status] ?? item.status} · {when(item.dueAt)}
              </p>
              {item.description ? (
                <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
              ) : null}
              {canEdit(org.role) && item.status !== "inactive" ? (
                <Button
                  onClick={() => {
                    void api(`/orgs/${org.id}/compliance/${item.id}/complete`, {
                      method: "POST",
                    }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["compliance", org.id] }),
                    );
                  }}
                >
                  Mark complete
                </Button>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      {canEdit(org.role) ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Add from a template</h2>
          <ul className="mt-3 space-y-3">
            {(templates.data ?? []).map((template) => (
              <li key={template.id} className="rounded-xl border border-line bg-white p-4">
                <p className="font-medium">{template.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{template.explanation}</p>
                <a className="text-sm text-accent underline" href={template.officialUrl}>
                  Official page
                </a>
                <label className="mt-2 block text-sm">
                  Due date
                  <input
                    className={`${controlClass} mt-1`}
                    type="date"
                    value={dates[template.id] ?? template.suggestedDueAt ?? ""}
                    onChange={(event) => setDates({ ...dates, [template.id]: event.target.value })}
                  />
                </label>
                <Button
                  onClick={() => {
                    const dueAt = dates[template.id] ?? template.suggestedDueAt;
                    if (!dueAt) return;
                    void api(`/orgs/${org.id}/compliance`, {
                      method: "POST",
                      json: {
                        kind: template.kind,
                        title: template.title,
                        description: template.explanation,
                        dueAt,
                        rrule: template.rrule,
                        templateId: template.id,
                      },
                    }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["compliance", org.id] }),
                    );
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}
