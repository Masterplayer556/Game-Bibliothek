import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateKey } from "./crypto";
import { findGameMatch } from "./match-games";
import { normalizeTitle } from "./normalize-title";
import { addDays, dateRange, diffDays, monthKey, toLocalDate, weekStart } from "./time";

describe("time (Europe/Zurich)", () => {
  it("converts instants to the Zurich calendar day", () => {
    expect(toLocalDate("2026-01-10T22:59:00Z")).toBe("2026-01-10");
    expect(toLocalDate("2026-01-10T23:00:00Z")).toBe("2026-01-11"); // UTC+1
    expect(toLocalDate("2026-07-10T21:59:00Z")).toBe("2026-07-10");
    expect(toLocalDate("2026-07-10T22:00:00Z")).toBe("2026-07-11"); // UTC+2
  });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-03-02")).toBe("2026-03-02"); // Monday
    expect(weekStart("2026-03-08")).toBe("2026-03-02"); // Sunday
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });

  it("does calendar arithmetic across month and DST borders", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // DST change in Zurich
    expect(diffDays("2025-12-31", "2026-01-02")).toBe(2);
    expect(monthKey("2026-03-08")).toBe("2026-03");
    expect(dateRange("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });
});

describe("normalizeTitle", () => {
  it("removes accents, symbols and case", () => {
    expect(normalizeTitle("Pokémon™ Purpur")).toBe("pokemon purpur");
    expect(normalizeTitle("Ghost of Yōtei")).toBe("ghost of yotei");
    expect(normalizeTitle("  SUPERHOT: MIND CONTROL DELETE ")).toBe("superhot mind control delete");
  });

  it("treats platform editions as the same game", () => {
    expect(normalizeTitle("Minecraft for Nintendo Switch")).toBe("minecraft");
    expect(normalizeTitle("Minecraft: Java Edition")).toBe("minecraft");
    expect(normalizeTitle("Hollow Knight: Silksong – Nintendo Switch 2 Edition")).toBe(
      normalizeTitle("Hollow Knight: Silksong"),
    );
    expect(normalizeTitle("Rayman Legends: Definitive Edition")).toBe("rayman legends");
    expect(normalizeTitle("Grand Theft Auto V (PlayStation®5)")).toBe("grand theft auto v");
    expect(normalizeTitle("Minecraft (PS4)")).toBe("minecraft");
    expect(normalizeTitle("Super Mario Odyssey (Nintendo Switch)")).toBe("super mario odyssey");
    // a number that belongs to the title stays
    expect(normalizeTitle("Hades II")).toBe("hades ii");
    expect(normalizeTitle("Cities: Skylines II")).toBe("cities skylines ii");
  });

  it("keeps different games apart", () => {
    expect(normalizeTitle("SUPERHOT")).not.toBe(normalizeTitle("SUPERHOT: MIND CONTROL DELETE"));
    expect(normalizeTitle("Pokémon-Legenden: Arceus")).not.toBe(
      normalizeTitle("Pokémon-Legenden: Z-A"),
    );
  });
});

describe("findGameMatch", () => {
  const known = [
    { id: "a", normalizedTitle: "minecraft", igdbId: 121 },
    { id: "b", normalizedTitle: "nine sols", igdbId: null },
  ];

  it("prefers the IGDB id over the title", () => {
    expect(findGameMatch(known, "Some other title", 121)?.id).toBe("a");
  });

  it("falls back to the normalised title", () => {
    expect(findGameMatch(known, "Nine Sols")?.id).toBe("b");
    expect(findGameMatch(known, "Minecraft for Nintendo Switch")?.id).toBe("a");
    expect(findGameMatch(known, "Unknown Game")).toBeNull();
  });
});

describe("credential encryption", () => {
  it("round-trips a secret", async () => {
    const key = generateKey();
    const encrypted = await encryptSecret("npsso-token-123", key);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain("npsso-token-123");
    expect(await decryptSecret(encrypted, key)).toBe("npsso-token-123");
  });

  it("uses a fresh IV every time", async () => {
    const key = generateKey();
    expect(await encryptSecret("same", key)).not.toBe(await encryptSecret("same", key));
  });

  it("rejects a wrong key and tampered data", async () => {
    const key = generateKey();
    const encrypted = await encryptSecret("secret", key);
    await expect(decryptSecret(encrypted, generateKey())).rejects.toThrow(/could not be decrypted/);
    const [v, iv, data] = encrypted.split(":");
    const flipped = (data![0] === "A" ? "B" : "A") + data!.slice(1);
    await expect(decryptSecret(`${v}:${iv}:${flipped}`, key)).rejects.toThrow();
  });

  it("rejects keys of the wrong length", async () => {
    await expect(encryptSecret("x", btoa("too-short"))).rejects.toThrow(/32 bytes/);
  });
});
