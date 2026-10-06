import { displayDeadline, type RfpExtractionResult } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useAuth, useOrg } from "../auth";
import { Button, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { localStorageUrl } from "../lib/compress";

type Extraction = RfpExtractionResult;

type ParseView = {
  id: string;
  status: string;
  error: string | null;
  pdfUrl: string | null;
  warnings: string[];
  extraction: Extraction | null;
  applicationId: string | null;
};

export function RfpReviewPage() {
  const org = useOrg();
  const { me } = useAuth();
  const { parseId = "" } = useParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [titleOn, setTitleOn] = useState(false);
  const [title, setTitle] = useState("");
  const [deadlineOn, setDeadlineOn] = useState(false);
  const [deadlineIso, setDeadlineIso] = useState("");
  const [sections, setSections] = useState<
    Array<{ include: boolean; heading: string; prompt: string; limit: string }>
  >([]);
  const [note, setNote] = useState<string | null>(null);
  const [canvasNote, setCanvasNote] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["rfp", org?.id, parseId],
    enabled: Boolean(org && parseId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
    queryFn: () => api<ParseView>(`/orgs/${org?.id}/rfp-parses/${parseId}`),
  });
  const extraction = detail.data?.extraction ?? null;

  useEffect(() => {
    if (!extraction) return;
    setTitle(extraction.programTitle);
    const deadline = extraction.deadlines.find((item) => item.isoDateTime);
    setDeadlineIso(deadline?.isoDateTime ?? "");
    setSections(
      extraction.narrativeSections.map((section) => ({
        include: false,
        heading: section.heading,
        prompt: section.prompt,
        limit: section.limit,
      })),
    );
  }, [extraction]);

  useEffect(() => {
    const url = detail.data?.pdfUrl;
    const target = document.getElementById("rfp-page");
    if (!url || !(target instanceof HTMLCanvasElement)) return;
    let cancelled = false;
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const task = pdfjs.getDocument({
        url: localStorageUrl(url),
        standardFontDataUrl: `${import.meta.env.BASE_URL}standard_fonts/`,
      });
      const pdf = await task.promise;
      const chosen = Math.min(Math.max(page, 1), pdf.numPages);
      const rendered = await pdf.getPage(chosen);
      const viewport = rendered.getViewport({ scale: 1.2 });
      if (cancelled) return;
      target.width = viewport.width;
      target.height = viewport.height;
      const context = target.getContext("2d");
      if (!context) return;
      await rendered.render({ canvas: target, canvasContext: context, viewport }).promise;
      setCanvasNote(`Page ${chosen} of ${pdf.numPages}`);
    })().catch(() =>
      setCanvasNote("The PDF viewer could not open this file. Use Download instead."),
    );
    return () => {
      cancelled = true;
    };
  }, [detail.data?.pdfUrl, page]);

  if (!org) return null;
  const organization = org;
  const item = detail.data;
  const deadline = extraction?.deadlines[0];
  const shown = deadline?.isoDateTime
    ? displayDeadline(
        new Date(deadline.isoDateTime),
        me?.timezone ?? "America/Juneau",
        deadline.timezone,
      )
    : null;

  async function apply() {
    setNote(null);
    await api(`/orgs/${organization.id}/rfp-parses/${parseId}/apply`, {
      method: "POST",
      json: { applyTitle: titleOn, title, applyDeadline: deadlineOn, deadlineIso, sections },
    });
    setNote(
      "Saved the items you checked. Deadlines and sections you left unchecked were not added.",
    );
    await queryClient.invalidateQueries({ queryKey: ["rfp", organization.id, parseId] });
  }

  return (
    <Page title="Review this RFP" lede="Nothing is saved until you check it and confirm.">
      {item?.error ? <Notice>{item.error}</Notice> : null}
      {note ? <Notice>{note}</Notice> : null}
      {item && (item.status === "QUEUED" || item.status === "RUNNING") ? (
        <p>Reading the PDF…</p>
      ) : null}
      {item?.warnings.map((warning) => (
        <p key={warning} className="mt-2 text-sm">
          Warning: {warning}
        </p>
      ))}
      {extraction ? (
        <div className="mt-4 space-y-4">
          <label className="flex min-h-11 items-start gap-2">
            <input
              type="checkbox"
              checked={titleOn}
              onChange={(event) => setTitleOn(event.target.checked)}
            />
            <span className="grow">
              Program title
              <input
                className={`${controlClass} mt-1`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </span>
          </label>
          <p className="text-sm">{extraction.plainSummary}</p>
          <label className="flex min-h-11 items-start gap-2">
            <input
              type="checkbox"
              checked={deadlineOn}
              onChange={(event) => setDeadlineOn(event.target.checked)}
            />
            <span>
              Deadline: {deadline?.asWritten || "None found"}
              {shown ? ` · ${shown.primary}` : ""}
              {shown?.original ? ` · Funder time: ${shown.original}` : ""}
              <button
                type="button"
                className="ml-2 text-accent underline"
                onClick={() => setPage(deadline?.sourcePage ?? 1)}
              >
                page {deadline?.sourcePage ?? 1}
              </button>
            </span>
          </label>
          {sections.map((section, index) => (
            <label key={`${section.heading}-${index}`} className="flex min-h-11 items-start gap-2">
              <input
                type="checkbox"
                checked={section.include}
                onChange={(event) =>
                  setSections((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, include: event.target.checked } : row,
                    ),
                  )
                }
              />
              <span className="grow">
                Section
                <input
                  className={`${controlClass} mt-1`}
                  value={section.heading}
                  onChange={(event) =>
                    setSections((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, heading: event.target.value } : row,
                      ),
                    )
                  }
                />
                <span className="mt-1 block text-sm text-ink-soft">
                  {section.limit}{" "}
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => setPage(extraction.narrativeSections[index]?.sourcePage ?? 1)}
                  >
                    page {extraction.narrativeSections[index]?.sourcePage}
                  </button>
                </span>
              </span>
            </label>
          ))}
          <p className="text-sm">
            Attachments stay in this review. They are not added to the checklist unless you add them
            yourself.
          </p>
          <Button
            onClick={() => void apply()}
            disabled={item?.status !== "NEEDS_REVIEW" || !item.applicationId}
          >
            Confirm checked items
          </Button>
          {item?.applicationId ? (
            <p className="text-sm">
              <Link
                className="text-accent underline"
                to={`/o/${organization.slug}/applications/${item.applicationId}`}
              >
                Back to the application
              </Link>
            </p>
          ) : (
            <p className="text-sm">
              Choose an application before confirming. This reading is not tied to one yet.
            </p>
          )}
        </div>
      ) : null}
      <div className="mt-6 overflow-auto rounded-lg border border-line bg-white p-2">
        <canvas id="rfp-page" className="max-w-full" />
        {canvasNote ? <p className="text-sm text-ink-soft">{canvasNote}</p> : null}
      </div>
    </Page>
  );
}
