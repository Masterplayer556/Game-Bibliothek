"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDay, gameHref, GameCover } from "@/components/game-ui";
import { LibraryGate } from "@/components/LibraryGate";
import { PixelIcon } from "@/components/PixelIcon";
import {
  Button,
  Card,
  fieldClass,
  isRare,
  Medal,
  Notice,
  ProgressBar,
  ProgressRing,
  RARE_LIMITS,
  RareBadge,
  rareLimitLabel,
  readRareLimit,
  Segmented,
  StatTile,
  type RareLimit,
} from "@/components/ui";
import { achievementPlatforms, achievementSummary, type AchievementFilter } from "@/core/achievements";
import { ACHIEVEMENT_PLATFORM_LABEL, PLATFORM_LABEL } from "@/core/labels";
import { errorMessage } from "@/lib/errors";
import { saveSettings } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";

export default function AchievementsPage() {
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRare, setAllRare] = useState(false);

  return (
    <LibraryGate>
      {({ library, raw, reload, userId }) => {
        const platforms = achievementPlatforms(library.games);
        // A platform that disappeared (e.g. after a merge) falls back to «all».
        const active: AchievementFilter = filter === "all" || platforms.includes(filter) ? filter : "all";
        const { rows, unlocked, total, games } = achievementSummary(library.games, active, raw.achievements);
        const nintendoOnly = library.games.filter((g) => !g.hidden && g.platforms.every((p) => p === "nintendo")).length;
        const shownEntries = new Map(
          rows.flatMap((r) =>
            r.game.entries
              .filter((e) => r.platforms.includes(e.platform) && (active === "all" || e.id === r.key))
              .map((e) => [e.id, { game: r.game, platform: e.platform }] as const),
          ),
        );
        const recent = raw.achievements
          .filter((a) => a.unlocked_at && shownEntries.has(a.platform_game_id))
          .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
          .slice(0, 8);
        const rareLimit = readRareLimit(raw.settings);
        // Rare ones I have, rarest first. In «Zusammen» the same achievement on PC and PlayStation
        // appears once, with the lower share.
        const rareByKey = new Map<string, (typeof raw.achievements)[number]>();
        for (const a of raw.achievements) {
          if (!a.unlocked_at || !shownEntries.has(a.platform_game_id) || !isRare(a.rarity_percent, rareLimit)) continue;
          const key = `${shownEntries.get(a.platform_game_id)!.game.id}|${a.name.trim().toLowerCase()}`;
          const known = rareByKey.get(key);
          if (!known || (a.rarity_percent ?? 100) < (known.rarity_percent ?? 100)) rareByKey.set(key, a);
        }
        const rare = [...rareByKey.values()].sort((a, b) => (a.rarity_percent ?? 100) - (b.rarity_percent ?? 100));
        const rareUnlocked = rare.length;
        const rareShown = allRare ? rare : rare.slice(0, 10);
        const saveRareLimit = async (next: RareLimit) => {
          setBusy(true);
          setError(null);
          try {
            await saveSettings(getSupabase(), userId, { ...raw.settings, rareLimit: next });
            await reload();
          } catch (e) {
            setError(errorMessage(e));
          }
          setBusy(false);
        };
        const options = [
          { id: "all" as AchievementFilter, label: "Zusammen" },
          ...platforms.map((p) => ({ id: p as AchievementFilter, label: ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p] })),
        ];

        return (
          <>
            {platforms.length > 1 ? (
              <section className="flex flex-col gap-1">
                <Segmented label="Plattform" options={options} value={active} onChange={setFilter} />
                <span className="text-xs text-muted">
                  {active === "all"
                    ? "Gleiche Erfolge auf PC und PlayStation zählen einmal und gelten als geschafft, wenn sie auf einer der beiden freigeschaltet sind."
                    : "Nur diese Plattform: Eine Trophäe schaltet den Steam-Erfolg nicht frei und umgekehrt."}
                </span>
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-stack sm:grid-cols-4">
              <div className="sheet glow-tile col-span-2 flex items-center gap-4 rounded-card p-4">
                <ProgressRing value={unlocked} max={total} label="Erfolge freigeschaltet" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Freigeschaltet</div>
                  <div className="num whitespace-nowrap text-4xl leading-tight">
                    {unlocked}
                    <span className="text-xl text-muted"> / {total}</span>
                  </div>
                </div>
              </div>
              <StatTile label="Spiele" value={String(games)} icon="gamepad" hint="mit Erfolgen" />
              <a href="#selten" className="lift rounded-card">
                <StatTile label="Seltene" value={String(rareUnlocked)} icon="star" hint="Liste ansehen ↓" />
              </a>
            </section>
            {nintendoOnly > 0 && active === "all" ? (
              <Notice>
                {nintendoOnly === 1 ? "1 Nintendo-Spiel ist" : `${nintendoOnly} Nintendo-Spiele sind`} nicht aufgeführt: Nintendo hat keine Erfolge.
              </Notice>
            ) : null}

            <section className="flex flex-col gap-1">
              <label className="flex flex-wrap items-center gap-2 text-sm">
                Als «Selten» gilt ein Erfolg, den
                <select
                  className={fieldClass}
                  value={rareLimit}
                  disabled={busy}
                  onChange={(e) => saveRareLimit(e.target.value as RareLimit)}
                >
                  {RARE_LIMITS.map((l) => (
                    <option key={l} value={l}>{rareLimitLabel(l)}</option>
                  ))}
                </select>
                der Spieler haben.
              </label>
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </section>

            <section id="selten" className="scroll-mt-20">
              <Card title="Deine seltensten Erfolge" icon="star">
                {rare.length === 0 ? (
                  <Notice>Noch kein Erfolg, den {rareLimitLabel(rareLimit)} der Spieler haben. Die Grenze stellst du oben ein.</Notice>
                ) : (
                  <>
                    <p className="text-sm text-muted">
                      {rare.length} Erfolge, die {rareLimitLabel(rareLimit)} der Spieler haben, der seltenste zuerst.
                    </p>
                    <ol className="flex flex-col gap-1">
                      {rareShown.map((a, i) => {
                        const row = shownEntries.get(a.platform_game_id)!;
                        const percent = a.rarity_percent ?? 0;
                        return (
                          <li key={`${a.platform_game_id}-${a.external_id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface-raised">
                            <span className={`num w-6 shrink-0 text-center text-lg leading-none ${i < 3 ? "text-highlight" : "text-muted"}`}>{i + 1}</span>
                            {a.icon_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.icon_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-[10px] border border-border" />
                            ) : (
                              <span className="icon-tile h-10 w-10 rounded-[10px]">
                                <PixelIcon name="trophy" className="h-5 w-5" />
                              </span>
                            )}
                            <Link href={gameHref(row.game.id)} className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                <Medal tier={a.tier} />
                                <span className="truncate">{a.name}</span>
                              </span>
                              <span className="block truncate text-xs text-muted">
                                {row.game.title} · {ACHIEVEMENT_PLATFORM_LABEL[row.platform] ?? PLATFORM_LABEL[row.platform]}
                                {a.unlocked_at ? ` · ${formatDay(a.unlocked_at)}` : ""}
                              </span>
                            </Link>
                            <span className="flex shrink-0 flex-col items-end">
                              <span className="num text-xl leading-none text-highlight">{percent.toLocaleString("de-CH")} %</span>
                              <span className="text-[10px] text-muted">der Spieler</span>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    {rare.length > 10 ? (
                      <div>
                        <Button onClick={() => setAllRare((v) => !v)}>{allRare ? "Weniger zeigen" : `Alle ${rare.length} zeigen`}</Button>
                      </div>
                    ) : null}
                  </>
                )}
              </Card>
            </section>

            {recent.length > 0 ? (
              <Card title="Zuletzt freigeschaltet" icon="star">
                <ul className="flex flex-col gap-2 text-sm">
                  {recent.map((a) => {
                    const row = shownEntries.get(a.platform_game_id)!;
                    return (
                      <li key={`${a.platform_game_id}-${a.external_id}`} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <Medal tier={a.tier} />
                            <span className="truncate">{a.name}</span>
                            <RareBadge percent={a.rarity_percent} limit={rareLimit} />
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {row.game.title}
                            {active === "all" ? ` · ${ACHIEVEMENT_PLATFORM_LABEL[row.platform] ?? PLATFORM_LABEL[row.platform]}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatDay(a.unlocked_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            <Card title="Fortschritt pro Spiel" icon="trophy">
              {rows.length === 0 ? (
                <Notice>Noch keine Erfolge erfasst. Sie kommen mit dem Sync von Steam und PlayStation.</Notice>
              ) : (
                <ul className="flex flex-col gap-3">
                  {rows.map(({ key, game, platforms: on, unlocked: done, total: of }) => (
                    <li key={key}>
                      <Link href={gameHref(game.id)} className="flex items-center gap-3">
                        <GameCover game={game} className="w-10 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex justify-between gap-2 text-sm">
                            <span className="truncate">
                              {game.title}
                              {active === "all" ? (
                                <span className="text-muted"> · {on.map((p) => ACHIEVEMENT_PLATFORM_LABEL[p] ?? PLATFORM_LABEL[p]).join(" + ")}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {done}/{of}
                            </span>
                          </span>
                          <ProgressBar value={done} max={of} label={`Erfolge ${game.title}`} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
