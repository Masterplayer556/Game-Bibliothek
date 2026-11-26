import { describe, expect, it } from "vitest";
import {
  addStartingBaselines,
  buildPlayedDays,
  resolveDailyRows,
  shouldWriteSnapshot,
  snapshotsToDays,
  spreadOverGap,
  sumByPeriod,
  type DailyRow,
  type SnapshotRow,
} from "./index";

const snap = (takenAt: string, totalMinutes: number, lastPlayedAt?: string): SnapshotRow => ({
  platformGameId: "g1",
  takenAt,
  totalMinutes,
  lastPlayedAt,
});

const daily = (over: Partial<DailyRow>): DailyRow => ({
  platformGameId: "n1",
  deviceId: "switch1",
  date: "2026-03-10",
  minutes: 60,
  source: "nintendo-parental",
  ...over,
});

describe("snapshotsToDays", () => {
  it("treats the first snapshot as a starting value only", () => {
    const { days } = snapshotsToDays([snap("2026-03-10T10:00:00Z", 5000)]);
    expect(days).toEqual([]);
  });

  it("assigns the difference to the day of the later snapshot", () => {
    const { days } = snapshotsToDays([
      snap("2026-03-10T10:00:00Z", 100),
      snap("2026-03-10T16:00:00Z", 160),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: "2026-03-10", minutes: 60, estimated: false });
  });

  it("uses lastPlayedAt when it lies between the snapshots", () => {
    // Played until 23:30 Zurich on the 10th, snapshot taken at 00:30 Zurich on the 11th.
    const { days } = snapshotsToDays([
      snap("2026-03-10T17:30:00Z", 100),
      snap("2026-03-10T23:30:00Z", 190, "2026-03-10T22:30:00Z"),
    ]);
    expect(days[0]).toMatchObject({ date: "2026-03-10", minutes: 90 });
  });

  it("ignores lastPlayedAt outside the interval", () => {
    const { days } = snapshotsToDays([
      snap("2026-03-10T10:00:00Z", 100),
      snap("2026-03-10T16:00:00Z", 130, "2026-03-01T12:00:00Z"),
    ]);
    expect(days[0]?.date).toBe("2026-03-10");
  });

  it("uses the Zurich calendar day, not UTC", () => {
    // 23:30 UTC on the 10th is 00:30 on the 11th in Zurich (winter time).
    const { days } = snapshotsToDays([
      snap("2026-01-10T18:00:00Z", 0),
      snap("2026-01-10T23:30:00Z", 30),
    ]);
    expect(days[0]?.date).toBe("2026-01-11");
  });

  it("counts negative differences as zero and reports them", () => {
    const { days, warnings } = snapshotsToDays([
      snap("2026-03-10T10:00:00Z", 100),
      snap("2026-03-10T16:00:00Z", 80),
      snap("2026-03-10T22:00:00Z", 95),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: "negative_delta", minutes: -20 });
    expect(days).toHaveLength(1);
    expect(days[0]?.minutes).toBe(15);
  });

  it("does not flag a long gap when the platform says when it was played", () => {
    const { days } = snapshotsToDays([
      snap("2026-03-01T10:00:00Z", 100),
      snap("2026-03-08T10:00:00Z", 400, "2026-03-07T19:00:00Z"),
    ]);
    expect(days[0]).toMatchObject({ date: "2026-03-07", minutes: 300, estimated: false });
  });

  it("flags gaps over 48 hours without a known play time as estimated and does not spread them", () => {
    const { days } = snapshotsToDays([
      snap("2026-03-01T10:00:00Z", 100),
      snap("2026-03-08T10:00:00Z", 400),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: "2026-03-08", minutes: 300, estimated: true });
  });

  it("adds up several differences on the same day and sorts unsorted input", () => {
    const { days } = snapshotsToDays([
      snap("2026-03-10T16:00:00Z", 160),
      snap("2026-03-10T06:00:00Z", 100),
      snap("2026-03-10T11:00:00Z", 130),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]?.minutes).toBe(60);
  });
});

