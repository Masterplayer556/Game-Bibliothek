"use client";

import { useState } from "react";
import type { LibraryGame } from "@/core/library";
import { applyIgdb } from "@/lib/igdb";
import { getSupabase } from "@/lib/supabase";
import { IgdbPicker } from "../IgdbPicker";
import { Button, Card, Notice } from "../ui";
import { useAction } from "./use-action";

export function IgdbCard({ game, reload }: { game: LibraryGame; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [open, setOpen] = useState(false);
  const searchFor = game.entries[0]?.title ?? game.title;
  return (
    <Card title="Cover und Genres (IGDB)" icon="image" tone="chronicle">
      {game.igdbId ? (
        <Notice>
          Zugeordnet{game.releaseYear ? `: erschienen ${game.releaseYear}` : ""}
          {game.genres.length > 0 ? ` · ${game.genres.join(", ")}` : ""}.
        </Notice>
      ) : (
        <Notice>Keine Zuordnung. Ohne IGDB bleiben das Cover der Plattform und keine Genres.</Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => setOpen((o) => !o)}>
          {open ? "Schliessen" : "Anderes Spiel wählen"}
        </Button>
        {game.igdbId ? (
          <Button disabled={busy} onClick={() => run(() => applyIgdb(getSupabase(), game.id, null))}>
            Zuordnung entfernen
          </Button>
        ) : null}
      </div>
      {open ? (
        <IgdbPicker
          initialQuery={searchFor}
          busy={busy}
          onPick={(choice) =>
            run(async () => {
              await applyIgdb(getSupabase(), game.id, choice);
              setOpen(false);
            })
          }
        />
      ) : null}
      <Notice>Eine Korrektur von Hand ändert der Sync nie wieder. Gibt es das gewählte Spiel schon, wird es hierher geholt.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
