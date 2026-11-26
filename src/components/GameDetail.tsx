"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACHIEVEMENT_PLATFORM_LABEL, DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import { achievementSummary, mergeAchievements, type AchievementFilter } from "@/core/achievements";
import { compareTitles, deviceTotals, type LibraryGame, type RawData } from "@/core/library";
import { toLocalDate } from "@/core/time";
import { GAME_STATUSES, type DeviceKind, type GameStatus, type PlatformId } from "@/core/types";
import { deleteManualEntry, mergeGames, saveUserData, splitEntry, type UserDataPatch } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { applyIgdb } from "@/lib/igdb";
import { ShareBars } from "./charts";
import { PlaytimeHistory } from "./PlaytimeHistory";
import { IgdbPicker } from "./IgdbPicker";
import { CoverBackdrop, formatDay, gameHref, GameCover, PlatformBadge, shelfMark, STATUS_LOOK } from "./game-ui";
import { LibraryGate } from "./LibraryGate";
import { Icon } from "./Icon";
import { Button, Card, fieldClass, Medal, Notice, RareBadge, readRareLimit, Segmented, SegmentedProgress } from "./ui";
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

function AchievementIcon({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-[10px] shadow-[var(--shadow-cover)]" loading="lazy" decoding="async" />
  ) : (
    <span aria-hidden className="icon-tile h-10 w-10 rounded-[10px]">
      <Icon name="trophy" className="h-5 w-5" />
    </span>
  );
}

