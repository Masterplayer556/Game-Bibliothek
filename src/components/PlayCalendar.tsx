// A year of play days as a grid of pixels: one square per day, darker with more time played.
import { formatMinutes } from "@/core/labels";
import type { GameDay } from "@/core/library";
import { addDays, weekStart } from "@/core/time";
import type { LocalDate } from "@/core/types";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Upper limits in minutes of the four coloured steps. */
const STEPS = [30, 60, 120] as const;

function level(minutes: number): number {
  if (minutes <= 0) return 0;
  const step = STEPS.findIndex((limit) => minutes < limit);
  return step === -1 ? STEPS.length + 1 : step + 1;
}

function label(date: LocalDate): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export function PlayCalendar({ days, today, weeks = 53 }: { days: readonly GameDay[]; today: LocalDate; weeks?: number }) {
  const first = addDays(weekStart(today), -(weeks - 1) * 7);
  const minutesOn = new Map<LocalDate, number>();
  for (const d of days) {
    if (d.date >= first && d.date <= today) minutesOn.set(d.date, (minutesOn.get(d.date) ?? 0) + d.minutes);
  }

  const columns = Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(first, w * 7);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    // Name a month above the first week that starts in it.
    const month = Number(monday.slice(8, 10)) <= 7 ? MONTHS[Number(monday.slice(5, 7)) - 1] : null;
    return { monday, dates, month };
  });

  return (
    <figure className="flex flex-col gap-2">
      {/* On a narrow screen the oldest weeks are cut off on the left; the latest stay visible. */}
      <div className="flex justify-end overflow-hidden" role="img" aria-label={`Spieltage der letzten ${weeks} Wochen: an ${minutesOn.size} Tagen gespielt`}>
        <div className="flex gap-[3px]">
          {columns.map((column) => (
            <div key={column.monday} className="flex flex-col gap-[3px]">
              <div className="relative h-4 w-3">
                {column.month ? <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] text-muted">{column.month}</span> : null}
              </div>
              {column.dates.map((date) =>
                date > today ? (
                  <span key={date} className="h-3 w-3" />
                ) : (
                  <span
                    key={date}
                    className="h-3 w-3 rounded-[2px]"
                    style={{ background: `var(--color-heat-${level(minutesOn.get(date) ?? 0)})` }}
                    title={`${label(date)}: ${minutesOn.has(date) ? formatMinutes(minutesOn.get(date)!) : "nicht gespielt"}`}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          An <span className="num text-sm text-text">{minutesOn.size}</span> Tagen gespielt
        </span>
        <span className="flex items-center gap-1.5">
          0
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-3 w-3 rounded-[2px]" style={{ background: `var(--color-heat-${l})` }} />
          ))}
          2 Std. und mehr
        </span>
      </figcaption>
    </figure>
  );
}
