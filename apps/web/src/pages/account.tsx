import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { RequireAuth } from "../auth";
import { Button, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";

type Prefs = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  weeklyDigest: boolean;
  digestWeekday: number;
  digestHour: number;
  reminderOffsets: number[];
  quietStartHour: number;
  quietEndHour: number;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AccountPage() {
  return (
    <RequireAuth>
      <AccountForm />
    </RequireAuth>
  );
}

function AccountForm() {
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [code, setCode] = useState("");
  const [feed, setFeed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const prefs = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Prefs>("/me/notifications"),
  });
  const [form, setForm] = useState<Prefs | null>(null);
  useEffect(() => {
    if (prefs.data) setForm(prefs.data);
  }, [prefs.data]);

  return (
    <Page title="Your account" lede={me?.email ?? ""}>
      {note ? <Notice>{note}</Notice> : null}
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void api("/me", { method: "PATCH", json: { name } }).then(() => refresh());
        }}
      >
        <Field label="Name">
          <input
            className={controlClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Button type="submit">Save name</Button>
      </form>
      <h2 className="mt-8 text-lg font-semibold">Phone</h2>
      <p className="text-sm text-ink-soft">
        We text a code before any reminder texts. Use a number like +19075550123.
      </p>
      <Field label="Phone">
        <input
          className={controlClass}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <Button
        onClick={() =>
          void api("/me/phone", { method: "POST", json: { phone } }).then(() =>
            setNote("Code sent."),
          )
        }
      >
        Send code
      </Button>
      <Field label="Code">
        <input
          className={controlClass}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </Field>
      <Button
        onClick={() =>
          void api("/me/phone/verify", { method: "POST", json: { code } }).then(() => refresh())
        }
      >
        Verify phone
      </Button>
      <p className="mt-2 text-sm">
        {me?.phoneVerified ? "Phone verified." : "Phone is not verified yet."}
      </p>
      {form ? (
        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            void api("/me/notifications", { method: "PATCH", json: form }).then(() =>
              setNote("Notification settings saved."),
            );
          }}
        >
          <h2 className="text-lg font-semibold">Notifications</h2>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.emailEnabled}
              onChange={(event) => setForm({ ...form, emailEnabled: event.target.checked })}
            />{" "}
            Email reminders
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.smsEnabled}
              onChange={(event) => setForm({ ...form, smsEnabled: event.target.checked })}
            />{" "}
            Text reminders for the last two days
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.weeklyDigest}
              onChange={(event) => setForm({ ...form, weeklyDigest: event.target.checked })}
            />{" "}
            Weekly digest
          </label>
          <Field label="Digest day">
            <select
              className={controlClass}
              value={form.digestWeekday}
              onChange={(event) => setForm({ ...form, digestWeekday: Number(event.target.value) })}
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Digest hour (your time)">
            <input
              className={controlClass}
              type="number"
              min={0}
              max={23}
              value={form.digestHour}
              onChange={(event) => setForm({ ...form, digestHour: Number(event.target.value) })}
            />
          </Field>
          <Field label="Quiet hours start">
            <input
              className={controlClass}
              type="number"
              min={0}
              max={23}
              value={form.quietStartHour}
              onChange={(event) => setForm({ ...form, quietStartHour: Number(event.target.value) })}
            />
          </Field>
          <Field label="Quiet hours end">
            <input
              className={controlClass}
              type="number"
              min={0}
              max={23}
              value={form.quietEndHour}
              onChange={(event) => setForm({ ...form, quietEndHour: Number(event.target.value) })}
            />
          </Field>
          <Button type="submit">Save notifications</Button>
        </form>
      ) : null}
      <h2 className="mt-8 text-lg font-semibold">Calendar feed</h2>
      <p className="text-sm text-ink-soft">
        Subscribe in your calendar app. Rotating the link turns off the old one. We only show the
        address once.
      </p>
      <Button
        onClick={() => {
          void api<{ url: string }>("/me/calendar-token/rotate", { method: "POST" }).then(
            (result) => setFeed(result.url),
          );
        }}
      >
        {me?.hasCalendarFeed ? "Rotate calendar link" : "Create calendar link"}
      </Button>
      {feed ? <p className="mt-2 break-all text-sm">{feed}</p> : null}
      <div className="mt-8 flex gap-3">
        <Button
          tone="quiet"
          onClick={() =>
            void api("/auth/logout", { method: "POST" }).then(() => navigate("/sign-in"))
          }
        >
          Sign out
        </Button>
        <Button
          tone="quiet"
          onClick={() =>
            void api("/auth/logout-all", { method: "POST" }).then(() => navigate("/sign-in"))
          }
        >
          Sign out everywhere
        </Button>
      </div>
    </Page>
  );
}
