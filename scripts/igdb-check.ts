// Diagnosis: asks IGDB once through each path and prints only counts and public titles.
//   npm run igdb:check
import { login, searchGames, searchMany } from "../src/core/igdb/client";
import { loadLocalEnv } from "../sync/env";

async function main(): Promise<void> {
  loadLocalEnv();
  const session = await login(fetch, { clientId: process.env.IGDB_CLIENT_ID ?? "", clientSecret: process.env.IGDB_CLIENT_SECRET ?? "" });
  console.log("login ok");
  const single = await searchGames(session, "Minecraft", 5);
  console.log(`search: ${single.length} hits: ${single.map((g) => g.title).join(" | ")}`);
  const many = await searchMany(session, [{ key: "a", title: "Minecraft" }, { key: "b", title: "God of War" }]);
  console.log(`multiquery: a=${many.get("a")?.length} b=${many.get("b")?.length}`);
  // raw multiquery answer, to see its shape
  const raw = await fetch("https://api.igdb.com/v4/multiquery", {
    method: "POST",
    headers: { "Client-ID": session.clientId, Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
    body: 'query games "0" { search "Minecraft"; fields name; where version_parent = null; limit 3; };',
  });
  console.log(`raw multiquery ${raw.status}: ${(await raw.text()).slice(0, 400)}`);
  const raw2 = await fetch("https://api.igdb.com/v4/multiquery", {
    method: "POST",
    headers: { "Client-ID": session.clientId, Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
    body: 'query games "0" { search "Minecraft"; fields name; limit 3; };',
  });
  console.log(`raw multiquery without where ${raw2.status}: ${(await raw2.text()).slice(0, 400)}`);
}

main().catch((error) => {
  console.error(`IGDB check failed: ${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
});
