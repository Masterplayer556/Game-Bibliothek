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
