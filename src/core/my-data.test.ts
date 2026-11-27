import { describe, expect, it } from "vitest";
import { nextRating, statusChange, validRating } from "./my-data";

describe("rating", () => {
  it("accepts whole numbers from 1 to 5 only", () => {
    expect([1, 5].map(validRating)).toEqual([1, 5]);
    expect([0, 6, 2.5, "3", null].map(validRating)).toEqual([null, null, null, null, null]);
  });

  it("sets the tapped star, or removes the rating when it is tapped again", () => {
    expect(nextRating(null, 4)).toBe(4);
    expect(nextRating(2, 4)).toBe(4);
    expect(nextRating(4, 4)).toBeNull();
  });
});

describe("statusChange", () => {
  it("fills in today when a game is marked as finished without a day", () => {
    expect(statusChange("completed", null, "2026-11-27")).toEqual({ status: "completed", completed_on: "2026-11-27" });
  });

  it("keeps a day entered before", () => {
    expect(statusChange("completed", "2026-05-01", "2026-11-27")).toEqual({ status: "completed" });
    expect(statusChange("playing", "2026-05-01", "2026-11-27")).toEqual({ status: "playing" });
    expect(statusChange(null, null, "2026-11-27")).toEqual({ status: null });
  });
});
