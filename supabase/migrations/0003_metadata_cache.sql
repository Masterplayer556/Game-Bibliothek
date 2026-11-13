-- Game Bibliothek – cache for metadata lookups (IGDB)
--
-- Every title is looked up once; misses are retried after 30 days. Only the sync script
-- (service role) reads and writes this table: row level security on, no policy.

create table game_bibliothek.metadata_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  query_key text not null,
  -- the chosen match, or null when nothing convincing was found
  result jsonb,
  fetched_at timestamptz not null default now(),
  primary key (user_id, provider, query_key)
);

alter table game_bibliothek.metadata_cache enable row level security;

revoke all on game_bibliothek.metadata_cache from public, anon, authenticated;
grant all on game_bibliothek.metadata_cache to service_role;
