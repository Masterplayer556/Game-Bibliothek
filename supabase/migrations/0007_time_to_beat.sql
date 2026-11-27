-- Game Bibliothek – how long a game takes (IGDB «time to beat»)
--
-- Written by the sync (service role) for games with an IGDB id; read by the app. Two columns
-- in games: the table keeps its row level security policy (own rows, allowed e-mail only) and
-- its grants, which cover new columns.

alter table game_bibliothek.games
  -- minutes: {"hastily": 480, "normally": 720, "completely": 1500, "count": 42}; null = unknown
  add column time_to_beat jsonb,
  -- last lookup, also when IGDB knew nothing; null = not looked up yet (asked again after 30 days)
  add column time_to_beat_checked_at timestamptz;
