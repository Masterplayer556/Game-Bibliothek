// Demo data: the real game list with invented playtime over the last 14 months, so every
// page has something to show before a platform is connected. Deterministic for a given day.
// Everything is tagged with DEMO_SOURCE and external ids start with "demo:".
import { addDays, dateRange, toLocalDate } from "../time";
import {
  DEMO_SOURCE,
  emptyBatch,
  type AchievementInput,
  type DeviceKind,
  type LocalDate,
  type PlatformId,
  type SyncBatch,
} from "../types";

export const DEMO_MONTHS = 14;
const WINDOW_DAYS = 425;

interface DemoGame {
  title: string;
  /** Minutes played before the 14-month window (lifetime sources only). */
  baseline?: number;
  /** Not played before this date (release or purchase). */
  from?: LocalDate;
  /** Not played after this date. */
  to?: LocalDate;
  /** Chance to play on any day inside the active range. */
  freq: number;
  /** Typical session length in minutes. */
  avg: number;
  /** [unlocked, total] */
  achievements?: [number, number];
  steamAppId?: number;
  /** Nintendo: share of play days on the Switch 2 (1 = Switch 2 only, 0 = Switch 1 only). */
  switch2Share?: number;
}

const STEAM: DemoGame[] = [
  { title: "Cities: Skylines II", baseline: 1900, freq: 0.06, avg: 110, achievements: [14, 40], steamAppId: 949230 },
  { title: "Counter-Strike 2", baseline: 8200, freq: 0.22, avg: 70, achievements: [1, 1], steamAppId: 730 },
  { title: "Nine Sols", from: "2025-11-20", to: "2026-02-10", freq: 0.3, avg: 80, achievements: [21, 37], steamAppId: 1809540 },
  { title: "CloverPit", from: "2025-10-05", freq: 0.07, avg: 45, achievements: [18, 42] },
  { title: "SUPERHOT", baseline: 260, freq: 0.01, avg: 40, achievements: [19, 26], steamAppId: 322500 },
  { title: "SUPERHOT: MIND CONTROL DELETE", baseline: 30, freq: 0.004, avg: 30, achievements: [2, 25], steamAppId: 690040 },
  { title: "Peggle Deluxe", baseline: 340, freq: 0.02, avg: 30, steamAppId: 3480 },
  { title: "Haste", from: "2026-01-15", to: "2026-04-01", freq: 0.12, avg: 50, achievements: [9, 30] },
  { title: "OneShot", from: "2026-05-02", to: "2026-05-20", freq: 0.4, avg: 60, achievements: [7, 20], steamAppId: 420530 },
  { title: "Geometry Dash", baseline: 2600, freq: 0.1, avg: 35, achievements: [61, 120], steamAppId: 322170 },
  { title: "Detroit: Become Human", from: "2026-07-10", to: "2026-07-12", freq: 0.5, avg: 25, achievements: [1, 48], steamAppId: 1222140 },
];

const PSN: DemoGame[] = [
  { title: "Hollow Knight", baseline: 5400, freq: 0.2, avg: 55, achievements: [34, 63] },
  { title: "Hollow Knight: Silksong", from: "2025-09-10", to: "2026-01-20", freq: 0.3, avg: 95, achievements: [27, 52] },
  { title: "ASTRO BOT", baseline: 700, to: "2025-12-01", freq: 0.1, avg: 60, achievements: [38, 44] },
  { title: "Nine Sols", from: "2026-03-01", to: "2026-03-20", freq: 0.2, avg: 50, achievements: [5, 37] },
  { title: "Ghost of Yōtei", from: "2025-10-02", to: "2026-03-15", freq: 0.25, avg: 100, achievements: [31, 55] },
  { title: "Grand Theft Auto V", baseline: 3100, freq: 0.03, avg: 70, achievements: [22, 78] },
  { title: "Minecraft", baseline: 2400, freq: 0.04, avg: 60, achievements: [48, 131] },
];

