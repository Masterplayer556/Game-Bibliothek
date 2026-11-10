// SyncStore backed by Supabase (secret key: bypasses row level security).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdapterInfo } from "../src/core/adapter-catalog";
import { decryptSecret, encryptSecret } from "../src/core/crypto";
import type { SyncBatch } from "../src/core/types";
import { fetchAll, persistBatch, type PersistSummary } from "../src/data/persist";
import type {
  AdapterRunResult,
  ConnectionPatch,
  CredentialUpdate,
  PreviousGameState,
  RunMode,
  SyncStore,
} from "./types";

export function createServiceClient(env: Readonly<Record<string, string | undefined>>): SupabaseClient {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example)");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The single user all data belongs to. */
export async function resolveUserId(
  db: SupabaseClient,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string> {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const users = data.users;
  const wanted = env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (wanted) {
    const user = users.find((u) => u.email?.toLowerCase() === wanted);
    if (!user) throw new Error("No user with the e-mail from ALLOWED_EMAIL exists in this project");
    return user.id;
  }
  if (users.length === 1) return users[0]!.id;
  if (users.length === 0) throw new Error("The project has no user yet. Create your user first.");
  throw new Error("The project has several users. Set ALLOWED_EMAIL to choose one.");
}

export class SupabaseSyncStore implements SyncStore {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
    private readonly encryptionKey: string | undefined,
  ) {}

  private key(): string {
    if (!this.encryptionKey) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
    return this.encryptionKey;
  }

  async isEnabled(adapterId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("platform_connections")
      .select("enabled")
      .eq("user_id", this.userId)
      .eq("adapter_id", adapterId)
      .maybeSingle();
    if (error) throw new Error(`Could not read connection: ${error.message}`);
    return data?.enabled ?? true;
  }

  async getCredentials(adapterId: string): Promise<Record<string, string>> {
    const { data, error } = await this.db
      .from("platform_credentials")
      .select("kind, ciphertext")
      .eq("user_id", this.userId)
      .eq("adapter_id", adapterId);
    if (error) throw new Error(`Could not read credentials: ${error.message}`);
    const out: Record<string, string> = {};
    for (const row of data ?? []) out[row.kind] = await decryptSecret(row.ciphertext, this.key());
    return out;
  }

  async saveCredentials(adapterId: string, updates: readonly CredentialUpdate[]): Promise<void> {
    for (const update of updates) {
      if (update.value === null) {
        const { error } = await this.db
          .from("platform_credentials")
          .delete()
          .eq("user_id", this.userId)
          .eq("adapter_id", adapterId)
          .eq("kind", update.kind);
        if (error) throw new Error(`Could not delete credential: ${error.message}`);
        continue;
      }
      const { error } = await this.db.from("platform_credentials").upsert(
        {
          user_id: this.userId,
          adapter_id: adapterId,
          kind: update.kind,
          ciphertext: await encryptSecret(update.value, this.key()),
        },
        { onConflict: "user_id,adapter_id,kind" },
      );
      if (error) throw new Error(`Could not save credential: ${error.message}`);
    }
  }

  async getPreviousGames(adapter: AdapterInfo): Promise<Map<string, PreviousGameState>> {
    const rows = await fetchAll<{
      external_id: string;
      total_playtime_minutes: number;
      last_played_at: string | null;
    }>((from, to) =>
      this.db
        .from("platform_games")
        .select("external_id, total_playtime_minutes, last_played_at")
        .eq("user_id", this.userId)
        .eq("platform", adapter.platform)
        .eq("source", adapter.id)
        .range(from, to),
    );
    return new Map(
      rows.map((r) => [
        r.external_id,
        { totalPlaytimeMinutes: r.total_playtime_minutes, lastPlayedAt: r.last_played_at },
      ]),
    );
  }

  saveBatch(batch: SyncBatch, now: Date): Promise<PersistSummary> {
    return persistBatch(this.db, this.userId, batch, now);
  }

  async setConnection(adapter: AdapterInfo, patch: ConnectionPatch): Promise<void> {
    const row: Record<string, unknown> = {
      user_id: this.userId,
      adapter_id: adapter.id,
      platform: adapter.platform,
      status: patch.status,
      configured: patch.configured,
    };
    if (patch.lastSyncAt !== undefined) row.last_sync_at = patch.lastSyncAt;
    if (patch.lastSuccessAt !== undefined) row.last_success_at = patch.lastSuccessAt;
    if (patch.lastError !== undefined) row.last_error = patch.lastError;
    if (patch.dataSince != null) row.data_since = patch.dataSince;
    if (patch.tokenExpiresAt !== undefined) row.token_expires_at = patch.tokenExpiresAt;
    if (patch.details !== undefined) row.details = patch.details;
    const { error } = await this.db
      .from("platform_connections")
      .upsert(row, { onConflict: "user_id,adapter_id" });
    if (error) throw new Error(`Could not save connection status: ${error.message}`);
  }

  /** Marks a run as started. Reuses the row created by the trigger-sync function if given. */
  async startRun(input: {
    runId?: string;
    mode: RunMode;
    adapterId?: string;
    trigger: "schedule" | "manual" | "local";
  }): Promise<string> {
    const startedAt = new Date().toISOString();
    if (input.runId) {
      const { data, error } = await this.db
        .from("sync_runs")
        .update({ status: "running", started_at: startedAt })
        .eq("id", input.runId)
        .eq("user_id", this.userId)
        .select("id");
      if (error) throw new Error(`Could not update sync run: ${error.message}`);
      if (data && data.length > 0) return input.runId;
    }
    const { data, error } = await this.db
      .from("sync_runs")
      .insert({
        user_id: this.userId,
        mode: input.mode,
        adapter_id: input.adapterId ?? null,
        trigger: input.trigger,
        status: "running",
        started_at: startedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create sync run: ${error.message}`);
    return data.id;
  }

  async finishRun(
    runId: string,
    status: "success" | "partial" | "error",
    results: readonly AdapterRunResult[],
  ): Promise<void> {
    const { error } = await this.db
      .from("sync_runs")
      .update({ status, results, finished_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("user_id", this.userId);
    if (error) throw new Error(`Could not finish sync run: ${error.message}`);
  }
}
