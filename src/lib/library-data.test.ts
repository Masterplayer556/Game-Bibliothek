// Loader and actions against the real schema (in-memory Postgres).
import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { buildLibrary } from "../core/library";
import {
  addManualGame,
  deleteManualEntry,
  loadDemoData,
  loadRawData,
  mergeGames,
  removeDemoData,
  saveSettings,
  saveUserData,
  splitEntry,
} from "./library-data";

const USER = "11111111-1111-1111-1111-111111111111";
let pg: PGlite;
let db: SupabaseClient;

const library = async () => buildLibrary(await loadRawData(db));
const find = async (title: string) => (await library()).games.find((g) => g.title === title)!;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
  await loadDemoData(db, USER);
}, 60_000);

describe("loadRawData", () => {
  it("loads the demo library", async () => {
    const raw = await loadRawData(db);
    expect(raw.platformGames).toHaveLength(41);
    expect(raw.achievements.length).toBeGreaterThan(800);
    expect(typeof raw.achievements[0]!.rarity_percent).toBe("number");
    const lib = buildLibrary(raw);
    expect(lib.games.length).toBe(37);
    expect(lib.days.length).toBeGreaterThan(300);
  });
});

describe("actions", () => {
  it("saves my own data and settings", async () => {
    const game = await find("Cuphead");
    const current = { status: null, favorite: false, note: null, hide_from_pile: false, hidden: false };
    await saveUserData(db, USER, game.id, current, { status: "completed", note: "Alle Bosse" });
    await saveUserData(db, USER, game.id, { ...current, status: "completed", note: "Alle Bosse" }, { favorite: true });
    const after = await find("Cuphead");
    expect([after.status, after.note, after.favorite]).toEqual(["completed", "Alle Bosse", true]);

    await saveSettings(db, USER, { pileThresholdMinutes: 120 });
    expect((await loadRawData(db)).settings).toEqual({ pileThresholdMinutes: 120 });
  });

  it("adds a game by hand and links it to an existing game by title", async () => {
    const before = await find("Peggle Deluxe");
    const id = await addManualGame(db, USER, { title: "Peggle Deluxe", deviceKind: "xbox360", minutes: 300, owned: false });
    expect(id).toBe(before.id);
    const after = await find("Peggle Deluxe");
    expect(after.platforms).toEqual(["steam", "manual"]);
    expect(after.totalMinutes).toBe(before.totalMinutes + 300);
    // the starting value is not counted as played on a day
    expect((await library()).days.filter((d) => d.gameId === id && d.platform === "manual")).toHaveLength(0);
  });

  it("adds a new game without playtime", async () => {
    const id = await addManualGame(db, USER, { title: "Rayman 2", deviceKind: "other", minutes: null, owned: true });
    const game = (await library()).byId.get(id)!;
    expect([game.title, game.totalMinutes, game.owned, game.deviceKinds]).toEqual(["Rayman 2", 0, true, ["other"]]);
  });

  it("splits an entry into its own game and merges it back", async () => {
    const minecraft = await find("Minecraft");
    const java = minecraft.entries.find((e) => e.platform === "manual")!;
    const newId = await splitEntry(db, USER, java);
    let lib = await library();
    expect(lib.byId.get(newId)!.title).toBe("Minecraft: Java Edition");
    expect(lib.byId.get(minecraft.id)!.platforms).toEqual(["psn", "nintendo"]);

    await mergeGames(db, minecraft.id, newId);
    lib = await library();
    expect(lib.byId.has(newId)).toBe(false);
    expect(lib.byId.get(minecraft.id)!.platforms).toEqual(["psn", "nintendo", "manual"]);
    const locked = await pg.query("select 1 from game_bibliothek.platform_games where game_id = $1 and not game_link_locked", [minecraft.id]);
    expect(locked.rows).toHaveLength(0);
  });

  it("deletes a manual entry and its now empty game, and nothing else", async () => {
    const before = (await library()).games.length;
    const rayman = await find("Rayman 2");
    await deleteManualEntry(db, rayman.entries[0]!.id);
    const lib = await library();
    expect(lib.byId.has(rayman.id)).toBe(false);
    expect(lib.games.length).toBe(before - 1);
    // a game that keeps other entries survives
    const peggle = await find("Peggle Deluxe");
    await deleteManualEntry(db, peggle.entries.find((e) => e.platform === "manual")!.id);
    expect((await find("Peggle Deluxe")).platforms).toEqual(["steam"]);
    // entries from a sync cannot be deleted this way
    await deleteManualEntry(db, peggle.entries.find((e) => e.platform === "steam")!.id);
    expect((await find("Peggle Deluxe")).platforms).toEqual(["steam"]);
    await addManualGame(db, USER, { title: "Peggle Deluxe", deviceKind: "xbox360", minutes: 300, owned: false });
  });

  it("removes all demo data but keeps entries added by hand", async () => {
    await removeDemoData(db);
    const lib = await library();
    expect(lib.games.map((g) => g.title)).toEqual(["Peggle Deluxe"]);
    expect(lib.games[0]!.platforms).toEqual(["manual"]);
  });
});
