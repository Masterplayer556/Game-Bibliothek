"use client";

import { formatHours } from "@/core/labels";
import { timeToBeatSummary, type LibraryGame, type TimeToBeatKind } from "@/core/library";
import { Card, Notice } from "../ui";

const KIND_LABEL: Record<TimeToBeatKind, string> = {
  hastily: "Hauptstory, zügig",
  normally: "Hauptstory",
  completely: "Komplett (100 %)",
};

/** «Hauptstory ca. 12 Std., du: 8 Std.»: how long the game takes, from IGDB players. */
export function TimeToBeat({ game }: { game: LibraryGame }) {
  const summary = timeToBeatSummary(game);
  if (!summary) return null;
  const longest = Math.max(summary.mineMinutes, ...summary.steps.map((s) => s.minutes));
  const percent = Math.round(summary.progress * 100);
  return (
    <Card title="Spieldauer" subtitle="Wie lange Spieler brauchen (IGDB)" icon="clock" tone="chronicle">
      <p className="text-sm">
        Hauptstory ca. <span className="font-semibold">{formatHours(summary.mainMinutes)}</span>, du:{" "}
        <span className="font-semibold">{formatHours(summary.mineMinutes)}</span>
        {summary.mineMinutes > 0 ? <span className="text-muted"> ({percent >= 100 ? "geschafft oder mehr" : `${percent} %`})</span> : null}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {summary.steps.map((s) => (
          <li key={s.kind} className="flex flex-col gap-1">
            <span className="flex justify-between gap-2">
              <span>{KIND_LABEL[s.kind]}</span>
              <span className="tabular-nums text-muted">ca. {formatHours(s.minutes)}</span>
            </span>
            <span aria-hidden className="h-2 rounded-full bg-section-soft">
              <span className="block h-full rounded-full bg-[var(--section)] opacity-50" style={{ width: `${(s.minutes / longest) * 100}%` }} />
            </span>
          </li>
        ))}
        <li className="flex flex-col gap-1">
          <span className="flex justify-between gap-2 font-semibold">
            <span>Du</span>
            <span className="tabular-nums">{formatHours(summary.mineMinutes)}</span>
          </span>
          <span aria-hidden className="h-2 rounded-full bg-section-soft">
            <span className="block h-full rounded-full bg-[var(--section)]" style={{ width: `${(summary.mineMinutes / longest) * 100}%` }} />
          </span>
        </li>
      </ul>
      {game.timeToBeat && game.timeToBeat.count > 0 && game.timeToBeat.count < 5 ? (
        <Notice>Nur {game.timeToBeat.count} Angaben von Spielern: ein grober Wert.</Notice>
      ) : null}
    </Card>
  );
}
