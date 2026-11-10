// Nintendo, main source: the API behind the «Nintendo Switch Parental Controls» app.
// It reports playtime per day, game and profile for every linked console.
import { getAdapterInfo } from "../../../src/core/adapter-catalog";
import {
  fetchDailySummaries,
  fetchDevices,
  fetchKnownTitles,
  NintendoApiError,
  type NintendoApiOptions,
  type NintendoDailySummaries,
  type NintendoDevice,
  type NintendoTitleInfo,
} from "../../../src/core/nintendo/api";
import { fetchApiTokens, NintendoAuthError, readTokenExpiry } from "../../../src/core/nintendo/auth";
import { emptyBatch, type LocalDate, type SyncBatch } from "../../../src/core/types";
import {
  AdapterError,
  type AdapterContext,
  type PlatformAdapter,
  type SyncResult,
  type TestResult,
} from "../../types";

export const NINTENDO_PARENTAL_ID = "nintendo-parental";
/** Kind of the stored credential in platform_credentials. */
export const SESSION_TOKEN_KIND = "session_token";

export type PlayingTimeUnit = "minutes" | "seconds";

const DEVICE_KIND_LABEL = { switch1: "Switch", switch2: "Switch 2", other: "Konsole" } as const;

function toAdapterError(error: unknown): AdapterError {
  if (error instanceof AdapterError) return error;
  if (error instanceof NintendoAuthError) {
    return new AdapterError(
      error.kind === "session_expired" ? "auth_expired" : error.kind === "network" ? "network" : "unknown",
      error.message,
    );
  }
  if (error instanceof NintendoApiError) {
    if (error.status === 401 || error.status === 403) {
      return new AdapterError("auth_expired", "Nintendo hat die Anmeldung abgelehnt. Bitte Nintendo neu anmelden.");
    }
    if (error.status === 429) return new AdapterError("rate_limited", "Nintendo bremst die Abfragen. Der nächste Sync versucht es erneut.");
    return new AdapterError(error.status === 0 ? "network" : "unknown", error.message);
  }
  return new AdapterError("unknown", "Unerwarteter Fehler beim Abruf der Nintendo-Daten.");
}

async function connect(ctx: AdapterContext): Promise<{ api: NintendoApiOptions; sessionToken: string }> {
  const sessionToken = ctx.credentials[SESSION_TOKEN_KIND];
  if (!sessionToken) {
    throw new AdapterError("auth_expired", "Nintendo ist noch nicht angemeldet.");
  }
  const tokens = await fetchApiTokens(ctx.fetch, sessionToken);
  return {
    sessionToken,
    api: {
      fetch: ctx.fetch,
      tokens,
      // Nintendo may require a newer app version at some point: adjustable without a code change.
      appVersion: ctx.env.NINTENDO_APP_VERSION || undefined,
      appBuild: ctx.env.NINTENDO_APP_BUILD || undefined,
    },
  };
}

/**
 * The reference implementation treats `playingTime` as minutes; the older API used seconds.
 * A day has 1440 minutes, so any larger value proves seconds.
 */
export function detectUnit(summaries: readonly NintendoDailySummaries[]): PlayingTimeUnit {
  for (const summary of summaries) {
    for (const day of summary.days) {
      if ((day.playingTime ?? 0) > 1440) return "seconds";
      for (const player of day.players) {
        if (player.games.some((g) => g.playingTime > 1440)) return "seconds";
      }
    }
  }
  return "minutes";
}

function toMinutes(value: number, unit: PlayingTimeUnit): number {
  if (unit === "minutes") return Math.round(value);
  return Math.max(1, Math.round(value / 60));
}

export interface BuiltBatch {
  batch: SyncBatch;
  dataSince: LocalDate | null;
  unit: PlayingTimeUnit;
  /** Application ids that have no title in any response. */
  untitled: string[];
}