const NINTENDO: DemoGame[] = [
  { title: "Minecraft", freq: 0.12, avg: 70, switch2Share: 0.5 },
  { title: "DELTARUNE", from: "2025-09-20", to: "2025-11-15", freq: 0.3, avg: 75, switch2Share: 1 },
  { title: "Cuphead", freq: 0.02, avg: 35, switch2Share: 0.3 },
  { title: "Rayman Legends: Definitive Edition", freq: 0.015, avg: 40, switch2Share: 0 },
  { title: "Paper Mario", from: "2026-08-01", to: "2026-09-10", freq: 0.3, avg: 60, switch2Share: 1 },
  { title: "Paper Mario: Die Legende vom Äonentor", from: "2025-12-26", to: "2026-02-15", freq: 0.4, avg: 80, switch2Share: 0.8 },
  { title: "Paper Mario: The Origami King", from: "2026-02-20", to: "2026-04-10", freq: 0.3, avg: 70, switch2Share: 0.8 },
  { title: "Donkey Kong Bananza", to: "2025-11-01", freq: 0.3, avg: 85, switch2Share: 1 },
  { title: "Super Mario Odyssey", freq: 0.02, avg: 45, switch2Share: 0.5 },
  { title: "Kirby und das vergessene Land", from: "2026-06-01", to: "2026-07-05", freq: 0.3, avg: 60, switch2Share: 1 },
  { title: "The Legend of Zelda: Breath of the Wild", freq: 0.02, avg: 60, switch2Share: 0.6 },
  { title: "The Legend of Zelda: Tears of the Kingdom", from: "2025-10-01", to: "2026-01-10", freq: 0.15, avg: 90, switch2Share: 1 },
  { title: "Pokémon Strahlender Diamant", freq: 0.01, avg: 40, switch2Share: 0 },
  { title: "Pokémon Schwert", freq: 0.01, avg: 40, switch2Share: 0 },
  { title: "Pokémon-Legenden: Arceus", from: "2026-04-15", to: "2026-05-30", freq: 0.2, avg: 60, switch2Share: 0.5 },
  { title: "Pokémon Purpur", freq: 0.03, avg: 50, switch2Share: 0.7 },
  { title: "Pokémon-Legenden: Z-A", from: "2025-10-16", to: "2025-12-20", freq: 0.4, avg: 80, switch2Share: 1 },
  { title: "Pokémon Pokopia", from: "2026-03-05", freq: 0.2, avg: 55, switch2Share: 1 },
  { title: "Hollow Knight: Silksong", from: "2026-02-01", to: "2026-03-10", freq: 0.15, avg: 50, switch2Share: 1 },
  { title: "Miitopia", from: "2026-09-15", freq: 0.15, avg: 45, switch2Share: 0 },
  { title: "Animal Crossing: New Horizons", freq: 0.08, avg: 30, switch2Share: 0.6 },
];

/** Small deterministic random generator (mulberry32). */
function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function playedDays(game: DemoGame, days: readonly LocalDate[], random: () => number) {
  const out: { date: LocalDate; minutes: number }[] = [];
  for (const date of days) {
    if (game.from && date < game.from) continue;
    if (game.to && date > game.to) continue;
    if (random() >= game.freq) continue;
    const minutes = Math.max(5, Math.round(game.avg * (0.35 + 1.3 * random())));
    out.push({ date, minutes });
  }
  return out;
}

function lifetimeBatch(
  platform: PlatformId,
  deviceKind: DeviceKind,
  games: readonly DemoGame[],
  days: readonly LocalDate[],
  random: () => number,
): SyncBatch {
  const batch = emptyBatch(platform, DEMO_SOURCE);
  batch.snapshots = [];
  const windowStart = days[0]!;

  for (const game of games) {
    const externalId = `demo:${platform}:${slug(game.title)}`;
    const sessions = playedDays(game, days, random);
    let total = game.baseline ?? 0;

    // Starting value: what the platform reported on the first sync.
    batch.snapshots.push({ gameExternalId: externalId, takenAt: `${windowStart}T05:00:00Z`, totalMinutes: total });
    for (const session of sessions) {
      total += session.minutes;
      // 20:00 UTC is the same evening in Europe/Zurich, summer and winter.
      batch.snapshots.push({
        gameExternalId: externalId,
        takenAt: `${session.date}T20:00:00Z`,
        totalMinutes: total,
        lastPlayedAt: `${session.date}T19:30:00Z`,
      });
    }

    const lastDate = sessions.at(-1)?.date;
    const firstDate = game.baseline ? addDays(windowStart, -200) : sessions[0]?.date;
    const achievements = game.achievements;
    batch.games.push({
      externalId,
      title: game.title,
      coverUrl: game.steamAppId
        ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
        : null,
      deviceKind,
      owned: true,
      firstPlayedAt: firstDate ? `${firstDate}T18:00:00Z` : null,
      lastPlayedAt: lastDate ? `${lastDate}T19:30:00Z` : game.baseline ? `${addDays(windowStart, -10)}T19:30:00Z` : null,
      totalPlaytimeMinutes: total,
      achievementsUnlocked: achievements ? achievements[0] : null,
      achievementsTotal: achievements ? achievements[1] : null,
      raw: { demo: true },
    });

    if (achievements) {
      batch.achievements.push(
        ...demoAchievements(platform, externalId, achievements, sessions, windowStart, random),
      );
    }
  }
  return batch;
}

