// Small presentational building blocks. Styling only, no logic.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-card">
      {title ? <h2 className="mb-stack text-lg font-semibold">{title}</h2> : null}
      <div className="flex flex-col gap-stack">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-accent text-on-accent"
      : "border border-border bg-surface-raised text-text";
  return (
    <button
      {...props}
      className={`rounded-control px-4 py-2 text-sm font-medium disabled:opacity-50 ${look} ${className}`}
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

export const fieldClass =
  "rounded-control border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none focus:border-accent";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-control bg-surface-raised p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
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
      className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
