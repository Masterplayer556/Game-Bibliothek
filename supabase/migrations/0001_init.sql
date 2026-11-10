-- Game Bibliothek – initial schema
--
-- Everything lives in its own schemas (game_bibliothek, game_bibliothek_private), so the
-- app can share a Supabase project with another app without touching that app's tables.
-- Remove it completely with:
--   drop schema game_bibliothek cascade; drop schema game_bibliothek_private cascade;
--
-- Top to bottom:
--   1. private schema with the allowed e-mail check
--   2. tables
--   3. row level security: every table is locked, nothing is readable without login
--   4. grants
--
-- AFTER running this file, add your login e-mail (not stored in the repository):
--   insert into game_bibliothek_private.allowed_emails (email) values ('you@example.com');

-- ---------------------------------------------------------------------------
-- 1. Private schema
-- ---------------------------------------------------------------------------

create schema if not exists game_bibliothek_private;

create table game_bibliothek_private.allowed_emails (
  email text primary key
);

-- True only for a logged-in user whose e-mail is on the list.
create function game_bibliothek_private.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from game_bibliothek_private.allowed_emails e
    where lower(e.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

create function game_bibliothek_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on schema game_bibliothek_private from public, anon, authenticated;
revoke all on all tables in schema game_bibliothek_private from public, anon, authenticated;
revoke all on all functions in schema game_bibliothek_private from public, anon, authenticated;
grant usage on schema game_bibliothek_private to authenticated, service_role;
grant execute on function game_bibliothek_private.is_allowed_user() to authenticated, service_role;
grant all on all tables in schema game_bibliothek_private to service_role;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create schema if not exists game_bibliothek;

-- The "real" game, across platforms.
create table game_bibliothek.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  normalized_title text not null,
  igdb_id bigint,
  igdb_locked boolean not null default false,
  cover_url text,
  genres text[] not null default '{}',
  release_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_user_title_idx on game_bibliothek.games (user_id, normalized_title);
create index games_user_igdb_idx on game_bibliothek.games (user_id, igdb_id) where igdb_id is not null;

-- A physical device: one row per console / PC.
create table game_bibliothek.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null check (platform in ('steam', 'psn', 'nintendo', 'manual')),
  kind text not null check (kind in ('pc', 'ps5', 'ps4', 'switch1', 'switch2', 'xbox360', 'other')),
  label text not null,
  external_id text not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

-- One game on one platform.
create table game_bibliothek.platform_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id uuid references game_bibliothek.games (id) on delete set null,
  game_link_locked boolean not null default false,
  platform text not null check (platform in ('steam', 'psn', 'nintendo', 'manual')),
  source text not null,
  external_id text not null,
  title text not null,
  cover_url text,
  device_kind text check (device_kind in ('pc', 'ps5', 'ps4', 'switch1', 'switch2', 'xbox360', 'other')),
  owned boolean not null default true,
  first_played_at timestamptz,
  last_played_at timestamptz,
  total_playtime_minutes integer not null default 0 check (total_playtime_minutes >= 0),
  -- null = the platform has no achievements (shown as "keine Erfolge", not 0/0)
  achievements_unlocked integer,
  achievements_total integer,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);
create index platform_games_game_idx on game_bibliothek.platform_games (game_id);
create index platform_games_user_source_idx on game_bibliothek.platform_games (user_id, source);

-- Lifetime playtime of a game at a point in time (Steam, PSN). Written only when it changes.
create table game_bibliothek.playtime_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform_game_id uuid not null references game_bibliothek.platform_games (id) on delete cascade,
  taken_at timestamptz not null default now(),
  total_minutes integer not null check (total_minutes >= 0),
  last_played_at timestamptz,
  source text not null,
  unique (platform_game_id, taken_at)
);
create index playtime_snapshots_user_idx on game_bibliothek.playtime_snapshots (user_id, taken_at);

-- Minutes per game, device and day, where a source reports that directly.
-- Rows keep their source; which one counts is decided when reading (see src/core/playtime).
create table game_bibliothek.daily_playtime (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform_game_id uuid not null references game_bibliothek.platform_games (id) on delete cascade,
  device_id uuid not null references game_bibliothek.devices (id) on delete cascade,
  play_date date not null,
  minutes integer not null check (minutes >= 0),
  source text not null,
  estimated boolean not null default false,
  details jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (platform_game_id, device_id, play_date, source)
);
create index daily_playtime_user_date_idx on game_bibliothek.daily_playtime (user_id, play_date);

create table game_bibliothek.achievements (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform_game_id uuid not null references game_bibliothek.platform_games (id) on delete cascade,
  external_id text not null,
  name text not null,
  description text,
  icon_url text,
  unlocked_at timestamptz,
  rarity_percent numeric(5, 2),
  tier text,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (platform_game_id, external_id)
);
create index achievements_user_unlocked_idx on game_bibliothek.achievements (user_id, unlocked_at);

