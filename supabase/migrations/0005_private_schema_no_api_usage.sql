-- The private schema is not for the API roles. «authenticated» had USAGE on it so the row
-- level policies could call game_bibliothek_private.is_allowed_user(). A policy calls the
-- function by its id, so EXECUTE on the function is enough; without USAGE the schema has
-- nothing a logged-in user can reach through the Data API, even if it is listed there.
-- The service role (Edge Functions, sync) keeps its access. No table changes.
revoke usage on schema game_bibliothek_private from public, anon, authenticated;
