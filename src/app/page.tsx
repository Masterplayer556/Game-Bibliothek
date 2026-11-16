"use client";

import Link from "next/link";
import { CoverBackdrop, gameHref, GameCover, PlatformBadge, ShelfCover, formatDay, relativeAge } from "@/components/game-ui";
import { ShareBars } from "@/components/charts";
import { LibraryGate } from "@/components/LibraryGate";
import { PlayCalendar } from "@/components/PlayCalendar";
import { SyncStatusBar } from "@/components/SyncStatusBar";
import { Card, Notice, StatTile } from "@/components/ui";
import { formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import { lifetimeByPlatform, rangeEndingToday, topGames, totalInRange } from "@/core/library";
import { addDays, dateRange, monthKey, toLocalDate, weekStart } from "@/core/time";
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
          .slice(0, 7);
        // The game played last gets the stage; the others stand on the shelf below.
        const featured = recent[0];
        const fortnight = dateRange(addDays(today, -13), today).map((date) => ({
          date,
          minutes: library.days.filter((d) => d.gameId === featured?.id && d.date === date).reduce((s, d) => s + d.minutes, 0),
        }));
        const fortnightMax = Math.max(1, ...fortnight.map((d) => d.minutes));
        const topMax = Math.max(1, ...top.map((t) => t.minutes));

        if (visible.length === 0) {
          return (
            <>
              <SyncStatusBar connections={raw.connections} now={now} />
              <Card title="Noch keine Spiele">
                <Notice>
                  Verbinde eine Plattform oder lade Demo-Daten unter{" "}
                  <Link className="link" href="/plattformen/">
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
            {featured ? (
              <section aria-label="Zuletzt gespielt" className="relative overflow-hidden rounded-card border border-border-strong bg-surface shadow-card">
                <CoverBackdrop game={featured} />
                <div className="relative flex gap-4 p-card sm:gap-6 sm:p-6">
                  <Link href={gameHref(featured.id)} className="group w-28 shrink-0 self-start rounded-control sm:w-40">
                    <GameCover
                      game={featured}
                      bookmark={featured.favorite}
                      className="transition-transform duration-150 group-hover:-rotate-2 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:transform-none"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
                      Zuletzt gespielt · <span title={formatDay(featured.lastPlayedAt)}>{relativeAge(featured.lastPlayedAt, now)}</span>
                    </p>
                    <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                      <Link href={gameHref(featured.id)} className="rounded-control hover:text-accent">
                        {featured.title}
                      </Link>
                    </h2>
                    <div className="flex flex-wrap gap-1">
                      {featured.platforms.map((p) => (
                        <PlatformBadge key={p} platform={p} />
                      ))}
                    </div>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-2">
                      <dl className="flex flex-wrap gap-x-6 gap-y-2">
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">Spielzeit</dt>
                          <dd className="num text-3xl leading-none">{formatHours(featured.totalMinutes)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">14 Tage</dt>
                          <dd className="num text-3xl leading-none">{formatHours(fortnight.reduce((s, d) => s + d.minutes, 0))}</dd>
                        </div>
                        {featured.achievements ? (
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">Erfolge</dt>
                            <dd className="num text-3xl leading-none">
                              {featured.achievements.unlocked}
                              <span className="text-lg text-muted"> / {featured.achievements.total}</span>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="flex flex-col gap-1">
                        <div className="flex h-14 items-end gap-[3px]" role="img" aria-label={`Spielzeit von ${featured.title} in den letzten 14 Tagen`}>
                          {fortnight.map((d) => (
                            <span
                              key={d.date}
                              className={`w-2.5 rounded-t-[2px] sm:w-3.5 ${d.minutes > 0 ? "bg-section" : "bg-border-strong"}`}
                              style={{ height: d.minutes > 0 ? `${Math.max(12, (d.minutes / fortnightMax) * 100)}%` : "2px" }}
                              title={`${formatDay(d.date)}: ${d.minutes > 0 ? formatMinutes(d.minutes) : "nicht gespielt"}`}
                            />
                          ))}
                        </div>
                        <div className="text-[11px] text-muted">Letzte 14 Tage</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-stack sm:grid-cols-4">
              <StatTile label="Spiele" value={String(visible.length)} icon="book" />
              <StatTile label="Diese Woche" value={formatHours(week.minutes)} hint={week.estimated ? "teilweise geschätzt" : undefined} icon="calendar" />
              <StatTile label="Diesen Monat" value={formatHours(month.minutes)} hint={month.estimated ? "teilweise geschätzt" : undefined} icon="chart" />
              <StatTile
                icon="clock"
                label="Gesamt"
                value={formatHours(visible.reduce((s, g) => s + g.totalMinutes, 0))}
                hint="inkl. Zeit vor dem ersten Sync"
              />
            </section>
            {(() => {
              const apps = library.games.filter((g) => g.hidden && g.totalMinutes > 0);
              if (apps.length === 0) return null;
              const minutes = apps.reduce((s, g) => s + g.totalMinutes, 0);
              return (
                <Notice>
                  Dazu {formatHours(minutes)} in Apps wie {apps.slice(0, 2).map((a) => a.title).join(" und ")} (zählen nicht als
                  Spielzeit, Details unter <Link className="link" href="/statistiken/">Statistiken</Link>).
                </Notice>
              );
            })()}

            <Card title="Top 5 der letzten 30 Tage" icon="trophy">
              {top.length === 0 ? (
                <Notice>In den letzten 30 Tagen wurde nichts gespielt.</Notice>
              ) : (
                <ol className="flex flex-col gap-1">
                  {top.map((t, i) => {
                    const game = library.byId.get(t.gameId)!;
                    return (
                      <li key={t.gameId}>
                        <Link href={gameHref(game.id)} className="flex items-center gap-3 rounded-control p-1.5 hover:bg-surface-raised">
                          <span className={`num w-5 text-center leading-none ${i === 0 ? "text-3xl text-highlight" : "text-xl text-muted"}`}>{i + 1}</span>
                          <GameCover game={game} className={`shrink-0 ${i === 0 ? "w-14" : "w-10"}`} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className={`truncate ${i === 0 ? "font-display text-lg font-semibold" : "text-sm"}`}>{game.title}</span>
                              <span className="shrink-0 text-sm tabular-nums text-muted">
                                {formatMinutes(t.minutes)}
                                {t.estimated ? "*" : ""}
                              </span>
                            </span>
                            {/* How far behind the first place: a bar of blocks. */}
                            <span aria-hidden className="xp block h-1.5 overflow-hidden rounded-[2px] bg-surface-raised">
                              <span
                                className={`block h-full ${i === 0 ? "bg-highlight-fill" : "bg-section"}`}
                                style={{ width: `${Math.max(3, (t.minutes / topMax) * 100)}%` }}
                              />
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {top.some((t) => t.estimated) ? <Notice>* enthält geschätzte Werte</Notice> : null}
            </Card>

            <Card title="Spieltage" icon="calendar">
              <PlayCalendar days={library.days} today={today} byId={library.byId} />
            </Card>

            <Card title="Plattformen (gesamte Spielzeit)" icon="gamepad">
              <ShareBars
                shares={lifetimeByPlatform(visible)}
                label={(k) => PLATFORM_LABEL[k as PlatformId] ?? k}
                color={(k) => `var(--color-platform-${k})`}
              />
            </Card>

            <Card title="Davor gespielt" icon="book">
              <ul className="grid grid-cols-3 gap-stack sm:grid-cols-6">
                {recent.slice(1).map((g) => (
                  <li key={g.id}>
                    <Link href={gameHref(g.id)} className="group flex flex-col gap-1.5 rounded-control">
                      <ShelfCover game={g} bookmark={g.favorite} stamp={g.status} />
                      <span className="line-clamp-2 text-xs font-medium leading-tight group-hover:text-accent">{g.title}</span>
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
