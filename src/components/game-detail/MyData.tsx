"use client";

import { useState } from "react";
import { STATUS_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import { nextRating, RATING_MAX, statusChange } from "@/core/my-data";
import { toLocalDate } from "@/core/time";
import { GAME_STATUSES, type GameStatus } from "@/core/types";
import { saveUserData, type UserDataPatch } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { Icon } from "../Icon";
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
    rating: game.rating,
    completed_on: game.completedOn,
  };
  const save = (patch: UserDataPatch) => run(() => saveUserData(getSupabase(), userId, game.id, current, patch));
  const today = toLocalDate(new Date());
  // The day is saved when the field is left: typing a date must not save half of it.
  const [completedOn, setCompletedOn] = useState(game.completedOn ?? "");
  const saveCompletedOn = () => {
    if (completedOn !== (game.completedOn ?? "")) void save({ completed_on: completedOn || null });
  };

  return (
    <Card title="Meine Angaben" icon="pencil" tone="review">
      <div className="grid grid-cols-1 gap-stack sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            className={fieldClass}
            value={game.status ?? ""}
            disabled={busy}
            onChange={(e) => save(statusChange((e.target.value || null) as GameStatus | null, game.completedOn, today))}
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
      <div className="grid grid-cols-1 gap-stack sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm font-medium">
          <span id={`rating-${game.id}`}>Bewertung</span>
          <div role="group" aria-labelledby={`rating-${game.id}`} className="flex items-center gap-1">
            {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => {
              const on = game.rating != null && n <= game.rating;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  aria-pressed={game.rating === n}
                  aria-label={`${n} von ${RATING_MAX} Sternen${game.rating === n ? " (nochmals tippen entfernt die Bewertung)" : ""}`}
                  onClick={() => save({ rating: nextRating(game.rating, n) })}
                  className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${on ? "text-highlight" : "text-muted opacity-50 hover:opacity-100"}`}
                >
                  <Icon name="star" className="h-6 w-6" />
                </button>
              );
            })}
            {game.rating == null ? <span className="ml-1 text-xs font-normal text-muted">noch keine</span> : null}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Durchgespielt am
          <input
            type="date"
            className={fieldClass}
            value={completedOn}
            max={today}
            disabled={busy}
            onChange={(e) => setCompletedOn(e.target.value)}
            onBlur={saveCompletedOn}
          />
        </label>
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
