import { describe, expect, it } from "vitest";
import { failuresBySource, formatDuration, isFinished, isStale, runDurationMs, type RunStatus, type SyncRun } from "./sync-control";

const NOW = new Date("2026-11-14T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("sync run state", () => {
  it("knows which states are final", () => {
    const states: RunStatus[] = ["queued", "running", "success", "partial", "error"];
    expect(states.map(isFinished)).toEqual([false, false, true, true, true]);
  });

  it("treats an open run as stale after 25 minutes without news, a finished one never", () => {
    expect(isStale({ status: "running", created_at: ago(24), started_at: ago(20) }, NOW)).toBe(false);
    expect(isStale({ status: "queued", created_at: ago(26), started_at: null }, NOW)).toBe(true);
    expect(isStale({ status: "running", created_at: ago(600), started_at: ago(599) }, NOW)).toBe(true);
    expect(isStale({ status: "error", created_at: ago(600), started_at: null }, NOW)).toBe(false);
  });

  it("does not give up on a run that waited behind another one and is still within the job's time", () => {
    // queued 12 minutes behind the scheduled sync, running for 10: 22 minutes since it was created
    expect(isStale({ status: "running", created_at: ago(22), started_at: ago(10) }, NOW)).toBe(false);
    expect(isStale({ status: "running", created_at: ago(40), started_at: ago(18) }, NOW)).toBe(false);
    // a queued run that waits longer than a whole sync can take never started
    expect(isStale({ status: "queued", created_at: ago(24), started_at: null }, NOW)).toBe(false);
  });
});

describe("sync history", () => {
  const run = (over: Partial<SyncRun>): SyncRun => ({
    id: "r", mode: "sync", adapter_id: null, status: "success", results: [],
    created_at: ago(10), started_at: ago(9), finished_at: ago(7), ...over,
  });

  it("measures a run from its start, or from its creation if it never started", () => {
    expect(runDurationMs(run({}))).toBe(2 * 60_000);
    expect(runDurationMs(run({ started_at: null }))).toBe(3 * 60_000);
    expect(runDurationMs(run({ finished_at: null, status: "running" }))).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(45_400)).toBe("45 s");
    expect(formatDuration(125_000)).toBe("2 Min. 05 s");
    expect(formatDuration(3_720_000)).toBe("1 Std. 02 Min.");
  });

  it("counts failures per source, with the newest message", () => {
    const runs = [
      run({ results: [{ adapterId: "psn", outcome: "auth_expired", message: "neu" }, { adapterId: "steam", outcome: "ok" }] }),
      run({ results: [{ adapterId: "psn", outcome: "error", message: "alt" }, { adapterId: "steam", outcome: "error" }] }),
      run({ results: [{ adapterId: "nintendo-parental", outcome: "skipped_not_configured" }] }),
    ];
    expect(failuresBySource(runs)).toEqual([
      { adapterId: "psn", count: 2, lastMessage: "neu" },
      { adapterId: "steam", count: 1, lastMessage: null },
    ]);
  });
});
