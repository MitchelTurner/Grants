import {
  FOCUS_AREAS,
  ORG_TYPES,
  SE_COMMUNITIES,
  orgTypeLabel,
  type OrgType,
} from "@se-grants/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { ApiError, api } from "../lib/api";

type Template = {
  id: string;
  kind: string;
  title: string;
  explanation: string;
  officialUrl: string;
  rrule: string | null;
  suggestedDueAt: string | null;
};

type Created = { id: string; slug: string; suggestedTemplates: Template[] };

export function OnboardingPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType>("NONPROFIT_501C3");
  const [community, setCommunity] = useState<string>(SE_COMMUNITIES[12] ?? "Juneau");
  const [focus, setFocus] = useState<string[]>(["Education & Youth"]);
  const [federal, setFederal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const org = await api<Created>("/orgs", {
        method: "POST",
        json: { name, type, community, focusAreas: focus, receivesFederalFunds: federal },
      });
      const initial: Record<string, boolean> = {};
      const initialDates: Record<string, string> = {};
      for (const template of org.suggestedTemplates) {
        initial[template.id] = true;
        if (template.suggestedDueAt) initialDates[template.id] = template.suggestedDueAt;
      }
      setPicked(initial);
      setDates(initialDates);
      setCreated(org);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create the organization.");
    }
  }

  async function confirmTemplates() {
    if (!created) return;
    for (const template of created.suggestedTemplates) {
      if (!picked[template.id]) continue;
      const dueAt = dates[template.id];
      if (!dueAt) {
        setError(`Enter a date for ${template.title}.`);
        return;
      }
      await api(`/orgs/${created.id}/compliance`, {
        method: "POST",
        json: {
          kind: template.kind,
          title: template.title,
          description: template.explanation,
          dueAt,
          rrule: template.rrule,
          templateId: template.id,
        },
      });
    }
    void navigate(`/o/${created.slug}`);
  }

  if (created) {
    return (
      <Page
        title="Add the dates that protect future funding"
        lede="These are suggestions. Uncheck any that do not apply. Enter the date from your own filings when we cannot compute it."
      >
        {created.suggestedTemplates.map((template) => (
          <label
            key={template.id}
            className="mb-4 block rounded-xl border border-line bg-white p-4"
          >
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={picked[template.id] ?? false}
                onChange={(event) => setPicked({ ...picked, [template.id]: event.target.checked })}
              />
              <span>
                <span className="font-medium">{template.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{template.explanation}</span>
                <a
                  className="mt-1 inline-block text-sm text-accent underline"
                  href={template.officialUrl}
                >
                  Official page
                </a>
              </span>
            </span>
            {picked[template.id] ? (
              <span className="mt-3 block text-sm">
                Due date
                <input
                  className={`${controlClass} mt-1`}
                  type="date"
                  value={dates[template.id] ?? ""}
                  onChange={(event) => setDates({ ...dates, [template.id]: event.target.value })}
                />
              </span>
            ) : null}
          </label>
        ))}
        {error ? <Notice>{error}</Notice> : null}
        <Button onClick={() => void confirmTemplates()}>Continue to the dashboard</Button>
      </Page>
    );
  }

  return (
    <Page
      title="Create your organization"
      lede="This takes a minute. You can add the EIN and budget later."
    >
      {error ? <Notice>{error}</Notice> : null}
      <form onSubmit={(event) => void create(event)}>
        <Field label="Organization name">
          <input
            className={controlClass}
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="What kind of organization is this?">
          <select
            className={controlClass}
            value={type}
            onChange={(event) => setType(event.target.value as OrgType)}
          >
            {ORG_TYPES.map((item) => (
              <option key={item} value={item}>
                {orgTypeLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Home community">
          <select
            className={controlClass}
            value={community}
            onChange={(event) => setCommunity(event.target.value)}
          >
            {SE_COMMUNITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="mb-4">
          <legend className="text-sm font-medium">Focus areas</legend>
          <p className="mb-2 text-sm text-ink-soft">
            Pick at least one. These drive the fit labels.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FOCUS_AREAS.map((area) => (
              <label key={area} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={focus.includes(area)}
                  onChange={(event) => {
                    setFocus(
                      event.target.checked
                        ? [...focus, area]
                        : focus.filter((item) => item !== area),
                    );
                  }}
                />
                {area}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-4">
          <legend className="text-sm font-medium">Do you receive federal funds?</legend>
          <label className="mr-4 inline-flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="federal"
              checked={!federal}
              onChange={() => setFederal(false)}
            />{" "}
            No
          </label>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="federal"
              checked={federal}
              onChange={() => setFederal(true)}
            />{" "}
            Yes
          </label>
        </fieldset>
        <Button type="submit" disabled={focus.length === 0}>
          Create organization
        </Button>
      </form>
    </Page>
  );
}
