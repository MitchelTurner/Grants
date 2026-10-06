import type { ReactNode } from "react";

export function Page({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lede ? (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">{lede}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-white p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Button({
  children,
  type = "button",
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "quiet" | "danger";
}) {
  const tones = {
    primary: "bg-accent text-accent-ink",
    quiet: "border border-line bg-white text-ink",
    danger: "bg-ink text-white",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block text-sm font-medium">
      {label}
      {hint ? <span className="mt-1 block font-normal text-ink-soft">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export const controlClass =
  "min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink";

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </Card>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm">
      {children}
    </p>
  );
}
