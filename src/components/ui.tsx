// Small presentational building blocks. Styling only, no logic.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-card shadow-card">
      {title ? <h2 className="rule-dashed mb-stack pb-2 font-display text-xl font-semibold leading-snug">{title}</h2> : null}
      <div className="flex flex-col gap-stack">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  const look =
    variant === "primary"
      ? "key-accent bg-accent text-on-accent"
      : "key border border-border-strong bg-surface text-text";
  return (
    <button
      {...props}
      className={`rounded-control px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  );
}

export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const color = {
    muted: "text-muted",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return <p className={`text-sm ${color}`}>{children}</p>;
}

// 16px on phones: iOS zooms into smaller fields.
export const fieldClass =
  "rounded-control border border-border-strong bg-field px-3 py-2 text-base text-text outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-60 sm:text-sm";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-control border border-border bg-surface p-3 shadow-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num text-[1.75rem] leading-tight">{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="xp h-2.5 w-full overflow-hidden rounded-[3px] bg-surface-raised shadow-[inset_0_0_0_1px_var(--color-border)]"
    >
      {/* A finished bar turns to brass. */}
      <div className={`h-full ${percent === 100 ? "bg-highlight-fill" : "bg-accent"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** A row of buttons of which exactly one is selected (tabs for a view, not for pages). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-control border border-border bg-surface-raised p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-[5px] px-2 py-1.5 ${value === o.id ? "bg-accent font-medium text-on-accent" : "text-muted hover:text-text"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
