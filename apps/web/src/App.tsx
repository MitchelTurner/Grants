import { HealthResponse } from "@se-grants/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { checkLabel, healthSummary } from "./lib/health-copy";

async function loadHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/v1/health");
  if (!response.ok && response.status !== 503) {
    throw new Error("health request failed");
  }
  return HealthResponse.parse(await response.json());
}

export function App() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: loadHealth,
  });

  useEffect(() => {
    const markOnline = () => setOffline(false);
    const markOffline = () => setOffline(true);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  const status = offline
    ? "unreachable"
    : health.data
      ? health.data.status
      : health.isError
        ? "unreachable"
        : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-8">
      {offline ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink"
        >
          You are offline. This page will try again when the connection returns.
        </p>
      ) : null}
      <header className="mb-8">
        <p className="text-sm font-medium text-accent">Southeast Alaska</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Southeast Grants</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          A workspace for finding grant money and keeping deadlines with the organization, not in
          someone&apos;s inbox.
        </p>
      </header>
      <section
        className="rounded-xl border border-line bg-white p-5"
        aria-labelledby="status-heading"
      >
        <h2 id="status-heading" className="text-lg font-semibold">
          Service status
        </h2>
        <p className="mt-2 text-base text-ink" role="status">
          {status === null ? "Checking the workspace…" : healthSummary(status)}
        </p>
        {health.data ? (
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>{checkLabel("database", health.data.checks.database)}</li>
            <li>{checkLabel("redis", health.data.checks.redis)}</li>
          </ul>
        ) : null}
        <button
          type="button"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink"
          onClick={() => {
            void health.refetch();
          }}
        >
          Check again
        </button>
      </section>
      <p className="mt-8 text-sm leading-relaxed text-ink-soft">
        Sign-in and organizations are next. Nothing here asks for a password.
      </p>
    </div>
  );
}
