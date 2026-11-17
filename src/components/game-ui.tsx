"use client";

// Building blocks around a game: cover, badges, list rows. Presentation only.
import Link from "next/link";
import type { CSSProperties, SyntheticEvent } from "react";
import { DEVICE_LABEL, formatHours, formatMinutes, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import type { DeviceKind, GameStatus, PlatformId } from "@/core/types";
import { Icon } from "./Icon";

/**
 * Steam's upright cover is missing for some older games; then use the wide header, which every
 * game has. For an <img onError>: swaps the picture once, then gives up.
 */
export function steamCoverFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  const wide = img.src.replace(/\/library_600x900(_2x)?\.jpg(\?.*)?$/, "/header.jpg");
  if (wide !== img.src) img.src = wide;
}

/**
 * Upright pictures (IGDB, Steam's library cover) fill the cover. Wide or square ones (Steam's
 * header, PlayStation) are shown whole on a blurred copy of themselves. The blurred copy is only
 * drawn for those few, so a shelf of covers costs no blur filters.
 */
function fitCover(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
  img.closest(".cover")?.setAttribute("data-fit", ratio > 0.62 && ratio < 0.86 ? "cover" : "contain");
}

export function gameHref(id: string): string {
  return `/spiel/?id=${encodeURIComponent(id)}`;
}

function initials(title: string): string {
  return title
    .split(/[\s:–-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Games without a cover get one of five gradients; the same title always gets the same one. */
export function clothIndex(title: string): number {
  let sum = 0;
  for (const char of title) sum += char.codePointAt(0)!;
  return (sum % 5) + 1;
}

export function clothStyle(title: string): CSSProperties {
  const n = clothIndex(title);
  return { "--cloth-a": `var(--color-cloth-${n})`, "--cloth-b": `var(--color-cloth-${n}b)` } as CSSProperties;
}

const PLATFORM_CODE: Record<PlatformId, string> = { steam: "PC", psn: "PS", nintendo: "NSW", manual: "MAN" };

/**
 * A short label as on a library spine: platforms, year of release, first letters of the title.
 * «o. J.» (ohne Jahr) is what a catalogue writes when the year is unknown.
 */
export function shelfMark(game: Pick<LibraryGame, "title" | "platforms" | "releaseYear">): string {
  const letters = game.title
    .normalize("NFD")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return [game.platforms.map((p) => PLATFORM_CODE[p]).join("+"), game.releaseYear ?? "o. J.", letters].filter(Boolean).join(" · ");
}

/** Colours of the status pill on a cover. */
export const STATUS_LOOK: Record<GameStatus, string> = {
  completed: "bg-linear-to-br from-[#2ed47a] to-[#0fa36b]",
  playing: "bg-linear-to-br from-[#8b6bff] to-[#e8399b]",
  backlog: "bg-linear-to-br from-[#ffbf2e] to-[#ff8a1f] !text-[#2e1a00]",
  dropped: "bg-linear-to-br from-[#8d8aa8] to-[#5f5a80]",
};

/** Text colours for the status in lists. */
export const STATUS_TONE: Record<GameStatus, string> = {
  completed: "text-success",
  playing: "text-[var(--color-section-review-ink)]",
  backlog: "text-highlight",
  dropped: "text-muted",
};

/** The cover. `favorite` puts a heart in the corner, `status` a pill at the bottom. */
export function GameCover({
  game,
  favorite = false,
  status = null,
  className = "",
  eager = false,
}: {
  game: Pick<LibraryGame, "title" | "coverUrl">;
  favorite?: boolean;
  status?: GameStatus | null;
  className?: string;
  /** Load at once instead of when scrolled near (for the first picture on a page). */
  eager?: boolean;
}) {
  return (
    <div className={`cover ${className}`}>
      {game.coverUrl ? (
        // Covers come from many hosts; next/image cannot optimise them in a static export.
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.coverUrl} alt="" aria-hidden className="cover-fill" loading="lazy" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.coverUrl}
            alt=""
            className="cover-img"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={fitCover}
            onError={steamCoverFallback}
          />
        </>
      ) : (
        <div aria-hidden className="cover-blank" style={clothStyle(game.title)}>
          <span>{initials(game.title)}</span>
          <Icon name="gamepad" className="h-[18cqw] w-[18cqw] opacity-70" />
        </div>
      )}
      {favorite ? (
        <span className="cover-fav" title="Favorit">
          <Icon name="heart" className="h-[58%] w-[58%]" />
        </span>
      ) : null}
      {status ? <span className={`cover-status ${STATUS_LOOK[status]}`}>{STATUS_LABEL[status]}</span> : null}
    </div>
  );
}

/**
 * The mood of a game behind its details: its cover, blurred, or its gradient. The parent needs
 * `relative overflow-hidden`; content goes on top with `relative`.
 */
export function CoverBackdrop({ game }: { game: Pick<LibraryGame, "title" | "coverUrl"> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt="" decoding="async" className="h-full w-full scale-150 object-cover opacity-80 blur-2xl saturate-[1.6]" onError={steamCoverFallback} />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-[var(--cloth-a)] to-[var(--cloth-b)] opacity-70" style={clothStyle(game.title)} />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/30 to-black/65" />
    </div>
  );
}

export function PlatformBadge({ platform, onDark = false }: { platform: PlatformId; onDark?: boolean }) {
  return (
    <span className={`chip ${onDark ? "!border-white/25 !bg-white/15 !text-white" : ""}`}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--color-platform-${platform})`, boxShadow: "0 0 0 1.5px rgb(255 255 255 / 0.5)" }} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function DeviceBadge({ kind, onDark = false }: { kind: DeviceKind; onDark?: boolean }) {
  return (
    <span className={`chip ${onDark ? "!border-white/25 !bg-white/15 !text-white" : ""}`}>
      <span aria-hidden className="h-2 w-2 rounded-[3px]" style={{ background: `var(--color-device-${kind})`, boxShadow: "0 0 0 1.5px rgb(255 255 255 / 0.5)" }} />
      {DEVICE_LABEL[kind]}
    </span>
  );
}

/** Small coloured dots for the platforms of a game (where a full badge is too big). */
export function PlatformDots({ platforms }: { platforms: PlatformId[] }) {
  return (
    <span className="flex items-center gap-1" title={platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}>
      {platforms.map((p) => (
        <span key={p} aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--color-platform-${p})` }} />
      ))}
      <span className="sr-only">{platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</span>
    </span>
  );
}

