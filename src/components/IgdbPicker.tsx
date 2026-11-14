"use client";

import { useState, type FormEvent } from "react";
import type { IgdbGame } from "@/core/igdb/client";
import { searchIgdb } from "@/lib/igdb";
import { getSupabase } from "@/lib/supabase";
import { Button, fieldClass, Notice } from "./ui";
import { errorMessage } from "@/lib/errors";

/** Search field with IGDB results; calls onPick with the chosen entry. */
export function IgdbPicker({
  initialQuery,
  pickLabel = "Übernehmen",
  busy = false,
  onPick,
}: {
  initialQuery: string;
  pickLabel?: string;
  busy?: boolean;
  onPick: (game: IgdbGame) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<IgdbGame[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setResults(await searchIgdb(getSupabase(), query));
    } catch (e) {
      setError(errorMessage(e));
    }
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          type="search"
          className={`${fieldClass} min-w-0 flex-1`}
          aria-label="Auf IGDB suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={searching || query.trim().length < 2}>
          {searching ? "Suche …" : "Suchen"}
        </Button>
      </form>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {results && results.length === 0 ? <Notice>Nichts gefunden. Anderer Suchbegriff, z. B. der englische Titel?</Notice> : null}
      {results && results.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={r.igdbId} className="flex items-center gap-3 rounded-control p-1.5 hover:bg-surface-raised">
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span aria-hidden className="h-14 w-10 shrink-0 rounded bg-surface-raised" />
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{r.title}</span>
                <span className="block truncate text-xs text-muted">
                  {[r.releaseYear, r.genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ") || "ohne Details"}
                </span>
              </span>
              <Button disabled={busy} onClick={() => onPick(r)}>
                {pickLabel}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
