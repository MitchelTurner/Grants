import {
  FOCUS_AREAS,
  ORG_TYPES,
  SE_COMMUNITIES,
  memberRoleLabel,
  orgTypeLabel,
  type MemberRole,
  type OrgType,
} from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, useOrg } from "../auth";
import { canAdmin, canEdit, isOwner } from "../components/shell";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";

type Profile = {
  id: string;
  name: string;
  type: OrgType;
  community: string;
  mission: string | null;
  website: string | null;
  ein: string | null;
  uei: string | null;
  annualBudget: string | null;
  focusAreas: string[];
  receivesFederalFunds: boolean;
  fiscalSponsorName: string | null;
  fiscalYearStartMonth: number;
  timezone: string;
  completeness: { percent: number; missing: { label: string; reason: string }[] };
  suggestedTemplates?: {
    id: string;
    kind: string;
    title: string;
    explanation: string;
    rrule: string | null;
    suggestedDueAt: string | null;
  }[];
};

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  remindersMuted: boolean;
};
type Invite = { id: string; email: string; role: string };

export function SettingsPage() {
  const org = useOrg();
  const { me, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("EDITOR");
  const profile = useQuery({
    queryKey: ["org", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Profile>(`/orgs/${org?.id}`),
  });
  const members = useQuery({
    queryKey: ["members", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<Member[]>(`/orgs/${org?.id}/members`),
  });
  const invites = useQuery({
    queryKey: ["invites", org?.id],
    enabled: Boolean(org && canAdmin(org.role)),
    queryFn: () => api<Invite[]>(`/orgs/${org?.id}/invitations`),
  });
  const [form, setForm] = useState<Profile | null>(null);
  useEffect(() => {
    if (profile.data) setForm(profile.data);
  }, [profile.data]);
  if (!org || !form) return <Page title="Settings">Loading…</Page>;
  const organization = org;
  const profileForm = form;
  const locked = !canEdit(organization.role);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const updated = await api<Profile>(`/orgs/${organization.id}`, {
      method: "PATCH",
      json: {
        name: profileForm.name,
        type: profileForm.type,
        community: profileForm.community,
        mission: profileForm.mission,
        website: profileForm.website || null,
        ein: profileForm.ein || null,
        uei: profileForm.uei || null,
        annualBudget: profileForm.annualBudget || null,
        focusAreas: profileForm.focusAreas,
        receivesFederalFunds: profileForm.receivesFederalFunds,
        fiscalSponsorName: profileForm.fiscalSponsorName,
        fiscalYearStartMonth: profileForm.fiscalYearStartMonth,
        timezone: profileForm.timezone,
      },
    });
    setForm(updated);
    await refresh();
    if ((updated.suggestedTemplates?.length ?? 0) > 0) {
      setError(
        "Profile saved. Review the suggested compliance dates below and add the ones that apply.",
      );
    }
  }

  return (
    <Page title="Settings" lede={`${form.completeness.percent}% of the profile is filled in.`}>
      {error ? <Notice>{error}</Notice> : null}
      <ul className="mb-4 text-sm text-ink-soft">
        {form.completeness.missing.map((item) => (
          <li key={item.label}>
            {item.label}: {item.reason}
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void save(event)}>
        <Field label="Name">
          <input
            className={controlClass}
            value={form.name}
            disabled={locked}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Type">
          <select
            className={controlClass}
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as OrgType })}
          >
            {ORG_TYPES.map((item) => (
              <option key={item} value={item}>
                {orgTypeLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Community">
          <select
            className={controlClass}
            value={form.community}
            onChange={(event) => setForm({ ...form, community: event.target.value })}
          >
            {SE_COMMUNITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Mission" hint="A few sentences in plain language.">
          <textarea
            className={controlClass}
            value={form.mission ?? ""}
            onChange={(event) => setForm({ ...form, mission: event.target.value })}
          />
        </Field>
        <Field label="Website">
          <input
            className={controlClass}
            value={form.website ?? ""}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
        </Field>
        <Field label="EIN" hint="The federal employer identification number, if you have one.">
          <input
            className={controlClass}
            value={form.ein ?? ""}
            onChange={(event) => setForm({ ...form, ein: event.target.value })}
          />
        </Field>
        <Field
          label="UEI"
          hint="Your 12-character federal ID from SAM.gov. You only need this for federal grants."
        >
          <input
            className={controlClass}
            maxLength={12}
            value={form.uei ?? ""}
            onChange={(event) => setForm({ ...form, uei: event.target.value })}
          />
        </Field>
        <Field label="Annual budget" hint="Whole dollars, such as 250000.00">
          <input
            className={controlClass}
            value={form.annualBudget ?? ""}
            onChange={(event) => setForm({ ...form, annualBudget: event.target.value })}
          />
        </Field>
        <Field label="Federal funds?">
          <select
            className={controlClass}
            value={form.receivesFederalFunds ? "yes" : "no"}
            onChange={(event) =>
              setForm({ ...form, receivesFederalFunds: event.target.value === "yes" })
            }
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <fieldset className="mb-4">
          <legend className="text-sm font-medium">Focus areas</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FOCUS_AREAS.map((area) => (
              <label key={area} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.focusAreas.includes(area)}
                  onChange={(event) => {
                    const focusAreas = event.target.checked
                      ? [...form.focusAreas, area]
                      : form.focusAreas.filter((item) => item !== area);
                    setForm({ ...form, focusAreas });
                  }}
                />
                {area}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={locked}>
          Save profile
        </Button>
      </form>
      {(form.suggestedTemplates ?? []).map((template) => (
        <div key={template.id} className="mt-3 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-medium">{template.title}</p>
          <p>{template.explanation}</p>
          <Button
            onClick={() => {
              const dueAt = template.suggestedDueAt ?? window.prompt("Due date (YYYY-MM-DD)") ?? "";
              if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return;
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
              });
            }}
          >
            Add this date
          </Button>
        </div>
      ))}
      <h2 className="mt-8 text-lg font-semibold">People</h2>
      <ul className="mt-2 space-y-2">
        {(members.data ?? []).map((member) => (
          <li key={member.id} className="rounded-lg border border-line bg-white p-3 text-sm">
            <p>
              {member.name ?? member.email} · {memberRoleLabel(member.role as MemberRole)}
            </p>
            {member.email === me?.email ? (
              <label className="mt-2 flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={member.remindersMuted}
                  onChange={(event) => {
                    void api(`/orgs/${org.id}/members/${member.id}`, {
                      method: "PATCH",
                      json: { remindersMuted: event.target.checked },
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["members", org.id] }));
                  }}
                />
                Mute reminders for this organization
              </label>
            ) : null}
            {canAdmin(org.role) && member.email !== me?.email ? (
              <select
                className={`${controlClass} mt-2`}
                value={member.role}
                onChange={(event) => {
                  void api(`/orgs/${org.id}/members/${member.id}`, {
                    method: "PATCH",
                    json: { role: event.target.value },
                  }).then(() => queryClient.invalidateQueries({ queryKey: ["members", org.id] }));
                }}
              >
                {(["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"] as const).map((role) => (
                  <option key={role} value={role}>
                    {memberRoleLabel(role)}
                  </option>
                ))}
              </select>
            ) : null}
          </li>
        ))}
      </ul>
      {canAdmin(org.role) ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api(`/orgs/${org.id}/invitations`, {
              method: "POST",
              json: { email: inviteEmail, role: inviteRole },
            }).then(() => {
              setInviteEmail("");
              return queryClient.invalidateQueries({ queryKey: ["invites", org.id] });
            });
          }}
        >
          <Field label="Invite by email">
            <input
              className={controlClass}
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </Field>
          <Field label="Role">
            <select
              className={controlClass}
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as MemberRole)}
            >
              {(["ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"] as const).map((role) => (
                <option key={role} value={role}>
                  {memberRoleLabel(role)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">Send invite</Button>
        </form>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {(invites.data ?? []).map((invite) => (
          <li key={invite.id} className="flex items-center justify-between">
            <span>
              {invite.email} · {memberRoleLabel(invite.role as MemberRole)} · expires in 14 days
            </span>
            <Button
              tone="quiet"
              onClick={() =>
                void api(`/orgs/${org.id}/invitations/${invite.id}/resend`, { method: "POST" })
              }
            >
              Resend
            </Button>
            <Button
              tone="quiet"
              onClick={() =>
                void api(`/orgs/${org.id}/invitations/${invite.id}`, { method: "DELETE" }).then(
                  () => queryClient.invalidateQueries({ queryKey: ["invites", org.id] }),
                )
              }
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {isOwner(org.role) ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Export</h2>
          <p className="mt-1 text-sm text-ink-soft">
            We email a zip of the organization data and files. The link lasts 7 days.
          </p>
          <Button
            onClick={() =>
              void api(`/orgs/${org.id}/export`, { method: "POST" }).then(() =>
                setError("Export started. Watch your email."),
              )
            }
          >
            Request export
          </Button>
          <h2 className="mt-6 text-lg font-semibold">Delete this organization</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Type the organization name. It disappears immediately and is permanently removed after
            30 days.
          </p>
          <Field label="Organization name">
            <input
              className={controlClass}
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </Field>
          <Button
            tone="danger"
            onClick={() => {
              void api(`/orgs/${org.id}`, { method: "DELETE", json: { confirmName } }).then(() => {
                void refresh().then(() => {
                  window.location.assign("/app/");
                });
              });
            }}
          >
            Delete organization
          </Button>
        </section>
      ) : null}
    </Page>
  );
}
