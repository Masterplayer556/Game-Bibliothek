-- Game Bibliothek – my rating of a game and the day I finished it
--
-- Two columns in game_user_data (my own notes per game). The table keeps its row level
-- security policy (own rows, allowed e-mail only) and its grants; they cover new columns.

alter table game_bibliothek.game_user_data
  -- 1 to 5 stars, null = not rated
  add column rating smallint check (rating between 1 and 5),
  -- «Durchgespielt am»: a calendar day (Europe/Zurich), null = not known
  add column completed_on date;
