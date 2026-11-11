"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LibraryGate } from "@/components/LibraryGate";
import { Card, fieldClass, Notice } from "@/components/ui";
import { WrappedCards } from "@/components/WrappedCards";
import { DEFAULT_PILE_THRESHOLD_MINUTES } from "@/core/library";
import { toLocalDate } from "@/core/time";
import { availableYears, buildWrapped } from "@/core/wrapped";

function WrappedContent() {
  const router = useRouter();
  const requested = Number(useSearchParams().get("year"));

  return (
    <LibraryGate>
      {({ library, raw }) => {
        const today = toLocalDate(new Date());
        const years = availableYears(library.days, today);
        const currentYear = Number(today.slice(0, 4));
        if (years.length === 0) {
          return (
            <Card title="Jahresrückblick">
              <Notice>
                {library.days.length === 0
                  ? "Noch keine Spielzeit erfasst. Lade Demo-Daten oder verbinde eine Plattform."
                  : `Der Rückblick auf ${currentYear} erscheint im Dezember.`}
              </Notice>
            </Card>
          );
        }
        const year = years.includes(requested) ? requested : years[0]!;
        const stored = Number(raw.settings.pileThresholdMinutes);
        const wrapped = buildWrapped(library, raw.achievements, year, {
          today,
          pileThresholdMinutes: Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_PILE_THRESHOLD_MINUTES,
        });
        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Jahresrückblick</h2>
              <select
                className={fieldClass}
                aria-label="Jahr"
                value={year}
                onChange={(e) => router.replace(`/rueckblick/?year=${e.target.value}`)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {year === currentYear ? <Notice>Das Jahr läuft noch: Stand heute.</Notice> : null}
            {!years.includes(currentYear) && library.days.some((d) => d.date.startsWith(String(currentYear))) ? (
              <Notice>Der Rückblick auf {currentYear} erscheint im Dezember.</Notice>
            ) : null}
            <WrappedCards key={year} wrapped={wrapped} library={library} />
          </>
        );
      }}
    </LibraryGate>
  );
}

export default function WrappedPage() {
  return (
    <Suspense fallback={<Notice>Lade …</Notice>}>
      <WrappedContent />
    </Suspense>
  );
}
