import { describe, expect, it } from "vitest";
import { clampOffset, offsetKeepingEnd, WINDOW_SIZE, windowBounds } from "./history-window";
import { playtimeSeries } from "./library";

const series = (from: string, to: string, bucket: "day" | "week" | "month" | "year") => playtimeSeries([], { from, to }, bucket);

describe("history window", () => {
  it("shows the newest bars first and stops at the oldest", () => {
    expect(windowBounds(40, 12, 0)).toEqual([28, 40]);
    expect(windowBounds(40, 12, 6)).toEqual([22, 34]);
    expect(windowBounds(40, 12, 99)).toEqual([0, 12]);
    expect(windowBounds(5, 12, 3)).toEqual([0, 5]); // shorter than one window: nothing to move
    expect(clampOffset(-3, 40, 12)).toBe(0);
    expect(clampOffset(3.6, 40, 12)).toBe(4);
  });

  it("keeps the same point in time when switching from months to weeks", () => {
    const months = series("2022-01-01", "2026-11-16", "month");
    // window of 12 months ending March 2024
    const offset = months.length - 1 - months.findIndex((p) => p.key === "2024-03");
    const weeks = series("2022-01-01", "2026-11-16", "week");
    const next = offsetKeepingEnd(months, "month", offset, weeks, "week");
    const [, end] = windowBounds(weeks.length, WINDOW_SIZE.week, next);
    expect(weeks[end - 1]!.key).toBe("2024-03-25"); // the week with 31.03.2024
  });

  it("stays at today when the window ends today", () => {
    const months = series("2022-01-01", "2026-11-16", "month");
    const days = series("2022-01-01", "2026-11-16", "day");
    expect(offsetKeepingEnd(months, "month", 0, days, "day")).toBe(0);
  });

  it("goes as far back as possible when the new bucket cannot reach that far", () => {
    const days = series("2026-01-01", "2026-11-16", "day");
    const years = series("2026-01-01", "2026-11-16", "year");
    expect(offsetKeepingEnd(days, "day", 200, years, "year")).toBe(0);
  });
});
