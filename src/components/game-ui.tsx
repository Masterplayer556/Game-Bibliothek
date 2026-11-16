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

/** Games without a cover get one of five cloth bindings; the same title always gets the same one. */
function clothIndex(title: string): number {
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

/** The cover as a bound book. `bookmark` hangs a ribbon over it (favourite). */
export function GameCover({
  game,
  bookmark = false,
  className = "",
}: {
  game: Pick<LibraryGame, "title" | "coverUrl">;
  bookmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`book aspect-square bg-surface-raised ${className}`}>
      {game.coverUrl ? (
        // Covers come from many hosts; next/image cannot optimise them in a static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
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
export function ShelfCover({ game, bookmark = false }: { game: Pick<LibraryGame, "title" | "coverUrl">; bookmark?: boolean }) {
  return (
    <div className="shelf px-[7%] pt-1">
      <GameCover
        game={game}
        bookmark={bookmark}
        className="transition-transform duration-150 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      />
    </div>
  );
}

export function GameCard({ game }: { game: LibraryGame }) {
  return (
    <Link href={gameHref(game.id)} className="group flex h-full flex-col gap-2 rounded-control">
      <ShelfCover game={game} bookmark={game.favorite} />
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
