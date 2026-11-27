// Diagnosis: asks IGDB once through each path and prints only counts and public titles.
//   npm run igdb:check
import { login, searchGames } from "../src/core/igdb/client";
import { fetchTimeToBeat } from "../src/core/igdb/time-to-beat";
import { loadLocalEnv } from "../sync/env";

async function main(): Promise<void> {
  loadLocalEnv();
  const session = await login(fetch, { clientId: process.env.IGDB_CLIENT_ID ?? "", clientSecret: process.env.IGDB_CLIENT_SECRET ?? "" });
  console.log("login ok");
  const single = await searchGames(session, "Minecraft", 5);
  console.log(`search: ${single.length} hits: ${single.map((g) => g.title).join(" | ")}`);
  for (const title of ["Fall Guys", "Dead by Daylight", "God of War Ragnarök"]) {
    const hits = await searchGames(session, title, 5);
    console.log(`${title}: ${hits.map((g) => g.title).join(" | ")}`);
  }
  // How long a game takes (endpoint game_time_to_beats): values in hours.
  const hk = (await searchGames(session, "Hollow Knight", 1))[0];
  if (hk) {
    const time = (await fetchTimeToBeat(session, [hk.igdbId])).get(hk.igdbId);
    const hours = (m: number | null | undefined) => (m == null ? "–" : (m / 60).toFixed(1));
    console.log(
      time
        ? `time to beat ${hk.title}: ${hours(time.hastily)} / ${hours(time.normally)} / ${hours(time.completely)} h (${time.count} answers)`
        : `time to beat ${hk.title}: no data`,
    );
  }
}

main().catch((error) => {
  console.error(`IGDB check failed: ${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
});
