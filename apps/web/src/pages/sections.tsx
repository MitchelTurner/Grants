import { countWords, needsMarkers } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button, Field, controlClass } from "../components/ui";
import { api, streamApi } from "../lib/api";
import { toast } from "../lib/toast";

type Section = {
  id: string;
  heading: string;
  prompt: string;
  body: string;
  wordLimit: number | null;
  charLimit: number | null;
  wordCount: number;
  needs: string[];
  source: string;
};

type Block = { id: string; title: string };
type Point = {
  id: string;
  metric: string;
  community: string;
  year: number;
  value: string;
  unit: string;
};
type Criterion = { criterion: string; points: number | null };
type ReviewItem = { criterion: string; coverage: string; suggestion: string };

export function ApplicationSections({
  orgId,
  orgSlug,
  applicationId,
  canEdit,
}: {
  orgId: string;
  orgSlug: string;
  applicationId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [heading, setHeading] = useState("");
  const sections = useQuery({
    queryKey: ["sections", orgId, applicationId],
    queryFn: () => api<Section[]>(`/orgs/${orgId}/applications/${applicationId}/sections`),
  });
  const parses = useQuery({
    queryKey: ["parses", orgId, applicationId],
    queryFn: () =>
      api<
        Array<{ id: string; status: string; extraction: { scoringCriteria: Criterion[] } | null }>
      >(`/orgs/${orgId}/applications/${applicationId}/rfp-parses`),
  });

  async function add(event: FormEvent) {
    event.preventDefault();
    await api(`/orgs/${orgId}/applications/${applicationId}/sections`, {
      method: "POST",
      json: { heading, prompt: "" },
    });
    setHeading("");
    await queryClient.invalidateQueries({ queryKey: ["sections", orgId, applicationId] });
  }

  const latest = parses.data?.find((row) => row.extraction);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Narrative sections</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Drafts stay as suggestions until you insert, replace, or append them.
      </p>
      {latest ? (
        <p className="mt-2 text-sm">
          <Link className="text-accent underline" to={`/o/${orgSlug}/rfp/${latest.id}`}>
            Review the RFP reading
          </Link>
        </p>
      ) : null}
      {(sections.data ?? []).map((section) => (
        <SectionCard
          key={section.id}
          orgId={orgId}
          applicationId={applicationId}
          section={section}
          criteria={latest?.extraction?.scoringCriteria ?? []}
          canEdit={canEdit}
        />
      ))}
      <SupportLetterForm orgId={orgId} applicationId={applicationId} canEdit={canEdit} />
      {canEdit ? (
        <form className="mt-4" onSubmit={(event) => void add(event)}>
          <Field label="New section heading">
            <input
              className={controlClass}
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              required
            />
          </Field>
          <Button type="submit">Add section</Button>
        </form>
      ) : null}
    </section>
  );
}

function SupportLetterForm({
  orgId,
  applicationId,
  canEdit,
}: {
  orgId: string;
  applicationId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const letters = useQuery({
    queryKey: ["letters", orgId, applicationId],
    queryFn: () =>
      api<Array<{ id: string; partnerName: string; status: string }>>(
        `/orgs/${orgId}/applications/${applicationId}/support-letters`,
      ),
  });
  if (!canEdit && (letters.data ?? []).length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">Letters of support</h2>
      <ul className="mt-2 text-sm">
        {(letters.data ?? []).map((letter) => (
          <li key={letter.id}>
            {letter.partnerName} · {letter.status}
          </li>
        ))}
      </ul>
      {link ? <p className="mt-2 text-sm">Partner link: {link}</p> : null}
      {canEdit ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api<{ token: string }>(
              `/orgs/${orgId}/applications/${applicationId}/support-letters`,
              {
                method: "POST",
                json: { partnerName, partnerEmail, draftBody, dueAt: null },
              },
            ).then((result) => {
              setLink(`${window.location.origin}/support/${result.token}`);
              setPartnerName("");
              setPartnerEmail("");
              setDraftBody("");
              return queryClient.invalidateQueries({ queryKey: ["letters", orgId, applicationId] });
            });
          }}
        >
          <Field label="Partner name">
            <input
              className={controlClass}
              value={partnerName}
              onChange={(event) => setPartnerName(event.target.value)}
              required
            />
          </Field>
          <Field label="Partner email">
            <input
              className={controlClass}
              type="email"
              value={partnerEmail}
              onChange={(event) => setPartnerEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Draft they can edit">
            <textarea
              className={`${controlClass} min-h-24`}
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              required
            />
          </Field>
          <Button type="submit">Send request</Button>
        </form>
      ) : null}
    </div>
  );
}

