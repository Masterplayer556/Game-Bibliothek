"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEVICE_LABEL, formatMinutes, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import { deviceTotals, playtimeSeries, type LibraryGame, type RawData } from "@/core/library";
import { addDays, toLocalDate } from "@/core/time";
import { GAME_STATUSES, type GameStatus } from "@/core/types";
import { deleteManualEntry, mergeGames, saveUserData, splitEntry, type UserDataPatch } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { applyIgdb } from "@/lib/igdb";
import { PlaytimeChart } from "./charts";
import { IgdbPicker } from "./IgdbPicker";
import { DeviceBadge, formatDay, gameHref, GameCover, PlatformBadge } from "./game-ui";
import { LibraryGate } from "./LibraryGate";
import { Button, Card, fieldClass, Notice, ProgressBar } from "./ui";
import { errorMessage } from "@/lib/errors";

function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { busy, error, run };
}

function MyData({ game, userId, reload }: { game: LibraryGame; userId: string; reload: () => Promise<void> }) {
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
    <Card title="Meine Angaben">
      <div className="grid grid-cols-1 gap-stack sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
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
            <input type="checkbox" checked={game.hideFromPile} disabled={busy} onChange={(e) => save({ hide_from_pile: e.target.checked })} />
            Nicht im Pile of Shame anzeigen
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={game.hidden} disabled={busy} onChange={(e) => save({ hidden: e.target.checked })} />
            Kein Spiel (App): zählt nicht als Spielzeit, erscheint separat unter Statistiken
          </label>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
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

function Achievements({ game, raw }: { game: LibraryGame; raw: RawData }) {
  const withAchievements = game.entries.filter((e) => e.achievements);
  if (withAchievements.length === 0) {
    return (
      <Card title="Erfolge">
        <Notice>
          {game.platforms.every((p) => p === "nintendo")
            ? "Nintendo hat keine Erfolge."
            : "Für dieses Spiel sind keine Erfolge erfasst."}
        </Notice>
      </Card>
    );
  }
  const entryIds = new Set(withAchievements.map((e) => e.id));
  const list = raw.achievements
    .filter((a) => entryIds.has(a.platform_game_id))
    .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? "") || a.name.localeCompare(b.name, "de"));
  return (
    <Card title="Erfolge">
      {withAchievements.map((e) => (
        <div key={e.id} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>{PLATFORM_LABEL[e.platform]}</span>
            <span className="tabular-nums text-muted">
              {e.achievements!.unlocked}/{e.achievements!.total}
            </span>
          </div>
          <ProgressBar value={e.achievements!.unlocked} max={e.achievements!.total} label={`Erfolge ${PLATFORM_LABEL[e.platform]}`} />
        </div>
      ))}
      {list.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Alle {list.length} Erfolge anzeigen</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {list.map((a) => (
              <li key={`${a.platform_game_id}-${a.external_id}`} className={`flex gap-3 text-sm ${a.unlocked_at ? "" : "opacity-50"}`}>
                {a.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.icon_url} alt="" className="h-8 w-8 shrink-0 rounded" loading="lazy" />
                ) : (
                  <span aria-hidden className="h-8 w-8 shrink-0 rounded bg-surface-raised" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block">{a.name}</span>
                  {a.description ? <span className="block text-xs text-muted">{a.description}</span> : null}
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  {a.unlocked_at ? formatDay(a.unlocked_at) : "gesperrt"}
                  {a.rarity_percent != null ? <span className="block">{a.rarity_percent} % der Spieler</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function Entries({
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
    <Card title="Plattform-Einträge">
      <ul className="flex flex-col gap-2">
        {game.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-raised p-2 text-sm">
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

function IgdbCard({ game, reload }: { game: LibraryGame; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [open, setOpen] = useState(false);
  const searchFor = game.entries[0]?.title ?? game.title;
  return (
    <Card title="Cover und Genres (IGDB)">
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

export function GameDetail({ id }: { id: string }) {
  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const game = library.byId.get(id);
        if (!game) {
          return (
            <Card title="Spiel nicht gefunden">
              <Notice>
                Vielleicht wurde es zusammengeführt oder gelöscht.{" "}
                <Link className="underline" href="/bibliothek/">Zur Bibliothek</Link>
              </Notice>
            </Card>
          );
        }
        const today = toLocalDate(new Date());
        const gameDays = (game.hidden ? library.appDays : library.days).filter((d) => d.gameId === game.id);
        const first = gameDays[0]?.date;
        const from = first && first > addDays(today, -425) ? first : addDays(today, -425);
        const series = playtimeSeries(gameDays, { from, to: today }, "month");
        const totals = deviceTotals(game, game.hidden ? library.appDays : library.days);

        return (
          <>
            <section className="flex gap-4">
              <GameCover game={game} className="w-28 shrink-0 sm:w-36" />
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-xl font-semibold">
                  {game.favorite ? <span aria-label="Favorit">★ </span> : null}
                  {game.title}
                </h2>
                <div className="flex flex-wrap gap-1">
                  {game.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                  {game.deviceKinds.map((k) => <DeviceBadge key={k} kind={k} />)}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  <dt className="text-muted">Spielzeit</dt>
                  <dd className="tabular-nums">{formatMinutes(game.totalMinutes)}</dd>
                  <dt className="text-muted">Zuletzt</dt>
                  <dd>{formatDay(game.lastPlayedAt)}</dd>
                  {game.status ? (
                    <>
                      <dt className="text-muted">Status</dt>
                      <dd>{STATUS_LABEL[game.status]}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            </section>

            <Card title="Spielzeit nach Plattform und Gerät">
              {totals.length === 0 ? (
                <Notice>Noch keine Spielzeit erfasst.</Notice>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {totals.map((t) => (
                    <li key={`${t.platform}-${t.deviceKind}`} className="flex justify-between gap-2">
                      <span>
                        {PLATFORM_LABEL[t.platform]}
                        {t.deviceKind ? ` · ${DEVICE_LABEL[t.deviceKind]}` : ""}
                      </span>
                      <span className="tabular-nums text-muted">{formatMinutes(t.minutes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Verlauf (pro Monat)">
              {gameDays.length === 0 ? (
                <Notice>Noch kein Verlauf: Er beginnt mit dem ersten Sync nach dem Spielen.</Notice>
              ) : (
                <PlaytimeChart points={series} bucket="month" title={`Spielzeit pro Monat für ${game.title}`} />
              )}
            </Card>

            <MyData key={`${game.id}-${game.note}`} game={game} userId={userId} reload={reload} />
            <Achievements game={game} raw={raw} />
            <Entries game={game} games={library.games} userId={userId} reload={reload} />
            <IgdbCard game={game} reload={reload} />
          </>
        );
      }}
    </LibraryGate>
  );
}
