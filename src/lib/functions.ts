// One way to call the app's Edge Functions. They answer errors with a German message in
// the body ({ error }), which the client library hides behind a generic one.
import type { SupabaseClient } from "@supabase/supabase-js";

export class FunctionError extends Error {
  /** HTTP status, 0 if the function could not be reached. */
  readonly status: number;
  /** Parsed body of the answer, if there was one. */
  readonly body: Record<string, unknown>;
  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = "FunctionError";
    this.status = status;
    this.body = body;
  }
}

/** Calls an Edge Function. Throws a FunctionError whose message can be shown as is. */
export async function invokeFunction<T>(
  db: SupabaseClient,
  name: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  const { data, error } = await db.functions.invoke(name, { body });
  if (!error) return (data ?? {}) as T;

  let message = fallbackMessage;
  let status = 0;
  let answer: Record<string, unknown> = {};
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    status = context.status;
    if (status === 404) {
      message = `Die Function «${name}» ist noch nicht eingerichtet (Workflow «Edge Functions deployen» starten).`;
    }
    try {
      const parsed: unknown = await context.json();
      if (parsed !== null && typeof parsed === "object") answer = parsed as Record<string, unknown>;
      if (typeof answer.error === "string") message = answer.error;
    } catch {
      // no readable body
    }
  }
  throw new FunctionError(message, status, answer);
}
