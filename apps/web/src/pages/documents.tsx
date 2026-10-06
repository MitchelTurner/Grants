import { DOCUMENT_KINDS, documentKindLabel, type DocumentKind } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrg } from "../auth";
import { canContribute, canEdit } from "../components/shell";
import { Button, Card, Empty, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { prepareUpload, putWithRetry } from "../lib/compress";
import { when } from "../lib/format";

type DocumentRow = {
  id: string;
  kind: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
};

export function DocumentsPage() {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<DocumentKind>("IRS_DETERMINATION_LETTER");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["documents", org?.id],
    enabled: Boolean(org),
    queryFn: () =>
      api<{ items: DocumentRow[]; packetMissing: string[] }>(`/orgs/${org?.id}/documents`),
  });
  if (!org) return null;
  const organization = org;
  const items = list.data?.items ?? [];

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const prepared = await prepareUpload(file);
      const signed = await api<{
        storageKey: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(`/orgs/${organization.id}/documents/upload-url`, {
        method: "POST",
        json: { filename: prepared.name, mimeType: prepared.type, sizeBytes: prepared.blob.size },
      });
      await putWithRetry(signed.uploadUrl, prepared.blob, prepared.type, setProgress);
      await api(`/orgs/${organization.id}/documents`, {
        method: "POST",
        json: {
          storageKey: signed.storageKey,
          kind,
          title: title || prepared.name,
          mimeType: prepared.type,
          sizeBytes: prepared.blob.size,
          expiresAt: expiresAt || null,
          inFunderPacket: true,
        },
      });
      setTitle("");
      setProgress(null);
      await queryClient.invalidateQueries({ queryKey: ["documents", organization.id] });
    } catch (caught) {
      setProgress(null);
      setError(caught instanceof Error ? caught.message : "The upload failed.");
    }
  }

  async function download(id: string) {
    const result = await api<{ url: string }>(
      `/orgs/${organization.id}/documents/${id}/download-url`,
    );
    window.location.assign(result.url);
  }

  const grouped = new Map<string, DocumentRow[]>();
  for (const item of items) {
    const bucket = grouped.get(item.kind) ?? [];
    bucket.push(item);
    grouped.set(item.kind, bucket);
  }

  return (
    <Page
      title="Documents"
      lede="Files stay private. A download link lasts 5 minutes, and each download is recorded."
    >
      {error ? <Notice>{error}</Notice> : null}
      <Card>
        <h2 className="text-lg font-semibold">Funder packet</h2>
        {(list.data?.packetMissing.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm">The usual packet documents are here.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {(list.data?.packetMissing ?? []).map((missing) => (
              <li key={missing}>{documentKindLabel(missing as DocumentKind)} is still needed</li>
            ))}
          </ul>
        )}
      </Card>
      {canContribute(org.role) ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("file");
            const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
            if (file) void upload(file);
          }}
        >
          <Field label="Kind">
            <select
              className={controlClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentKind)}
            >
              {DOCUMENT_KINDS.map((item) => (
                <option key={item} value={item}>
                  {documentKindLabel(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className={controlClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field
            label="Expires"
            hint="Optional. We remind owners and admins 45, 14, and 3 days before."
          >
            <input
              className={controlClass}
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </Field>
          <Field
            label="File"
            hint="PDF, Word, Excel, PNG, JPG, HEIC, text, or CSV. 25 MB maximum. Photos are resized before they upload."
          >
            <input className={controlClass} name="file" type="file" required />
          </Field>
          {progress != null ? (
            <p className="mb-3 text-sm" role="status">
              Uploading {Math.round(progress * 100)}%
              <span className="mt-1 block h-2 overflow-hidden rounded bg-line">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </span>
            </p>
          ) : null}
          <Button type="submit">Upload</Button>
        </form>
      ) : null}
      {items.length === 0 ? (
        <div className="mt-4">
          <Empty title="The vault is empty">
            <p>
              Start with the IRS letter, a W-9, and the current board list. Those three answer most
              funder packets.
            </p>
          </Empty>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {[...grouped.entries()].map(([group, rows]) => (
            <section key={group}>
              <h2 className="text-lg font-semibold">{documentKindLabel(group as DocumentKind)}</h2>
              <ul className="mt-2 space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3"
                  >
                    <span>
                      {row.title}
                      <span className="block text-sm text-ink-soft">
                        {row.expiresAt ? `Expires ${when(row.expiresAt)}` : "No expiration"}
                      </span>
                    </span>
                    <Button tone="quiet" onClick={() => void download(row.id)}>
                      Download
                    </Button>
                    {canEdit(org.role) ? (
                      <Button
                        tone="quiet"
                        onClick={() => {
                          void api(`/orgs/${org.id}/documents/${row.id}`, {
                            method: "DELETE",
                          }).then(() =>
                            queryClient.invalidateQueries({ queryKey: ["documents", org.id] }),
                          );
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
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
