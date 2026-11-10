import { describe, expect, it } from "vitest";
import {
  createLoginRequest,
  exchangeCodeForSessionToken,
  fetchApiTokens,
  NINTENDO_CLIENT_ID,
  NintendoAuthError,
  parseRedirectLink,
  readTokenExpiry,
} from "./auth";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("createLoginRequest", () => {
  it("builds a PKCE authorize link for the Parental Controls app", async () => {
    const request = await createLoginRequest();
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe("https://accounts.nintendo.com/connect/1.0.0/authorize");
    expect(url.searchParams.get("client_id")).toBe(NINTENDO_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`npf${NINTENDO_CLIENT_ID}://auth`);
    expect(url.searchParams.get("response_type")).toBe("session_token_code");
    expect(url.searchParams.get("session_token_code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(request.state);
    expect(url.searchParams.get("scope")).toContain("moonDailySummary");

    // The challenge is the SHA-256 of the verifier, base64url without padding.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.verifier));
    const expected = Buffer.from(digest).toString("base64url");
    expect(url.searchParams.get("session_token_code_challenge")).toBe(expected);
  });

  it("creates a new verifier and state every time", async () => {
    const [a, b] = await Promise.all([createLoginRequest(), createLoginRequest()]);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
  });
});

describe("parseRedirectLink", () => {
  const link = `npf${NINTENDO_CLIENT_ID}://auth#session_state=abc&session_token_code=eyJ.code.sig&state=my-state`;

  it("reads the code and the state", () => {
    expect(parseRedirectLink(`  ${link}\n`)).toEqual({ code: "eyJ.code.sig", state: "my-state" });
  });

  it("explains what to do when something else was pasted", () => {
    for (const wrong of ["https://accounts.nintendo.com/login", "hello", ""]) {
      expect(() => parseRedirectLink(wrong)).toThrow(/npf/);
    }
    expect(() => parseRedirectLink(`npf${NINTENDO_CLIENT_ID}://auth#state=x`)).toThrow(/Anmelde-Code/);
  });

  it("reports a rejection by Nintendo", () => {
    const rejected = `npf${NINTENDO_CLIENT_ID}://auth#error=access_denied&state=x`;
    expect(() => parseRedirectLink(rejected)).toThrow(/abgelehnt/);
  });
});

describe("exchangeCodeForSessionToken", () => {
  it("posts the code and verifier and returns the session token", async () => {
    let seen: { url: string; body: string } | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      seen = { url, body: String(init?.body) };
      return jsonResponse(200, { session_token: "session-123", code: "x" });
    }) as typeof fetch;
    expect(await exchangeCodeForSessionToken(fakeFetch, "the-code", "the-verifier")).toBe("session-123");
    expect(seen!.url).toContain("/api/session_token");
    const body = new URLSearchParams(seen!.body);
    expect(body.get("session_token_code")).toBe("the-code");
    expect(body.get("session_token_code_verifier")).toBe("the-verifier");
    expect(body.get("client_id")).toBe(NINTENDO_CLIENT_ID);
  });

  it("turns a rejected code into a helpful message", async () => {
    const fakeFetch = (async () => jsonResponse(400, { error: "invalid_grant" })) as typeof fetch;
    await expect(exchangeCodeForSessionToken(fakeFetch, "c", "v")).rejects.toMatchObject({
      kind: "rejected",
    });
  });

  it("reports network problems", async () => {
    const fakeFetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(exchangeCodeForSessionToken(fakeFetch, "c", "v")).rejects.toMatchObject({
      kind: "network",
    });
  });
});

describe("fetchApiTokens", () => {
  it("returns both tokens", async () => {
    const fakeFetch = (async () =>
      jsonResponse(200, { id_token: "id", access_token: "access", expires_in: 900 })) as typeof fetch;
    expect(await fetchApiTokens(fakeFetch, "session")).toEqual({
      idToken: "id",
      accessToken: "access",
      expiresInSeconds: 900,
    });
  });

  it("recognises an expired session", async () => {
    const fakeFetch = (async () => jsonResponse(400, { error: "invalid_grant" })) as typeof fetch;
    const error = await fetchApiTokens(fakeFetch, "old").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NintendoAuthError);
    expect((error as NintendoAuthError).kind).toBe("session_expired");
  });

  it("does not call a server error an expired session", async () => {
    const fakeFetch = (async () => jsonResponse(503, {})) as typeof fetch;
    await expect(fetchApiTokens(fakeFetch, "s")).rejects.toMatchObject({ kind: "network" });
  });
});

describe("readTokenExpiry", () => {
  it("reads exp from a JWT", () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_900_000_000 })).toString("base64url");
    expect(readTokenExpiry(`h.${payload}.s`)).toBe(new Date(1_900_000_000_000).toISOString());
  });

  it("returns null for anything unreadable", () => {
    expect(readTokenExpiry("not-a-jwt")).toBeNull();
    expect(readTokenExpiry("a.b.c")).toBeNull();
  });
});
