// Fills the database with demo data (the real game list, invented playtime, 14 months).
//
//   npm run seed:demo     replace demo data
//   npm run clear:demo    remove demo data
import { buildDemoBatches } from "../src/core/demo";
import { deleteDemoData, persistBatch } from "../src/data/persist";
import { loadLocalEnv } from "../sync/env";
import { createServiceClient, resolveUserId } from "../sync/store";

async function main(): Promise<void> {
  loadLocalEnv();
  const clearOnly = process.argv.includes("--clear");
  const db = createServiceClient(process.env);
  const userId = await resolveUserId(db, process.env);

  // Always start clean: demo history depends on today's date.
  await deleteDemoData(db);
  console.log("Demo data removed");
  if (clearOnly) return;

  const now = new Date();
  for (const batch of buildDemoBatches(now)) {
    const summary = await persistBatch(db, userId, batch, now);
    console.log(
      `${batch.platform}: ${summary.games} games, ${summary.snapshots} snapshots, ` +
        `${summary.dailyRows} daily rows, ${summary.achievements} achievements`,
    );
  }
  console.log("Demo data written");
}

main().catch((error) => {
  console.error(`Seeding failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
