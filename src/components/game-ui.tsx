// Building blocks around a game: cover, badges, list rows. Presentation only.
import Link from "next/link";
import { DEVICE_LABEL, formatMinutes, PLATFORM_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import type { DeviceKind, PlatformId } from "@/core/types";

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

export function GameCover({ game, className = "" }: { game: Pick<LibraryGame, "title" | "coverUrl">; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-control bg-surface-raised ${className}`}>
      {game.coverUrl ? (
        // Covers come from many hosts; next/image cannot optimise them in a static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted">
          {initials(game.title)}
        </div>
      )}
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: PlatformId }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-border px-1.5 py-0.5 text-[11px] text-muted">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--color-platform-${platform})` }} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function DeviceBadge({ kind }: { kind: DeviceKind }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-border px-1.5 py-0.5 text-[11px] text-muted">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--color-device-${kind})` }} />
      {DEVICE_LABEL[kind]}
    </span>
  );
}

export function GameCard({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="flex flex-col gap-1.5 rounded-card bg-surface p-2 hover:bg-surface-raised">
      <GameCover game={game} />
      <div className="line-clamp-2 text-sm font-medium leading-tight">
        {game.favorite ? <span aria-label="Favorit">★ </span> : null}
        {game.title}
      </div>
      <div className="flex flex-wrap gap-1">
        {game.platforms.map((p) => (
          <PlatformBadge key={p} platform={p} />
        ))}
      </div>
      <div className="text-xs tabular-nums text-muted">{game.totalMinutes > 0 ? formatMinutes(game.totalMinutes) : "Nie gespielt"}</div>
    </Link>
  );
}

/** A compact game line. The caller puts it into an <li>. */
export function GameRow({ game, right }: { game: LibraryGame; right?: React.ReactNode }) {
  return (
    <Link href={gameHref(game.id)} className="flex items-center gap-3 rounded-control p-1.5 hover:bg-surface-raised">
      <GameCover game={game} className="w-10 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">{game.title}</span>
      {right ? <span className="shrink-0 text-sm tabular-nums text-muted">{right}</span> : null}
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
