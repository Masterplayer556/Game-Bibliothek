"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDay, gameHref, GameCover } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { Card, Notice, ProgressBar, Segmented, StatTile } from "@/components/ui";
import { achievementPlatforms, achievementSummary, type AchievementFilter } from "@/core/achievements";
import { ACHIEVEMENT_PLATFORM_LABEL, PLATFORM_LABEL } from "@/core/labels";

export default function AchievementsPage() {
  const [filter, setFilter] = useState<AchievementFilter>("all");

  return (
    <LibraryGate>
      {({ library, raw }) => {
        const platforms = achievementPlatforms(library.games);
        // A platform that disappeared (e.g. after a merge) falls back to «all».
        const active: AchievementFilter = filter === "all" || platforms.includes(filter) ? filter : "all";
        const { rows, unlocked, total, games } = achievementSummary(library.games, active);
        const nintendoOnly = library.games.filter((g) => !g.hidden && g.platforms.every((p) => p === "nintendo")).length;
        const rowByEntry = new Map(rows.map((r) => [r.entry.id, r] as const));
        const recent = raw.achievements
          .filter((a) => a.unlocked_at && rowByEntry.has(a.platform_game_id))
          .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
          .slice(0, 8);
        const options = [
          { id: "all" as AchievementFilter, label: "Alle" },
          ...platforms.map((p) => ({ id: p as AchievementFilter, label: ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p] })),
        ];

        return (
          <>
            {platforms.length > 1 ? (
              <section className="flex flex-col gap-1">
                <Segmented label="Plattform" options={options} value={active} onChange={setFilter} />
                {active === "all" ? (
                  <span className="text-xs text-muted">
                    PC und PlayStation zählen getrennt: Eine Trophäe schaltet den Steam-Erfolg nicht frei.
                  </span>
                ) : null}
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-stack">
              <StatTile label="Freigeschaltet" value={`${unlocked} / ${total}`} hint={total > 0 ? `${Math.round((unlocked / total) * 100)} %` : undefined} />
              <StatTile label="Spiele mit Erfolgen" value={String(games)} />
            </section>
            {nintendoOnly > 0 && active === "all" ? (
              <Notice>{nintendoOnly} Nintendo-Spiele sind nicht aufgeführt: Nintendo hat keine Erfolge.</Notice>
            ) : null}

            {recent.length > 0 ? (
              <Card title="Zuletzt freigeschaltet">
                <ul className="flex flex-col gap-2 text-sm">
                  {recent.map((a) => {
                    const row = rowByEntry.get(a.platform_game_id)!;
                    return (
                      <li key={`${a.platform_game_id}-${a.external_id}`} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate">{a.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {row.game.title}
                            {active === "all" ? ` · ${ACHIEVEMENT_PLATFORM_LABEL[row.entry.platform] ?? PLATFORM_LABEL[row.entry.platform]}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatDay(a.unlocked_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            <Card title="Fortschritt pro Spiel">
              {rows.length === 0 ? (
                <Notice>Noch keine Erfolge erfasst. Sie kommen mit dem Sync von Steam und PlayStation.</Notice>
              ) : (
                <ul className="flex flex-col gap-3">
                  {rows.map(({ game, entry }) => (
                    <li key={entry.id}>
                      <Link href={gameHref(game.id)} className="flex items-center gap-3">
                        <GameCover game={game} className="w-10 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex justify-between gap-2 text-sm">
                            <span className="truncate">
                              {game.title}
                              {active === "all" ? (
                                <span className="text-muted"> · {ACHIEVEMENT_PLATFORM_LABEL[entry.platform] ?? PLATFORM_LABEL[entry.platform]}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {entry.achievements.unlocked}/{entry.achievements.total}
                            </span>
                          </span>
                          <ProgressBar value={entry.achievements.unlocked} max={entry.achievements.total} label={`Erfolge ${game.title}`} />
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
