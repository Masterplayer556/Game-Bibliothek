"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLATFORM_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import { deleteManualEntry, mergeGames, splitEntry } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { gameHref } from "../game-ui";
import { Button, Card, fieldClass, Notice } from "../ui";
import { useAction } from "./use-action";

export function Entries({
  game,
  games,
  userId,
  reload,
}: {
  game: LibraryGame;
  games: LibraryGame[];
  userId: string;
  reload: () => Promise<void>;
}) {
  const router = useRouter();
  const { busy, error, run } = useAction(reload);
  const [search, setSearch] = useState("");
  const candidates =
    search.trim().length < 2
      ? []
      : games
          .filter((g) => g.id !== game.id && g.title.toLowerCase().includes(search.trim().toLowerCase()))
          .slice(0, 6);

  return (
    <Card title="Plattform-Einträge" icon="layers" tone="platforms">
      <ul className="flex flex-col gap-2">
        {game.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-section-soft p-2.5 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{e.title}</span>
              <span className="text-xs text-muted">
                {PLATFORM_LABEL[e.platform]} · Quelle {e.source}
                {e.owned ? "" : " · nicht mehr im Besitz"}
              </span>
            </span>
            <span className="flex gap-2">
              {game.entries.length > 1 ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const id = await splitEntry(getSupabase(), userId, e);
                      router.push(gameHref(id));
                    })
                  }
                >
                  Abtrennen
                </Button>
              ) : null}
              {e.platform === "manual" ? (
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`«${e.title}» wirklich löschen?`)) return;
                    void run(async () => {
                      await deleteManualEntry(getSupabase(), e.id);
                      if (game.entries.length === 1) router.push("/bibliothek/");
                    });
                  }}
                >
                  Löschen
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Mit einem anderen Spiel zusammenführen
          <input
            type="search"
            className={fieldClass}
            placeholder="Titel suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {candidates.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {c.title} <span className="text-muted">({c.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")})</span>
                </span>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await mergeGames(getSupabase(), game.id, c.id);
                      setSearch("");
                    })
                  }
                >
                  Hierher holen
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Notice>Zusammenführen und Abtrennen bleiben auch nach dem nächsten Sync bestehen.</Notice>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
