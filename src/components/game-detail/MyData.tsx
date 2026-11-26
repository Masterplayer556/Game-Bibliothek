"use client";

import { useState } from "react";
import { STATUS_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import { GAME_STATUSES, type GameStatus } from "@/core/types";
import { saveUserData, type UserDataPatch } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, fieldClass, Notice } from "../ui";
import { useAction } from "./use-action";

export function MyData({ game, userId, reload }: { game: LibraryGame; userId: string; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [note, setNote] = useState(game.note);
  const current = {
    status: game.status,
    favorite: game.favorite,
    note: game.note || null,
    hide_from_pile: game.hideFromPile,
    hidden: game.hidden,
  };
  const save = (patch: UserDataPatch) => run(() => saveUserData(getSupabase(), userId, game.id, current, patch));

  return (
    <Card title="Meine Angaben" icon="pencil" tone="review">
      <div className="grid grid-cols-1 gap-stack sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            className={fieldClass}
            value={game.status ?? ""}
            disabled={busy}
            onChange={(e) => save({ status: (e.target.value || null) as GameStatus | null })}
          >
            <option value="">Kein Status</option>
            {GAME_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={game.favorite} disabled={busy} onChange={(e) => save({ favorite: e.target.checked })} />
            Favorit
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={game.hidden} disabled={busy} onChange={(e) => save({ hidden: e.target.checked })} />
            Kein Spiel (App): zählt nicht als Spielzeit, erscheint separat unter Statistiken
          </label>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Notiz
        <textarea className={`${fieldClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div>
        <Button disabled={busy || note === game.note} onClick={() => save({ note: note.trim() || null })}>
          Notiz speichern
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
