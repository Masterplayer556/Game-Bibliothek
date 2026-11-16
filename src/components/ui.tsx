// Small presentational building blocks. Styling only, no logic.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

/** An index card. `icon` sits in a tile in the colour of the section; `variant="note"` is a pinned note. */
export function Card({
  title,
  icon,
  variant = "card",
  children,
}: {
  title?: string;
  icon?: PixelIconName;
  variant?: "card" | "note";
  children: ReactNode;
}) {
  return (
    <section className={`rounded-card p-card sm:p-5 ${variant === "note" ? "note border shadow-card" : "sheet"}`}>
      {title ? (
        <h2 className="rule-dashed mb-stack flex items-center gap-3 pb-3 font-display text-xl font-semibold leading-snug">
          {icon ? (
            <span className="icon-tile h-8 w-8 rounded-[10px]">
              <PixelIcon name={icon} />
            </span>
          ) : null}
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-stack">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  const look =
    variant === "primary"
      ? "key-accent bg-accent text-on-accent shadow-[0_8px_18px_-10px_var(--color-accent)]"
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

export function StatTile({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: PixelIconName }) {
  return (
    <div className="sheet glow-tile flex h-full flex-col gap-1.5 rounded-card p-3.5">
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="icon-tile h-6 w-6 rounded-[7px]">
            <PixelIcon name={icon} className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider text-muted">{label}</span>
      </div>
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

/** Progress as a ring with the percentage in the middle. */
export function ProgressRing({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  const radius = 26;
  const length = 2 * Math.PI * radius;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="relative h-16 w-16 shrink-0"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-surface-raised)" strokeWidth="8" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={share === 1 ? "var(--color-highlight-fill)" : "var(--section, var(--color-accent))"}
          strokeWidth="8"
          strokeDasharray={`${share * length} ${length}`}
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-lg leading-none">{Math.round(share * 100)}%</span>
    </div>
  );
}

const MEDAL: Record<string, { label: string; color: string }> = {
  bronze: { label: "Bronze", color: "var(--color-medal-bronze)" },
  silver: { label: "Silber", color: "var(--color-medal-silver)" },
  gold: { label: "Gold", color: "var(--color-medal-gold)" },
  platinum: { label: "Platin", color: "var(--color-medal-platinum)" },
};

/** The tier of a PlayStation trophy as a small coloured cup. Nothing for achievements without a tier. */
export function Medal({ tier }: { tier: string | null | undefined }) {
  const medal = tier ? MEDAL[tier.toLowerCase()] : undefined;
  if (!medal) return null;
  return (
    <span className="inline-flex shrink-0 items-center" style={{ color: medal.color }} title={medal.label}>
      <PixelIcon name="trophy" className="h-3.5 w-3.5" />
      <span className="sr-only">{medal.label}</span>
    </span>
  );
}

/** The limits offered for «rare», as stored in the settings (`rareLimit`). */
export const RARE_LIMITS = ["10", "5", "3", "2", "1", "<1"] as const;
export type RareLimit = (typeof RARE_LIMITS)[number];
export const DEFAULT_RARE_LIMIT: RareLimit = "10";

export function rareLimitLabel(limit: RareLimit): string {
  return limit === "<1" ? "unter 1 %" : `höchstens ${limit} %`;
}

/** The stored limit, or the default if nothing valid is stored. */
export function readRareLimit(settings: Record<string, unknown>): RareLimit {
  const stored = settings.rareLimit;
  return RARE_LIMITS.includes(stored as RareLimit) ? (stored as RareLimit) : DEFAULT_RARE_LIMIT;
}

/** Rare: at most the limit in percent of players have it; «<1» means fewer than one percent. */
export function isRare(percent: number | null | undefined, limit: RareLimit): boolean {
  if (percent == null) return false;
  return limit === "<1" ? percent < 1 : percent <= Number(limit);
}

/** A brass tag for an achievement that few players have. Nothing if the share is unknown or common. */
export function RareBadge({ percent, limit }: { percent: number | null | undefined; limit: RareLimit }) {
  if (percent == null || !isRare(percent, limit)) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-highlight-fill px-1 py-px text-[10px] font-semibold uppercase leading-tight tracking-wide text-on-highlight"
      title={`Nur ${percent} % der Spieler haben das`}
    >
      <PixelIcon name="star" className="h-2.5 w-2.5" />
      Selten
    </span>
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
    <div role="group" aria-label={label} className="flex gap-1 rounded-full border border-border bg-surface-raised p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${value === o.id ? "bg-section font-semibold text-on-section shadow-[0_4px_12px_-6px_var(--section,var(--color-accent))]" : "text-muted hover:text-text"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
