// Nintendo Account login for the «Nintendo Switch Parental Controls» app.
//
// IMPORTANT: this file must not import anything. It is used by the app, by the sync script
// and (copied as-is) by the Supabase Edge Function, which runs on Deno.
//
// Flow, as documented by the open-source projects nxapi and pynintendoauth:
//   1. open the authorize URL (PKCE, response_type=session_token_code)
//   2. the «select this account» button links to npf<client>://auth#session_token_code=…
//   3. exchange that code for a long-lived session token
//   4. exchange the session token for short-lived API tokens whenever needed
// No third-party service is involved.

export const NINTENDO_CLIENT_ID = "54789befb391a838";
export const NINTENDO_REDIRECT_URI = `npf${NINTENDO_CLIENT_ID}://auth`;

const AUTHORIZE_URL = "https://accounts.nintendo.com/connect/1.0.0/authorize";
const SESSION_TOKEN_URL = "https://accounts.nintendo.com/connect/1.0.0/api/session_token";
const TOKEN_URL = "https://accounts.nintendo.com/connect/1.0.0/api/token";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer-session-token";

const SCOPES = [
  "openid",
  "user",
  "moonUser:administration",
  "moonDevice:create",
  "moonOwnedDevice:administration",
  "moonParentalControlSetting",
  "moonParentalControlSetting:update",
  "moonParentalControlSettingState",
  "moonPairingState",
  "moonSmartDevice:administration",
  "moonDailySummary",
  "moonMonthlySummary",
];

export type NintendoAuthErrorKind = "invalid_link" | "session_expired" | "rejected" | "network";

/** `message` is German and safe to show in the app. */
export class NintendoAuthError extends Error {
  readonly kind: NintendoAuthErrorKind;
  constructor(kind: NintendoAuthErrorKind, message: string) {
    super(message);
    this.name = "NintendoAuthError";
    this.kind = kind;
  }
}

export interface NintendoLoginRequest {
  url: string;
  /** Keep until the login is finished; needed to exchange the code. */
  verifier: string;
  state: string;
}

export interface NintendoApiTokens {
  idToken: string;
  accessToken: string;
  expiresInSeconds: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Step 1: the link the user opens to log in. */
export async function createLoginRequest(): Promise<NintendoLoginRequest> {
  const verifier = randomToken(32);
  const state = randomToken(36);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const params = new URLSearchParams({
    state,
    redirect_uri: NINTENDO_REDIRECT_URI,
    client_id: NINTENDO_CLIENT_ID,
    scope: SCOPES.join(" "),
    response_type: "session_token_code",
    session_token_code_challenge: base64Url(new Uint8Array(digest)),
    session_token_code_challenge_method: "S256",
    theme: "login_form",
  });
  return { url: `${AUTHORIZE_URL}?${params.toString()}`, verifier, state };
}

/** Step 2: read the code out of the copied «select this account» link. */
export function parseRedirectLink(link: string): { code: string; state: string | null } {
  const text = link.trim();
  const separator = text.search(/[#?]/);
  if (!text.startsWith("npf") || separator === -1) {
    throw new NintendoAuthError(
      "invalid_link",
      "Das ist nicht der richtige Link. Er muss mit «npf» beginnen. Halte den Knopf «Dieses Konto auswählen» gedrückt und wähle «Link kopieren».",
    );
  }
  const params = new URLSearchParams(text.slice(separator + 1).replace(/^[#?]/, ""));
  const error = params.get("error");
  if (error) {
    throw new NintendoAuthError("rejected", `Nintendo hat die Anmeldung abgelehnt (${error}).`);
  }
  const code = params.get("session_token_code");
  if (!code) {
    throw new NintendoAuthError(
      "invalid_link",
      "Im Link fehlt der Anmelde-Code. Bitte den Link noch einmal vollständig kopieren.",
    );
  }
  return { code, state: params.get("state") };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    return data !== null && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Step 3: one-time code → session token (valid for a long time, store encrypted). */
export async function exchangeCodeForSessionToken(
  fetchFn: typeof fetch,
  code: string,
  verifier: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchFn(SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: NINTENDO_CLIENT_ID,
        session_token_code: code,
        session_token_code_verifier: verifier,
      }).toString(),
    });
  } catch {
    throw new NintendoAuthError("network", "Nintendo ist gerade nicht erreichbar. Bitte später noch einmal versuchen.");
  }
  const data = await readJson(response);
  const token = data.session_token;
  if (!response.ok || typeof token !== "string" || token === "") {
    throw new NintendoAuthError(
      "rejected",
      "Nintendo hat den Link nicht akzeptiert. Er gilt nur kurz und nur einmal: Bitte den Login-Link neu öffnen und den Link frisch kopieren.",
    );
  }
  return token;
}

/** Step 4: session token → short-lived tokens for the API. */
export async function fetchApiTokens(
  fetchFn: typeof fetch,
  sessionToken: string,
): Promise<NintendoApiTokens> {
  let response: Response;
  try {
    response = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: NINTENDO_CLIENT_ID,
        session_token: sessionToken,
        grant_type: GRANT_TYPE,
      }),
    });
  } catch {
    throw new NintendoAuthError("network", "Nintendo ist gerade nicht erreichbar.");
  }
  const data = await readJson(response);
  if (response.status === 400 || response.status === 401) {
    throw new NintendoAuthError("session_expired", "Die Nintendo-Anmeldung ist abgelaufen. Bitte Nintendo neu anmelden.");
  }
  const idToken = data.id_token;
  const accessToken = data.access_token;
  if (!response.ok || typeof idToken !== "string" || typeof accessToken !== "string") {
    throw new NintendoAuthError("network", `Nintendo antwortet mit einem Fehler (Status ${response.status}).`);
  }
  return {
    idToken,
    accessToken,
    expiresInSeconds: typeof data.expires_in === "number" ? data.expires_in : 900,
  };
}

/** Expiry of a JWT (session token) as ISO string, or null if it cannot be read. */
export function readTokenExpiry(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp: unknown = (JSON.parse(json) as Record<string, unknown>).exp;
    return typeof exp === "number" ? new Date(exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}
