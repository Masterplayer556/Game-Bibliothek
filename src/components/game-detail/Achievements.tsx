"use client";

import { useState } from "react";
import { achievementSummary, mergeAchievements, orderAchievements, type AchievementFilter, type AchievementOrder } from "@/core/achievements";
import { ACHIEVEMENT_PLATFORM_LABEL, PLATFORM_LABEL } from "@/core/labels";
import type { LibraryGame, RawData } from "@/core/library";
import type { PlatformId } from "@/core/types";
import { formatDay } from "../game-ui";
import { Icon } from "../Icon";
import { Card, Medal, Notice, RareBadge, readRareLimit, Segmented, SegmentedProgress } from "../ui";

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

export function Achievements({ game, raw }: { game: LibraryGame; raw: RawData }) {
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const [order, setOrder] = useState<AchievementOrder>("date");
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
  const merged = joined
    ? orderAchievements(mergeAchievements(stored, platformOf), order, { unlockedAt: (m) => m.unlockedAt, rarity: (m) => m.rarityPercent, name: (m) => m.name })
    : [];
  const list = joined ? [] : orderAchievements(stored, order, { unlockedAt: (a) => a.unlocked_at, rarity: (a) => a.rarity_percent, name: (a) => a.name });
  const locked = joined ? merged.some((m) => !m.unlockedAt) : list.some((a) => !a.unlocked_at);
  // «Als Nächstes»: the locked ones most players have first, i.e. the easiest still open.
  const orderSwitch = locked ? (
    <div className="mt-2 flex flex-col gap-1">
      <Segmented
        label="Reihenfolge"
        options={[
          { id: "date" as AchievementOrder, label: "Neueste" },
          { id: "next" as AchievementOrder, label: "Als Nächstes" },
        ]}
        value={order}
        onChange={setOrder}
      />
      {order === "next" ? (
        <span className="text-xs text-muted">Offene zuerst: die, die die meisten Spieler haben, also die leichtesten.</span>
      ) : null}
    </div>
  ) : null;
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
          {orderSwitch}
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
          {orderSwitch}
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