/** A game in the grid: cover, title, platforms and playtime. */
export function GameCard({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="group flex h-full flex-col gap-2 rounded-control">
      <GameCover game={game} favorite={game.favorite} status={game.status} className="tilt" />
      <div className="flex flex-col gap-1 px-0.5">
        <div className="line-clamp-2 text-[13.5px] font-semibold leading-tight group-hover:text-section">
          {game.favorite ? <span className="sr-only">Favorit: </span> : null}
          {game.title}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <PlatformDots platforms={game.platforms} />
          <span className="whitespace-nowrap tabular-nums" title={game.totalMinutes > 0 ? formatMinutes(game.totalMinutes) : undefined}>
            {game.totalMinutes <= 0 ? "Nie gespielt" : game.totalMinutes < 60 ? formatMinutes(game.totalMinutes) : formatHours(game.totalMinutes)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** One line of the library as a list: small cover, title, platforms, status, last played, playtime. */
export function GameListRow({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-section-soft">
      <GameCover game={game} favorite={game.favorite} className="w-12 shrink-0 !rounded-lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold group-hover:text-section">
          {game.favorite ? <span className="sr-only">Favorit: </span> : null}
          {game.title}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <PlatformDots platforms={game.platforms} />
          {game.status ? <span className={`text-[11px] font-semibold ${STATUS_TONE[game.status]}`}>{STATUS_LABEL[game.status]}</span> : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="num text-lg leading-none">{game.totalMinutes > 0 ? formatMinutes(game.totalMinutes) : "–"}</span>
        <span className="text-[11px] text-muted">{game.lastPlayedAt ? formatDay(game.lastPlayedAt) : "nie gespielt"}</span>
      </span>
    </Link>
  );
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "–";
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "noch nie";
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
}

export function relativeAge(value: string | null | undefined, now: Date): string {
  if (!value) return "noch nie";
  const hours = (now.getTime() - new Date(value).getTime()) / 3_600_000;
  if (hours < 1) return "vor weniger als einer Stunde";
  if (hours < 24) return `vor ${Math.floor(hours)} Std.`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}
