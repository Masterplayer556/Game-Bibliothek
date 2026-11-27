import { describe, expect, it } from "vitest";
import type { RawData } from "../core/library";
import { ALL_PARTS, ReloadOrder } from "./library-data";

const full = (note: string): RawData => ({
  games: [], platformGames: [], devices: [], daily: [], snapshots: [], achievements: [], connections: [],
  settings: { note },
  userData: [{ game_id: "g", status: null, favorite: false, note, hide_from_pile: false, hidden: false, rating: null, completed_on: null }],
});

describe("ReloadOrder", () => {
  it("does not let a slow full reload bring back a note saved meanwhile", () => {
    const order = new ReloadOrder();
    let shown = order.take(order.begin(), full("alt"), null)!;
    const slowFull = order.begin(); // e.g. coming back to the app
    const quickNote = order.begin(); // saving a note, reloads one table
    shown = order.take(quickNote, { userData: full("neu").userData }, shown)!;
    expect(shown.userData[0]!.note).toBe("neu");
    // the full reload read the tables before the note was saved
    const late = order.take(slowFull, full("alt"), shown)!;
    expect(late.userData[0]!.note).toBe("neu");
    // the tables nobody reloaded since are still taken from it
    expect(late.settings).toEqual({ note: "alt" });
  });

  it("drops an answer that has nothing newer, and waits for a complete first answer", () => {
    const order = new ReloadOrder();
    const first = order.begin();
    const second = order.begin();
    expect(order.take(second, { userData: [] }, null)).toBeNull();
    const shown = order.take(first, full("a"), null)!;
    expect(Object.keys(shown).sort()).toEqual([...ALL_PARTS].sort());
    const third = order.begin();
    order.take(third, full("b"), shown);
    expect(order.take(second, full("c"), shown)).toBeNull();
  });
});
