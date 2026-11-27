"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import type { Library } from "@/core/library";
import type { DeviceKind, PlatformId } from "@/core/types";
import type { WrappedYear } from "@/core/wrapped";
import { deliverCard, renderCard, type CardImage, type DeliverResult } from "@/lib/export-image";
import { formatDay, GameCover } from "./game-ui";
import { Icon, type IconName } from "./Icon";
import { sectionStyle, type Section } from "./section";
import { Button, IconButton } from "./ui";

interface CardDef {
  id: string;
  /** The colour gradient of the card. */
  tone: Section;
  icon: IconName;
  estimated?: boolean;
  body: ReactNode;
}

function Big({ children }: { children: ReactNode }) {
  return <div className="num text-[5.25rem] leading-[0.9] drop-shadow-[0_4px_14px_rgb(0_0_0/0.18)]">{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{children}</div>;
}

/** White text on the card's gradient: the usual text colours are replaced inside a card. */
const ON_GRADIENT = {
  "--color-text": "#ffffff",
  "--color-muted": "rgb(255 255 255 / 0.8)",
  "--color-highlight": "#fff1a8",
} as CSSProperties;

function CardFrame({ card, year, index, count }: { card: CardDef; year: number; index: number; count: number }) {
  return (
    <div
      className="relative flex aspect-[9/16] w-full flex-col overflow-hidden rounded-[2rem] text-white shadow-[0_24px_48px_-24px_rgb(20_10_60/0.6)]"
      style={{
        ...sectionStyle(card.tone),
        ...ON_GRADIENT,
        backgroundColor: "var(--section)",
        backgroundImage:
          "radial-gradient(24rem 16rem at 100% 0%, rgb(255 255 255 / 0.32), transparent 60%), radial-gradient(22rem 18rem at 0% 100%, rgb(0 0 0 / 0.22), transparent 60%), linear-gradient(160deg, var(--section), var(--section-2))",
      }}
    >
      {/* Rings in the corner, like the heroes in the app. */}
      <span aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[26px] border-white/10" />
      <span aria-hidden className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full border-[18px] border-white/[0.07]" />
      <div className="relative flex items-center gap-2.5 px-5 pt-5">
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/30 bg-white/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]">
          <Icon name={card.icon} className="h-[22px] w-[22px]" />
        </span>
        <span className="font-display text-sm font-extrabold tracking-tight">Wrapped {year}</span>
      </div>
      <div className="relative flex flex-1 flex-col justify-center gap-5 px-6 py-4">{card.body}</div>
      <div className="relative flex shrink-0 items-baseline justify-between px-5 pb-4 text-[11px] text-white/80">
        <span className="font-display text-sm font-extrabold text-white">Game Bibliothek</span>
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

function Cover({ library, id, className }: { library: Library; id: string; className: string }) {
  const game = library.byId.get(id);
  return game ? <GameCover game={game} className={className} /> : null;
}

function buildCards(w: WrappedYear, library: Library): CardDef[] {
  const cards: CardDef[] = [];
  const star = (estimated: boolean) => (estimated ? "*" : "");

  cards.push({
    id: "intro",
      icon: "star",
    tone: "review",
    estimated: w.estimated,
    body: (
      <>
        <Label>Dein Spielejahr</Label>
        <Big>{w.year}</Big>
        <p className="text-lg">
          {formatHours(w.totalMinutes)}
          {star(w.estimated)} an {w.playDays} Tagen
        </p>
        {w.top.length > 0 ? (
          <div className="flex items-end pt-2" aria-hidden>
            {w.top.slice(0, 3).map((t, i) => (
              <div key={t.gameId} className={i === 0 ? "z-10 w-[38%]" : "-ml-[6%] w-[30%]"} style={{ rotate: `${[-4, 3, 7][i]}deg` }}>
                <Cover library={library} id={t.gameId} className="w-full" />
              </div>
            ))}
          </div>
        ) : null}
      </>
    ),
  });

  if (w.previousYear) {
    const prev = w.previousYear.minutes;
    const change = prev > 0 ? Math.round(((w.totalMinutes - prev) / prev) * 100) : null;
    cards.push({
      id: "compare",
      icon: "stats",
      tone: "stats",
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
      icon: "trophy",
      tone: "achievements",
      estimated: w.top.some((t) => t.estimated),
      body: (
        <>
          <Label>Deine Top {w.top.length}</Label>
          <ol className="flex flex-col gap-3">
            {w.top.map((t, i) => (
              <li key={t.gameId} className="flex items-center gap-3">
                <span className={`num w-5 text-3xl leading-none ${i === 0 ? "text-highlight" : "text-muted"}`}>{i + 1}</span>
                <Cover library={library} id={t.gameId} className="w-11 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-display text-lg font-semibold leading-tight">{title(library, t.gameId)}</span>
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
      icon: "gamepad",
      tone: "platforms",
      body: (
        <>
          {w.favoritePlatform ? (
            <div className="flex flex-col gap-1">
              <Label>Lieblingsplattform</Label>
              <div className="font-display text-3xl font-semibold leading-tight">{PLATFORM_LABEL[w.favoritePlatform.key as PlatformId] ?? w.favoritePlatform.key}</div>
              <p className="text-muted">{Math.round((w.favoritePlatform.minutes / total) * 100)} % deiner Spielzeit</p>
            </div>
          ) : null}
          {w.favoriteDevice ? (
            <div className="flex flex-col gap-1">
              <Label>Lieblingsgerät</Label>
              <div className="font-display text-3xl font-semibold leading-tight">{DEVICE_LABEL[w.favoriteDevice.key as DeviceKind] ?? w.favoriteDevice.key}</div>
              <p className="text-muted">{formatHours(w.favoriteDevice.minutes)}</p>
            </div>
          ) : null}
        </>
      ),
    });
  }

  cards.push({
    id: "genre",
      icon: "library",
    tone: "library",
    body: w.favoriteGenre ? (
      <>
        <Label>Lieblings-Genre</Label>
        <div className="font-display text-4xl font-semibold leading-tight">{w.favoriteGenre.key}</div>
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
      icon: "calendar",
      tone: "chronicle",
      estimated: (w.bestDay?.estimated ?? false) || (w.longestStreak?.estimated ?? false),
      body: (
        <>
          {w.bestDay ? (
            <div className="flex flex-col gap-1">
              <Label>Dein Rekordtag</Label>
              <div className="flex items-center gap-3">
                <Cover library={library} id={w.bestDay.gameIds[0]!} className="w-12 shrink-0" />
                <div className="font-display text-3xl font-semibold leading-tight">{formatDay(w.bestDay.date)}</div>
              </div>
              <p>
                {formatMinutes(w.bestDay.minutes)}
                {star(w.bestDay.estimated)}, vor allem {title(library, w.bestDay.gameIds[0]!)}
              </p>
            </div>
          ) : null}
          {w.longestStreak ? (
            <div className="flex flex-col gap-1">
              <Label>Längste Serie</Label>
              <div className="font-display text-3xl font-semibold leading-tight">
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
      icon: "plus",
      tone: "add",
      body: (
        <>
          <Label>Neu angefangen</Label>
          <Big>{w.newGames.length}</Big>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-3">
            {w.newGames.slice(0, 6).map((id) => (
              <li key={id} className="flex min-w-0 flex-col gap-1">
                <Cover library={library} id={id} className="w-full" />
                <span className="truncate text-xs">{title(library, id)}</span>
              </li>
            ))}
          </ul>
          {w.newGames.length > 6 ? <p className="text-muted">und {w.newGames.length - 6} weitere</p> : null}
        </>
      ),
    });
  }

  if (w.finished.length > 0) {
    cards.push({
      id: "finished",
      icon: "check",
      tone: "add",
      body: (
        <>
          <Label>Durchgespielt</Label>
          <Big>{w.finished.length}</Big>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-3">
            {w.finished.slice(0, 6).map((id) => (
              <li key={id} className="flex min-w-0 flex-col gap-1">
                <Cover library={library} id={id} className="w-full" />
                <span className="truncate text-xs">{title(library, id)}</span>
              </li>
            ))}
          </ul>
          {w.finished.length > 6 ? <p className="text-muted">und {w.finished.length - 6} weitere</p> : null}
        </>
      ),
    });
  }

  if (w.topRated.length > 0) {
    cards.push({
      id: "rated",
      icon: "star",
      tone: "review",
      body: (
        <>
          <Label>Bestbewertet</Label>
          <ol className="flex flex-col gap-3">
            {w.topRated.map((r) => (
              <li key={r.gameId} className="flex items-center gap-3">
                <Cover library={library} id={r.gameId} className="w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-display text-lg font-semibold leading-tight">{title(library, r.gameId)}</span>
                  <span className="text-highlight" aria-label={`${r.rating} von 5 Sternen`}>
                    {"★".repeat(r.rating)}
                    <span className="opacity-30">{"★".repeat(5 - r.rating)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  cards.push({
    id: "achievements",
      icon: "trophy",
    tone: "home",
    body:
      w.achievements.unlocked > 0 ? (
        <>
          <Label>Erfolge und Trophäen</Label>
          <Big>{w.achievements.unlocked}</Big>
          <p className="text-lg">freigeschaltet</p>
          {w.achievements.rarest ? (
            <div className="flex flex-col gap-1">
              <Label>Die seltenste</Label>
              <div className="font-display text-xl font-semibold leading-snug">{w.achievements.rarest.name}</div>
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

  if (w.rediscovered.length > 0) {
    cards.push({
      id: "rediscovered",
      icon: "sync",
      tone: "library",
      body: (
        <>
          <Label>Wiederentdeckt</Label>
          <Big>{w.rediscovered.length}</Big>
          <p className="text-white/85">Vorher kaum gespielt, dieses Jahr richtig losgelegt:</p>
          <ul className="flex flex-col gap-1 text-lg">
            {w.rediscovered.slice(0, 6).map((e) => (
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
      icon: "clock",
      tone: "home",
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

  // One export at a time: a second tap while the image is being made would make it twice
  // (two downloads or two share sheets).
  const exporting = useRef(false);
  const [busy, setBusy] = useState(false);
  // An image that is ready but could not be shared yet (see DeliverResult «needs-tap»).
  const [ready, setReady] = useState<(CardImage & { card: number }) | null>(null);
  const report = (result: DeliverResult, image: CardImage, card: number) => {
    setReady(result === "needs-tap" ? { ...image, card } : null);
    setStatus(result === "downloaded" ? "Bild gespeichert." : result === "needs-tap" ? "Bild ist bereit." : null);
  };
  async function save() {
    const node = cardRefs.current[current];
    if (!node || exporting.current) return;
    exporting.current = true;
    setBusy(true);
    setReady(null);
    setStatus("Bild wird erstellt …");
    try {
      const image = await renderCard(node, `game-bibliothek-${wrapped.year}-${cards[current]!.id}.png`);
      report(await deliverCard(image), image, current);
    } catch {
      setStatus("Das Bild konnte nicht erstellt werden.");
    } finally {
      exporting.current = false;
      setBusy(false);
    }
  }
  // Called straight from the tap: the share sheet may open now.
  async function shareReady() {
    if (!ready) return;
    try {
      report(await deliverCard(ready), ready, ready.card);
    } catch {
      setStatus("Das Bild konnte nicht geteilt werden.");
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
        <IconButton icon="back" label="Vorherige Karte" disabled={current === 0} onClick={() => goTo(current - 1)} />
        <div className="flex gap-1.5" aria-hidden>
          {cards.map((c, i) => (
            <span key={c.id} className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-6 bg-section" : "w-2 bg-border-strong"}`} />
          ))}
        </div>
        <IconButton icon="forward" label="Nächste Karte" disabled={current >= cards.length - 1} onClick={() => goTo(current + 1)} />
      </div>
      <div className="flex flex-wrap items-center gap-stack">
        <Button variant="primary" icon="download" onClick={save} disabled={busy}>
          Karte als Bild speichern
        </Button>
        {ready && ready.card === current ? (
          <Button icon="download" onClick={shareReady}>
            Teilen
          </Button>
        ) : null}
        {status ? <span className="text-sm text-muted">{status}</span> : null}
      </div>
    </section>
  );
}
