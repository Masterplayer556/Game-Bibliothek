// Diagnosis: asks IGDB once through each path and prints only counts and public titles.
//   npm run igdb:check
import { login, searchGames } from "../src/core/igdb/client";
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
}

main().catch((error) => {
  console.error(`IGDB check failed: ${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
});
