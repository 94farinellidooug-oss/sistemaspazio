-- Imita o mínimo do Supabase para testar supabase/*.sql num Postgres comum:
-- esquema auth com users, auth.uid() e auth.jwt() lidos da sessão, e os papéis anon e authenticated.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
