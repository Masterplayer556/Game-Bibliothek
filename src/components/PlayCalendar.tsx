"use client";

// A year of play days as a grid of pixels: one square per day, one colour step per hour played.
// Tapping a square shows what was played that day. Narrow screens scroll the weeks sideways;
// the newest week (today) starts in view on the right.
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { formatMinutes } from "@/core/labels";
import type { GameDay, LibraryGame } from "@/core/library";
import { addDays, weekStart } from "@/core/time";
import type { LocalDate } from "@/core/types";
import { gameHref, GameCover } from "./game-ui";
import { IconButton } from "./ui";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/**
 * Where each colour step starts, in hours: under 1 h is step 1, then one step per hour up to the
 * full colour at 4 h; past that it turns white (5 h a little, 7 h more, 10 h pure white).
 */
const STEP_HOURS = [0, 1, 2, 3, 4, 5, 7, 10] as const;

export function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  let step = 0;
  while (step < STEP_HOURS.length && minutes >= STEP_HOURS[step]! * 60) step++;
  return step;
}

function stepLabel(step: number): string {
  const from = STEP_HOURS[step - 1]!;
  const to = STEP_HOURS[step];
  if (to === undefined) return `${from} Std. und mehr`;
  return from === 0 ? `unter ${to} Std.` : `${from} bis unter ${to} Std.`;
}

function heatStyle(step: number) {
  return { background: `var(--color-heat-${step})` };
}

function label(date: LocalDate): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

function weekday(date: LocalDate): string {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

export function PlayCalendar({
  days,
  today,
  byId,
  weeks = 53,
}: {
  days: readonly GameDay[];
  today: LocalDate;
  byId: ReadonlyMap<string, LibraryGame>;
  weeks?: number;
}) {
  const [selected, setSelected] = useState<LocalDate | null>(null);
  // How many windows back from today: 0 shows the weeks up to today, 1 the weeks before those …
  const [back, setBack] = useState(0);

  const last = back === 0 ? today : addDays(weekStart(today), -back * weeks * 7 + 6);
  const first = addDays(weekStart(last), -(weeks - 1) * 7);
  const earliest = days.reduce<LocalDate>((min, d) => (d.date < min ? d.date : min), today);
  const canGoBack = earliest < first;
  const minutesOn = new Map<LocalDate, number>();
  for (const d of days) {
    if (d.date >= first && d.date <= last) minutesOn.set(d.date, (minutesOn.get(d.date) ?? 0) + d.minutes);
  }
  // Show the newest week first: scrolled to the right end, also after «Früher» / «Später».
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [back, weeks, today]);
  const move = (by: number) => {
    setBack((b) => Math.max(0, b + by));
    setSelected(null);
  };

  // Oldest week first, left to right.
  const columns = Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(first, w * 7);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    // Name a month above the first week that starts in it.
    const month = Number(monday.slice(8, 10)) <= 7 ? MONTHS[Number(monday.slice(5, 7)) - 1] : null;
    return { monday, dates, month };
  });

  const played = new Map<string, { minutes: number; estimated: boolean }>();
  if (selected) {
    for (const d of days) {
      if (d.date !== selected) continue;
      const entry = played.get(d.gameId) ?? { minutes: 0, estimated: false };
      entry.minutes += d.minutes;
      entry.estimated ||= d.estimated;
      played.set(d.gameId, entry);
    }
  }
  const playedGames = [...played].sort((a, b) => b[1].minutes - a[1].minutes);

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <IconButton icon="back" label="Früher" disabled={!canGoBack} onClick={() => move(1)} />
        <div className="text-center text-sm font-semibold" aria-live="polite">
          {label(first)} – {label(last)}
        </div>
        <IconButton icon="forward" label="Später" disabled={back === 0} onClick={() => move(-1)} />
      </div>
      {/*
        All weeks of the window, scrolling sideways where they do not fit (a phone shows about
        19): the dates above and the count below always match what can be seen by scrolling.
        In the light theme the grid sits on a dark «screen», so the white steps glow as at night.
      */}
      <div className="heat-screen">
        <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
        <div
          role="group"
          aria-label={`Spieltage vom ${label(first)} bis ${label(last)}: an ${minutesOn.size} Tagen gespielt`}
          className="flex w-max flex-row gap-x-[3px] pb-1"
        >
        {columns.map((column) => (
          <div key={column.monday} className="flex flex-col gap-[3px]">
            <div className="relative h-4 w-3">
              {column.month ? <span className="heat-month absolute left-0 top-0 whitespace-nowrap text-[10px]">{column.month}</span> : null}
            </div>
            {column.dates.map((date) =>
              date > last ? (
                <span key={date} className="h-3 w-3" />
              ) : (
                <button
                  key={date}
                  type="button"
                  aria-pressed={selected === date}
                  onClick={() => setSelected(selected === date ? null : date)}
                  className={`h-3 w-3 rounded-[3.5px] ${selected === date ? "heat-selected outline-2 outline-offset-1" : ""}`}
                  style={heatStyle(heatLevel(minutesOn.get(date) ?? 0))}
                  title={`${label(date)}: ${minutesOn.has(date) ? formatMinutes(minutesOn.get(date)!) : "nicht gespielt"}`}
                  aria-label={`${label(date)}: ${minutesOn.has(date) ? formatMinutes(minutesOn.get(date)!) : "nicht gespielt"}`}
                />
              ),
            )}
          </div>
        ))}
        </div>
        </div>
      </div>

      <div aria-live="polite">
        {selected ? (
          <div className="anim-drop-in flex flex-col gap-2 rounded-2xl border border-border bg-section-soft p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display font-bold">
                {weekday(selected)}, {label(selected)}
              </span>
              <span className="num text-lg leading-none">{minutesOn.has(selected) ? formatMinutes(minutesOn.get(selected)!) : "–"}</span>
            </div>
            {playedGames.length === 0 ? (
              <p className="text-sm text-muted">An diesem Tag ist keine Spielzeit erfasst.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {playedGames.map(([gameId, entry]) => {
                  const game = byId.get(gameId);
                  if (!game) return null;
                  return (
                    <li key={gameId}>
                      <Link href={gameHref(gameId)} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface">
                        <GameCover game={game} className="w-9 shrink-0 !rounded-md" />
                        <span className="min-w-0 flex-1 truncate text-sm">{game.title}</span>
                        <span className="shrink-0 text-sm tabular-nums text-muted">
                          {formatMinutes(entry.minutes)}
                          {entry.estimated ? "*" : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {playedGames.some(([, entry]) => entry.estimated) ? <p className="text-xs text-muted">* geschätzt</p> : null}
          </div>
        ) : null}
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          An <span className="num text-sm text-text">{minutesOn.size}</span> Tagen gespielt · Tag antippen für Details
        </span>
        <span className="flex items-center gap-1.5">
          0
          <span className="heat-screen heat-legend flex items-center gap-1">
            {Array.from({ length: STEP_HOURS.length + 1 }, (_, step) => (
              <span key={step} className="h-3 w-3 rounded-[3.5px]" style={heatStyle(step)} title={step === 0 ? "nicht gespielt" : stepLabel(step)} />
            ))}
          </span>
          10 Std.+
        </span>
      </figcaption>
    </figure>
  );
}