describe("resolveDailyRows", () => {
  it("keeps devices apart", () => {
    const days = resolveDailyRows([daily({}), daily({ deviceId: "switch2", minutes: 30 })]);
    expect(days).toHaveLength(2);
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(90);
  });

  it("drops an import row when a native source has the same game and day", () => {
    const days = resolveDailyRows([
      daily({ deviceId: "switch2", minutes: 47 }),
      daily({ deviceId: "unknown", minutes: 45, source: "nintendo-import" }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ deviceId: "switch2", minutes: 47 });
  });

  it("keeps import rows for days without native data", () => {
    const days = resolveDailyRows([
      daily({ date: "2026-03-11" }),
      daily({ date: "2024-05-01", deviceId: "switch1", minutes: 75, source: "nintendo-import" }),
    ]);
    expect(days.map((d) => d.date).sort()).toEqual(["2024-05-01", "2026-03-11"]);
  });

  it("drops an import row when a sibling platform entry of the same game has native data", () => {
    // Import created its own entry ("import:minecraft"); the console reports the real one.
    const days = resolveDailyRows([
      daily({ platformGameId: "real", gameKey: "game-1", deviceId: "switch2", minutes: 50 }),
      daily({ platformGameId: "imported", gameKey: "game-1", deviceId: "unknown", minutes: 45, source: "nintendo-import" }),
      daily({ platformGameId: "imported", gameKey: "game-1", date: "2024-01-01", minutes: 30, source: "nintendo-import" }),
    ]);
    expect(days.map((d) => [d.platformGameId, d.date, d.minutes]).sort()).toEqual([
      ["imported", "2024-01-01", 30],
      ["real", "2026-03-10", 50],
    ]);
  });

  it("keeps two editions of one game that were both played natively on the same day", () => {
    const days = resolveDailyRows([
      daily({ platformGameId: "base", gameKey: "game-1", deviceId: "switch2", minutes: 20 }),
      daily({ platformGameId: "switch2-edition", gameKey: "game-1", deviceId: "switch2", minutes: 40 }),
    ]);
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(60);
  });

  it("never counts the same game, device and day twice", () => {
    const days = resolveDailyRows([daily({ minutes: 60 }), daily({ minutes: 80, source: "demo" })]);
    expect(days).toHaveLength(1);
    expect(days[0]?.minutes).toBe(80);
  });
});

describe("buildPlayedDays", () => {
  it("prefers per-day data over snapshots for the same game", () => {
    const { days } = buildPlayedDays({
      dailyRows: [daily({ platformGameId: "g1", date: "2026-03-10", minutes: 45 })],
      snapshots: [
        snap("2026-03-01T10:00:00Z", 0),
        snap("2026-03-01T16:00:00Z", 30),
        snap("2026-03-10T10:00:00Z", 30),
        snap("2026-03-10T16:00:00Z", 90),
      ],
    });
    // Snapshot day before the first per-day date counts, the overlapping one does not.
    expect(days.map((d) => [d.date, d.minutes, d.origin])).toEqual([
      ["2026-03-01", 30, "snapshot"],
      ["2026-03-10", 45, "daily"],
    ]);
  });

  it("combines games from different kinds of sources", () => {
    const { days } = buildPlayedDays({
      dailyRows: [daily({})],
      snapshots: [snap("2026-03-10T10:00:00Z", 0), snap("2026-03-10T16:00:00Z", 20)],
    });
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(80);
  });
});

describe("sumByPeriod", () => {
  const days = resolveDailyRows([
    daily({ date: "2026-03-01", minutes: 10 }), // Sunday
    daily({ date: "2026-03-02", minutes: 20 }), // Monday
    daily({ date: "2026-03-08", minutes: 30, estimated: true }), // Sunday
  ]);

  it("starts weeks on Monday", () => {
    const weeks = sumByPeriod(days, "week");
    expect(weeks.get("2026-02-23")?.minutes).toBe(10);
    expect(weeks.get("2026-03-02")).toEqual({ minutes: 50, estimated: true });
  });

  it("sums months and years", () => {
    expect(sumByPeriod(days, "month").get("2026-03")?.minutes).toBe(60);
    expect(sumByPeriod(days, "year").get("2026")?.minutes).toBe(60);
  });
});

describe("shouldWriteSnapshot", () => {
  it("writes the first snapshot and changed totals only", () => {
    expect(shouldWriteSnapshot(null, 0)).toBe(true);
    expect(shouldWriteSnapshot(undefined, 120)).toBe(true);
    expect(shouldWriteSnapshot(120, 120)).toBe(false);
    expect(shouldWriteSnapshot(120, 150)).toBe(true);
  });
});

describe("addStartingBaselines", () => {
  const at = (platformGameId: string, takenAt: string, totalMinutes: number, lastPlayedAt?: string): SnapshotRow => ({
    platformGameId,
    takenAt,
    totalMinutes,
    lastPlayedAt,
  });
  const platform = () => "steam";

  it("dates the first total of an entry that showed up after tracking began", () => {
    const snapshots = [
      at("old", "2026-03-01T06:00:00Z", 500),
      at("old", "2026-03-05T06:00:00Z", 560, "2026-03-04T21:00:00Z"),
      // bought and played on the 7th, first seen by the sync on the 8th
      at("new", "2026-03-08T06:00:00Z", 120, "2026-03-07T20:00:00Z"),
    ];
    const { days } = buildPlayedDays({ dailyRows: [], snapshots: addStartingBaselines(snapshots, platform) });
    expect(days.map((d) => [d.platformGameId, d.date, d.minutes, d.estimated])).toEqual([
      ["old", "2026-03-04", 60, false],
      ["new", "2026-03-07", 120, false],
    ]);
  });

  it("keeps the first snapshot a starting value at the first sync and for old play", () => {
    const snapshots = [
      at("a", "2026-03-01T06:00:00Z", 500),
      // shows up later, but the platform says it was last played before tracking began
      at("b", "2026-03-08T06:00:00Z", 300, "2026-01-07T20:00:00Z"),
      // shows up later, first played (per platform) before tracking began
      at("c", "2026-03-08T06:00:00Z", 200),
      // shows up later with 0 minutes: nothing to date
      at("d", "2026-03-08T06:00:00Z", 0),
    ];
    const withBaselines = addStartingBaselines(snapshots, platform, (id) => (id === "c" ? "2025-12-24T10:00:00Z" : null));
    expect(withBaselines).toEqual(snapshots);
  });

  it("works per platform", () => {
    const snapshots = [at("s", "2026-03-01T06:00:00Z", 10), at("p", "2026-03-08T06:00:00Z", 30)];
    const byId = (id: string) => (id === "s" ? "steam" : "psn");
    // «p» is the first PlayStation snapshot: the start of its tracking, not a new game
    expect(addStartingBaselines(snapshots, byId)).toEqual(snapshots);
  });
});

describe("spreadOverGap (sync gap of several days)", () => {
  it("leaves time on its day when it fits", () => {
    // 10 hours, the last session ending on the 12th, three days without a sync
    const { days } = snapshotsToDays([
      snap("2026-03-09T20:00:00Z", 100),
      snap("2026-03-12T21:00:00Z", 700, "2026-03-12T20:00:00Z"),
    ]);
    expect(days.map((d) => [d.date, d.minutes, d.estimated])).toEqual([["2026-03-12", 600, false]]);
  });

  it("shares time that cannot fit into one day among the fewest days before it", () => {
    // 30 hours between the 9th 21:00 and the 12th 10:00 (Zurich): the 12th only has 10 of them
    const { days } = snapshotsToDays([
      snap("2026-03-09T20:00:00Z", 0),
      snap("2026-03-12T09:00:00Z", 1800, "2026-03-12T08:30:00Z"),
    ]);
    expect(days.map((d) => [d.date, d.minutes, d.estimated])).toEqual([
      ["2026-03-11", 1200, true],
      ["2026-03-12", 600, true],
    ]);
    expect(days.reduce((s, d) => s + d.minutes, 0)).toBe(1800);
  });

  it("never puts more on a day than it has between the snapshots", () => {
    const parts = spreadOverGap(1800, "2026-03-12", Date.parse("2026-03-10T22:00:00Z"), Date.parse("2026-03-12T05:00:00Z"));
    expect(parts.reduce((s, p) => s + p.minutes, 0)).toBe(1800);
    expect(parts.every((p) => p.minutes <= 1440 && p.spread)).toBe(true);
    // the 12th has six hours (00:00–06:00 Zurich), the 11th all day: two days are enough
    expect(parts.map((p) => [p.date, p.minutes])).toEqual([["2026-03-11", 1440], ["2026-03-12", 360]]);
  });
});
