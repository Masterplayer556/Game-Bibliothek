"use client";

import Link from "next/link";
import { useState } from "react";
import { ShareBars } from "@/components/charts";
import { formatDay, gameHref } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { PlaytimeHistory } from "@/components/PlaytimeHistory";
import { Card, fieldClass, Notice, StatTile } from "@/components/ui";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import { distribution, topGames, totalInRange, type Range } from "@/core/library";
import { addDays, toLocalDate } from "@/core/time";
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
  const [rangeKey, setRangeKey] = useState<RangeKey>("12m");

  return (
    <LibraryGate>
      {({ library }) => {
        const today = toLocalDate(new Date());
        const range = rangeFor(rangeKey, today, library.days[0]?.date);
        const total = totalInRange(library.days, range);
        const top = topGames(library.days, range, 10);
        const playedDays = new Set(library.days.filter((d) => d.date >= range.from && d.date <= range.to).map((d) => d.date)).size;
        const coverage = Object.entries(library.dataSince) as [PlatformId, LocalDate][];

        return (
          <>
            <Card title="Verlauf">
              {library.days.length === 0 ? (
                <Notice>Noch keine Spielzeit erfasst.</Notice>
              ) : (
                <PlaytimeHistory days={library.days} today={today} title="Spielzeit aller Spiele" />
              )}
            </Card>

            <section className="flex flex-col gap-1" aria-label="Zeitraum">
              <select className={fieldClass} aria-label="Zeitraum" value={rangeKey} onChange={(e) => setRangeKey(e.target.value as RangeKey)}>
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                  <option key={k} value={k}>{RANGE_LABEL[k]}</option>
                ))}
              </select>
              <span className="text-xs text-muted">Gilt für die Zahlen und Listen darunter.</span>
            </section>

            <section className="grid grid-cols-2 gap-stack sm:grid-cols-3">
              <StatTile label="Spielzeit" value={formatHours(total.minutes)} hint={total.estimated ? "teilweise geschätzt" : undefined} />
              <StatTile label="Spieltage" value={String(playedDays)} />
              <StatTile label="Verschiedene Spiele" value={String(topGames(library.days, range, 10_000).length)} />
            </section>

            <Card title="Top-Spiele">
              {top.length === 0 ? (
                <Notice>Keine Spielzeit im gewählten Zeitraum.</Notice>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {top.map((t, i) => (
                    <li key={t.gameId} className="flex justify-between gap-2">
                      <Link href={gameHref(t.gameId)} className="flex min-w-0 items-baseline gap-2 hover:text-accent">
                        <span className={`num w-5 shrink-0 text-right text-lg leading-none ${i === 0 ? "text-highlight" : "text-muted"}`}>{i + 1}</span>
                        <span className="truncate">{library.byId.get(t.gameId)?.title}</span>
                      </Link>
                      <span className="shrink-0 tabular-nums text-muted">
                        {formatMinutes(t.minutes)}
                        {t.estimated ? "*" : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Plattformen">
              <ShareBars
                shares={distribution(library.days, range, "platform", library.byId)}
                label={(k) => PLATFORM_LABEL[k as PlatformId] ?? k}
                color={(k) => `var(--color-platform-${k})`}
              />
            </Card>

            <Card title="Geräte">
              <ShareBars
                shares={distribution(library.days, range, "device", library.byId)}
                label={(k) => DEVICE_LABEL[k as DeviceKind] ?? k}
                color={(k) => `var(--color-device-${k})`}
              />
            </Card>

            <Card title="Genres">
              <ShareBars
                shares={distribution(library.days, range, "genre", library.byId)}
                label={(k) => k}
                color={() => "var(--color-chart-bar)"}
              />
              <Notice>Genres kommen von IGDB. Ein Spiel mit mehreren Genres zählt bei jedem.</Notice>
            </Card>

            <Card title="Apps (kein Spiel)">
              {(() => {
                const apps = topGames(library.appDays, range, 50);
                if (apps.length === 0) return <Notice>Keine App-Zeit im gewählten Zeitraum.</Notice>;
                return (
                  <>
                    <Notice>
                      Zählt nicht zur Spielzeit oben. Zusammen {formatHours(apps.reduce((s, a) => s + a.minutes, 0))}.
                    </Notice>
                    <ul className="flex flex-col gap-1 text-sm">
                      {apps.map((a) => (
                        <li key={a.gameId} className="flex justify-between gap-2">
                          <Link href={gameHref(a.gameId)} className="truncate hover:text-accent">
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

            <Card title="Datenbasis">
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
