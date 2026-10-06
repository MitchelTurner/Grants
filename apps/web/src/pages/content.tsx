import {
  CONTENT_TEMPLATES,
  contentCategoryLabel,
  countWords,
  type ContentCategory,
} from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useOrg } from "../auth";
import { canEdit } from "../components/shell";
import { Button, Card, Empty, Field, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { readDraft, saveDraft } from "../lib/drafts";

type Block = {
  id: string;
  category: string;
  title: string;
  body: string;
  wordCount: number;
  charCount: number;
  needsReview: boolean;
  version: number;
  lastReviewedAt: string | null;
  updatedAt: string | null;
};

type Version = { version: number; title: string; body: string; createdAt: string | null };

export function ContentListPage() {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ContentCategory>("MISSION");
  const list = useQuery({
    queryKey: ["content", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Block[] }>(`/orgs/${org?.id}/content-blocks`),
  });
  if (!org) return null;
  const organization = org;

  async function create(event: FormEvent) {
    event.preventDefault();
    const template = CONTENT_TEMPLATES.find((item) => item.category === category);
    const created = await api<Block>(`/orgs/${organization.id}/content-blocks`, {
      method: "POST",
      json: { category, title: template?.title ?? "Untitled", body: template?.starter ?? "" },
    });
    await queryClient.invalidateQueries({ queryKey: ["content", organization.id] });
    window.location.assign(`/app/o/${organization.slug}/content/${created.id}`);
  }

  const items = list.data?.items ?? [];
  return (
    <Page
      title="Writing"
      lede="Reusable answers you can paste into applications. Each save keeps a version."
    >
      {items.length === 0 ? (
        <Empty title="Start with your mission">
          <p>A short mission statement is the piece funders ask for most often.</p>
        </Empty>
      ) : null}
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <Link className="font-medium" to={`/o/${org.slug}/content/${item.id}`}>
                {item.title}
              </Link>
              <p className="text-sm text-ink-soft">
                {contentCategoryLabel(item.category as ContentCategory)} · {item.wordCount} words
                {item.needsReview ? " · Needs review" : ""}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      {canEdit(org.role) ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void create(event)}
        >
          <Field label="Starter">
            <select
              className={controlClass}
              value={category}
              onChange={(event) => setCategory(event.target.value as ContentCategory)}
            >
              {CONTENT_TEMPLATES.map((template) => (
                <option key={template.category} value={template.category}>
                  {template.title}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">New block</Button>
        </form>
      ) : null}
    </Page>
  );
}

export function ContentEditorPage() {
  const org = useOrg();
  const { id = "" } = useParams();
  const area = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Saved");
  const dirty = useRef(false);
  const serverDirty = useRef(false);
  const snapshot = useRef({ title: "", body: "" });
  const block = useQuery({
    queryKey: ["content-block", org?.id, id],
    enabled: Boolean(org && id),
    queryFn: () => api<Block>(`/orgs/${org?.id}/content-blocks/${id}`),
  });
  const versions = useQuery({
    queryKey: ["content-versions", org?.id, id],
    enabled: Boolean(org && id),
    queryFn: () => api<Version[]>(`/orgs/${org?.id}/content-blocks/${id}/versions`),
  });

  useEffect(() => {
    if (!block.data || ready) return;
    const draftKey = `${org?.id}:${id}`;
    void readDraft(draftKey).then((draft) => {
      if (draft && draft.savedAt > (block.data?.updatedAt ?? "")) {
        setTitle(draft.title);
        setBody(draft.body);
        snapshot.current = { title: block.data?.title ?? "", body: block.data?.body ?? "" };
        dirty.current = draft.title !== block.data?.title || draft.body !== block.data?.body;
        setStatus(navigator.onLine ? "Saved on this device" : "Offline, saved on this device");
      } else if (block.data) {
        setTitle(block.data.title);
        setBody(block.data.body);
        snapshot.current = { title: block.data.title, body: block.data.body };
      }
      setReady(true);
    });
  }, [block.data, id, org?.id, ready]);

  useEffect(() => {
    if (!org || !ready) return;
    const local = window.setInterval(() => {
      if (!dirty.current) return;
      void saveDraft(`${org.id}:${id}`, { title, body, savedAt: new Date().toISOString() });
      dirty.current = false;
      setStatus(navigator.onLine ? "Saved on this device" : "Offline, saved on this device");
    }, 3000);
    const remote = window.setInterval(() => {
      if (!serverDirty.current || !navigator.onLine) return;
      serverDirty.current = false;
      setStatus("Saving…");
      void api(`/orgs/${org.id}/content-blocks/${id}`, { method: "PATCH", json: { title, body } })
        .then(() => {
          snapshot.current = { title, body };
          setStatus("Saved");
        })
        .catch(() => {
          serverDirty.current = true;
          setStatus("Offline, saved on this device");
        });
    }, 10_000);
    return () => {
      window.clearInterval(local);
      window.clearInterval(remote);
    };
  }, [body, id, org, ready, title]);

  if (!org) return null;
  const words = countWords(body);
  const template = CONTENT_TEMPLATES.find((item) => item.category === block.data?.category);

  function change(nextTitle: string, nextBody: string) {
    setTitle(nextTitle);
    setBody(nextBody);
    dirty.current = true;
    serverDirty.current =
      nextTitle !== snapshot.current.title || nextBody !== snapshot.current.body;
  }

  function wrap(before: string, after = before) {
    const node = area.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const next = body.slice(0, start) + before + body.slice(start, end) + after + body.slice(end);
    change(title, next);
  }

  return (
    <Page title={title || "Writing"} lede={template?.prompt}>
      <p role="status" className="mb-3 text-sm">
        {status}
      </p>
      {block.data?.needsReview ? (
        <p className="mb-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
          Needs review. This was last marked reviewed more than a year ago.
          {canEdit(org.role) ? (
            <Button
              tone="quiet"
              onClick={() => {
                void api(`/orgs/${org.id}/content-blocks/${id}`, {
                  method: "PATCH",
                  json: { markReviewed: true },
                }).then(() => setStatus("Saved"));
              }}
            >
              Mark reviewed
            </Button>
          ) : null}
        </p>
      ) : null}
      <Field label="Title">
        <input
          className={controlClass}
          value={title}
          disabled={!canEdit(org.role)}
          onChange={(event) => change(event.target.value, body)}
        />
      </Field>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button tone="quiet" onClick={() => wrap("**")}>
          Bold
        </Button>
        <Button tone="quiet" onClick={() => wrap("*")}>
          Italic
        </Button>
        <Button tone="quiet" onClick={() => wrap("\n- ", "")}>
          List
        </Button>
        <Button tone="quiet" onClick={() => wrap("[", "](https://)")}>
          Link
        </Button>
      </div>
      <textarea
        ref={area}
        className={`${controlClass} min-h-64 font-mono`}
        value={body}
        disabled={!canEdit(org.role)}
        onChange={(event) => change(title, event.target.value)}
      />
      <p className="mt-2 text-sm text-ink-soft">
        {words} words · {body.length} characters
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button tone="quiet" onClick={() => void navigator.clipboard.writeText(body)}>
          Copy markdown
        </Button>
        <Button
          tone="quiet"
          onClick={() =>
            void navigator.clipboard.writeText(
              body
                .replace(/[*_`#>\n]/g, " ")
                .replace(/\s+/g, " ")
                .trim(),
            )
          }
        >
          Copy plain text
        </Button>
        <Link
          className="inline-flex min-h-11 items-center text-sm underline"
          to={`/o/${org.slug}/content`}
        >
          All writing
        </Link>
      </div>
      <h2 className="mt-6 text-lg font-semibold">Versions</h2>
      <ul className="mt-2 space-y-2">
        {(versions.data ?? []).map((version) => (
          <li
            key={version.version}
            className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <span>Version {version.version}</span>
            {canEdit(org.role) ? (
              <Button
                tone="quiet"
                onClick={() => {
                  void api(`/orgs/${org.id}/content-blocks/${id}/restore/${version.version}`, {
                    method: "POST",
                  }).then(() => {
                    setTitle(version.title);
                    setBody(version.body);
                    setStatus("Saved");
                  });
                }}
              >
                Restore
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Page>
  );
}
