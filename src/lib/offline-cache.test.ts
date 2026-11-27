import { describe, expect, it } from "vitest";
import { CACHE_VERSION, storedSession, usableCache } from "./offline-cache";

const raw = { games: [], platformGames: [], devices: [], daily: [], snapshots: [], achievements: [], userData: [], connections: [], settings: {} };

describe("usableCache", () => {
  const entry = { version: CACHE_VERSION, userId: "u1", savedAt: "2026-11-27T10:00:00Z", raw };

  it("takes a complete entry of the same user", () => {
    expect(usableCache(entry, "u1")).toEqual(entry);
  });

  it("refuses another user, an old version or a missing table", () => {
    expect(usableCache(entry, "u2")).toBeNull();
    expect(usableCache({ ...entry, version: CACHE_VERSION - 1 }, "u1")).toBeNull();
    const partial = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "achievements"));
    expect(usableCache({ ...entry, raw: partial }, "u1")).toBeNull();
    expect(usableCache({ ...entry, raw: { ...raw, settings: null } }, "u1")).toBeNull();
    expect(usableCache(undefined, "u1")).toBeNull();
  });
});

describe("storedSession", () => {
  it("reads a stored login with tokens and a user", () => {
    const session = { access_token: "a", refresh_token: "r", expires_at: 1, user: { id: "u1" } };
    expect(storedSession(JSON.stringify(session))?.user.id).toBe("u1");
  });

  it("ignores anything else", () => {
    expect(storedSession(null)).toBeNull();
    expect(storedSession("{")).toBeNull();
    expect(storedSession(JSON.stringify({ access_token: "a", user: { id: "u1" } }))).toBeNull();
    expect(storedSession("null")).toBeNull();
  });
});
