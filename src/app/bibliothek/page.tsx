"use client";

import { useState } from "react";
import { GameCard } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { fieldClass, Notice } from "@/components/ui";
import { DEVICE_LABEL, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import { allGenres, filterLibrary, type LibraryFilter, type SortKey } from "@/core/library";
import { DEVICE_KINDS, GAME_STATUSES, PLATFORM_IDS, type DeviceKind, type GameStatus, type PlatformId } from "@/core/types";

export default function LibraryPage() {
  const [filter, setFilter] = useState<LibraryFilter>({ sort: "lastPlayed" });
  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <LibraryGate>
      {({ library }) => {
        const games = filterLibrary(library.games, filter);
        const genres = allGenres(library.games);
        const hiddenCount = library.games.filter((g) => g.hidden).length;
        return (
          <>
            <section className="flex flex-col gap-stack" aria-label="Suche und Filter">
              <input
                type="search"
                className={fieldClass}
                placeholder="Spiel suchen …"
                aria-label="Spiel suchen"
                value={filter.search ?? ""}
                onChange={(e) => set({ search: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select className={fieldClass} aria-label="Plattform" value={filter.platform ?? ""} onChange={(e) => set({ platform: e.target.value as PlatformId | "" })}>
                  <option value="">Alle Plattformen</option>
                  {PLATFORM_IDS.map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
                  ))}
                </select>
                <select className={fieldClass} aria-label="Gerät" value={filter.device ?? ""} onChange={(e) => set({ device: e.target.value as DeviceKind | "" })}>
                  <option value="">Alle Geräte</option>
                  {DEVICE_KINDS.map((d) => (
                    <option key={d} value={d}>{DEVICE_LABEL[d]}</option>
                  ))}
                </select>
                <select className={fieldClass} aria-label="Genre" value={filter.genre ?? ""} onChange={(e) => set({ genre: e.target.value })} disabled={genres.length === 0}>
                  <option value="">{genres.length === 0 ? "Genres ab IGDB" : "Alle Genres"}</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select className={fieldClass} aria-label="Status" value={filter.status ?? ""} onChange={(e) => set({ status: e.target.value as GameStatus | "none" | "" })}>
                  <option value="">Jeder Status</option>
                  {GAME_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                  <option value="none">Ohne Status</option>
                </select>
                <select className={fieldClass} aria-label="Sortierung" value={filter.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
                  <option value="lastPlayed">Zuletzt gespielt</option>
                  <option value="playtime">Spielzeit</option>
                  <option value="name">Name</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>{games.length} Spiele</span>
                {hiddenCount > 0 ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={filter.showHidden ?? false} onChange={(e) => set({ showHidden: e.target.checked })} />
                    {hiddenCount} ausgeblendete zeigen
                  </label>
                ) : null}
              </div>
            </section>
            {games.length === 0 ? (
              <Notice>Keine Spiele für diese Auswahl.</Notice>
            ) : (
              <ul className="grid grid-cols-2 gap-stack sm:grid-cols-4">
                {games.map((g) => (
                  <li key={g.id}>
                    <GameCard game={g} />
                  </li>
                ))}
              </ul>
            )}
          </>
        );
      }}
    </LibraryGate>
  );
}
