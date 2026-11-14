import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { FunctionError, invokeFunction } from "./functions";
import { startSync } from "./sync-control";

/** A client whose Edge Functions answer with the given status and body. */
function clientAnswering(status: number, body: unknown): SupabaseClient {
  const invoke = async () => {
    if (status === 200) return { data: body, error: null };
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return { data: null, error: { message: "Edge Function returned a non-2xx status code", context: new Response(text, { status }) } };
  };
  return { functions: { invoke } } as unknown as SupabaseClient;
}

const failure = async (db: SupabaseClient): Promise<FunctionError> => {
  try {
    await invokeFunction(db, "save-credential", {}, "Speichern fehlgeschlagen.");
  } catch (error) {
    if (error instanceof FunctionError) return error;
  }
  throw new Error("expected a FunctionError");
};

describe("invokeFunction", () => {
  it("returns the answer of a successful call", async () => {
    expect(await invokeFunction(clientAnswering(200, { ok: true }), "x", {}, "Fehler")).toEqual({ ok: true });
  });

  it("shows the message the function sent", async () => {
    const error = await failure(clientAnswering(400, { error: "Die NPSSO besteht aus genau 64 Buchstaben und Ziffern." }));
    expect(error.message).toBe("Die NPSSO besteht aus genau 64 Buchstaben und Ziffern.");
    expect(error.status).toBe(400);
  });

  it("explains a function that is not deployed yet", async () => {
    const error = await failure(clientAnswering(404, "Not Found"));
    expect(error.message).toContain("«save-credential» ist noch nicht eingerichtet");
  });

  it("falls back to the given message when the answer is unreadable or missing", async () => {
    expect((await failure(clientAnswering(500, "<html>"))).message).toBe("Speichern fehlgeschlagen.");
    const offline = { functions: { invoke: async () => ({ data: null, error: { message: "Failed to fetch" } }) } } as unknown as SupabaseClient;
    const error = await failure(offline);
    expect([error.message, error.status]).toEqual(["Speichern fehlgeschlagen.", 0]);
  });
});

describe("startSync", () => {
  it("returns the id of the new run", async () => {
    expect(await startSync(clientAnswering(200, { runId: "run-1" }), "sync", null)).toBe("run-1");
  });

  it("follows the run that is already open instead of failing", async () => {
    const db = clientAnswering(409, { error: "Es läuft schon ein Sync.", runId: "run-open" });
    expect(await startSync(db, "sync", "steam")).toBe("run-open");
  });

  it("passes other errors on with their message", async () => {
    const db = clientAnswering(503, { error: "Der Knopf ist noch nicht eingerichtet." });
    await expect(startSync(db, "test", null)).rejects.toThrow("Der Knopf ist noch nicht eingerichtet.");
  });
});
