import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { Button, Field, Notice, controlClass } from "../components/ui";
import { ApiError, api } from "../lib/api";

export function SignInPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(
    params.get("error") === "expired" ? "That sign-in link expired. Request a new code." : null,
  );
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/auth/login-request", { method: "POST", json: { email } });
      setStep("code");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not send the code.");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/auth/verify", { method: "POST", json: { email, code } });
      await refresh();
      void navigate("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That code did not work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
      <p className="text-sm font-medium text-accent">Southeast Alaska</p>
      <h1 className="mt-1 text-3xl font-semibold">Sign in</h1>
      <p className="mt-3 text-ink-soft">
        We email a 6-digit code and a link. There is no password. The code works once and expires in
        15 minutes.
      </p>
      {error ? (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      ) : null}
      {step === "email" ? (
        <form className="mt-6" onSubmit={(event) => void requestCode(event)}>
          <Field label="Email">
            <input
              className={controlClass}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      ) : (
        <form className="mt-6" onSubmit={(event) => void verify(event)}>
          <Field label="6-digit code" hint={`Sent to ${email}`}>
            <input
              className={controlClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}
