-- MUSUBI · equipe da clínica (etapa 10, quarta parte).
-- Como usar: no Supabase, SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Precisa do 001_inicio.sql e do 002_planos.sql antes. Pode rodar este de novo sem estragar nada.
--
-- O administrador convida pessoas pelo e-mail, com o perfil Profissional ou Recepção. A pessoa cria a conta no
-- site com esse e-mail; ao entrar (com o e-mail confirmado), passa a fazer parte da clínica. O administrador
-- muda o perfil, tira e devolve o acesso (nada é apagado) e escolhe o que cada perfil abre.
-- Limite por pacote (decisão do Maicon em 06/11/2026): Essencial e Profissional têm 1 profissional (quem
-- administra conta como profissional) e até 2 pessoas na recepção; o pacote Clínica não tem limite.

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null default '',
  email text not null check (position('@' in email) > 1),
  perfil text not null check (perfil in ('prof', 'rec')),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  aceito_por uuid references auth.users(id) on delete set null
);
create unique index if not exists convites_abertos on public.convites (clinica_id, lower(email)) where aceito_em is null;
alter table public.convites enable row level security;
drop policy if exists convites_ler on public.convites;
create policy convites_ler on public.convites for select to authenticated using (public.e_admin(clinica_id));
revoke insert, update, delete on public.convites from anon, authenticated;

-- Pacote da clínica (sem assinatura conta como Profissional, como no sistema).
create or replace function public.pacote_da_clinica(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select plano from assinaturas where clinica_id = c), 'profissional');
$$;

-- Cabe mais uma pessoa com este perfil? (conta quem tem acesso e os convites ainda não aceitos)
create or replace function public.cabe_na_equipe(c uuid, p_perfil text, p_ignorar uuid default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare n integer; limite integer; grupo text[];
begin
  if public.pacote_da_clinica(c) = 'clinica' then return true; end if;
  if p_perfil = 'rec' then grupo := array['rec']; limite := 2; else grupo := array['adm', 'prof']; limite := 1; end if;
  select count(*) into n from membros where clinica_id = c and ativo and perfil = any(grupo) and user_id is distinct from p_ignorar;
  n := n + (select count(*) from convites where clinica_id = c and aceito_em is null and perfil = any(grupo));
  return n < limite;
end $$;

-- Convidar: só o administrador. Devolve o id do convite.
create or replace function public.convidar(p_clinica uuid, p_nome text, p_email text, p_perfil text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); r uuid;
begin
  if not public.e_admin(p_clinica) then raise exception 'sem_acesso'; end if;
  if p_perfil not in ('prof', 'rec') then raise exception 'perfil_invalido'; end if;
  if position('@' in e) < 2 then raise exception 'email_invalido'; end if;
  if exists (select 1 from membros where clinica_id = p_clinica and lower(email) = e and ativo) then raise exception 'ja_na_equipe'; end if;
  if exists (select 1 from convites where clinica_id = p_clinica and lower(email) = e and aceito_em is null) then raise exception 'ja_convidado'; end if;
  if not public.cabe_na_equipe(p_clinica, p_perfil) then raise exception 'limite_pacote'; end if;
  insert into convites (clinica_id, nome, email, perfil, criado_por) values (p_clinica, trim(coalesce(p_nome, '')), e, p_perfil, auth.uid()) returning id into r;
  return r;
end $$;

create or replace function public.cancelar_convite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from convites where id = p_id and public.e_admin(clinica_id)) then raise exception 'sem_acesso'; end if;
  delete from convites where id = p_id and aceito_em is null;
end $$;

-- Ao entrar: aceita os convites feitos para o e-mail da pessoa (só com o e-mail confirmado). Devolve quantos.
create or replace function public.aceitar_convites() returns integer
language plpgsql security definer set search_path = public as $$
declare u record; c record; n integer := 0;
begin
  if auth.uid() is null then return 0; end if;
  select id, lower(email) as email, email_confirmed_at, coalesce(raw_user_meta_data ->> 'nome', '') as nome into u from auth.users where id = auth.uid();
  if u.email is null or u.email_confirmed_at is null then return 0; end if;
  for c in select * from convites where lower(email) = u.email and aceito_em is null loop
    insert into membros (clinica_id, user_id, nome, email, perfil, ativo)
      values (c.clinica_id, u.id, coalesce(nullif(u.nome, ''), c.nome), u.email, c.perfil, true)
      on conflict (clinica_id, user_id) do update set perfil = excluded.perfil, ativo = true;
    update convites set aceito_em = now(), aceito_por = u.id where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Mudar o perfil ou tirar/devolver o acesso de alguém da equipe (não vale para si mesmo).
create or replace function public.mudar_membro(p_clinica uuid, p_user uuid, p_perfil text, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m membros;
begin
  if not public.e_admin(p_clinica) then raise exception 'sem_acesso'; end if;
  if p_user = auth.uid() then raise exception 'nao_a_si_mesmo'; end if;
  if p_perfil not in ('adm', 'prof', 'rec') then raise exception 'perfil_invalido'; end if;
  select * into m from membros where clinica_id = p_clinica and user_id = p_user;
  if not found then raise exception 'nao_encontrado'; end if;
  if p_ativo and (not m.ativo or (case when p_perfil = 'rec' then 'rec' else 'prof' end) <> (case when m.perfil = 'rec' then 'rec' else 'prof' end))
     and not public.cabe_na_equipe(p_clinica, p_perfil, p_user) then raise exception 'limite_pacote'; end if;
  update membros set perfil = p_perfil, ativo = p_ativo where clinica_id = p_clinica and user_id = p_user;
end $$;

revoke all on function public.pacote_da_clinica(uuid), public.cabe_na_equipe(uuid, text, uuid) from public, anon;
revoke all on function public.convidar(uuid, text, text, text), public.cancelar_convite(uuid), public.aceitar_convites(), public.mudar_membro(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.pacote_da_clinica(uuid), public.cabe_na_equipe(uuid, text, uuid) to authenticated;
grant execute on function public.convidar(uuid, text, text, text), public.cancelar_convite(uuid), public.aceitar_convites(), public.mudar_membro(uuid, uuid, text, boolean) to authenticated;
