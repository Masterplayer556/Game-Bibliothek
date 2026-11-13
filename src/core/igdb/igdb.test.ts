import { describe, expect, it } from "vitest";
import { coverUrl, germanGenre, login, parseGame, searchMany, type IgdbGame } from "./client";
import { pickBestMatch, searchTitle, titleSimilarity } from "./match";

const game = (over: Partial<IgdbGame>): IgdbGame => ({
  igdbId: 1,
  title: "x",
  alternativeNames: [],
  coverUrl: null,
  genres: [],
  releaseYear: null,
  platformIds: [],
  ratingCount: 0,
  ...over,
});

describe("searchTitle", () => {
  it("removes trademarks and platform suffixes", () => {
    expect(searchTitle("Grand Theft Auto V (PlayStation®5)")).toBe("Grand Theft Auto V");
    expect(searchTitle("Minecraft for Nintendo Switch")).toBe("Minecraft");
    expect(searchTitle("The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition")).toBe(
      "The Legend of Zelda: Tears of the Kingdom",
    );
    expect(searchTitle("ASTRO BOT™")).toBe("ASTRO BOT");
  });
});

describe("pickBestMatch", () => {
  const hk = game({ igdbId: 14593, title: "Hollow Knight", platformIds: [6, 48, 130], ratingCount: 900 });
  const silksong = game({ igdbId: 26286, title: "Hollow Knight: Silksong", platformIds: [6, 167] });
  const voidheart = game({ igdbId: 99, title: "Hollow Knight: Voidheart Edition", platformIds: [48] });

  it("prefers the exact title", () => {
    expect(pickBestMatch("Hollow Knight", [voidheart, silksong, hk])?.igdbId).toBe(14593);
    expect(pickBestMatch("Hollow Knight: Silksong", [hk, silksong])?.igdbId).toBe(26286);
  });

  it("finds German titles through alternative names", () => {
    const kirby = game({ igdbId: 7, title: "Kirby and the Forgotten Land", alternativeNames: ["Kirby und das vergessene Land"] });
    expect(pickBestMatch("Kirby und das vergessene Land", [kirby])?.igdbId).toBe(7);
  });

  it("returns nothing when no candidate is convincing", () => {
    expect(pickBestMatch("Pokémon Purpur", [game({ title: "Pokémon Scarlet" })])).toBeNull();
    expect(pickBestMatch("Haste", [])).toBeNull();
  });

  it("uses the platform to break ties between equal titles", () => {
    const old = game({ igdbId: 1, title: "Doom", platformIds: [6] });
    const remake = game({ igdbId: 2, title: "Doom", platformIds: [48, 167] });
    expect(pickBestMatch("DOOM", [old, remake], ["ps5"])?.igdbId).toBe(2);
    expect(pickBestMatch("DOOM", [remake, old], ["pc"])?.igdbId).toBe(1);
  });

  it("measures similarity on normalised words", () => {
    expect(titleSimilarity("Cities: Skylines II", "Cities Skylines II")).toBe(1);
    expect(titleSimilarity("Nine Sols", "Nine Sols: Deluxe")).toBeCloseTo(2 / 3);
  });
});

describe("IGDB client", () => {
  it("maps genres to German and builds cover links", () => {
    expect(germanGenre("Role-playing (RPG)")).toBe("Rollenspiel");
    expect(germanGenre("Something new")).toBe("Something new");
    expect(coverUrl("co1rgi")).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg");
    expect(
      parseGame({
        id: 14593,
        name: "Hollow Knight",
        cover: { id: 1, image_id: "co1rgi" },
        genres: [{ id: 8, name: "Platform" }, { id: 31, name: "Adventure" }, { id: 32, name: "Indie" }],
        first_release_date: 1487894400,
        platforms: [6, 48],
        total_rating_count: 812,
      }),
    ).toEqual({
      igdbId: 14593,
      title: "Hollow Knight",
      alternativeNames: [],
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg",
      genres: ["Jump 'n' Run", "Abenteuer", "Indie"],
      releaseYear: 2017,
      platformIds: [6, 48],
      ratingCount: 812,
    });
    expect(parseGame({ name: "no id" })).toBeNull();
  });

  it("logs in at Twitch and sends multiqueries with escaped titles", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.startsWith("https://id.twitch.tv")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 5000000, token_type: "bearer" }));
      }
      return new Response(
        JSON.stringify([
          { name: "0", result: [{ id: 1, name: 'Say "Hi"' }] },
          { name: "1", result: [] },
        ]),
      );
    }) as typeof fetch;
    const session = await login(fakeFetch, { clientId: "cid", clientSecret: "secret" });
    const result = await searchMany(session, [
      { key: "a", title: 'Say "Hi"' },
      { key: "b", title: "Nothing" },
    ]);
    expect(result.get("a")?.[0]?.title).toBe('Say "Hi"');
    expect(result.get("b")).toEqual([]);
    const api = requests[1]!;
    expect(api.url).toBe("https://api.igdb.com/v4/multiquery");
    expect((api.init?.headers as Record<string, string>)["Client-ID"]).toBe("cid");
    expect((api.init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(String(api.init?.body)).toContain('search "Say \\"Hi\\""');
  });

  it("explains rejected credentials", async () => {
    const fakeFetch = (async () => new Response('{"status":403,"message":"invalid client secret"}', { status: 403 })) as typeof fetch;
    await expect(login(fakeFetch, { clientId: "c", clientSecret: "s" })).rejects.toThrow(/IGDB_CLIENT_SECRET/);
  });
});
