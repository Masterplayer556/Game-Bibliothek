"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { gameHref, GameCover } from "@/components/game-ui";
import { Icon, type IconName } from "@/components/Icon";
import { LibraryGate } from "@/components/LibraryGate";
import { sectionStyle, type Section } from "@/components/section";
import { Button, Card, isRare, Notice, readRareLimit, rareLimitLabel, Segmented } from "@/components/ui";
import { buildChronicle, chronicleYears, type ChronicleEvent, type ChronicleKind } from "@/core/chronicle";
import { ACHIEVEMENT_PLATFORM_LABEL, DEVICE_LABEL, formatHours, PLATFORM_LABEL } from "@/core/labels";
import type { Library } from "@/core/library";

type Filter = "all" | "start" | "hours" | "achievements";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Alles" },
  { id: "start", label: "Starts" },
  { id: "hours", label: "Stunden" },
  { id: "achievements", label: "Erfolge" },
];

const FILTER_KINDS: Record<Filter, ChronicleKind[] | null> = {
  all: null,
  start: ["start"],
  hours: ["milestone"],
  achievements: ["platinum", "complete", "rare"],
};

/** How each kind of event looks: icon and colour. */
const LOOK: Record<ChronicleKind, { icon: IconName; tone: Section }> = {
  start: { icon: "play", tone: "library" },
  milestone: { icon: "flag", tone: "stats" },
  complete: { icon: "trophy", tone: "achievements" },
  platinum: { icon: "crown", tone: "chronicle" },
  rare: { icon: "star", tone: "review" },
  device: { icon: "gamepad", tone: "platforms" },
  tracking: { icon: "sync", tone: "home" },
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Events shown at first; more come in steps of this size. */
const STEP = 60;

function dayLabel(date: string): string {
  return `${Number(date.slice(8, 10))}. ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

function deviceIcon(event: ChronicleEvent): IconName {
  if (event.device === "pc") return "monitor";
  if (event.device === "switch1" || event.device === "switch2") return "switch";
  return "gamepad";
}

function platformName(event: ChronicleEvent): string {
  return event.platform ? (ACHIEVEMENT_PLATFORM_LABEL[event.platform] ?? PLATFORM_LABEL[event.platform]) : "";
}

/** What an event says: a title and a line below it. */
function describe(event: ChronicleEvent, library: Library): { title: ReactNode; line: string } {
  const game = event.gameId ? library.byId.get(event.gameId) : undefined;
  const name = game?.title ?? "";
  switch (event.kind) {
    case "start":
      return { title: name, line: `Zum ersten Mal gespielt${game ? ` · ${game.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}` : ""}` };
    case "milestone":
      return {
        title: (
          <>
            <span className="num text-section">{event.hours}</span> Stunden in {name}
          </>
        ),
        line: event.estimated ? "Meilenstein · Tag teilweise geschätzt" : "Meilenstein",
      };
    case "complete":
      return { title: `Alle ${event.count} Erfolge`, line: `${name} · ${platformName(event)}` };
    case "platinum":
      return { title: "Platin-Trophäe", line: `${name}${event.achievement?.rarityPercent != null ? ` · ${event.achievement.rarityPercent.toLocaleString("de-CH")} % der Spieler` : ""}` };
    case "rare":
      return {
        title: event.achievement?.name ?? "Seltener Erfolg",
        line: `${name} · nur ${event.achievement?.rarityPercent?.toLocaleString("de-CH")} % der Spieler`,
      };
    case "device":
      return { title: `Erster Tag auf ${event.device ? DEVICE_LABEL[event.device] : "einem neuen Gerät"}`, line: name ? `Gespielt: ${name}` : "" };
    case "tracking":
      return { title: `${platformName(event)} wird erfasst`, line: "Ab hier zählt jeder Tag mit Datum" };
  }
}

function EventRow({ event, library }: { event: ChronicleEvent; library: Library }) {
  const look = LOOK[event.kind];
  const game = event.gameId ? library.byId.get(event.gameId) : undefined;
  const { title, line } = describe(event, library);
  const body = (
    <span className="card card-glow flex items-center gap-3 rounded-[1.1rem] p-2.5 pr-3">
      {game ? <GameCover game={game} className="w-11 shrink-0 !rounded-lg" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-bold leading-snug">{title}</span>
        {line ? <span className="mt-0.5 block truncate text-xs text-muted">{line}</span> : null}
      </span>
      <span className="shrink-0 self-start pt-0.5 text-[11px] font-semibold text-muted">{dayLabel(event.date)}</span>
    </span>
  );
  return (
    <li className="relative pl-12" style={sectionStyle(look.tone)}>
      <span className="icon-tile absolute left-0 top-2.5 z-[1] h-9 w-9 rounded-xl">
        <Icon name={event.kind === "device" ? deviceIcon(event) : look.icon} className="h-5 w-5" />
      </span>
      {game ? (
        <Link href={gameHref(game.id)} className="lift block rounded-[1.1rem]">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

export default function ChroniclePage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(STEP);

  return (
    <LibraryGate>
      {({ library, raw }) => {
        const rareLimit = readRareLimit(raw.settings);
        const all = buildChronicle(library, raw, { isRare: (p) => isRare(p, rareLimit) });
        const kinds = FILTER_KINDS[filter];
        const events = kinds ? all.filter((e) => kinds.includes(e.kind)) : all;
        const visible = events.slice(0, shown);
        const years = chronicleYears(library);
        const count = (list: ChronicleKind[]) => all.filter((e) => list.includes(e.kind)).length;

        if (all.length === 0) {
          return (
            <Card title="Noch leer" icon="chronicle">
              <Notice>Die Chronik füllt sich mit dem ersten Sync: Starts, Stunden-Meilensteine und Erfolge.</Notice>
            </Card>
          );
        }

        // Group: year → month → events
        const groups: { year: number; months: { month: string; events: ChronicleEvent[] }[] }[] = [];
        for (const e of visible) {
          const year = Number(e.date.slice(0, 4));
          const month = MONTHS[Number(e.date.slice(5, 7)) - 1]!;
          let y = groups.at(-1);
          if (!y || y.year !== year) {
            y = { year, months: [] };
            groups.push(y);
          }
          let m = y.months.at(-1);
          if (!m || m.month !== month) {
            m = { month, events: [] };
            y.months.push(m);
          }
          m.events.push(e);
        }

        return (
          <>
            <section className="hero p-5" aria-label="Chronik in Zahlen">
              <div className="relative z-[1] grid grid-cols-3 gap-3">
                {[
                  { label: "Starts", value: count(["start"]), icon: "play" as const },
                  { label: "Meilensteine", value: count(["milestone"]), icon: "flag" as const },
                  { label: "Erfolgs-Momente", value: count(["platinum", "complete", "rare"]), icon: "trophy" as const },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col gap-1.5">
                    <Icon name={f.icon} className="h-5 w-5 opacity-90" />
                    <div className="num text-[2rem] leading-none">{f.value}</div>
                    <div className="text-[11px] font-bold uppercase leading-tight tracking-wider opacity-85">{f.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-1.5">
              <Segmented label="Zeigen" options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setShown(STEP); }} />
              <span className="text-xs text-muted">
                Seltene Erfolge: die, die {rareLimitLabel(rareLimit)} der Spieler haben (einstellbar unter Erfolge).
              </span>
            </section>

            {events.length === 0 ? <Notice>Dafür gibt es noch keine Einträge.</Notice> : null}

            {groups.map((group) => {
              const summary = years.find((y) => y.year === group.year);
              const top = summary?.topGameId ? library.byId.get(summary.topGameId) : undefined;
              return (
                <section key={group.year} className="flex flex-col gap-4" aria-label={String(group.year)}>
                  <div className="flex items-end justify-between gap-3 px-1">
                    <h2 className="text-gradient font-display text-5xl font-extrabold leading-none tracking-tight">{group.year}</h2>
                    {summary ? (
                      <p className="pb-1 text-right text-xs text-muted">
                        <span className="num text-base text-text">{formatHours(summary.minutes)}</span> an {summary.playDays} Tagen
                        {top ? <span className="block truncate">am meisten: {top.title}</span> : null}
                      </p>
                    ) : null}
                  </div>
                  {group.months.map((m) => (
                    <div key={m.month} className="flex flex-col gap-2.5">
                      <h3 className="eyebrow pl-12">{m.month}</h3>
                      {/* The line of the timeline runs behind the icons. */}
                      <ol className="relative flex flex-col gap-2.5 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-[2.5px] before:rounded-full before:bg-linear-to-b before:from-[color-mix(in_oklab,var(--section)_60%,transparent)] before:to-[color-mix(in_oklab,var(--section-2)_25%,transparent)]">
                        {m.events.map((e) => (
                          <EventRow key={e.id} event={e} library={library} />
                        ))}
                      </ol>
                    </div>
                  ))}
                </section>
              );
            })}

            {events.length > shown ? (
              <div className="flex justify-center">
                <Button onClick={() => setShown((s) => s + STEP)} icon="chronicle">
                  Weiter zurück ({events.length - shown} mehr)
                </Button>
              </div>
            ) : null}
          </>
        );
      }}
    </LibraryGate>
  );
}
