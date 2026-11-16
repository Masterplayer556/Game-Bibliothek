// Edge Function: finishes the Nintendo login started in the app.
//
// The browser cannot do this itself: the exchange with Nintendo needs a server, and the
// resulting session token must be encrypted with a key the browser never sees.
//
// Input (POST, JSON):  { link, verifier, state }
//   link      the copied «select this account» link (npf…://auth#session_token_code=…)
//   verifier  PKCE verifier created by the app together with the login link
//   state     state created by the app, to make sure link and verifier belong together
// Output: { ok: true, expiresAt, devices: [{ label, kind }] } or { error }
//
// Runs on Deno. The files in ../_shared are copies of src/core/* made by the deploy
// workflow, so the logic exists only once.
import { encryptSecret } from "../_shared/crypto.ts";
import { fetchDevices } from "../_shared/nintendo-api.ts";
import {
  exchangeCodeForSessionToken,
  fetchApiTokens,
  NintendoAuthError,
  parseRedirectLink,
  readTokenExpiry,
} from "../_shared/nintendo-auth.ts";
import { authorize, reply } from "../_common/http.ts";

const ADAPTER_ID = "nintendo-parental";

Deno.serve(async (request: Request) => {
  // 1.–2. Login token and allowed e-mail
  const caller = await authorize(request);
  if (caller instanceof Response) return caller;
  const { admin, encryptionKey, userId } = caller;

  // 3. Input
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Ungültige Anfrage." });
  }
  const link = typeof body.link === "string" ? body.link : "";
  const verifier = typeof body.verifier === "string" ? body.verifier : "";
  const state = typeof body.state === "string" ? body.state : "";
  if (!verifier) {
    return reply(400, { error: "Bitte zuerst den Login-Link in der App öffnen und danach den Link einfügen." });
  }

  try {
    const parsed = parseRedirectLink(link);
    if (state && parsed.state && parsed.state !== state) {
      return reply(400, {
        error: "Der Link gehört zu einem älteren Login-Versuch. Bitte den Login-Link neu öffnen und den Link frisch kopieren.",
      });
    }

    // 4. Nintendo: code → session token → check that it works
    const sessionToken = await exchangeCodeForSessionToken(fetch, parsed.code, verifier);
    const tokens = await fetchApiTokens(fetch, sessionToken);
    let devices: { label: string; kind: string }[] | null = null;
    try {
      devices = (await fetchDevices({ fetch, tokens })).map((d) => ({ label: d.label, kind: d.kind }));
    } catch {
      // The login itself worked; the console list is only a confirmation.
      devices = null;
    }

    // 5. Store the session token, encrypted
    const expiresAt = readTokenExpiry(sessionToken);
    const saved = await admin.from("platform_credentials").upsert(
      {
        user_id: userId,
        adapter_id: ADAPTER_ID,
        kind: "session_token",
        ciphertext: await encryptSecret(sessionToken, encryptionKey),
      },
      { onConflict: "user_id,adapter_id,kind" },
    );
    if (saved.error) return reply(500, { error: "Die Anmeldung konnte nicht gespeichert werden." });

    await admin.from("platform_connections").upsert(
      {
        user_id: userId,
        adapter_id: ADAPTER_ID,
        platform: "nintendo",
        status: "ok",
        configured: true,
        last_error: null,
        token_expires_at: expiresAt,
        details: { connectedAt: new Date().toISOString(), devices: devices ?? [] },
      },
      { onConflict: "user_id,adapter_id" },
    );

    return reply(200, { ok: true, expiresAt, devices });
  } catch (error) {
    if (error instanceof NintendoAuthError) {
      return reply(error.kind === "network" ? 502 : 400, { error: error.message });
    }
    // Never return details: they could contain token material.
    return reply(500, { error: "Unerwarteter Fehler bei der Nintendo-Anmeldung." });
  }
});
