"use client";

import { useState } from "react";
import Link from "next/link";
import { clothIndex, gameHref } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { Button, Card, fieldClass, Notice } from "@/components/ui";
import { formatMinutes } from "@/core/labels";
import { DEFAULT_PILE_THRESHOLD_MINUTES, pileOfShame } from "@/core/library";
import { saveSettings, saveUserData } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

export default function PileOfShamePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const stored = Number(raw.settings.pileThresholdMinutes);
        const threshold = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_PILE_THRESHOLD_MINUTES;
        const pile = pileOfShame(library.games, threshold);

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
            <Card title="Pile of Shame" icon="pile">
              <Notice>
                Spiele, die du besitzt, aber weniger als die Grenze gespielt hast. Durchgespielte und
                abgebrochene Spiele zählen nicht.
              </Notice>
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
              <p className="text-sm text-muted">
                <span className="num text-2xl leading-none text-text">{pile.length}</span> Spiele auf dem Stapel
              </p>
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </Card>
            {pile.length > 0 ? (
              <Card>
                {/* The pile itself: every game is a book lying flat, each pushed in a little differently. */}
                <ul className="flex flex-col gap-1">
                  {pile.map((g, i) => (
                    <li key={g.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1" style={{ paddingLeft: [0, 10, 4, 14, 2, 8][i % 6], paddingRight: [8, 0, 12, 2, 10, 4][i % 6] }}>
                        <Link href={gameHref(g.id)} className="spine" style={{ background: `var(--color-cloth-${clothIndex(g.title)})` }}>
                          <span className="min-w-0 flex-1 truncate font-display font-semibold">{g.title}</span>
                          <span className="shrink-0 text-xs tabular-nums opacity-80">{g.totalMinutes > 0 ? formatMinutes(g.totalMinutes) : "nie gespielt"}</span>
                        </Link>
                      </div>
                      <Button
                        disabled={busy}
                        aria-label={`${g.title} ausblenden`}
                        onClick={() =>
                          run(() =>
                            saveUserData(
                              getSupabase(),
                              userId,
                              g.id,
                              { status: g.status, favorite: g.favorite, note: g.note || null, hide_from_pile: g.hideFromPile, hidden: g.hidden },
                              { hide_from_pile: true },
                            ),
                          )
                        }
                      >
                        Ausblenden
                      </Button>
                    </li>
                  ))}
                </ul>
                <div aria-hidden className="-mt-1 h-2 rounded-[2px] bg-shelf shadow-[inset_0_2px_0_var(--color-shelf-edge)]" />
              </Card>
            ) : null}
          </>
        );
      }}
    </LibraryGate>
  );
}
