-- Game Bibliothek – helper for Edge Functions
--
-- An Edge Function verifies the login token itself and then has to check that the e-mail
-- is allowed. The list lives in a schema that is not reachable through the API, so this
-- function answers the question. Only the service role (Edge Functions, sync script) may
-- call it; the browser cannot use it to probe addresses.

create function game_bibliothek.is_allowed_email(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from game_bibliothek_private.allowed_emails e
    where lower(e.email) = lower(coalesce(candidate, ''))
  );
$$;

revoke all on function game_bibliothek.is_allowed_email(text) from public, anon, authenticated;
grant execute on function game_bibliothek.is_allowed_email(text) to service_role;
