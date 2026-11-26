"use client";

// Charts. Colours come from the design tokens (CSS variables), never from here.
// The bar chart over time needs Recharts and lives in playtime-chart.tsx, loaded only where it
// is shown (see PlaytimeChart below), so Recharts stays out of the other pages.
import dynamic from "next/dynamic";
import { formatHours, formatMinutes } from "@/core/labels";
import type { Bucket, Share } from "@/core/library";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function bucketLabel(key: string, bucket: Bucket, long = false): string {
  if (bucket === "year") return key;
  if (bucket === "month") {
    const month = MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
    return long ? `${month} ${key.slice(0, 4)}` : `${month} ${key.slice(2, 4)}`;
  }
  const [, m, d] = key.split("-");
  if (bucket === "day") {
    const weekday = WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()];
    return long ? `${weekday}, ${d}.${m}.${key.slice(0, 4)}` : `${d}.${m}.`;
  }
  return long ? `Woche ab ${d}.${m}.${key.slice(0, 4)}` : `${d}.${m}.`;
}

/** Playtime per day, week, month or year (Recharts, loaded when first shown). */
export const PlaytimeChart = dynamic(() => import("./playtime-chart").then((m) => m.PlaytimeChart), {
  ssr: false,
  loading: () => <div className="h-56 w-full" aria-hidden />,
});

/** Horizontal share bars with direct labels: «label, bar, value». */
export function ShareBars({
  shares,
  label,
  color,
  empty = "Keine Daten im gewählten Zeitraum.",
}: {
  shares: Share[];
  label: (key: string) => string;
  color: (key: string) => string;
  empty?: string;
}) {
  if (shares.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...shares.map((s) => s.minutes));
  const total = shares.reduce((sum, s) => sum + s.minutes, 0);
  return (
    <ul className="flex flex-col gap-2">
      {shares.map((s) => (
        <li key={s.key} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(s.key) }} />
            <span className="truncate">{label(s.key)}</span>
          </span>
          <span className="h-3 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-text)_8%,transparent)]">
            <span
              className="block h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
              style={{ width: `${Math.max(2, (s.minutes / max) * 100)}%`, background: color(s.key) }}
            />
          </span>
          <span className="text-xs font-semibold tabular-nums text-muted" title={formatMinutes(s.minutes)}>
            {formatHours(s.minutes)} · {Math.round((s.minutes / total) * 100)} %
          </span>
        </li>
      ))}
    </ul>
  );
}
