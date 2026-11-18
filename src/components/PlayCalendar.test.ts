import { describe, expect, it } from "vitest";
import { heatLevel } from "./PlayCalendar";

describe("heatLevel", () => {
  it("goes up one step per hour to the full colour at 4 h, then turns white at 5, 7 and 10 h", () => {
    const at = (hours: number) => heatLevel(Math.round(hours * 60));
    expect(heatLevel(0)).toBe(0);
    expect([at(0.1), at(0.99)]).toEqual([1, 1]);
    expect([at(1), at(2), at(3), at(4)]).toEqual([2, 3, 4, 5]);
    expect([at(4.9), at(5), at(6.9), at(7), at(9.9), at(10), at(16)]).toEqual([5, 6, 6, 7, 7, 8, 8]);
  });
});
