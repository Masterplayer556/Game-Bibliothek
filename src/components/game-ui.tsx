// Building blocks around a game: cover, badges, list rows. Presentation only.
import Link from "next/link";
import { DEVICE_LABEL, formatMinutes, PLATFORM_LABEL, STATUS_LABEL } from "@/core/labels";
import type { LibraryGame } from "@/core/library";
import type { DeviceKind, GameStatus, PlatformId } from "@/core/types";

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

/** Games without a cover get one of five cloth bindings; the same title always gets the same one. */
export function clothIndex(title: string): number {
  let sum = 0;
  for (const char of title) sum += char.codePointAt(0)!;
  return (sum % 5) + 1;
}

const PLATFORM_CODE: Record<PlatformId, string> = { steam: "PC", psn: "PS", nintendo: "NSW", manual: "MAN" };

/**
 * A shelf mark as on a library spine label: platforms, year of release, first letters of the title.
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

const STAMP_TONE: Record<GameStatus, string> = {
  completed: "text-success",
  playing: "text-accent",
  backlog: "text-highlight",
  dropped: "text-muted",
};

/** The cover as a bound book. `bookmark` hangs a ribbon over it (favourite), `stamp` prints the status across it. */
export function GameCover({
  game,
  bookmark = false,
  stamp = null,
  className = "",
}: {
  game: Pick<LibraryGame, "title" | "coverUrl">;
  bookmark?: boolean;
  stamp?: GameStatus | null;
  className?: string;
}) {
  return (
    <div className={`book aspect-[3/4] bg-surface-raised ${className}`}>
      {game.coverUrl ? (
        // The picture is shown whole, so no title is cut off: covers come upright (IGDB), wide
        // (Steam) or square (PlayStation). What it leaves free is filled with a blurred copy of itself.
        // Covers come from many hosts; next/image cannot optimise them in a static export.
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.coverUrl} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover blur-md brightness-75" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.coverUrl} alt="" loading="lazy" className="relative h-full w-full object-contain" />
        </>
      ) : (
        <div
          aria-hidden
          className="book-cloth flex h-full w-full items-center justify-center pl-[9%] font-display text-[34cqw] font-semibold text-cloth-ink"
          style={{ background: `var(--color-cloth-${clothIndex(game.title)})` }}
        >
          {initials(game.title)}
        </div>
      )}
      {bookmark ? <span aria-hidden className="bookmark" /> : null}
      {stamp ? <span className={`stamp ${STAMP_TONE[stamp]}`}>{STATUS_LABEL[stamp]}</span> : null}
    </div>
  );
}

/**
 * The mood of a game behind its details: its cover, blurred and washed out, or the colour of its
 * cloth binding. The parent needs `relative overflow-hidden`; content goes on top with `relative`.
 */
export function CoverBackdrop({ game }: { game: Pick<LibraryGame, "title" | "coverUrl"> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt="" className="h-full w-full scale-150 object-cover opacity-60 blur-2xl saturate-150" />
      ) : (
        <div className="h-full w-full opacity-35" style={{ background: `var(--color-cloth-${clothIndex(game.title)})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-surface/40 via-surface/65 to-surface/85" />
    </div>
  );
}

const badgeClass =
  "inline-flex items-center gap-1 rounded-[3px] border border-border bg-field px-1.5 py-0.5 text-[11px] leading-tight text-muted";

export function PlatformBadge({ platform }: { platform: PlatformId }) {
  return (
    <span className={badgeClass}>
      <span aria-hidden className="h-2 w-2" style={{ background: `var(--color-platform-${platform})` }} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function DeviceBadge({ kind }: { kind: DeviceKind }) {
  return (
    <span className={badgeClass}>
      <span aria-hidden className="h-2 w-2" style={{ background: `var(--color-device-${kind})` }} />
      {DEVICE_LABEL[kind]}
    </span>
  );
}

/** A book standing on its shelf board, with a lift on hover. For grids with gap-stack. */
export function ShelfCover({
  game,
  bookmark = false,
  stamp = null,
}: {
  game: Pick<LibraryGame, "title" | "coverUrl">;
  bookmark?: boolean;
  stamp?: GameStatus | null;
}) {
  return (
    <div className="shelf px-[7%] pt-1.5">
      <GameCover
        game={game}
        bookmark={bookmark}
        stamp={stamp}
        className="origin-bottom transition-transform duration-150 group-hover:-translate-y-1.5 group-hover:-rotate-2 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:rotate-0"
      />
    </div>
  );
}

export function GameCard({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="group flex h-full flex-col gap-2 rounded-control">
      <ShelfCover game={game} bookmark={game.favorite} stamp={game.status} />
      <div className="flex flex-col gap-1.5 px-1">
        <div className="line-clamp-2 text-sm font-medium leading-tight group-hover:text-accent">
          {game.favorite ? <span className="sr-only">Favorit: </span> : null}
          {game.title}
        </div>
        <div className="flex flex-wrap gap-1">
          {game.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>
        <div className="text-xs tabular-nums text-muted">{game.totalMinutes > 0 ? formatMinutes(game.totalMinutes) : "Nie gespielt"}</div>
      </div>
    </Link>
  );
}


/** One line of the library as a list: small cover, title, platforms, status, last played, playtime. */
export function GameListRow({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="group flex items-center gap-3 rounded-control p-2 hover:bg-surface-raised">
      <GameCover game={game} bookmark={game.favorite} className="w-12 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium group-hover:text-accent">
          {game.favorite ? <span className="sr-only">Favorit: </span> : null}
          {game.title}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {game.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
          {game.status ? <span className={`text-[11px] font-medium ${STAMP_TONE[game.status]}`}>{STATUS_LABEL[game.status]}</span> : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
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
