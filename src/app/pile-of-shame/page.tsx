"use client";

import { useState } from "react";
import { GameRow } from "@/components/game-ui";
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
            <Card title="Pile of Shame">
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
              <Notice>{pile.length} Spiele auf dem Stapel.</Notice>
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </Card>
            {pile.length > 0 ? (
              <Card>
                <ul className="flex flex-col gap-1">
                  {pile.map((g) => (
                    <li key={g.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <GameRow game={g} right={g.totalMinutes > 0 ? formatMinutes(g.totalMinutes) : "nie"} />
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
              </Card>
            ) : null}
          </>
        );
      }}
    </LibraryGate>
  );
}