-- My own notes per game.
create table game_bibliothek.game_user_data (
  game_id uuid primary key references game_bibliothek.games (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text check (status in ('backlog', 'playing', 'completed', 'dropped')),
  favorite boolean not null default false,
  note text,
  hide_from_pile boolean not null default false,
  -- for entries that are not games (YouTube, system apps)
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Status per adapter. Written by the sync script, read by the app.
create table game_bibliothek.platform_connections (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  adapter_id text not null,
  platform text not null,
  status text not null default 'not_connected'
    check (status in ('not_connected', 'ok', 'error', 'auth_expired', 'disabled')),
  enabled boolean not null default true,
  configured boolean not null default false,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  data_since date,
  token_expires_at timestamptz,
  details jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, adapter_id)
);

-- Encrypted tokens (AES-256-GCM). No policy on purpose: unreadable from the browser.
create table game_bibliothek.platform_credentials (
  user_id uuid not null references auth.users (id) on delete cascade,
  adapter_id text not null,
  kind text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, adapter_id, kind)
);

-- Log of every sync run, so the app can show progress.
create table game_bibliothek.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('sync', 'test')),
  adapter_id text,
  trigger text not null check (trigger in ('schedule', 'manual', 'local')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'partial', 'error')),
  results jsonb not null default '[]',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index sync_runs_user_created_idx on game_bibliothek.sync_runs (user_id, created_at desc);

create table game_bibliothek.app_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on game_bibliothek.games
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.devices
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.platform_games
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.daily_playtime
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.achievements
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.game_user_data
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.platform_connections
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.platform_credentials
  for each row execute function game_bibliothek_private.set_updated_at();
create trigger set_updated_at before update on game_bibliothek.app_settings
  for each row execute function game_bibliothek_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table game_bibliothek_private.allowed_emails enable row level security;

alter table game_bibliothek.games enable row level security;
alter table game_bibliothek.devices enable row level security;
alter table game_bibliothek.platform_games enable row level security;
alter table game_bibliothek.playtime_snapshots enable row level security;
alter table game_bibliothek.daily_playtime enable row level security;
alter table game_bibliothek.achievements enable row level security;
alter table game_bibliothek.game_user_data enable row level security;
alter table game_bibliothek.platform_connections enable row level security;
alter table game_bibliothek.platform_credentials enable row level security;
alter table game_bibliothek.sync_runs enable row level security;
alter table game_bibliothek.app_settings enable row level security;

-- Full access to own rows, only for the allowed e-mail.
create policy own_rows on game_bibliothek.games for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.devices for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.platform_games for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.playtime_snapshots for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.daily_playtime for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.achievements for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.game_user_data for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy own_rows on game_bibliothek.app_settings for all to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));

-- Read-only from the browser: only the sync script and edge functions write these.
create policy read_own_rows on game_bibliothek.platform_connections for select to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));
create policy read_own_rows on game_bibliothek.sync_runs for select to authenticated
  using (user_id = (select auth.uid()) and (select game_bibliothek_private.is_allowed_user()));

-- game_bibliothek.platform_credentials: intentionally NO policy.

-- ---------------------------------------------------------------------------
-- 4. Grants (explicit, so the result does not depend on project defaults)
-- ---------------------------------------------------------------------------

revoke all on schema game_bibliothek from public, anon;
grant usage on schema game_bibliothek to authenticated, service_role;

revoke all on all tables in schema game_bibliothek from public, anon, authenticated;

grant select, insert, update, delete on
  game_bibliothek.games,
  game_bibliothek.devices,
  game_bibliothek.platform_games,
  game_bibliothek.playtime_snapshots,
  game_bibliothek.daily_playtime,
  game_bibliothek.achievements,
  game_bibliothek.game_user_data,
  game_bibliothek.app_settings
to authenticated;

grant select on game_bibliothek.platform_connections, game_bibliothek.sync_runs to authenticated;

grant all on all tables in schema game_bibliothek to service_role;

-- ---------------------------------------------------------------------------
-- 5. Delete demo data (button in the app)
-- ---------------------------------------------------------------------------

-- Runs with the caller's rights, so row level security still applies.
create function game_bibliothek.delete_demo_data()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from game_bibliothek.platform_games where source = 'demo';
  delete from game_bibliothek.devices where source = 'demo';
  -- every game has at least one platform entry; games without one are leftovers
  delete from game_bibliothek.games g
  where not exists (select 1 from game_bibliothek.platform_games pg where pg.game_id = g.id);
$$;

revoke all on function game_bibliothek.delete_demo_data() from public, anon, authenticated;
grant execute on function game_bibliothek.delete_demo_data() to authenticated, service_role;
