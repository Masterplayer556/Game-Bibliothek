"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import type { Library } from "@/core/library";
import type { DeviceKind, PlatformId } from "@/core/types";
import type { WrappedYear } from "@/core/wrapped";
import { exportCard } from "@/lib/export-image";
import { formatDay } from "./game-ui";
import { Button } from "./ui";

interface CardDef {
  id: string;
  accent: string;
  estimated?: boolean;
  body: ReactNode;
}

function Big({ children }: { children: ReactNode }) {
  return <div className="text-5xl font-bold leading-none tabular-nums">{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-sm uppercase tracking-wide text-muted">{children}</div>;
}

function CardFrame({ card, year, index, count }: { card: CardDef; year: number; index: number; count: number }) {
  return (
    <div className="flex aspect-[9/16] w-full flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="h-2 shrink-0" style={{ background: card.accent }} />
      <div className="flex flex-1 flex-col justify-center gap-5 p-6">{card.body}</div>
      <div className="flex shrink-0 justify-between px-6 pb-4 text-[11px] text-muted">
        <span>Game Bibliothek Wrapped {year}</span>
        <span>
          {card.estimated ? "* geschätzt · " : ""}
          {index + 1}/{count}
        </span>
      </div>
    </div>
  );
}

function title(library: Library, id: string): string {
  return library.byId.get(id)?.title ?? "Unbekannt";
}

function buildCards(w: WrappedYear, library: Library): CardDef[] {
  const cards: CardDef[] = [];
  const star = (estimated: boolean) => (estimated ? "*" : "");

  cards.push({
    id: "intro",
    accent: "var(--color-chart-1)",
    estimated: w.estimated,
    body: (
      <>
        <Label>Dein Spielejahr</Label>
        <Big>{w.year}</Big>
        <p className="text-lg">
          {formatHours(w.totalMinutes)}
          {star(w.estimated)} an {w.playDays} Tagen
        </p>
      </>
    ),
  });

  if (w.previousYear) {
    const prev = w.previousYear.minutes;
    const change = prev > 0 ? Math.round(((w.totalMinutes - prev) / prev) * 100) : null;
    cards.push({
      id: "compare",
      accent: "var(--color-chart-2)",
      estimated: w.estimated,
      body: (
        <>
          <Label>Gesamtspielzeit</Label>
          <Big>{formatHours(w.totalMinutes)}</Big>
          <p className="text-lg">
            {change === null
              ? `${w.year - 1} wurde noch nichts erfasst.`
              : `${change >= 0 ? "+" : ""}${change} % gegenüber ${w.year - 1} (${formatHours(prev)})`}
          </p>
          {w.previousYear.partial ? <p className="text-sm text-muted">{w.year - 1} ist nur teilweise erfasst.</p> : null}
        </>
      ),
    });
  }

  if (w.top.length > 0) {
    cards.push({
      id: "top",
      accent: "var(--color-chart-3)",
      estimated: w.top.some((t) => t.estimated),
      body: (
        <>
          <Label>Deine Top {w.top.length}</Label>
          <ol className="flex flex-col gap-3">
            {w.top.map((t, i) => (
              <li key={t.gameId} className="flex items-baseline gap-3">
                <span className="w-6 text-2xl font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-lg font-medium leading-tight">{title(library, t.gameId)}</span>
                  <span className="text-sm text-muted">
                    {formatHours(t.minutes)}
                    {star(t.estimated)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  if (w.favoritePlatform || w.favoriteDevice) {
    const total = w.totalMinutes || 1;
    cards.push({
      id: "favorites",
      accent: "var(--color-chart-4)",
      body: (
        <>
          {w.favoritePlatform ? (
            <div className="flex flex-col gap-1">
              <Label>Lieblingsplattform</Label>
              <div className="text-3xl font-bold">{PLATFORM_LABEL[w.favoritePlatform.key as PlatformId] ?? w.favoritePlatform.key}</div>
              <p className="text-muted">{Math.round((w.favoritePlatform.minutes / total) * 100)} % deiner Spielzeit</p>
            </div>
          ) : null}
          {w.favoriteDevice ? (
            <div className="flex flex-col gap-1">
              <Label>Lieblingsgerät</Label>
              <div className="text-3xl font-bold">{DEVICE_LABEL[w.favoriteDevice.key as DeviceKind] ?? w.favoriteDevice.key}</div>
              <p className="text-muted">{formatHours(w.favoriteDevice.minutes)}</p>
            </div>
          ) : null}
        </>
      ),
    });
  }

  cards.push({
    id: "genre",
    accent: "var(--color-chart-5)",
    body: w.favoriteGenre ? (
      <>
        <Label>Lieblings-Genre</Label>
        <div className="text-4xl font-bold">{w.favoriteGenre.key}</div>
        <p className="text-lg">{formatHours(w.favoriteGenre.minutes)}</p>
      </>
    ) : (
      <>
        <Label>Lieblings-Genre</Label>
        <p className="text-lg">Noch unbekannt: Die Genres kommen mit der IGDB-Anbindung.</p>
      </>
    ),
  });

  if (w.bestDay || w.longestStreak) {
    cards.push({
      id: "days",
      accent: "var(--color-chart-6)",
      estimated: (w.bestDay?.estimated ?? false) || (w.longestStreak?.estimated ?? false),
      body: (
        <>
          {w.bestDay ? (
            <div className="flex flex-col gap-1">
              <Label>Dein Rekordtag</Label>
              <div className="text-3xl font-bold">{formatDay(w.bestDay.date)}</div>
              <p>
                {formatMinutes(w.bestDay.minutes)}
                {star(w.bestDay.estimated)}, vor allem {title(library, w.bestDay.gameIds[0]!)}
              </p>
            </div>
          ) : null}
          {w.longestStreak ? (
            <div className="flex flex-col gap-1">
              <Label>Längste Serie</Label>
              <div className="text-3xl font-bold">
                {w.longestStreak.days} {w.longestStreak.days === 1 ? "Tag" : "Tage"} am Stück
              </div>
              <p className="text-muted">
                {formatDay(w.longestStreak.from)} bis {formatDay(w.longestStreak.to)}
              </p>
            </div>
          ) : null}
        </>
      ),
    });
  }

  if (w.newGames.length > 0) {
    cards.push({
      id: "new",
      accent: "var(--color-chart-7)",
      body: (
        <>
          <Label>Neu angefangen</Label>
          <Big>{w.newGames.length}</Big>
          <ul className="flex flex-col gap-1 text-lg">
            {w.newGames.slice(0, 6).map((id) => (
              <li key={id} className="truncate">{title(library, id)}</li>
            ))}
            {w.newGames.length > 6 ? <li className="text-muted">und {w.newGames.length - 6} weitere</li> : null}
          </ul>
        </>
      ),
    });
  }

  cards.push({
    id: "achievements",
    accent: "var(--color-chart-8)",
    body:
      w.achievements.unlocked > 0 ? (
        <>
          <Label>Erfolge und Trophäen</Label>
          <Big>{w.achievements.unlocked}</Big>
          <p className="text-lg">freigeschaltet</p>
          {w.achievements.rarest ? (
            <div className="flex flex-col gap-1">
              <Label>Die seltenste</Label>
              <div className="text-xl font-semibold">{w.achievements.rarest.name}</div>
              <p className="text-muted">
                {title(library, w.achievements.rarest.gameId)} · nur {w.achievements.rarest.rarity_percent} % der Spieler
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Label>Erfolge und Trophäen</Label>
          <p className="text-lg">In diesem Jahr wurden keine Erfolge erfasst.</p>
        </>
      ),
  });

  if (w.pileExits.length > 0) {
    cards.push({
      id: "pile",
      accent: "var(--color-chart-1)",
      body: (
        <>
          <Label>Aus dem Pile of Shame geholt</Label>
          <Big>{w.pileExits.length}</Big>
          <ul className="flex flex-col gap-1 text-lg">
            {w.pileExits.slice(0, 6).map((e) => (
              <li key={e.gameId} className="flex justify-between gap-2">
                <span className="truncate">{title(library, e.gameId)}</span>
                <span className="shrink-0 text-muted">+{formatHours(e.minutesInYear)}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  if (w.coverageGaps.length > 0) {
    cards.push({
      id: "coverage",
      accent: "var(--color-border)",
      body: (
        <>
          <Label>Gut zu wissen</Label>
          <p className="text-lg">Nicht jede Plattform war das ganze Jahr erfasst:</p>
          <ul className="flex flex-col gap-1">
            {w.coverageGaps.map((g) => (
              <li key={g.platform}>
                {PLATFORM_LABEL[g.platform]}: erst ab {formatDay(g.since)}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Die Werte dieses Jahres sind dort entsprechend tiefer.</p>
        </>
      ),
    });
  }
  return cards;
}

export function WrappedCards({ wrapped, library }: { wrapped: WrappedYear; library: Library }) {
  const cards = buildCards(wrapped, library);
  const scroller = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  function goTo(index: number) {
    const target = Math.max(0, Math.min(cards.length - 1, index));
    setCurrent(target);
    cardRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  // The card that is mostly visible is the current one (for the buttons and the export).
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(cardRefs.current.indexOf(entry.target as HTMLDivElement));
        }
      },
      { root, threshold: 0.6 },
    );
    for (const el of cardRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [cards.length]);

  async function save() {
    const node = cardRefs.current[current];
    if (!node) return;
    setStatus("Bild wird erstellt …");
    try {
      const result = await exportCard(node, `game-bibliothek-${wrapped.year}-${cards[current]!.id}.png`);
      setStatus(result === "downloaded" ? "Bild gespeichert." : null);
    } catch {
      setStatus("Das Bild konnte nicht erstellt werden.");
    }
  }

  return (
    <section className="flex flex-col gap-stack" aria-roledescription="Karussell" aria-label={`Rückblick ${wrapped.year}`}>
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="w-[min(85vw,360px)] shrink-0 snap-center"
            aria-roledescription="Karte"
            aria-label={`${i + 1} von ${cards.length}`}
          >
            <CardFrame card={card} year={wrapped.year} index={i} count={cards.length} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button aria-label="Vorherige Karte" disabled={current === 0} onClick={() => goTo(current - 1)}>
          ←
        </Button>
        <div className="flex gap-1.5" aria-hidden>
          {cards.map((c, i) => (
            <span key={c.id} className={`h-1.5 w-1.5 rounded-full ${i === current ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <Button aria-label="Nächste Karte" disabled={current >= cards.length - 1} onClick={() => goTo(current + 1)}>
          →
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-stack">
        <Button variant="primary" onClick={save}>
          Karte als Bild speichern
        </Button>
        {status ? <span className="text-sm text-muted">{status}</span> : null}
      </div>
    </section>
  );
}
