import type { SyntheticEvent } from "react";
import { describe, expect, it } from "vitest";
import { steamCoverFallback, steamHeaderFor } from "./game-ui";

const COVER = "https://shared.steamstatic.com/store_item_assets/steam/apps/322500/library_600x900_2x.jpg?t=1";
const HEADER = "https://shared.steamstatic.com/store_item_assets/steam/apps/322500/header.jpg";

describe("steamCoverFallback", () => {
  it("finds the wide header of an upright Steam cover, and leaves other pictures alone", () => {
    expect(steamHeaderFor(COVER)).toBe(HEADER);
    expect(steamHeaderFor(HEADER)).toBe(HEADER);
    expect(steamHeaderFor("https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg")).toContain("igdb");
  });

  it("swaps the picture and its blurred copy to the header, once", () => {
    const fill = { src: COVER };
    const img = { src: COVER, closest: () => ({ querySelector: () => fill }) };
    const event = { currentTarget: img } as unknown as SyntheticEvent<HTMLImageElement>;
    steamCoverFallback(event);
    expect([img.src, fill.src]).toEqual([HEADER, HEADER]);
    // the header fails too: nothing left to try
    steamCoverFallback(event);
    expect(img.src).toBe(HEADER);
  });
});
