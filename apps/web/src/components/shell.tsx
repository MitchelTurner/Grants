import { roleAtLeast, type MemberRole } from "@se-grants/shared";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, useNavigate } from "react-router";
import { RequireAuth, useAuth, useOrg } from "../auth";
import { api } from "../lib/api";
import { onToast } from "../lib/toast";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center px-3 text-sm ${isActive ? "font-semibold text-accent" : "text-ink-soft"}`;

export function OrgShell({ children }: { children: ReactNode }) {
  const org = useOrg();
  const { me, orgs, refresh } = useAuth();
  const navigate = useNavigate();
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => onToast((text) => setMessage(text)), []);

  if (!org) {
    return (
      <p className="p-4">
        That organization is not in your workspace. <NavLink to="/">Go home</NavLink>
      </p>
    );
  }

  const base = `/o/${org.slug}`;
  const curator = me?.platformRole === "CURATOR" || me?.platformRole === "SUPERADMIN";

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-accent">Southeast Grants</p>
          <label className="text-sm">
            <span className="sr-only">Organization</span>
            <select
              className="min-h-11 rounded-lg border border-line bg-white px-3"
              value={org.id}
              onChange={(event) => {
                const next = orgs.find((item) => item.id === event.target.value);
                if (!next) return;
                void api("/me", { method: "PATCH", json: { lastActiveOrgId: next.id } }).then(() =>
                  refresh(),
                );
                void navigate(`/o/${next.slug}`);
              }}
            >
              {orgs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <nav className="hidden flex-1 flex-wrap gap-1 md:flex" aria-label="Organization">
            <NavLink to={base} end className={linkClass}>
              Home
            </NavLink>
            <NavLink to={`${base}/opportunities`} className={linkClass}>
              Opportunities
            </NavLink>
            <NavLink to={`${base}/applications`} className={linkClass}>
              Applications
            </NavLink>
            <NavLink to={`${base}/awards`} className={linkClass}>
              Awards
            </NavLink>
            <NavLink to={`${base}/calendar`} className={linkClass}>
              Calendar
            </NavLink>
            <NavLink to={`${base}/documents`} className={linkClass}>
              Documents
            </NavLink>
            <NavLink to={`${base}/content`} className={linkClass}>
              Writing
            </NavLink>
            <NavLink to={`${base}/compliance`} className={linkClass}>
              Compliance
            </NavLink>
            <NavLink to={`${base}/settings`} className={linkClass}>
              Settings
            </NavLink>
          </nav>
          <NavLink to="/me" className={linkClass}>
            Account
          </NavLink>
          {curator ? (
            <NavLink to="/admin" className={linkClass}>
              Curator
            </NavLink>
          ) : null}
        </div>
      </header>
      {offline ? (
        <p role="status" className="bg-ink px-4 py-2 text-center text-sm text-white">
          You are offline. Changes stay on this device until the connection returns.
        </p>
      ) : null}
      {message ? (
        <p role="status" className="border-b border-line bg-white px-4 py-2 text-sm">
          {message}
          <button type="button" className="ml-3 underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      <main id="main">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper md:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-4">
          <li>
            <NavLink to={base} end className={tabClass}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to={`${base}/calendar`} className={tabClass}>
              Calendar
            </NavLink>
          </li>
          <li>
            <NavLink to={`${base}/applications`} className={tabClass}>
              Applications
            </NavLink>
          </li>
          <li>
            <NavLink to={`${base}/more`} className={tabClass}>
              More
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function tabClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-14 items-center justify-center text-sm ${isActive ? "font-semibold text-accent" : "text-ink"}`;
}

export function OrgLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <OrgShell>{children}</OrgShell>
    </RequireAuth>
  );
}

export function canEdit(role: string): boolean {
  return roleAtLeast(role as MemberRole, "EDITOR");
}

export function canContribute(role: string): boolean {
  return roleAtLeast(role as MemberRole, "CONTRIBUTOR");
}

export function canAdmin(role: string): boolean {
  return roleAtLeast(role as MemberRole, "ADMIN");
}

export function isOwner(role: string): boolean {
  return role === "OWNER";
}

export function MissingOrg() {
  return <Navigate to="/" replace />;
}