function demoAchievements(
  platform: PlatformId,
  gameExternalId: string,
  [unlocked, total]: [number, number],
  sessions: readonly { date: LocalDate }[],
  windowStart: LocalDate,
  random: () => number,
): AchievementInput[] {
  const tiers = ["bronze", "bronze", "bronze", "silver", "silver", "gold"];
  const out: AchievementInput[] = [];
  for (let i = 1; i <= total; i++) {
    const isUnlocked = i <= unlocked;
    const session = sessions.length > 0 ? sessions[Math.floor(random() * sessions.length)] : undefined;
    const date = session?.date ?? addDays(windowStart, -30 - Math.floor(random() * 300));
    const isPlatinum = platform === "psn" && i === total;
    out.push({
      gameExternalId,
      externalId: String(i),
      name: isPlatinum ? "Platin-Trophäe" : `Demo-Erfolg ${i}`,
      description: "Beispiel-Erfolg aus den Demo-Daten.",
      unlockedAt: isUnlocked ? `${date}T19:00:00Z` : null,
      rarityPercent: Math.round((isPlatinum ? 1 + random() * 4 : 2 + random() * 88) * 10) / 10,
      tier: platform === "psn" ? (isPlatinum ? "platinum" : tiers[Math.floor(random() * tiers.length)]!) : null,
    });
  }
  return out;
}

function nintendoBatch(days: readonly LocalDate[], random: () => number): SyncBatch {
  const batch = emptyBatch("nintendo", DEMO_SOURCE);
  batch.devices.push(
    { externalId: "demo:switch1", kind: "switch1", label: "Switch (Demo)" },
    { externalId: "demo:switch2", kind: "switch2", label: "Switch 2 (Demo)" },
  );
  for (const game of NINTENDO) {
    const externalId = `demo:nintendo:${slug(game.title)}`;
    // No lifetime total: Nintendo only reports per-day values, the total is derived.
    batch.games.push({
      externalId,
      title: game.title,
      owned: true,
      achievementsUnlocked: null,
      achievementsTotal: null,
      raw: { demo: true },
    });
    for (const session of playedDays(game, days, random)) {
      const onSwitch2 = random() < (game.switch2Share ?? 0.5);
      batch.dailyPlaytime.push({
        gameExternalId: externalId,
        deviceExternalId: onSwitch2 ? "demo:switch2" : "demo:switch1",
        date: session.date,
        minutes: session.minutes,
      });
    }
  }
  return batch;
}

function manualBatch(days: readonly LocalDate[], random: () => number): SyncBatch {
  const batch = emptyBatch("manual", DEMO_SOURCE);
  // Minecraft: Java Edition is not sold on Steam, so a Steam sync will never report it.
  const java = lifetimeBatch(
    "manual",
    "pc",
    [{ title: "Minecraft: Java Edition", baseline: 14000, freq: 0.18, avg: 90 }],
    days,
    random,
  );
  batch.games.push(...java.games);
  batch.snapshots = java.snapshots;
  batch.games.push({
    externalId: "demo:manual:rayman-origins",
    title: "Rayman Origins",
    deviceKind: "xbox360",
    owned: false,
    totalPlaytimeMinutes: 900,
    achievementsUnlocked: null,
    achievementsTotal: null,
    raw: { demo: true },
  });
  return batch;
}

/** One batch per platform. `now` decides where the 14-month window ends. */
export function buildDemoBatches(now: Date = new Date()): SyncBatch[] {
  const today = toLocalDate(now);
  // Stop yesterday: today's values would still be moving.
  const end = addDays(today, -1);
  const days = dateRange(addDays(end, -(WINDOW_DAYS - 1)), end);
  const random = createRandom(20261110);
  return [
    lifetimeBatch("steam", "pc", STEAM, days, random),
    lifetimeBatch("psn", "ps5", PSN, days, random),
    nintendoBatch(days, random),
    manualBatch(days, random),
  ];
}
