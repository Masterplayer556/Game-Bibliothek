"use client";

// A year of play days as a grid of pixels: one square per day, darker with more time played.
// Tapping a square shows what was played that day.
import Link from "next/link";
import { useState } from "react";
import { formatMinutes } from "@/core/labels";
import type { GameDay, LibraryGame } from "@/core/library";
import { addDays, weekStart } from "@/core/time";
import type { LocalDate } from "@/core/types";
import { gameHref, GameCover } from "./game-ui";
import { Button } from "./ui";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Upper limits in minutes of the first three coloured steps; the fourth is everything above. */
const STEPS = [30, 60, 120] as const;

function level(minutes: number): number {
  if (minutes <= 0) return 0;
  const step = STEPS.findIndex((limit) => minutes < limit);
  return step === -1 ? STEPS.length + 1 : step + 1;
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
  const move = (by: number) => {
    setBack((b) => Math.max(0, b + by));
    setSelected(null);
  };

  // Newest week first: the row is laid out from the right, so the latest weeks always fit.
  const columns = Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(first, (weeks - 1 - w) * 7);
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
        <Button aria-label="Früher" disabled={!canGoBack} onClick={() => move(1)}>
          ‹
        </Button>
        <div className="text-center text-sm" aria-live="polite">
          {label(first)} – {label(last)}
        </div>
        <Button aria-label="Später" disabled={back === 0} onClick={() => move(-1)}>
          ›
        </Button>
      </div>
      {/* Weeks that do not fit wrap onto a second line, which is cut off: no half columns on a phone. */}
      <div
        role="group"
        aria-label={`Spieltage vom ${label(first)} bis ${label(last)}: an ${minutesOn.size} Tagen gespielt`}
        className="flex h-[121px] flex-row-reverse flex-wrap content-start gap-x-[3px] gap-y-4 overflow-hidden"
      >
        {columns.map((column) => (
          <div key={column.monday} className="flex flex-col gap-[3px]">
            <div className="relative h-4 w-3">
              {column.month ? <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] text-muted">{column.month}</span> : null}
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
                  className={`h-3 w-3 rounded-[2px] ${selected === date ? "outline outline-2 outline-offset-1 outline-text" : ""}`}
                  style={{ background: `var(--color-heat-${level(minutesOn.get(date) ?? 0)})` }}
                  title={`${label(date)}: ${minutesOn.has(date) ? formatMinutes(minutesOn.get(date)!) : "nicht gespielt"}`}
                  aria-label={`${label(date)}: ${minutesOn.has(date) ? formatMinutes(minutesOn.get(date)!) : "nicht gespielt"}`}
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div aria-live="polite">
        {selected ? (
          <div className="flex flex-col gap-2 rounded-control border border-border bg-surface-raised p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display font-semibold">
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
                      <Link href={gameHref(gameId)} className="flex items-center gap-3 rounded-control p-1 hover:bg-surface">
                        <GameCover game={game} className="w-8 shrink-0" />
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
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-3 w-3 rounded-[2px]" style={{ background: `var(--color-heat-${l})` }} />
          ))}
          2 Std. und mehr
        </span>
      </figcaption>
    </figure>
  );
}
