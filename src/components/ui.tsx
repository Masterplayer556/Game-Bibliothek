"use client";

// Small presentational building blocks. Styling only, no logic.
import { useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { sectionStyle, type Section } from "./section";

function CardHeading({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: IconName }) {
  return (
    <>
      {icon ? (
        <span className="icon-tile h-10 w-10 rounded-[13px]">
          <Icon name={icon} className="h-[22px] w-[22px]" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[1.3rem] font-bold leading-tight tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
    </>
  );
}

/**
 * A card of tinted glass. `icon` sits on a glossy tile in the colour of the section; `tone`
 * gives the card the colour of another section; `action` sits at the right of the title.
 * `collapsible` makes the title a button that folds the card away (closed unless `defaultOpen`).
 */
export function Card({
  title,
  subtitle,
  icon,
  tone,
  action,
  glow = false,
  collapsible = false,
  defaultOpen = false,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  tone?: Section;
  action?: ReactNode;
  glow?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // A card that becomes urgent later (a login expired while the page was open) opens by itself.
  const [wasDefaultOpen, setWasDefaultOpen] = useState(defaultOpen);
  if (wasDefaultOpen !== defaultOpen) {
    setWasDefaultOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }
  const classes = `card p-card sm:p-5 ${glow ? "card-glow" : ""} ${className}`;
  const style = tone ? sectionStyle(tone) : undefined;

  if (collapsible && title) {
    return (
      <details className={`card-fold ${classes}`} style={style} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="card-fold-summary flex items-center gap-3">
          <CardHeading title={title} subtitle={subtitle} icon={icon} />
          <Icon name="forward" className="card-fold-chevron h-5 w-5 text-muted" />
        </summary>
        <div className="mt-4 flex flex-col gap-stack">{children}</div>
      </details>
    );
  }

  return (
    <section className={classes} style={style}>
      {title ? (
        <div className="mb-4 flex items-center gap-3">
          <CardHeading title={title} subtitle={subtitle} icon={icon} />
          {action}
        </div>
      ) : null}
      <div className="flex flex-col gap-stack">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary"; icon?: IconName };

export function Button({ variant = "secondary", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button {...props} className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"} ${className}`}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

/** A round button with an icon only: arrows and menus. */
export function IconButton({
  icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button {...props} aria-label={label} title={label} className={`btn btn-secondary btn-icon ${className}`}>
      <Icon name={icon} className="h-[18px] w-[18px]" />
    </button>
  );
}

const NOTICE_TONE = {
  muted: { text: "text-muted", icon: null },
  success: { text: "text-success", icon: "check" },
  warning: { text: "text-warning", icon: "warning" },
  danger: { text: "text-danger", icon: "warning" },
} as const;

export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const look = NOTICE_TONE[tone];
  return (
    <p className={`flex gap-2 text-sm ${look.text}`}>
      {look.icon ? <Icon name={look.icon} className="mt-px h-4 w-4" /> : null}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// 16px on phones: iOS zooms into smaller fields.
export const fieldClass =
  "rounded-control border border-border-strong bg-field px-3.5 py-2.5 text-base text-text shadow-[inset_0_1px_2px_var(--color-border)] outline-none placeholder:text-muted focus:border-[var(--section-ink,var(--color-accent))] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--section,var(--color-accent))_22%,transparent)] disabled:opacity-60 sm:text-sm";

/** A number with its label on a tile. `tone` picks the colour of another section, for variety. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: Section;
}) {
  return (
    <div className="card card-glow flex h-full flex-col gap-2 rounded-tile p-3.5" style={tone ? sectionStyle(tone) : undefined}>
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="icon-tile h-8 w-8 rounded-[10px]">
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        ) : null}
        <span className="eyebrow min-w-0 leading-tight">{label}</span>
      </div>
      <div className="num text-[1.85rem] leading-none">{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Width of the cut between two segments: wide for a few, a hairline for very many. */
function segmentGap(count: number): number {
  if (count <= 12) return 4;
  if (count <= 30) return 3;
  if (count <= 60) return 2;
  if (count <= 110) return 1.25;
  return 0.75;
}

/**
 * Progress in as many segments as there are steps: a game with 4 achievements has four, one
 * with 137 has 137. Finished, it turns gold. Above 400 steps it is one plain bar.
 */
export function SegmentedProgress({ value, max, label, className = "" }: { value: number; max: number; label: string; className?: string }) {
  const steps = Math.max(1, max);
  const done = Math.max(0, Math.min(value, steps));
  const segmented = steps <= 400;
  const style = {
    "--n": segmented ? steps : 1,
    "--k": segmented ? done : done / steps,
    "--g": `${segmented && steps > 1 ? segmentGap(steps) : 0}px`,
  } as CSSProperties;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      data-complete={max > 0 && value >= max}
      className={`seg-bar ${className}`}
      style={style}
    >
      <div className="seg-bar-strip">
        <div className="seg-bar-fill" />
      </div>
    </div>
  );
}

/** Progress as a ring with the percentage in the middle. */
export function ProgressRing({ value, max, label, size = "h-20 w-20" }: { value: number; max: number; label: string; size?: string }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  const radius = 26;
  const length = 2 * Math.PI * radius;
  const id = `ring${useId().replace(/:/g, "")}`;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={`relative shrink-0 ${size}`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={share === 1 ? "var(--color-highlight-fill)" : "var(--section, var(--color-accent))"} />
            <stop offset="1" stopColor={share === 1 ? "var(--color-highlight-fill-2)" : "var(--section-2, var(--color-accent-2))"} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="color-mix(in oklab, var(--color-text) 10%, transparent)" strokeWidth="8" />
        <circle cx="32" cy="32" r={radius} fill="none" stroke={`url(#${id})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${share * length} ${length}`} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-xl leading-none">{Math.round(share * 100)}%</span>
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
      <Icon name="trophy" className="h-4 w-4" />
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

/** A gold tag for an achievement that few players have. Nothing if the share is unknown or common. */
export function RareBadge({ percent, limit }: { percent: number | null | undefined; limit: RareLimit }) {
  if (percent == null || !isRare(percent, limit)) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-linear-to-r from-highlight-fill to-highlight-fill-2 px-1.5 py-px text-[10px] font-bold uppercase leading-tight tracking-wide text-on-highlight shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
      title={`Nur ${percent} % der Spieler haben das`}
    >
      <Icon name="star" className="h-2.5 w-2.5" />
      Selten
    </span>
  );
}

/** A row of options of which exactly one is chosen (for a view, not for pages); the pill glides. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div role="group" aria-label={label} className={`segmented ${className}`} style={{ "--count": options.length, "--index": index } as CSSProperties}>
      <span aria-hidden className="segmented-pill" />
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className="segmented-option">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A label above a big number, for heroes and summaries. */
export function Figure({ label, value, unit, className = "" }: { label: string; value: ReactNode; unit?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-80">{label}</div>
      <div className="num mt-1 text-[2rem] leading-none">
        {value}
        {unit ? <span className="ml-1 text-base font-semibold opacity-75">{unit}</span> : null}
      </div>
    </div>
  );
}
