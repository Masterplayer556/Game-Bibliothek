"use client";

import Link from "next/link";
import { useState } from "react";
import { ShareBars } from "@/components/charts";
import { formatDay, gameHref, GameCover } from "@/components/game-ui";
import { Icon } from "@/components/Icon";
import { LibraryGate } from "@/components/LibraryGate";
import { PlayCalendar } from "@/components/PlayCalendar";
import { PlaytimeHistory } from "@/components/PlaytimeHistory";
import { Card, fieldClass, Notice, StatTile } from "@/components/ui";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import {
  countsAppsInTotal,
  distribution,
  lifetimeDistribution,
  lifetimeTopGames,
  topGames,
  totalInRange,
  undatedTime,
  type Grouping,
  type Range,
} from "@/core/library";
import { addDays, toLocalDate } from "@/core/time";
import { errorMessage } from "@/lib/errors";
import { saveSettings } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import type { DeviceKind, LocalDate, PlatformId } from "@/core/types";

type RangeKey = "30d" | "3m" | "6m" | "12m" | "year" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  "30d": "Letzte 30 Tage",
  "3m": "Letzte 3 Monate",
  "6m": "Letzte 6 Monate",
  "12m": "Letzte 12 Monate",
  year: "Dieses Jahr",
  all: "Alles",
};

