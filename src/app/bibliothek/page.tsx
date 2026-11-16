"use client";

import { useState } from "react";
import { GameCard, GameListRow } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { PixelIcon } from "@/components/PixelIcon";
import { Card, fieldClass, Notice, Segmented } from "@/components/ui";
import { DEVICE_LABEL, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import { allGenres, filterLibrary, type LibraryFilter, type SortKey } from "@/core/library";
import { DEVICE_KINDS, GAME_STATUSES, PLATFORM_IDS, type DeviceKind, type GameStatus, type PlatformId } from "@/core/types";

type View = "shelf" | "list";
const VIEW_KEY = "gb-library-view";
const VIEWS: { id: View; label: string }[] = [
  { id: "shelf", label: "Regal" },
  { id: "list", label: "Liste" },
];

function SortHead({ label, sortKey, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (key: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSort(sortKey)}
      className={`rounded-[3px] px-1 py-0.5 uppercase tracking-wider ${active ? "bg-section-soft text-section font-semibold" : "hover:text-text"}`}
    >
      {label}
      {active ? " ▾" : ""}
    </button>
  );
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<LibraryFilter>({ sort: "lastPlayed" });
  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [filter.platform, filter.device, filter.genre, filter.status].filter(Boolean).length;
  // Shelf or list: remembered in this browser.
  const [view, setView] = useState<View>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "list" ? "list" : "shelf";
    } catch {
      return "shelf";
    }
  });
  const chooseView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Without storage the choice holds until the page is closed.
    }
  };

  return (
    <LibraryGate>
      {({ library }) => {
        const games = filterLibrary(library.games, filter);
        const genres = allGenres(library.games);
        const hiddenCount = library.games.filter((g) => g.hidden).length;
        return (
          <>
            <section className="flex flex-col gap-stack" aria-label="Suche und Filter">
              <div className="flex gap-2">
                <input
                  type="search"
                  className={`${fieldClass} min-w-0 flex-1 rounded-full px-4`}
                  placeholder="Spiel suchen …"
                  aria-label="Spiel suchen"
                  value={filter.search ?? ""}
                  onChange={(e) => set({ search: e.target.value })}
                />
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls="filter"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                    filtersOpen || activeFilters > 0 ? "bg-section border-transparent text-on-section" : "border-border-strong bg-field text-text"
                  }`}
                >
                  <PixelIcon name="more" className="h-4 w-4" />
                  Filter
                  {activeFilters > 0 ? (
                    <span className="num rounded-full bg-black/20 px-1.5 text-sm leading-tight">{activeFilters}</span>
                  ) : null}
                </button>
              </div>
              {/* The filters fold away so the shelf starts right below the search. */}
              <div
                id="filter"
                hidden={!filtersOpen}
                className="glass grid grid-cols-2 gap-2 rounded-card p-3 sm:grid-cols-5"
              >
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
              {filtersOpen && activeFilters > 0 ? (
                <button
                  type="button"
                  className="link self-start text-sm"
                  onClick={() => set({ platform: "", device: "", genre: "", status: "" })}
                >
                  Filter zurücksetzen
                </button>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span className="flex items-center gap-3">
                  <span className="w-36">
                    <Segmented label="Ansicht" options={VIEWS} value={view} onChange={chooseView} />
                  </span>
                  {games.length} Spiele
                </span>
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
            ) : view === "list" ? (
              <Card>
                {/* Column heads: tapping one sorts the list by it. */}
                <div className="flex items-center gap-3 px-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  <span className="w-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <SortHead label="Name" sortKey="name" current={filter.sort ?? "lastPlayed"} onSort={(sort) => set({ sort })} />
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <SortHead label="Zuletzt" sortKey="lastPlayed" current={filter.sort ?? "lastPlayed"} onSort={(sort) => set({ sort })} />
                    <SortHead label="Spielzeit" sortKey="playtime" current={filter.sort ?? "lastPlayed"} onSort={(sort) => set({ sort })} />
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {games.map((g) => (
                    <li key={g.id}>
                      <GameListRow game={g} />
                    </li>
                  ))}
                </ul>
              </Card>
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
