import { describe, expect, it } from "vitest";
import type { AdapterInfo } from "../src/core/adapter-catalog";
import { emptyBatch, type SyncBatch } from "../src/core/types";
import { overallStatus, redact, runAdapters } from "./runner";
import {
  AdapterError,
  type ConnectionPatch,
  type CredentialUpdate,
  type PlatformAdapter,
  type SyncStore,
} from "./types";

const silent = { info: () => undefined, warn: () => undefined };

function fakeAdapter(id: string, over: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    id,
    platform: "steam",
    displayName: id,
    capabilities: { library: true, totalPlaytime: true, dailyPlaytime: false, achievements: false },
    credentialSource: "env",
    requiredEnv: [],
    guide: "x.md",
    isConfigured: async () => true,
    testConnection: async () => ({ ok: true, message: "Verbindung ok" }),
    sync: async () => ({ batch: emptyBatch("steam", id) }),
    ...over,
  };
}

class FakeStore implements SyncStore {
  connections = new Map<string, ConnectionPatch>();
  saved: SyncBatch[] = [];
  credentialWrites: { adapterId: string; updates: readonly CredentialUpdate[] }[] = [];
  credentials: Record<string, Record<string, string>> = {};
  disabled = new Set<string>();
  order: string[] = [];
  failOnSave = false;

  async isEnabled(adapterId: string) {
    return !this.disabled.has(adapterId);
  }
  async getCredentials(adapterId: string) {
    return this.credentials[adapterId] ?? {};
  }
  async saveCredentials(adapterId: string, updates: readonly CredentialUpdate[]) {
    this.order.push("credentials");
    this.credentialWrites.push({ adapterId, updates });
  }
  async getPreviousGames() {
    return new Map();
  }
  async saveBatch(batch: SyncBatch) {
    this.order.push("batch");
    if (this.failOnSave) throw new Error("database down");
    this.saved.push(batch);
    return { devices: 0, games: batch.games.length, newGames: 0, snapshots: 0, dailyRows: 0, achievements: 0 };
  }
  async setConnection(adapter: AdapterInfo, patch: ConnectionPatch) {
    this.connections.set(adapter.id, patch);
  }
}

const run = (store: FakeStore, adapters: PlatformAdapter[], over: Partial<Parameters<typeof runAdapters>[0]> = {}) =>
  runAdapters({ adapters, store, mode: "sync", env: {}, log: silent, now: new Date("2026-11-10T12:00:00Z"), ...over });

describe("runAdapters", () => {
  it("keeps going when one adapter fails", async () => {
    const store = new FakeStore();
    const results = await run(store, [
      fakeAdapter("steam"),
      fakeAdapter("psn", {
        sync: async () => {
          throw new Error("boom");
        },
      }),
      fakeAdapter("nintendo-parental"),
    ]);
    expect(results.map((r) => r.outcome)).toEqual(["ok", "error", "ok"]);
    expect(store.saved).toHaveLength(2);
    expect(store.connections.get("psn")).toMatchObject({ status: "error", lastError: "boom" });
    expect(store.connections.get("steam")).toMatchObject({ status: "ok", lastError: null });
    expect(overallStatus(results)).toBe("partial");
  });

  it("skips adapters that are not configured and records the missing secrets", async () => {
    const store = new FakeStore();
    const results = await run(
      store,
      [fakeAdapter("steam", { requiredEnv: ["STEAM_API_KEY", "STEAM_ID"], isConfigured: async () => false })],
      { env: { STEAM_ID: "123456789" } },
    );
    expect(results[0]?.outcome).toBe("skipped_not_configured");
    expect(store.saved).toHaveLength(0);
    expect(store.connections.get("steam")).toMatchObject({
      status: "not_connected",
      configured: false,
      details: { missingEnv: ["STEAM_API_KEY"] },
    });
    expect(overallStatus(results)).toBe("success");
  });

  it("skips disabled adapters without touching them", async () => {
    const store = new FakeStore();
    store.disabled.add("steam");
    const results = await run(store, [fakeAdapter("steam")]);
    expect(results[0]?.outcome).toBe("skipped_disabled");
    expect(store.connections.size).toBe(0);
  });

  it("marks expired logins as auth_expired", async () => {
    const store = new FakeStore();
    const results = await run(store, [
      fakeAdapter("psn", {
        sync: async () => {
          throw new AdapterError("auth_expired", "Neue NPSSO nötig");
        },
      }),
    ]);
    expect(results[0]?.outcome).toBe("auth_expired");
    expect(store.connections.get("psn")).toMatchObject({ status: "auth_expired", lastError: "Neue NPSSO nötig" });
    expect(overallStatus(results)).toBe("error");
  });

  it("stores rotated tokens before the data, so they survive a failed save", async () => {
    const store = new FakeStore();
    store.failOnSave = true;
    const results = await run(store, [
      fakeAdapter("psn", {
        sync: async () => ({
          batch: emptyBatch("psn", "psn"),
          credentialUpdates: [{ kind: "refresh_token", value: "new-token" }],
        }),
      }),
    ]);
    expect(store.order).toEqual(["credentials", "batch"]);
    expect(store.credentialWrites).toHaveLength(1);
    expect(results[0]?.outcome).toBe("error");
  });

  it("removes secrets from stored error messages", async () => {
    const store = new FakeStore();
    store.credentials.psn = { refresh_token: "super-secret-refresh-token" };
    await run(
      store,
      [
        fakeAdapter("psn", {
          requiredEnv: ["STEAM_API_KEY"],
          sync: async () => {
            throw new Error("GET /x?key=ABCDEF123456 failed for super-secret-refresh-token");
          },
        }),
      ],
      { env: { STEAM_API_KEY: "ABCDEF123456" } },
    );
    const message = store.connections.get("psn")?.lastError ?? "";
    expect(message).not.toContain("ABCDEF123456");
    expect(message).not.toContain("super-secret-refresh-token");
    expect(message).toContain("***");
  });

  it("runs a connection test without saving data", async () => {
    const store = new FakeStore();
    const results = await run(
      store,
      [
        fakeAdapter("psn", {
          testConnection: async () => ({
            ok: true,
            message: "Verbindung ok",
            credentialUpdates: [
              { kind: "refresh_token", value: "abc" },
              { kind: "npsso", value: null },
            ],
          }),
        }),
        fakeAdapter("steam", { testConnection: async () => ({ ok: false, message: "Key ungültig" }) }),
      ],
      { mode: "test" },
    );
    expect(store.saved).toHaveLength(0);
    expect(store.credentialWrites[0]?.updates).toHaveLength(2);
    expect(results.map((r) => r.outcome)).toEqual(["ok", "error"]);
    expect(store.connections.get("steam")).toMatchObject({ status: "error", lastError: "Key ungültig" });
  });

  it("runs a single adapter when asked and rejects unknown ids", async () => {
    const store = new FakeStore();
    const adapters = [fakeAdapter("steam"), fakeAdapter("psn")];
    const results = await run(store, adapters, { only: "psn" });
    expect(results.map((r) => r.adapterId)).toEqual(["psn"]);
    await expect(run(store, adapters, { only: "nope" })).rejects.toThrow(/Unknown adapter/);
  });
});

describe("redact", () => {
  it("ignores short or missing values", () => {
    expect(redact("id 12 failed", ["12", undefined, ""])).toBe("id 12 failed");
  });
});