function rangeFor(key: RangeKey, today: LocalDate, firstDay: LocalDate | undefined): Range {
  switch (key) {
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "3m":
      return { from: addDays(today, -91), to: today };
    case "6m":
      return { from: addDays(today, -182), to: today };
    case "12m":
      return { from: addDays(today, -364), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { from: firstDay ?? today, to: today };
  }
}

export default function StatisticsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [savingApps, setSavingApps] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);

  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const today = toLocalDate(new Date());
        const range = rangeFor(rangeKey, today, library.days[0]?.date);
        // «Alles» also counts what was played before the first sync: the platforms report it in
        // their totals, but without a date, so it cannot appear in any shorter range.
        const everything = rangeKey === "all";
        const undated = everything ? undatedTime(library.games, library.days) : [];
        const undatedMinutes = undated.reduce((sum, u) => sum + u.minutes, 0);
        const dated = totalInRange(library.days, range);
        // «App-Zeit mitzählen»: the total adds the time in apps; everything else stays games only.
        const withApps = countsAppsInTotal(raw.settings);
        const appDated = totalInRange(library.appDays, range);
        const appUndated = everything ? undatedTime(library.games, library.appDays, "apps").reduce((sum, u) => sum + u.minutes, 0) : 0;
        const appMinutes = appDated.minutes + appUndated;
        const total = withApps
          ? { minutes: dated.minutes + undatedMinutes + appMinutes, estimated: dated.estimated || appDated.estimated }
          : { minutes: dated.minutes + undatedMinutes, estimated: dated.estimated };
        const toggleApps = async (on: boolean) => {
          setSavingApps(true);
          setAppsError(null);
          try {
            await saveSettings(getSupabase(), userId, { ...raw.settings, countAppsInTotal: on });
            await reload(["settings"]);
          } catch (e) {
            setAppsError(errorMessage(e));
          }
          setSavingApps(false);
        };
        const ranked = everything ? lifetimeTopGames(library.days, undated, 10_000) : topGames(library.days, range, 10_000);
        const top = ranked.slice(0, 10);
        const shares = (by: Grouping) =>
          everything ? lifetimeDistribution(library.days, undated, by, library.byId) : distribution(library.days, range, by, library.byId);
        // Platforms whose day-by-day data starts inside the chosen range.
        const lateStart = (Object.entries(library.dataSince) as [PlatformId, LocalDate][]).filter(([, since]) => !everything && since > range.from);
        const playedDays = new Set(library.days.filter((d) => d.date >= range.from && d.date <= range.to).map((d) => d.date)).size;
        const coverage = Object.entries(library.dataSince) as [PlatformId, LocalDate][];

        return (
          <>
            <Card title="Verlauf" subtitle="Ziehen oder ‹ › für frühere Zeiten" icon="stats">
              {library.days.length === 0 ? (
                <Notice>Noch keine Spielzeit erfasst.</Notice>
              ) : (
                <PlaytimeHistory days={library.days} today={today} title="Spielzeit aller Spiele" />
              )}
            </Card>

            {library.days.length > 0 ? (
              <Card title="Spieltage" subtitle="Ein Feld pro Tag" icon="calendar">
                <PlayCalendar days={library.days} today={today} byId={library.byId} />
              </Card>
            ) : null}

            <section className="flex flex-col gap-1.5" aria-label="Zeitraum">
              <label className="flex items-center gap-3">
                <span className="icon-tile h-9 w-9 rounded-xl">
                  <Icon name="filter" className="h-5 w-5" />
                </span>
                <select className={`${fieldClass} min-w-0 flex-1 !rounded-full font-semibold`} aria-label="Zeitraum" value={rangeKey} onChange={(e) => setRangeKey(e.target.value as RangeKey)}>
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                  <option key={k} value={k}>{RANGE_LABEL[k]}</option>
                ))}
              </select>
              </label>
              <span className="text-xs text-muted">
                Gilt für die Zahlen und Listen darunter.
                {everything && undatedMinutes > 0
                  ? ` «Alles» zählt auch ${formatHours(undatedMinutes)} aus der Zeit vor dem ersten Sync mit (ohne Datum).`
                  : ""}
              </span>
              {lateStart.length > 0 ? (
                <Notice tone="warning">
                  Tageswerte gibt es erst seit dem ersten Sync: {lateStart.map(([p, since]) => `${PLATFORM_LABEL[p]} ab ${formatDay(since)}`).join(", ")}.
                  Was davor gespielt wurde, hat kein Datum und zählt nur unter «Alles».
                </Notice>
              ) : null}
            </section>

            <section className="grid grid-cols-2 gap-stack sm:grid-cols-3">
              <StatTile
                label="Spielzeit"
                value={formatHours(total.minutes)}
                hint={[withApps && appMinutes > 0 ? "mit Apps" : "", total.estimated ? "teilweise geschätzt" : ""].filter(Boolean).join(", ") || undefined}
                icon="clock"
                tone="stats"
              />
              <StatTile label="Spieltage" value={String(playedDays)} icon="calendar" hint={everything && undatedMinutes > 0 ? "nur Tage mit Datum" : undefined} tone="chronicle" />
              <div className="col-span-2 sm:col-span-1">
                <StatTile label="Verschiedene Spiele" value={String(ranked.length)} icon="library" tone="library" />
              </div>
            </section>

            <Card title="Top-Spiele" subtitle={RANGE_LABEL[rangeKey]} icon="trophy" tone="achievements">
              {top.length === 0 ? (
                <Notice>Keine Spielzeit im gewählten Zeitraum.</Notice>
              ) : (
                <ol className="-mx-1.5 flex flex-col gap-0.5 text-sm">
                  {top.map((t, i) => {
                    const game = library.byId.get(t.gameId);
                    return (
                      <li key={t.gameId}>
                        <Link href={gameHref(t.gameId)} className="group flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-section-soft">
                          <span className={`num w-6 shrink-0 text-center text-lg leading-none ${i < 3 ? "text-section" : "text-muted"}`}>{i + 1}</span>
                          {game ? <GameCover game={game} className="w-9 shrink-0 !rounded-md" /> : null}
                          <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-section">{game?.title}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-muted">
                            {formatMinutes(t.minutes)}
                            {t.estimated ? "*" : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>

            <Card title="Plattformen" icon="gamepad" tone="platforms">
              <ShareBars
                shares={shares("platform")}
                label={(k) => PLATFORM_LABEL[k as PlatformId] ?? k}
                color={(k) => `var(--color-platform-${k})`}
              />
            </Card>

            <Card title="Geräte" icon="switch" tone="chronicle">
              <ShareBars
                shares={shares("device")}
                label={(k) => DEVICE_LABEL[k as DeviceKind] ?? k}
                color={(k) => `var(--color-device-${k})`}
              />
            </Card>

            <Card title="Genres" icon="library" tone="review">
              <ShareBars
                shares={shares("genre")}
                label={(k) => k}
                color={() => "var(--section)"}
              />
              <Notice>Genres kommen von IGDB. Ein Spiel mit mehreren Genres zählt bei jedem.</Notice>
            </Card>

            <Card title="Apps (kein Spiel)" icon="play" tone="home">
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={withApps} disabled={savingApps} onChange={(e) => void toggleApps(e.target.checked)} />
                App-Zeit in der Spielzeit mitzählen
              </label>
              {appsError ? <Notice tone="danger">{appsError}</Notice> : null}
              {(() => {
                const apps = topGames(library.appDays, range, 50);
                if (apps.length === 0) return <Notice>Keine App-Zeit im gewählten Zeitraum.</Notice>;
                return (
                  <>
                    <Notice>
                      {withApps ? "Zählt zur Spielzeit oben" : "Zählt nicht zur Spielzeit oben"} (Ranglisten und Diagramme
                      bleiben nur Spiele). Zusammen {formatHours(apps.reduce((s, a) => s + a.minutes, 0))}.
                    </Notice>
                    <ul className="flex flex-col gap-1 text-sm">
                      {apps.map((a) => (
                        <li key={a.gameId} className="flex justify-between gap-2">
                          <Link href={gameHref(a.gameId)} className="truncate hover:text-section">
                            {library.byId.get(a.gameId)?.title}
                          </Link>
                          <span className="shrink-0 tabular-nums text-muted">{formatMinutes(a.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </Card>

            <Card title="Datenbasis" icon="info" tone="add">
              <Notice>
                Spielzeit pro Tag gibt es erst ab dem ersten Sync einer Plattform. Lücken davor heissen
                nicht «nicht gespielt». * markiert geschätzte Werte (z. B. mehrere Tage zwischen zwei
                Syncs oder «Für kurze Zeit» aus dem Import), hellere Balken sind grösstenteils geschätzt.
              </Notice>
              <ul className="text-sm">
                {coverage.length === 0 ? <li className="text-muted">Noch keine Daten.</li> : null}
                {coverage.map(([platform, since]) => (
                  <li key={platform}>
                    {PLATFORM_LABEL[platform]}: Daten ab {formatDay(since)}
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
