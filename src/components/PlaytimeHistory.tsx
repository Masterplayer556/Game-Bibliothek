"use client";

// Playtime over time: switch between days, weeks, months and years, and move back in time
// with the arrows or by swiping the chart sideways.
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { clampOffset, maxOffset, offsetKeepingEnd, WINDOW_SIZE, windowBounds } from "@/core/history-window";
import { formatMinutes } from "@/core/labels";
import { playtimeSeries, type Bucket, type GameDay } from "@/core/library";
import type { LocalDate } from "@/core/types";
import { bucketLabel, PlaytimeChart } from "./charts";
import { IconButton, Segmented } from "./ui";

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "day", label: "Tage" },
  { id: "week", label: "Wochen" },
  { id: "month", label: "Monate" },
  { id: "year", label: "Jahre" },
];

/** A finger has to move this far before a touch counts as a swipe and not a tap. */
const SWIPE_THRESHOLD_PX = 8;

export function PlaytimeHistory({
  days,
  today,
  title,
  initialBucket = "month",
}: {
  days: readonly GameDay[];
  today: LocalDate;
  title: string;
  initialBucket?: Bucket;
}) {
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [offset, setOffset] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; offset: number; swiping: boolean } | null>(null);

  const first = useMemo(() => days.reduce<LocalDate>((min, d) => (d.date < min ? d.date : min), today), [days, today]);
  const seriesFor = (b: Bucket) => playtimeSeries(days, { from: first, to: today }, b);
  // Computed once per bucket, not on every move of a swipe: a day series over years has
  // thousands of points.
  const series = useMemo(() => playtimeSeries(days, { from: first, to: today }, bucket), [days, first, today, bucket]);

  const size = WINDOW_SIZE[bucket];
  const [start, end] = windowBounds(series.length, size, offset);
  const visible = series.slice(start, end);
  const canGoBack = offset < maxOffset(series.length, size);
  const total = visible.reduce((sum, p) => sum + p.minutes, 0);
  const move = (by: number) => setOffset((o) => clampOffset(o + by, series.length, size));

  function switchBucket(next: Bucket) {
    if (next === bucket) return;
    setOffset(offsetKeepingEnd(series, bucket, offset, seriesFor(next), next));
    setBucket(next);
  }

  // Swipe: dragging to the right shows older bars, as on a timeline.
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, offset, swiping: false };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const width = area.current?.clientWidth ?? 0;
    if (!d || width === 0 || visible.length === 0) return;
    const dx = event.clientX - d.x;
    if (!d.swiping && Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (!d.swiping) {
      d.swiping = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setOffset(clampOffset(d.offset + dx / (width / visible.length), series.length, size));
  }
  function onPointerUp() {
    drag.current = null;
  }
  // Trackpads and Shift + mouse wheel scroll sideways.
  const wheelRest = useRef(0);
  function onWheel(event: WheelEvent<HTMLDivElement>) {
    const dx = event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (dx === 0) return;
    const width = area.current?.clientWidth ?? 0;
    if (width === 0 || visible.length === 0) return;
    wheelRest.current -= dx / (width / visible.length);
    const whole = Math.trunc(wheelRest.current);
    if (whole !== 0) {
      wheelRest.current -= whole;
      move(whole);
    }
  }

  const step = Math.max(1, Math.floor(size / 2));
  const from = visible[0];
  const to = visible[visible.length - 1];

  return (
    <div className="flex flex-col gap-stack">
      <Segmented label="Einteilung" options={BUCKETS} value={bucket} onChange={switchBucket} />

      <div className="flex items-center justify-between gap-2">
        <IconButton icon="back" label="Früher" disabled={!canGoBack} onClick={() => move(step)} />
        <div className="min-w-0 text-center text-sm font-semibold" aria-live="polite">
          <div className="truncate">
            {from && to ? (from.key === to.key ? bucketLabel(from.key, bucket, true) : `${bucketLabel(from.key, bucket, true)} – ${bucketLabel(to.key, bucket, true)}`) : "–"}
          </div>
          <div className="text-xs font-normal tabular-nums text-muted">zusammen {formatMinutes(total)}</div>
        </div>
        <IconButton icon="forward" label="Später" disabled={offset === 0} onClick={() => move(-step)} />
      </div>

      <div
        ref={area}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        // Vertical swipes still scroll the page; sideways ones move the chart.
        style={{ touchAction: "pan-y" }}
        className="select-none"
      >
        <PlaytimeChart points={visible} bucket={bucket} title={title} />
      </div>

      {offset > 0 ? (
        <div className="flex justify-end">
          <button type="button" className="link text-xs" onClick={() => setOffset(0)}>
            Zurück zu heute
          </button>
        </div>
      ) : null}
    </div>
  );
}
