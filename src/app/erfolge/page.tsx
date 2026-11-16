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
        const { rows, unlocked, total, games } = achievementSummary(library.games, active, raw.achievements);
        const nintendoOnly = library.games.filter((g) => !g.hidden && g.platforms.every((p) => p === "nintendo")).length;
        const shownEntries = new Map(
          rows.flatMap((r) =>
            r.game.entries
              .filter((e) => r.platforms.includes(e.platform) && (active === "all" || e.id === r.key))
              .map((e) => [e.id, { game: r.game, platform: e.platform }] as const),
          ),
        );
        const recent = raw.achievements
          .filter((a) => a.unlocked_at && shownEntries.has(a.platform_game_id))
          .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
          .slice(0, 8);
        const options = [
          { id: "all" as AchievementFilter, label: "Zusammen" },
          ...platforms.map((p) => ({ id: p as AchievementFilter, label: ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p] })),
        ];

        return (
          <>
            {platforms.length > 1 ? (
              <section className="flex flex-col gap-1">
                <Segmented label="Plattform" options={options} value={active} onChange={setFilter} />
                <span className="text-xs text-muted">
                  {active === "all"
                    ? "Gleiche Erfolge auf PC und PlayStation zählen einmal und gelten als geschafft, wenn sie auf einer der beiden freigeschaltet sind."
                    : "Nur diese Plattform: Eine Trophäe schaltet den Steam-Erfolg nicht frei und umgekehrt."}
                </span>
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
                    const row = shownEntries.get(a.platform_game_id)!;
                    return (
                      <li key={`${a.platform_game_id}-${a.external_id}`} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate">{a.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {row.game.title}
                            {active === "all" ? ` · ${ACHIEVEMENT_PLATFORM_LABEL[row.platform] ?? PLATFORM_LABEL[row.platform]}` : ""}
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
                  {rows.map(({ key, game, platforms: on, unlocked: done, total: of }) => (
                    <li key={key}>
                      <Link href={gameHref(game.id)} className="flex items-center gap-3">
                        <GameCover game={game} className="w-10 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex justify-between gap-2 text-sm">
                            <span className="truncate">
                              {game.title}
                              {active === "all" ? (
                                <span className="text-muted"> · {on.map((p) => ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p]).join(" + ")}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {done}/{of}
                            </span>
                          </span>
                          <ProgressBar value={done} max={of} label={`Erfolge ${game.title}`} />
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
