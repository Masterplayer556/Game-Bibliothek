"use client";

import Link from "next/link";
import { gameHref, GameCover, formatDay, relativeAge } from "@/components/game-ui";
import { ShareBars } from "@/components/charts";
import { LibraryGate } from "@/components/LibraryGate";
import { SyncStatusBar } from "@/components/SyncStatusBar";
import { Card, Notice, StatTile } from "@/components/ui";
import { formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import { lifetimeByPlatform, rangeEndingToday, topGames, totalInRange } from "@/core/library";
import { monthKey, toLocalDate, weekStart } from "@/core/time";
import type { PlatformId } from "@/core/types";

export default function DashboardPage() {
  return (
    <LibraryGate>
      {({ library, raw }) => {
        const now = new Date();
        const today = toLocalDate(now);
        const week = totalInRange(library.days, { from: weekStart(today), to: today });
        const month = totalInRange(library.days, { from: `${monthKey(today)}-01`, to: today });
        const visible = library.games.filter((g) => !g.hidden);
        const top = topGames(library.days, rangeEndingToday(today, 30), 5);
        const recent = visible
          .filter((g) => g.lastPlayedAt)
          .sort((a, b) => (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""))
          .slice(0, 6);

        if (visible.length === 0) {
          return (
            <>
              <SyncStatusBar connections={raw.connections} now={now} />
              <Card title="Noch keine Spiele">
                <Notice>
                  Verbinde eine Plattform oder lade Demo-Daten unter{" "}
                  <Link className="underline" href="/plattformen/">
                    Plattformen
                  </Link>
                  .
                </Notice>
              </Card>
            </>
          );
        }

        return (
          <>
            <SyncStatusBar connections={raw.connections} now={now} />
            <section className="grid grid-cols-2 gap-stack sm:grid-cols-4">
              <StatTile label="Spiele" value={String(visible.length)} />
              <StatTile label="Diese Woche" value={formatHours(week.minutes)} hint={week.estimated ? "teilweise geschätzt" : undefined} />
              <StatTile label="Diesen Monat" value={formatHours(month.minutes)} hint={month.estimated ? "teilweise geschätzt" : undefined} />
              <StatTile
                label="Gesamt"
                value={formatHours(visible.reduce((s, g) => s + g.totalMinutes, 0))}
                hint="inkl. Zeit vor dem ersten Sync"
              />
            </section>

            <Card title="Top 5 der letzten 30 Tage">
              {top.length === 0 ? (
                <Notice>In den letzten 30 Tagen wurde nichts gespielt.</Notice>
              ) : (
                <ol className="flex flex-col gap-1">
                  {top.map((t, i) => {
                    const game = library.byId.get(t.gameId)!;
                    return (
                      <li key={t.gameId}>
                        <Link href={gameHref(game.id)} className="flex items-center gap-3 rounded-control p-1.5 hover:bg-surface-raised">
                          <span className="w-4 text-sm text-muted">{i + 1}</span>
                          <GameCover game={game} className="w-10 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm">{game.title}</span>
                          <span className="text-sm tabular-nums text-muted">
                            {formatMinutes(t.minutes)}
                            {t.estimated ? "*" : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {top.some((t) => t.estimated) ? <Notice>* enthält geschätzte Werte</Notice> : null}
            </Card>

            <Card title="Plattformen (gesamte Spielzeit)">
              <ShareBars
                shares={lifetimeByPlatform(visible)}
                label={(k) => PLATFORM_LABEL[k as PlatformId] ?? k}
                color={(k) => `var(--color-platform-${k})`}
              />
            </Card>

            <Card title="Zuletzt gespielt">
              <ul className="grid grid-cols-3 gap-stack sm:grid-cols-6">
                {recent.map((g) => (
                  <li key={g.id}>
                    <Link href={gameHref(g.id)} className="flex flex-col gap-1">
                      <GameCover game={g} />
                      <span className="line-clamp-2 text-xs leading-tight">{g.title}</span>
                      <span className="text-[11px] text-muted" title={formatDay(g.lastPlayedAt)}>
                        {relativeAge(g.lastPlayedAt, now)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
