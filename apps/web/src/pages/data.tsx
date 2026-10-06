import { useQuery } from "@tanstack/react-query";
import { useOrg } from "../auth";
import { Empty, Page } from "../components/ui";
import { api } from "../lib/api";

type Point = {
  id: string;
  community: string;
  metric: string;
  value: string;
  unit: string;
  year: number;
  sourceName: string;
  sourceUrl: string;
};

export function DataPackPage() {
  const org = useOrg();
  const points = useQuery({
    queryKey: ["data-points", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Point[]>(`/orgs/${org?.id}/data-points`),
  });
  if (!org) return null;
  const items = points.data ?? [];
  return (
    <Page
      title="Southeast data"
      lede="Figures a curator has recorded, with a source. Drafts can use these only when you select them."
    >
      {items.length === 0 ? (
        <Empty title="No figures for your communities yet">
          <p>A curator adds numbers with a source. This page does not invent statistics.</p>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((point) => (
            <li key={point.id} className="rounded-lg border border-line bg-white p-3">
              <p className="font-medium">
                {point.metric}: {point.value} {point.unit}
              </p>
              <p className="text-sm text-ink-soft">
                {point.community} · {point.year} · {point.sourceName}
              </p>
              <a className="text-sm text-accent underline" href={point.sourceUrl}>
                Source
              </a>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
