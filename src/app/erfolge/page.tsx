"use client";

import Link from "next/link";
import { formatDay, gameHref, GameCover } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { Card, Notice, ProgressBar, StatTile } from "@/components/ui";
import { PLATFORM_LABEL } from "@/core/labels";

export default function AchievementsPage() {
  return (
    <LibraryGate>
      {({ library, raw }) => {
        const games = library.games.filter((g) => !g.hidden && g.achievements && g.achievements.total > 0);
        const rows = games
          .flatMap((g) => g.entries.filter((e) => e.achievements && e.achievements.total > 0).map((e) => ({ game: g, entry: e })))
          .sort(
            (a, b) =>
              b.entry.achievements!.unlocked / b.entry.achievements!.total -
                a.entry.achievements!.unlocked / a.entry.achievements!.total || a.game.title.localeCompare(b.game.title, "de"),
          );
        const unlocked = rows.reduce((s, r) => s + r.entry.achievements!.unlocked, 0);
        const total = rows.reduce((s, r) => s + r.entry.achievements!.total, 0);
        const nintendoOnly = library.games.filter((g) => !g.hidden && g.platforms.every((p) => p === "nintendo")).length;
        const entryToGame = new Map(library.games.flatMap((g) => g.entries.map((e) => [e.id, g] as const)));
        const recent = raw.achievements
          .filter((a) => a.unlocked_at && entryToGame.has(a.platform_game_id))
          .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
          .slice(0, 8);

        return (
          <>
            <section className="grid grid-cols-2 gap-stack">
              <StatTile label="Freigeschaltet" value={`${unlocked} / ${total}`} />
              <StatTile label="Spiele mit Erfolgen" value={String(rows.length)} />
            </section>
            {nintendoOnly > 0 ? (
              <Notice>{nintendoOnly} Nintendo-Spiele sind nicht aufgeführt: Nintendo hat keine Erfolge.</Notice>
            ) : null}

            {recent.length > 0 ? (
              <Card title="Zuletzt freigeschaltet">
                <ul className="flex flex-col gap-2 text-sm">
                  {recent.map((a) => (
                    <li key={`${a.platform_game_id}-${a.external_id}`} className="flex justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate">{a.name}</span>
                        <span className="block truncate text-xs text-muted">{entryToGame.get(a.platform_game_id)?.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDay(a.unlocked_at)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card title="Fortschritt pro Spiel">
              {rows.length === 0 ? (
                <Notice>Noch keine Erfolge erfasst. Sie kommen mit Steam (Phase 5) und PlayStation (Phase 6).</Notice>
              ) : (
                <ul className="flex flex-col gap-3">
                  {rows.map(({ game, entry }) => (
                    <li key={entry.id}>
                      <Link href={gameHref(game.id)} className="flex items-center gap-3">
                        <GameCover game={game} className="w-10 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex justify-between gap-2 text-sm">
                            <span className="truncate">
                              {game.title} <span className="text-muted">· {PLATFORM_LABEL[entry.platform]}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {entry.achievements!.unlocked}/{entry.achievements!.total}
                            </span>
                          </span>
                          <ProgressBar value={entry.achievements!.unlocked} max={entry.achievements!.total} label={`Erfolge ${game.title}`} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
