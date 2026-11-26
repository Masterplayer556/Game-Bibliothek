"use client";

import Link from "next/link";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import { deviceTotals } from "@/core/library";
import { toLocalDate } from "@/core/time";
import type { DeviceKind, PlatformId } from "@/core/types";
import { ShareBars } from "./charts";
import { PlaytimeHistory } from "./PlaytimeHistory";
import { CoverBackdrop, formatDay, GameCover, PlatformBadge, shelfMark, STATUS_LOOK } from "./game-ui";
import { LibraryGate } from "./LibraryGate";
import { Card, Notice } from "./ui";
import { Achievements } from "./game-detail/Achievements";
import { Entries } from "./game-detail/Entries";
import { IgdbCard } from "./game-detail/IgdbCard";
import { MyData } from "./game-detail/MyData";

// The game page; each card of «my data», achievements, entries and IGDB has its own file.
export function GameDetail({ id }: { id: string }) {
  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const game = library.byId.get(id);
        if (!game) {
          return (
            <Card title="Spiel nicht gefunden" icon="search">
              <Notice>
                Vielleicht wurde es zusammengeführt oder gelöscht.{" "}
                <Link className="link" href="/bibliothek/">Zur Bibliothek</Link>
              </Notice>
            </Card>
          );
        }
        const today = toLocalDate(new Date());
        const gameDays = (game.hidden ? library.appDays : library.days).filter((d) => d.gameId === game.id);
        const totals = deviceTotals(game, game.hidden ? library.appDays : library.days);

        return (
          <>
            <section className="relative overflow-hidden rounded-card bg-[#1a1438] text-white shadow-[0_24px_48px_-24px_rgb(20_10_60/0.7)]">
              <CoverBackdrop game={game} />
              <div className="relative flex gap-4 p-4 sm:gap-6 sm:p-6">
                <GameCover game={game} favorite={game.favorite} className="w-32 shrink-0 self-start shadow-[0_18px_30px_-12px_rgb(0_0_0/0.7)] sm:w-44" eager />
                <div className="flex min-w-0 flex-col gap-2">
                  <span
                    className="self-start rounded-full border border-white/25 bg-white/12 px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-white/85"
                    title="Signatur: Plattform, Erscheinungsjahr, Titel"
                  >
                    <span className="sr-only">Signatur </span>
                    {shelfMark(game)}
                  </span>
                  <h2 className="font-display text-[1.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
                    {game.favorite ? <span className="sr-only">Favorit: </span> : null}
                    {game.title}
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {game.platforms.map((p) => <PlatformBadge key={p} platform={p} onDark />)}
                  </div>
                  {game.status ? (
                    <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${STATUS_LOOK[game.status]}`}>{STATUS_LABEL[game.status]}</span>
                  ) : null}
                </div>
              </div>
              <dl className="relative mx-4 mb-4 grid grid-cols-2 gap-3 rounded-[1.25rem] border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] sm:mx-6 sm:mb-6 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Spielzeit</dt>
                  <dd className="num mt-1 text-2xl leading-none" title={formatMinutes(game.totalMinutes)}>
                    {game.totalMinutes >= 60 ? formatHours(game.totalMinutes) : formatMinutes(game.totalMinutes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Zuletzt</dt>
                  <dd className="mt-1 text-sm font-semibold">{formatDay(game.lastPlayedAt)}</dd>
                </div>
                {game.achievements ? (
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Erfolge</dt>
                    <dd className="num mt-1 text-2xl leading-none">
                      {game.achievements.unlocked}
                      <span className="text-sm text-white/70"> / {game.achievements.total}</span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <Card title="Spielzeit nach Gerät" subtitle="Plattform und Konsole" icon="gamepad" tone="stats">
              {totals.length === 0 ? (
                <Notice>Noch keine Spielzeit erfasst.</Notice>
              ) : (
                <ShareBars
                  shares={totals.map((t) => ({ key: `${t.platform}|${t.deviceKind ?? ""}`, minutes: t.minutes }))}
                  label={(k) => {
                    const [platform, device] = k.split("|") as [PlatformId, DeviceKind | ""];
                    return device ? DEVICE_LABEL[device] : PLATFORM_LABEL[platform];
                  }}
                  color={(k) => {
                    const [platform, device] = k.split("|");
                    return device ? `var(--color-device-${device})` : `var(--color-platform-${platform})`;
                  }}
                />
              )}
            </Card>

            <Card title="Verlauf" icon="stats">
              {gameDays.length === 0 ? (
                <Notice>Noch kein Verlauf: Er beginnt mit dem ersten Sync nach dem Spielen.</Notice>
              ) : (
                <PlaytimeHistory key={game.id} days={gameDays} today={today} title={`Spielzeit von ${game.title}`} />
              )}
            </Card>

            <MyData key={`${game.id}-${game.note}`} game={game} userId={userId} reload={() => reload(["userData"])} />
            <Achievements game={game} raw={raw} />
            <Entries game={game} games={library.games} userId={userId} reload={() => reload(["games", "platformGames", "snapshots", "userData"])} />
            <IgdbCard game={game} reload={() => reload(["games", "platformGames", "userData"])} />
          </>
        );
      }}
    </LibraryGate>
  );
}
