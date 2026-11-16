"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clothIndex, gameHref } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { PixelIcon } from "@/components/PixelIcon";
import { Card, fieldClass, Notice } from "@/components/ui";
import { formatMinutes } from "@/core/labels";
import { DEFAULT_PILE_THRESHOLD_MINUTES, pileOfShame, type LibraryGame } from "@/core/library";
import { errorMessage } from "@/lib/errors";
import { saveSettings, saveUserData } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";

// Each book is pushed in a little differently, as on a real pile: [left, right] in pixels.
const OFFSETS: [number, number][] = [
  [0, 6],
  [8, 0],
  [3, 9],
  [11, 2],
  [1, 7],
  [6, 3],
];

/** One game as a book lying flat: title centred on the spine, playtime on the left, a menu on the right. */
function PileBook({
  game,
  index,
  open,
  up,
  busy,
  onToggle,
  onHide,
}: {
  game: LibraryGame;
  index: number;
  /** Open the menu above the book (the last books sit near the bar at the bottom). */
  up: boolean;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onHide: () => void;
}) {
  const [left, right] = OFFSETS[index % OFFSETS.length]!;
  return (
    <li className="relative" style={{ paddingLeft: left, paddingRight: right, zIndex: open ? 20 : undefined }}>
      <div className="spine" style={{ background: `var(--color-cloth-${clothIndex(game.title)})` }}>
        {/* The whole spine opens the game; the menu button sits on top of it. */}
        <Link href={gameHref(game.id)} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={game.title} />
        <span className="pointer-events-none relative z-10 grid w-full grid-cols-[3.5rem_1fr_2rem] items-center gap-2">
          <span className="text-[11px] leading-tight tabular-nums opacity-80">
            {game.totalMinutes > 0 ? formatMinutes(game.totalMinutes) : "nie gespielt"}
          </span>
          <span className="line-clamp-2 text-balance text-center font-display text-[15px] font-semibold leading-tight">{game.title}</span>
          <button
            type="button"
            aria-label={`Optionen für ${game.title}`}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={busy}
            onClick={onToggle}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center justify-self-end rounded-full bg-black/15 hover:bg-black/30"
          >
            <PixelIcon name="dots" className="h-4 w-4" />
          </button>
        </span>
      </div>
      {open ? (
        <div
          role="menu"
          // Solid, unlike the bars: the titles of the books behind it must not shine through.
          style={{ backgroundColor: "var(--color-surface)" }}
          className={`glass anim-pop-in absolute right-1 z-30 flex min-w-48 flex-col rounded-2xl p-1.5 text-sm ${up ? "bottom-full mb-1 origin-bottom-right" : "top-full mt-1"}`}
        >
          <Link role="menuitem" href={gameHref(game.id)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-surface-raised">
            <PixelIcon name="book" className="h-4 w-4 text-muted" />
            Spiel öffnen
          </Link>
          <button role="menuitem" type="button" onClick={onHide} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-surface-raised">
            <PixelIcon name="eyeOff" className="h-4 w-4 text-muted" />
            Vom Stapel nehmen
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function PileOfShamePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  // A tap anywhere else or Escape closes the menu.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && (e.target as Element).closest("[role=menu], [aria-haspopup=menu]")) return;
      setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const stored = Number(raw.settings.pileThresholdMinutes);
        const threshold = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_PILE_THRESHOLD_MINUTES;
        const pile = pileOfShame(library.games, threshold);
        const never = pile.filter((g) => g.totalMinutes === 0).length;

        const run = async (action: () => Promise<void>) => {
          setBusy(true);
          setError(null);
          try {
            await action();
            await reload();
          } catch (e) {
            setError(errorMessage(e));
          }
          setBusy(false);
        };

        return (
          <>
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex gap-6">
                  <div>
                    <div className="num text-4xl leading-none">{pile.length}</div>
                    <div className="mt-1 text-xs text-muted">auf dem Stapel</div>
                  </div>
                  <div>
                    <div className="num text-4xl leading-none">{never}</div>
                    <div className="mt-1 text-xs text-muted">nie gestartet</div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Grenze
                  <select
                    className={fieldClass}
                    value={threshold}
                    disabled={busy}
                    onChange={(e) => run(() => saveSettings(getSupabase(), userId, { ...raw.settings, pileThresholdMinutes: Number(e.target.value) }))}
                  >
                    {[30, 60, 120, 180, 300, 600].map((m) => (
                      <option key={m} value={m}>unter {formatMinutes(m)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Notice>
                Spiele, die du besitzt, aber weniger als die Grenze gespielt hast. Durchgespielte und abgebrochene
                Spiele zählen nicht. Über ⋯ nimmst du ein Spiel vom Stapel.
              </Notice>
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </Card>
            {pile.length > 0 ? (
              <Card>
                <ul className="flex flex-col gap-1">
                  {pile.map((g, i) => (
                    <PileBook
                      key={g.id}
                      game={g}
                      index={i}
                      up={i >= 3 && i >= pile.length - 3}
                      busy={busy}
                      open={menu === g.id}
                      onToggle={() => setMenu(menu === g.id ? null : g.id)}
                      onHide={() => {
                        setMenu(null);
                        void run(() =>
                          saveUserData(
                            getSupabase(),
                            userId,
                            g.id,
                            { status: g.status, favorite: g.favorite, note: g.note || null, hide_from_pile: g.hideFromPile, hidden: g.hidden },
                            { hide_from_pile: true },
                          ),
                        );
                      }}
                    />
                  ))}
                </ul>
                <div aria-hidden className="-mt-1 h-2.5 rounded-[3px] bg-shelf shadow-[inset_0_2px_0_var(--color-shelf-edge),0_6px_8px_-4px_var(--color-shelf-shadow)]" />
              </Card>
            ) : (
              <Card>
                <Notice tone="success">Der Stapel ist leer. Stark!</Notice>
              </Card>
            )}
          </>
        );
      }}
    </LibraryGate>
  );
}
