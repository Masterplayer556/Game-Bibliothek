"use client";

// The bar chart of playtime over time. Its own file because of Recharts: charts.tsx loads it
// only when a chart is shown. Colours come from the design tokens (CSS variables).
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinutes } from "@/core/labels";
import type { Bucket, SeriesPoint } from "@/core/library";
import { bucketLabel } from "./charts";

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SeriesPoint }[];
  bucket: Bucket;
}

function PlaytimeTooltip({ active, payload, bucket }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="glass rounded-2xl px-3 py-2 text-xs text-text">
      <div className="text-muted">{bucketLabel(point.key, bucket, true)}</div>
      <div className="num text-lg leading-tight">{formatMinutes(point.minutes)}</div>
      {point.estimatedMinutes > 0 ? (
        <div className="text-muted">davon {formatMinutes(point.estimatedMinutes)} geschätzt</div>
      ) : null}
    </div>
  );
}

/** Playtime per day, week, month or year. Lighter bars contain estimated values. */
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
            <Tooltip content={<PlaytimeTooltip bucket={bucket} />} cursor={{ fill: "color-mix(in oklab, var(--section) 12%, transparent)", radius: 6 }} />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((p) => (
                <Cell key={p.key} fill="var(--color-chart-bar)" fillOpacity={p.estimated ? 0.4 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>Stunden{anyEstimated ? " · hellere Balken sind grösstenteils geschätzt" : ""}</span>
        <details>
          <summary className="cursor-pointer">Als Tabelle</summary>
          <table className="mt-2 text-left">
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td className="pr-4">{bucketLabel(p.key, bucket, true)}</td>
                  <td className="tabular-nums">
                    {formatMinutes(p.minutes)}
                    {p.estimatedMinutes > 0 ? ` (davon ${formatMinutes(p.estimatedMinutes)} geschätzt)` : ""}
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