function Achievements({ game, raw }: { game: LibraryGame; raw: RawData }) {
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const rareLimit = readRareLimit(raw.settings);
  const withAchievements = game.entries.filter((e) => e.achievements && e.achievements.total > 0);
  if (withAchievements.length === 0) {
    return (
      <Card title="Erfolge" icon="trophy" tone="achievements">
        <Notice>
          {game.platforms.every((p) => p === "nintendo")
            ? "Nintendo hat keine Erfolge."
            : "Für dieses Spiel sind keine Erfolge erfasst."}
        </Notice>
      </Card>
    );
  }
  const platformName = (p: PlatformId) => ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p];
  const several = withAchievements.length > 1;
  const joined = several && filter === "all";
  const shown = joined ? withAchievements : withAchievements.filter((e) => filter === "all" || e.platform === filter);
  const visible = shown.length > 0 ? shown : withAchievements;
  const platformOf = new Map(visible.map((e) => [e.id, e.platform] as const));
  const stored = raw.achievements.filter((a) => platformOf.has(a.platform_game_id));
  const byDate = <T,>(date: (x: T) => string | null, name: (x: T) => string) => (a: T, b: T) =>
    (date(b) ?? "").localeCompare(date(a) ?? "") || compareTitles(name(a), name(b));
  const merged = joined ? mergeAchievements(stored, platformOf).sort(byDate((m) => m.unlockedAt, (m) => m.name)) : [];
  const list = joined ? [] : [...stored].sort(byDate((a) => a.unlocked_at, (a) => a.name));
  const together = joined ? achievementSummary([game], "all", raw.achievements).rows[0] : undefined;

  return (
    <Card title="Erfolge" subtitle="Ein Abschnitt pro Erfolg" icon="trophy" tone="achievements">
      {several ? (
        <Segmented
          label="Plattform"
          options={[
            { id: "all" as AchievementFilter, label: "Zusammen" },
            ...withAchievements.map((e) => ({ id: e.platform as AchievementFilter, label: platformName(e.platform) })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      ) : null}
      {together ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm font-semibold">
            <span>Zusammen</span>
            <span className="num text-lg leading-none">
              {together.unlocked}
              <span className="text-xs text-muted"> / {together.total}</span>
            </span>
          </div>
          <SegmentedProgress value={together.unlocked} max={together.total} label="Erfolge zusammen" className="!h-3" />
        </div>
      ) : null}
      {visible.map((e) => (
        <div key={e.id} className="flex flex-col gap-1.5">
          <div className={`flex items-baseline justify-between ${joined ? "text-xs text-muted" : "text-sm font-semibold"}`}>
            <span>{platformName(e.platform)}</span>
            <span className={joined ? "tabular-nums" : "num text-lg leading-none"}>
              {e.achievements!.unlocked}
              <span className="text-xs text-muted"> / {e.achievements!.total}</span>
            </span>
          </div>
          {joined ? null : <SegmentedProgress value={e.achievements!.unlocked} max={e.achievements!.total} label={`Erfolge ${platformName(e.platform)}`} className="!h-3" />}
        </div>
      ))}
      {joined ? (
        <Notice>Gleiche Erfolge zählen einmal: geschafft, wenn auf PC oder PlayStation freigeschaltet.</Notice>
      ) : null}

      {merged.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-section">Alle {merged.length} Erfolge anzeigen</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {merged.map((m) => (
              <li key={m.key} className={`flex gap-3 text-sm ${m.unlockedAt ? "" : "opacity-50"}`}>
                <AchievementIcon url={m.iconUrl} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {m.name}
                    <RareBadge percent={m.rarityPercent} limit={rareLimit} />
                  </span>
                  {m.description ? <span className="block text-xs text-muted">{m.description}</span> : null}
                  <span className="block text-xs text-muted">
                    {m.platforms.map((p) => `${platformName(p)} ${m.unlockedOn.includes(p) ? "✓" : "–"}`).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  {m.unlockedAt ? formatDay(m.unlockedAt) : "gesperrt"}
                  {m.rarityPercent != null ? <span className="block">{m.rarityPercent} % der Spieler</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {list.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-section">Alle {list.length} Erfolge anzeigen</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {list.map((a) => (
              <li key={`${a.platform_game_id}-${a.external_id}`} className={`flex gap-3 text-sm ${a.unlocked_at ? "" : "opacity-50"}`}>
                <AchievementIcon url={a.icon_url} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Medal tier={a.tier} />
                    {a.name}
                    <RareBadge percent={a.rarity_percent} limit={rareLimit} />
                  </span>
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

function IgdbCard({ game, reload }: { game: LibraryGame; reload: () => Promise<void> }) {
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

export function GameDetail({ id }: { id: string }) {
  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const game = library.byId.get(id);
        if (!game) {
          return (
            <Card title="Spiel nicht gefunden" icon="search">
              <Notice>
                Vielleicht wurde es zusammengeführt oder gelöscht.{" "}
                <Link className="link" href="/bibliothek/">Zur Bibliothek</Link>
              </Notice>
            </Card>
          );
        }
        const today = toLocalDate(new Date());
        const gameDays = (game.hidden ? library.appDays : library.days).filter((d) => d.gameId === game.id);
        const totals = deviceTotals(game, game.hidden ? library.appDays : library.days);

        return (
          <>
            <section className="relative overflow-hidden rounded-card bg-[#1a1438] text-white shadow-[0_24px_48px_-24px_rgb(20_10_60/0.7)]">
              <CoverBackdrop game={game} />
              <div className="relative flex gap-4 p-4 sm:gap-6 sm:p-6">
                <GameCover game={game} favorite={game.favorite} className="w-32 shrink-0 self-start shadow-[0_18px_30px_-12px_rgb(0_0_0/0.7)] sm:w-44" eager />
                <div className="flex min-w-0 flex-col gap-2">
                  <span
                    className="self-start rounded-full border border-white/25 bg-white/12 px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-white/85"
                    title="Signatur: Plattform, Erscheinungsjahr, Titel"
                  >
                    <span className="sr-only">Signatur </span>
                    {shelfMark(game)}
                  </span>
                  <h2 className="font-display text-[1.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
                    {game.favorite ? <span className="sr-only">Favorit: </span> : null}
                    {game.title}
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {game.platforms.map((p) => <PlatformBadge key={p} platform={p} onDark />)}
                  </div>
                  {game.status ? (
                    <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${STATUS_LOOK[game.status]}`}>{STATUS_LABEL[game.status]}</span>
                  ) : null}
                </div>
              </div>
              <dl className="relative mx-4 mb-4 grid grid-cols-2 gap-3 rounded-[1.25rem] border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] sm:mx-6 sm:mb-6 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Spielzeit</dt>
                  <dd className="num mt-1 text-2xl leading-none" title={formatMinutes(game.totalMinutes)}>
                    {game.totalMinutes >= 60 ? formatHours(game.totalMinutes) : formatMinutes(game.totalMinutes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Zuletzt</dt>
                  <dd className="mt-1 text-sm font-semibold">{formatDay(game.lastPlayedAt)}</dd>
                </div>
                {game.achievements ? (
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">Erfolge</dt>
                    <dd className="num mt-1 text-2xl leading-none">
                      {game.achievements.unlocked}
                      <span className="text-sm text-white/70"> / {game.achievements.total}</span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <Card title="Spielzeit nach Gerät" subtitle="Plattform und Konsole" icon="gamepad" tone="stats">
              {totals.length === 0 ? (
                <Notice>Noch keine Spielzeit erfasst.</Notice>
              ) : (
                <ShareBars
                  shares={totals.map((t) => ({ key: `${t.platform}|${t.deviceKind ?? ""}`, minutes: t.minutes }))}
                  label={(k) => {
                    const [platform, device] = k.split("|") as [PlatformId, DeviceKind | ""];
                    return device ? DEVICE_LABEL[device] : PLATFORM_LABEL[platform];
                  }}
                  color={(k) => {
                    const [platform, device] = k.split("|");
                    return device ? `var(--color-device-${device})` : `var(--color-platform-${platform})`;
                  }}
                />
              )}
            </Card>

            <Card title="Verlauf" icon="stats">
              {gameDays.length === 0 ? (
                <Notice>Noch kein Verlauf: Er beginnt mit dem ersten Sync nach dem Spielen.</Notice>
              ) : (
                <PlaytimeHistory key={game.id} days={gameDays} today={today} title={`Spielzeit von ${game.title}`} />
              )}
            </Card>

            <MyData key={`${game.id}-${game.note}`} game={game} userId={userId} reload={() => reload(["userData"])} />
            <Achievements game={game} raw={raw} />
            <Entries game={game} games={library.games} userId={userId} reload={() => reload(["games", "platformGames", "snapshots", "userData"])} />
            <IgdbCard game={game} reload={() => reload(["games", "platformGames", "userData"])} />
          </>
        );
      }}
    </LibraryGate>
  );
}
