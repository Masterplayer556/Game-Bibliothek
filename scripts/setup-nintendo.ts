// Second way to connect Nintendo, for a computer with a terminal. The usual way is the
// card «Nintendo verbinden» in the app.
//
//   npm run setup:nintendo
//
// Needs .env.local with SUPABASE_SECRET_KEY and CREDENTIALS_ENCRYPTION_KEY.
import { createInterface } from "node:readline/promises";
import { getAdapterInfo } from "../src/core/adapter-catalog";
import { fetchDevices } from "../src/core/nintendo/api";
import {
  createLoginRequest,
  exchangeCodeForSessionToken,
  fetchApiTokens,
  parseRedirectLink,
  readTokenExpiry,
} from "../src/core/nintendo/auth";
import { NINTENDO_PARENTAL_ID, SESSION_TOKEN_KIND } from "../sync/adapters/nintendo-parental/adapter";
import { loadLocalEnv } from "../sync/env";
import { createServiceClient, resolveUserId, SupabaseSyncStore } from "../sync/store";

async function main(): Promise<void> {
  loadLocalEnv();
  const db = createServiceClient(process.env);
  const userId = await resolveUserId(db, process.env);
  const store = new SupabaseSyncStore(db, userId, process.env.CREDENTIALS_ENCRYPTION_KEY);

  const login = await createLoginRequest();
  console.log("\n1. Öffne diesen Link im Browser und melde dich mit deinem Nintendo-Account an:\n");
  console.log(login.url);
  console.log("\n2. Beim Knopf «Dieses Konto auswählen»: NICHT klicken, sondern Rechtsklick → «Adresse des Links kopieren».");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const link = await rl.question("\n3. Füge den kopierten Link hier ein:\n> ");
  rl.close();

  const parsed = parseRedirectLink(link);
  if (parsed.state && parsed.state !== login.state) {
    throw new Error("Der Link gehört zu einem anderen Login-Versuch. Bitte neu starten.");
  }
  const sessionToken = await exchangeCodeForSessionToken(fetch, parsed.code, login.verifier);
  const tokens = await fetchApiTokens(fetch, sessionToken);
  const devices = await fetchDevices({ fetch, tokens });

  await store.saveCredentials(NINTENDO_PARENTAL_ID, [{ kind: SESSION_TOKEN_KIND, value: sessionToken }]);
  await store.setConnection(getAdapterInfo(NINTENDO_PARENTAL_ID)!, {
    status: "ok",
    configured: true,
    lastError: null,
    tokenExpiresAt: readTokenExpiry(sessionToken),
    details: { connectedAt: new Date().toISOString(), devices: devices.map((d) => ({ label: d.label, kind: d.kind })) },
  });
  console.log(`\nVerbunden. ${devices.length} Konsole(n) gefunden. Der Token ist verschlüsselt gespeichert.`);
}

main().catch((error) => {
  console.error(`\nFehlgeschlagen: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  process.exit(1);
});
