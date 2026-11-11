"use client";

// Charts. Colours come from the design tokens (CSS variables), never from here.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatHours, formatMinutes } from "@/core/labels";
import type { Bucket, SeriesPoint, Share } from "@/core/library";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function bucketLabel(key: string, bucket: Bucket, long = false): string {
  if (bucket === "month") {
    const month = MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
    return long ? `${month} ${key.slice(0, 4)}` : `${month} ${key.slice(2, 4)}`;
  }
  const [, m, d] = key.split("-");
  return long ? `Woche ab ${d}.${m}.${key.slice(0, 4)}` : `${d}.${m}.`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SeriesPoint }[];
  bucket: Bucket;
}

function PlaytimeTooltip({ active, payload, bucket }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-control border border-border bg-surface-raised px-3 py-2 text-xs text-text">
      <div className="text-muted">{bucketLabel(point.key, bucket, true)}</div>
      <div className="font-semibold tabular-nums">{formatMinutes(point.minutes)}</div>
      {point.estimated ? <div className="text-muted">enthält geschätzte Werte</div> : null}
    </div>
  );
}

/** Playtime per week or month. Lighter bars contain estimated values. */
export function PlaytimeChart({ points, bucket, title }: { points: SeriesPoint[]; bucket: Bucket; title: string }) {
  const data = points.map((p) => ({ ...p, hours: p.minutes / 60 }));
  const anyEstimated = points.some((p) => p.estimated && p.minutes > 0);
  return (
    <figure className="flex flex-col gap-2">
      <div className="h-56 w-full" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis
              dataKey="key"
              tickFormatter={(k: string) => bucketLabel(k, bucket)}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(h: number) => `${Math.round(h)}`}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<PlaytimeTooltip bucket={bucket} />} cursor={{ fill: "var(--color-surface-raised)" }} />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((p) => (
                <Cell key={p.key} fill="var(--color-chart-1)" fillOpacity={p.estimated ? 0.5 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>Stunden{anyEstimated ? " · hellere Balken enthalten geschätzte Werte" : ""}</span>
        <details>
          <summary className="cursor-pointer">Als Tabelle</summary>
          <table className="mt-2 text-left">
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td className="pr-4">{bucketLabel(p.key, bucket, true)}</td>
                  <td className="tabular-nums">
                    {formatMinutes(p.minutes)}
                    {p.estimated && p.minutes > 0 ? " (geschätzt)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figcaption>
    </figure>
  );
}

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
        <li key={s.key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate">{label(s.key)}</span>
          <span className="h-2.5 rounded-full bg-surface-raised">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(2, (s.minutes / max) * 100)}%`, background: color(s.key) }}
            />
          </span>
          <span className="tabular-nums text-muted" title={formatMinutes(s.minutes)}>
            {formatHours(s.minutes)} · {Math.round((s.minutes / total) * 100)} %
          </span>
        </li>
      ))}
    </ul>
  );
}
