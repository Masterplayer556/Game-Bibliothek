import { describe, expect, it } from "vitest";
import { snapshotsToDays } from "../playtime";
import { diffDays } from "../time";
import { DEMO_SOURCE } from "../types";
import { buildDemoBatches } from "./index";

const NOW = new Date("2026-11-10T12:00:00Z");
const batches = buildDemoBatches(NOW);
const byPlatform = Object.fromEntries(batches.map((b) => [b.platform, b]));

describe("demo data", () => {
  it("is deterministic", () => {
    expect(buildDemoBatches(NOW)).toEqual(batches);
  });

  it("tags everything as demo", () => {
    for (const batch of batches) {
      expect(batch.source).toBe(DEMO_SOURCE);
      for (const game of batch.games) expect(game.externalId.startsWith("demo:")).toBe(true);
      for (const device of batch.devices) expect(device.externalId.startsWith("demo:")).toBe(true);
    }
  });

  it("contains the full game list", () => {
    expect(byPlatform.steam!.games).toHaveLength(11);
    expect(byPlatform.psn!.games).toHaveLength(7);
    expect(byPlatform.nintendo!.games).toHaveLength(21);
    expect(byPlatform.manual!.games.map((g) => g.title).sort()).toEqual([
      "Minecraft: Java Edition",
      "Rayman Origins",
    ]);
    const rayman = byPlatform.manual!.games.find((g) => g.title === "Rayman Origins");
    expect(rayman).toMatchObject({ owned: false, deviceKind: "xbox360" });
  });

  it("covers about 14 months and ends yesterday", () => {
    const dates = byPlatform.nintendo!.dailyPlaytime.map((d) => d.date).sort();
    expect(dates.at(-1)! <= "2026-11-09").toBe(true);
    expect(diffDays(dates[0]!, "2026-11-09")).toBeGreaterThan(395);
    expect(diffDays(dates[0]!, "2026-11-09")).toBeLessThan(426);
  });

  it("uses both consoles and keeps Switch 2 games off the Switch 1", () => {
    const nintendo = byPlatform.nintendo!;
    const devices = new Set(nintendo.dailyPlaytime.map((d) => d.deviceExternalId));
    expect(devices).toEqual(new Set(["demo:switch1", "demo:switch2"]));
    const bananza = nintendo.dailyPlaytime.filter((d) => d.gameExternalId.includes("bananza"));
    expect(bananza.length).toBeGreaterThan(0);
    expect(bananza.every((d) => d.deviceExternalId === "demo:switch2")).toBe(true);
  });

  it("never plays a game before its release", () => {
    const pokopia = byPlatform.nintendo!.dailyPlaytime.filter((d) => d.gameExternalId.includes("pokopia"));
    expect(pokopia.length).toBeGreaterThan(0);
    expect(pokopia.every((d) => d.date >= "2026-03-05")).toBe(true);
  });

  it("has at most one row per game, device and day", () => {
    const keys = byPlatform.nintendo!.dailyPlaytime.map(
      (d) => `${d.gameExternalId}|${d.deviceExternalId}|${d.date}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives Nintendo games no lifetime total and no achievements", () => {
    for (const game of byPlatform.nintendo!.games) {
      expect(game.totalPlaytimeMinutes).toBeUndefined();
      expect(game.achievementsTotal).toBeNull();
    }
    expect(byPlatform.nintendo!.achievements).toHaveLength(0);
  });

  it("produces snapshots that only grow and add up to the reported total", () => {
    for (const platform of ["steam", "psn"] as const) {
      const batch = byPlatform[platform]!;
      for (const game of batch.games) {
        const snapshots = batch
          .snapshots!.filter((s) => s.gameExternalId === game.externalId)
          .map((s) => ({ platformGameId: game.externalId, takenAt: s.takenAt, totalMinutes: s.totalMinutes, lastPlayedAt: s.lastPlayedAt }));
        const { days, warnings } = snapshotsToDays(snapshots);
        expect(warnings).toEqual([]);
        const played = days.reduce((sum, d) => sum + d.minutes, 0);
        expect(snapshots[0]!.totalMinutes + played).toBe(game.totalPlaytimeMinutes);
        // the demo knows when each session happened, so nothing is estimated
        expect(days.every((d) => !d.estimated)).toBe(true);
      }
    }
  });

  it("matches achievement counts with the generated list", () => {
    for (const platform of ["steam", "psn"] as const) {
      const batch = byPlatform[platform]!;
      for (const game of batch.games) {
        const list = batch.achievements.filter((a) => a.gameExternalId === game.externalId);
        expect(list).toHaveLength(game.achievementsTotal ?? 0);
        expect(list.filter((a) => a.unlockedAt).length).toBe(game.achievementsUnlocked ?? 0);
      }
    }
    const hollowKnight = byPlatform.psn!.games.find((g) => g.title === "Hollow Knight");
    expect([hollowKnight?.achievementsUnlocked, hollowKnight?.achievementsTotal]).toEqual([34, 63]);
  });
});
