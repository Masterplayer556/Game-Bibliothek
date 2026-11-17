"use client";

import Link from "next/link";
import { CoverBackdrop, formatDay, gameHref, GameCover, PlatformBadge, PlatformDots, relativeAge } from "@/components/game-ui";
import { ShareBars } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { LibraryGate } from "@/components/LibraryGate";
import { PlayCalendar } from "@/components/PlayCalendar";
import { SyncStatusBar } from "@/components/SyncStatusBar";
import { Card, Figure, Notice, StatTile } from "@/components/ui";
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
          .slice(0, 9);
        // The game played last gets the stage; the others follow in a row below.
        const featured = recent[0];
        const fortnightStart = addDays(today, -13);
        const featuredMinutes = new Map<string, number>();
        for (const d of library.days) {
          if (d.gameId === featured?.id && d.date >= fortnightStart) featuredMinutes.set(d.date, (featuredMinutes.get(d.date) ?? 0) + d.minutes);
        }
        const fortnight = dateRange(fortnightStart, today).map((date) => ({ date, minutes: featuredMinutes.get(date) ?? 0 }));
        const fortnightMax = Math.max(1, ...fortnight.map((d) => d.minutes));
        const topMax = Math.max(1, ...top.map((t) => t.minutes));

        if (visible.length === 0) {
          return (
            <>
              <SyncStatusBar connections={raw.connections} now={now} />
              <Card title="Noch keine Spiele" icon="gamepad">
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
              <section aria-label="Zuletzt gespielt" className="relative overflow-hidden rounded-card bg-[#1a1438] text-white shadow-[0_24px_48px_-24px_rgb(20_10_60/0.7)]">
                <CoverBackdrop game={featured} />
                <div className="relative flex flex-col gap-4 p-4 sm:p-6">
                  <div className="flex gap-4 sm:gap-6">
                    <Link href={gameHref(featured.id)} className="group w-28 shrink-0 self-start rounded-control sm:w-40">
                      <GameCover game={featured} favorite={featured.favorite} className="tilt shadow-[0_18px_30px_-12px_rgb(0_0_0/0.7)]" eager />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                        <span className="h-2 w-2 rounded-full bg-[#3dff9a] shadow-[0_0_10px_#3dff9a] motion-safe:animate-[pulse-dot_1.6s_ease-in-out_infinite]" aria-hidden />
                        Zuletzt gespielt
                      </p>
                      <h2 className="font-display text-[1.65rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
                        <Link href={gameHref(featured.id)} className="rounded-control">
                          {featured.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-white/75" title={formatDay(featured.lastPlayedAt)}>
                        {relativeAge(featured.lastPlayedAt, now)}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {featured.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} onDark />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-[1.25rem] border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
                    <dl className="flex flex-wrap gap-x-6 gap-y-3">
                      <Figure label="Spielzeit" value={formatHours(featured.totalMinutes).replace(" Std.", "")} unit="Std." />
                      <Figure label="14 Tage" value={formatHours(fortnight.reduce((s, d) => s + d.minutes, 0)).replace(" Std.", "")} unit="Std." />
                      {featured.achievements ? (
                        <Figure label="Erfolge" value={featured.achievements.unlocked} unit={`/ ${featured.achievements.total}`} />
                      ) : null}
                    </dl>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex h-12 items-end gap-[3px]" role="img" aria-label={`Spielzeit von ${featured.title} in den letzten 14 Tagen`}>
                        {fortnight.map((d) => (
                          <span
                            key={d.date}
                            className={`w-2.5 rounded-full sm:w-3.5 ${d.minutes > 0 ? "bg-linear-to-t from-[var(--section)] to-[#ffffff]" : "bg-white/25"}`}
                            style={{ height: d.minutes > 0 ? `${Math.max(14, (d.minutes / fortnightMax) * 100)}%` : "4px" }}
                            title={`${formatDay(d.date)}: ${d.minutes > 0 ? formatMinutes(d.minutes) : "nicht gespielt"}`}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] font-medium text-white/70">Letzte 14 Tage</div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-stack sm:grid-cols-4">
              <StatTile label="Spiele" value={String(visible.length)} icon="library" tone="library" />
              <StatTile label="Diese Woche" value={formatHours(week.minutes)} hint={week.estimated ? "teilweise geschätzt" : undefined} icon="calendar" tone="stats" />
              <StatTile label="Diesen Monat" value={formatHours(month.minutes)} hint={month.estimated ? "teilweise geschätzt" : undefined} icon="stats" tone="review" />
              <StatTile icon="clock" label="Gesamt" value={formatHours(visible.reduce((s, g) => s + g.totalMinutes, 0))} hint="inkl. Zeit vor dem ersten Sync" tone="achievements" />
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

            {recent.length > 1 ? (
              <Card title="Davor gespielt" icon="play" tone="library">
                {/* A row to swipe through, like a shelf in a game store. */}
                <ul className="-mx-card -my-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-card py-1 sm:-mx-5 sm:px-5" style={{ scrollbarWidth: "none" }}>
                  {recent.slice(1).map((g) => (
                    <li key={g.id} className="w-[6.6rem] shrink-0 snap-start">
                      <Link href={gameHref(g.id)} className="group flex flex-col gap-1.5 rounded-control">
                        <GameCover game={g} favorite={g.favorite} status={g.status} className="tilt" />
                        <span className="line-clamp-2 text-xs font-semibold leading-tight group-hover:text-section">{g.title}</span>
                        <span className="text-[11px] text-muted" title={formatDay(g.lastPlayedAt)}>
                          {relativeAge(g.lastPlayedAt, now)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card title="Top 5" subtitle="Die letzten 30 Tage" icon="trophy" tone="achievements">
              {top.length === 0 ? (
                <Notice>In den letzten 30 Tagen wurde nichts gespielt.</Notice>
              ) : (
                <ol className="-mx-1.5 flex flex-col gap-1">
                  {top.map((t, i) => {
                    const game = library.byId.get(t.gameId)!;
                    return (
                      <li key={t.gameId}>
                        <Link href={gameHref(game.id)} className="group flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-section-soft">
                          <span
                            className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base leading-none ${
                              i === 0 ? "icon-tile" : "bg-[color-mix(in_oklab,var(--color-text)_7%,transparent)] text-muted"
                            }`}
                          >
                            {i === 0 ? <Icon name="crown" className="h-[18px] w-[18px]" /> : i + 1}
                          </span>
                          <GameCover game={game} className={`shrink-0 !rounded-lg ${i === 0 ? "w-14" : "w-11"}`} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className={`truncate group-hover:text-section ${i === 0 ? "font-display text-lg font-bold" : "text-sm font-semibold"}`}>{game.title}</span>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
                                {formatMinutes(t.minutes)}
                                {t.estimated ? "*" : ""}
                              </span>
                            </span>
                            {/* How far behind the first place. */}
                            <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-text)_8%,transparent)]">
                              <span className="block h-full rounded-full bg-section" style={{ width: `${Math.max(4, (t.minutes / topMax) * 100)}%` }} />
                            </span>
                            <PlatformDots platforms={game.platforms} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {top.some((t) => t.estimated) ? <Notice>* enthält geschätzte Werte</Notice> : null}
            </Card>

            <Card title="Spieltage" subtitle="Ein Feld pro Tag, dunkler = länger gespielt" icon="calendar">
              <PlayCalendar days={library.days} today={today} byId={library.byId} />
            </Card>

            <Card title="Plattformen" subtitle="Gesamte Spielzeit" icon="gamepad" tone="platforms">
              <ShareBars
                shares={lifetimeByPlatform(visible)}
                label={(k) => PLATFORM_LABEL[k as PlatformId] ?? k}
                color={(k) => `var(--color-platform-${k})`}
              />
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