function SectionCard({
  orgId,
  applicationId,
  section,
  criteria,
  canEdit,
}: {
  orgId: string;
  applicationId: string;
  section: Section;
  criteria: Criterion[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState(section.body);
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState("plain");
  const [targetWords, setTargetWords] = useState(String(section.wordLimit ?? 300));
  const [blockIds, setBlockIds] = useState<string[]>([]);
  const [pointIds, setPointIds] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [counts, setCounts] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState(false);
  const blocks = useQuery({
    queryKey: ["content", orgId],
    enabled: open,
    queryFn: () => api<{ items: Block[] }>(`/orgs/${orgId}/content`),
  });
  const points = useQuery({
    queryKey: ["data-points", orgId],
    enabled: open,
    queryFn: () => api<Point[]>(`/orgs/${orgId}/data-points`),
  });

  async function save(next: string) {
    await api(`/orgs/${orgId}/applications/${applicationId}/sections/${section.id}`, {
      method: "PATCH",
      json: { body: next },
    });
    await queryClient.invalidateQueries({ queryKey: ["sections", orgId, applicationId] });
  }

  async function draft() {
    setBusy(true);
    setSuggestion("");
    setNeeds([]);
    setCounts(null);
    try {
      await streamApi(
        `/orgs/${orgId}/applications/${applicationId}/sections/${section.id}/draft`,
        {
          contentBlockIds: blockIds,
          dataPointIds: pointIds,
          tone,
          targetWords: Number(targetWords) || section.wordLimit || 300,
        },
        (event) => {
          if (typeof event.text === "string") {
            setSuggestion((current) => current + event.text);
          }
          if (event.done === true && typeof event.body === "string") {
            setSuggestion(event.body);
            setNeeds(
              Array.isArray(event.needs)
                ? event.needs.filter((item) => typeof item === "string")
                : [],
            );
            setCounts(
              `${String(event.wordCount ?? countWords(event.body))} words · ${String(event.charCount ?? event.body.length)} characters${section.wordLimit ? ` · limit ${section.wordLimit} words` : ""}`,
            );
          }
          if (typeof event.error === "string") toast(event.error);
        },
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "The draft did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function runReview() {
    if (criteria.length === 0) {
      toast("Read an RFP with scoring criteria, or add a section prompt the funder will score.");
      return;
    }
    const result = await api<{ status: string; review?: { items: ReviewItem[] } }>(
      `/orgs/${orgId}/applications/${applicationId}/sections/${section.id}/review`,
      { method: "POST", json: { criteria } },
    );
    setReview(result.review?.items ?? []);
  }

  function insertAtCursor(next: string) {
    const field = document.getElementById(`body-${section.id}`);
    if (!(field instanceof HTMLTextAreaElement)) return next;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    return `${body.slice(0, start)}${next}${body.slice(end)}`;
  }

  return (
    <article className="mt-4 rounded-xl border border-line bg-white p-4">
      <h3 className="font-semibold">{section.heading}</h3>
      <p className="text-sm text-ink-soft">
        {section.wordCount} words
        {section.wordLimit ? ` of ${section.wordLimit}` : ""}
        {section.needs.length > 0 ? ` · ${section.needs.length} facts still needed` : ""}
      </p>
      <textarea
        id={`body-${section.id}`}
        className={`${controlClass} mt-2 min-h-32`}
        value={body}
        disabled={!canEdit}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => {
          if (body !== section.body) void save(body);
        }}
      />
      {needsMarkers(body).length > 0 ? (
        <ul className="mt-2 text-sm">
          {needsMarkers(body).map((item) => (
            <li key={item}>Needs: {item}</li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div className="mt-3">
          <Button tone="quiet" onClick={() => setOpen((value) => !value)}>
            Draft with AI
          </Button>
          <Button tone="quiet" onClick={() => void runReview()}>
            Review against criteria
          </Button>
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">Choose facts the draft is allowed to use.</p>
          {(blocks.data?.items ?? []).map((block) => (
            <label key={block.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blockIds.includes(block.id)}
                onChange={(event) =>
                  setBlockIds((current) =>
                    event.target.checked
                      ? [...current, block.id]
                      : current.filter((id) => id !== block.id),
                  )
                }
              />
              {block.title}
            </label>
          ))}
          {(points.data ?? []).map((point) => (
            <label key={point.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pointIds.includes(point.id)}
                onChange={(event) =>
                  setPointIds((current) =>
                    event.target.checked
                      ? [...current, point.id]
                      : current.filter((id) => id !== point.id),
                  )
                }
              />
              {point.metric} · {point.value} {point.unit} · {point.community} {point.year}
            </label>
          ))}
          <label className="block text-sm">
            Tone
            <select
              className={controlClass}
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            >
              <option value="plain">Plain</option>
              <option value="formal">Formal</option>
              <option value="warm">Warm</option>
            </select>
          </label>
          <label className="block text-sm">
            Target length in words
            <input
              className={controlClass}
              value={targetWords}
              onChange={(event) => setTargetWords(event.target.value)}
            />
          </label>
          <Button onClick={() => void draft()} disabled={busy}>
            {busy ? "Writing…" : "Write a suggestion"}
          </Button>
          {suggestion ? (
            <div className="rounded-lg border border-line p-3">
              <p className="whitespace-pre-wrap text-sm">{suggestion}</p>
              {counts ? <p className="mt-2 text-sm text-ink-soft">{counts}</p> : null}
              {needs.length > 0 ? (
                <ul className="mt-2 text-sm">
                  {needs.map((item) => (
                    <li key={item}>Needs: {item}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    const next = insertAtCursor(suggestion);
                    setBody(next);
                    void save(next);
                  }}
                >
                  Insert
                </Button>
                <Button
                  tone="quiet"
                  onClick={() => {
                    setBody(suggestion);
                    void save(suggestion);
                  }}
                >
                  Replace
                </Button>
                <Button
                  tone="quiet"
                  onClick={() => {
                    const next = `${body.trim()}\n\n${suggestion}`.trim();
                    setBody(next);
                    void save(next);
                  }}
                >
                  Append
                </Button>
                <Button tone="quiet" onClick={() => setSuggestion("")}>
                  Discard
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {review.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {review.map((item) => (
            <li key={item.criterion}>
              <span className="font-medium">
                {item.coverage === "STRONG"
                  ? "Strong"
                  : item.coverage === "PARTIAL"
                    ? "Partial"
                    : "Missing"}
                .
              </span>{" "}
              {item.criterion} — {item.suggestion}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
