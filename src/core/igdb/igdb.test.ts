import { describe, expect, it } from "vitest";
import { coverUrl, germanGenre, login, parseGame, searchMany, type IgdbGame } from "./client";
import { pickBestMatch, searchTitle, titleNumbers, titleSimilarity } from "./match";
import { fetchTimeToBeat, parseTimeToBeat } from "./time-to-beat";

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
    expect(searchTitle("Terraria: PlayStation®4 Edition")).toBe("Terraria");
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

  it("never takes a sequel with another number for the game", () => {
    const bo2 = game({ igdbId: 2, title: "Call of Duty: Black Ops II" });
    const bo3 = game({ igdbId: 3, title: "Call of Duty: Black Ops III" });
    // 5 of 7 words in common would pass the similarity on its own
    expect(pickBestMatch("Call of Duty: Black Ops 2", [bo3])).toBeNull();
    expect(pickBestMatch("Call of Duty: Black Ops 2", [bo3, bo2])?.igdbId).toBe(2);
    const gw = game({ igdbId: 10, title: "Plants vs. Zombies: Garden Warfare" });
    const gw2 = game({ igdbId: 11, title: "Plants vs. Zombies: Garden Warfare 2" });
    expect(pickBestMatch("Plants vs. Zombies: Garden Warfare 2", [gw])).toBeNull();
    expect(pickBestMatch("Plants vs. Zombies Garden Warfare", [gw2])).toBeNull();
    expect(pickBestMatch("Plants vs. Zombies Garden Warfare", [gw2, gw])?.igdbId).toBe(10);
    // same number, other spelling: still the same game
    expect(pickBestMatch("Dark Souls 3 Deluxe", [game({ igdbId: 4, title: "Dark Souls III: Deluxe" })])?.igdbId).toBe(4);
  });

  it("reads the numbers of a title, Roman ones too", () => {
    expect(titleNumbers("Dark Souls III")).toBe("3");
    expect(titleNumbers("Grand Theft Auto V")).toBe("5");
    expect(titleNumbers("Mario Kart 8 Deluxe")).toBe("8");
    expect(titleNumbers("Tony Hawk's Pro Skater 1 + 2")).toBe("1 2");
    expect(titleNumbers("I Am Bread")).toBe("");
    expect(titleNumbers("Hollow Knight")).toBe("");
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

  it("logs in at Twitch and sends one search per title with escaped quotes", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.startsWith("https://id.twitch.tv")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 5000000, token_type: "bearer" }));
      }
      const body = String(init?.body);
      return new Response(JSON.stringify(body.includes("Hi") ? [{ id: 1, name: 'Say "Hi"' }] : []));
    }) as typeof fetch;
    const session = await login(fakeFetch, { clientId: "cid", clientSecret: "secret" });
    const result = await searchMany(
      session,
      [
        { key: "a", title: 'Say "Hi"' },
        { key: "b", title: "Nothing" },
      ],
      6,
      0,
    );
    expect(result.get("a")?.[0]?.title).toBe('Say "Hi"');
    expect(result.get("b")).toEqual([]);
    expect(requests.map((r) => r.url)).toEqual([
      "https://id.twitch.tv/oauth2/token",
      "https://api.igdb.com/v4/games",
      "https://api.igdb.com/v4/games",
    ]);
    // the secret travels in the body, never in the address
    expect(String(requests[0]!.init?.body)).toBe("client_id=cid&client_secret=secret&grant_type=client_credentials");
    const api = requests[1]!;
    expect((api.init?.headers as Record<string, string>)["Client-ID"]).toBe("cid");
    expect((api.init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(String(api.init?.body)).toContain('search "Say \\"Hi\\""');
    // only real games: no DLCs, seasons or editions
    expect(String(api.init?.body)).toContain("game_type = (0,4,8,9,10,11)");
  });

  it("explains rejected credentials", async () => {
    const fakeFetch = (async () => new Response('{"status":403,"message":"invalid client secret"}', { status: 403 })) as typeof fetch;
    await expect(login(fakeFetch, { clientId: "c", clientSecret: "s" })).rejects.toThrow(/IGDB_CLIENT_SECRET/);
  });
});

describe("time to beat", () => {
  it("reads seconds as minutes and drops rows without any time", () => {
    expect(parseTimeToBeat({ id: 1, game_id: 7, hastily: 36000, normally: 43230, completely: 0, count: 12 })).toEqual({
      igdbId: 7,
      time: { hastily: 600, normally: 721, completely: null, count: 12 },
    });
    expect(parseTimeToBeat({ game_id: 7, count: 3 })).toBeNull();
    expect(parseTimeToBeat({ hastily: 100 })).toBeNull();
    expect(parseTimeToBeat("x")).toBeNull();
  });

  it("asks for up to 500 games per request", async () => {
    const bodies: string[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.igdb.com/v4/game_time_to_beats");
      bodies.push(String(init.body));
      return new Response(JSON.stringify([{ game_id: 2, normally: 3600, count: 1 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const ids = Array.from({ length: 501 }, (_, i) => i + 1);
    const times = await fetchTimeToBeat({ clientId: "c", accessToken: "t", fetch: fakeFetch }, [...ids, 2], 0);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("where game_id = (1,2,3,");
    expect(bodies[0]).toContain("limit 500;");
    expect(bodies[1]).toContain("where game_id = (501);");
    expect(times.get(2)).toEqual({ hastily: null, normally: 60, completely: null, count: 1 });
  });

  it("reports an error answer", async () => {
    const fakeFetch = (async () => new Response("", { status: 400 })) as unknown as typeof fetch;
    await expect(fetchTimeToBeat({ clientId: "c", accessToken: "t", fetch: fakeFetch }, [1], 0)).rejects.toThrow(/Status 400/);
  });
});