/** Pure: turns API data into a batch. All profiles of a console are added up. */
export function buildBatch(
  devices: readonly NintendoDevice[],
  summariesByDevice: ReadonlyMap<string, NintendoDailySummaries>,
  extraTitles: Readonly<Record<string, NintendoTitleInfo>>,
  unitOverride?: PlayingTimeUnit,
): BuiltBatch {
  const batch = emptyBatch("nintendo", NINTENDO_PARENTAL_ID);
  const unit = unitOverride ?? detectUnit([...summariesByDevice.values()]);

  const titles: Record<string, NintendoTitleInfo> = { ...extraTitles };
  for (const summary of summariesByDevice.values()) {
    for (const [id, info] of Object.entries(summary.titles)) {
      titles[id] = { title: info.title ?? titles[id]?.title, imageUrl: info.imageUrl ?? titles[id]?.imageUrl };
    }
  }

  const played = new Set<string>();
  let dataSince: LocalDate | null = null;

  for (const device of devices) {
    batch.devices.push({ externalId: device.deviceId, kind: device.kind, label: device.label });
    const summary = summariesByDevice.get(device.deviceId);
    if (!summary) continue;

    for (const day of summary.days) {
      const perGame = new Map<string, { minutes: number; players: Record<string, number> }>();
      for (const player of day.players) {
        for (const game of player.games) {
          const minutes = toMinutes(game.playingTime, unit);
          if (minutes <= 0) continue;
          const entry = perGame.get(game.applicationId) ?? { minutes: 0, players: {} };
          entry.minutes += minutes;
          entry.players[player.playerId] = (entry.players[player.playerId] ?? 0) + minutes;
          perGame.set(game.applicationId, entry);
        }
      }
      for (const [applicationId, entry] of perGame) {
        played.add(applicationId);
        if (!dataSince || day.date < dataSince) dataSince = day.date;
        batch.dailyPlaytime.push({
          gameExternalId: applicationId,
          deviceExternalId: device.deviceId,
          date: day.date,
          // A day cannot have more than 24 hours.
          minutes: Math.min(entry.minutes, 1440),
          details: { players: entry.players },
        });
      }
    }
  }

  const untitled: string[] = [];
  for (const applicationId of [...played].sort()) {
    const info = titles[applicationId];
    if (!info?.title) untitled.push(applicationId);
    batch.games.push({
      externalId: applicationId,
      title: info?.title ?? `Unbekannter Titel (${applicationId})`,
      coverUrl: info?.imageUrl ?? null,
      owned: true,
      // Nintendo has no achievements, and only per-day values: the total is derived.
      achievementsUnlocked: null,
      achievementsTotal: null,
      raw: { applicationId },
    });
  }
  return { batch, dataSince, unit, untitled };
}

function describeDevices(devices: readonly NintendoDevice[]): string {
  return devices.map((d) => `${d.label} (${DEVICE_KIND_LABEL[d.kind]})`).join(", ");
}

export const nintendoParentalAdapter: PlatformAdapter = {
  ...getAdapterInfo(NINTENDO_PARENTAL_ID)!,

  async isConfigured(ctx) {
    return Boolean(ctx.credentials[SESSION_TOKEN_KIND]);
  },

  async testConnection(ctx): Promise<TestResult> {
    try {
      const { api, sessionToken } = await connect(ctx);
      const devices = await fetchDevices(api);
      const tokenExpiresAt = readTokenExpiry(sessionToken);
      if (devices.length === 0) {
        return {
          ok: false,
          message: "Anmeldung in Ordnung, aber es ist keine Konsole mit der Jugendschutz-App verknüpft.",
          tokenExpiresAt,
        };
      }
      return {
        ok: true,
        message: `${devices.length} Konsole(n) gefunden: ${describeDevices(devices)}`,
        tokenExpiresAt,
      };
    } catch (error) {
      throw toAdapterError(error);
    }
  },

  async sync(ctx): Promise<SyncResult> {
    try {
      const { api, sessionToken } = await connect(ctx);
      const devices = await fetchDevices(api);
      ctx.log.info(`${NINTENDO_PARENTAL_ID}: ${devices.length} console(s)`);

      const summaries = new Map<string, NintendoDailySummaries>();
      for (const device of devices) {
        summaries.set(device.deviceId, await fetchDailySummaries(api, device.deviceId));
      }

      const override = ctx.env.NINTENDO_PLAYTIME_UNIT;
      const unitOverride = override === "minutes" || override === "seconds" ? override : undefined;
      let built = buildBatch(devices, summaries, {}, unitOverride);

      // Titles missing in the summaries: look them up in each console's software list.
      if (built.untitled.length > 0) {
        const extra: Record<string, NintendoTitleInfo> = {};
        for (const device of devices) {
          try {
            Object.assign(extra, await fetchKnownTitles(api, device.deviceId));
          } catch {
            ctx.log.warn(`${NINTENDO_PARENTAL_ID}: software list of a console not available`);
          }
        }
        built = buildBatch(devices, summaries, extra, unitOverride);
      }

      const warnings: string[] = [];
      if (built.untitled.length > 0) warnings.push(`${built.untitled.length} Titel ohne Namen`);
      if (devices.length === 0) warnings.push("Keine Konsole verknüpft");
      const dayCount = [...summaries.values()].reduce((sum, s) => sum + s.days.length, 0);
      ctx.log.info(
        `${NINTENDO_PARENTAL_ID}: ${dayCount} day(s), unit ${built.unit}, ${built.untitled.length} untitled`,
      );

      return {
        batch: built.batch,
        dataSince: built.dataSince,
        tokenExpiresAt: readTokenExpiry(sessionToken),
        warnings,
        details: {
          unit: built.unit,
          days: dayCount,
          devices: devices.map((d) => ({ label: d.label, kind: d.kind })),
        },
      };
    } catch (error) {
      throw toAdapterError(error);
    }
  },
};
