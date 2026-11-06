-- MUSUBI · estrutura inicial do banco (etapa 10, primeira parte).
-- Como usar: no Supabase, abra SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Pode rodar de novo sem estragar nada (cria só o que ainda não existe e atualiza as funções).
--
-- Nesta primeira parte cada clínica guarda os dados do sistema em um único documento (o mesmo formato
-- que hoje fica no navegador), com controle de versão para dois aparelhos não apagarem o trabalho um
-- do outro. Equipe com dados separados por perfil entra na próxima parte.

create extension if not exists pgcrypto;

-- Clínicas
create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cidade text not null default '',
  uf text not null default '',
  whats text not null default '',
  permissoes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references auth.users(id)
);

-- Quem usa cada clínica e com qual perfil
create table if not exists public.membros (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  perfil text not null default 'prof' check (perfil in ('adm', 'prof', 'rec')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (clinica_id, user_id)
);

-- Dados do sistema de cada clínica (documento único, com versão)
create table if not exists public.dados (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  doc jsonb not null,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);

-- Pedidos de "Quero conhecer" da página de apresentação
create table if not exists public.interessados (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 120),
  whats text not null check (length(regexp_replace(whats, '\D', '', 'g')) between 10 and 13),
  situacao text not null default 'novo' check (situacao in ('novo', 'chamei', 'cliente', 'nao')),
  criado_em timestamptz not null default now()
);

-- Contas donas do MUSUBI (veem os interessados). Preenchida à mão, uma vez.
create table if not exists public.donos (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Funções auxiliares (security definer evita recursão nas regras de acesso)
create or replace function public.e_membro(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where clinica_id = c and user_id = auth.uid() and ativo);
$$;
create or replace function public.e_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where clinica_id = c and user_id = auth.uid() and ativo and perfil = 'adm');
$$;
create or replace function public.e_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from donos where user_id = auth.uid());
$$;

-- Regras de acesso: cada clínica só enxerga os próprios dados
alter table public.clinicas enable row level security;
alter table public.membros enable row level security;
alter table public.dados enable row level security;
alter table public.interessados enable row level security;
alter table public.donos enable row level security;

drop policy if exists clinicas_ler on public.clinicas;
create policy clinicas_ler on public.clinicas for select to authenticated using (public.e_membro(id));
drop policy if exists clinicas_mudar on public.clinicas;
create policy clinicas_mudar on public.clinicas for update to authenticated using (public.e_admin(id)) with check (public.e_admin(id));

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated using (public.e_membro(clinica_id));

drop policy if exists dados_ler on public.dados;
create policy dados_ler on public.dados for select to authenticated using (public.e_membro(clinica_id));

drop policy if exists interessados_pedir on public.interessados;
create policy interessados_pedir on public.interessados for insert to anon, authenticated with check (situacao = 'novo');
drop policy if exists interessados_ver on public.interessados;
create policy interessados_ver on public.interessados for select to authenticated using (public.e_dono());
drop policy if exists interessados_mudar on public.interessados;
create policy interessados_mudar on public.interessados for update to authenticated using (public.e_dono()) with check (public.e_dono());

drop policy if exists donos_ler on public.donos;
create policy donos_ler on public.donos for select to authenticated using (user_id = auth.uid());

-- Criar a clínica no primeiro acesso: quem cria vira administrador; os dados do aparelho vão junto.
create or replace function public.criar_clinica(p_nome text, p_cidade text, p_uf text, p_nome_pessoa text, p_doc jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  if p_doc is null then raise exception 'sem_dados'; end if;
  insert into clinicas (nome, cidade, uf, criado_por) values (trim(p_nome), trim(coalesce(p_cidade, '')), coalesce(p_uf, ''), auth.uid()) returning id into c;
  insert into membros (clinica_id, user_id, nome, email, perfil)
    values (c, auth.uid(), trim(coalesce(p_nome_pessoa, '')), coalesce(auth.jwt() ->> 'email', ''), 'adm');
  insert into dados (clinica_id, doc, versao, atualizado_por) values (c, p_doc, 1, auth.uid());
  return c;
end $$;

-- Salvar os dados com controle de versão: só grava se ninguém salvou antes.
-- Devolve a nova versão; se outra pessoa/aparelho salvou antes, devolve -1 e não grava.
create or replace function public.salvar_dados(p_clinica uuid, p_doc jsonb, p_versao integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not public.e_membro(p_clinica) then raise exception 'sem_acesso'; end if;
  update dados set doc = p_doc, versao = versao + 1, atualizado_em = now(), atualizado_por = auth.uid()
    where clinica_id = p_clinica and versao = p_versao returning versao into v;
  return coalesce(v, -1);
end $$;

revoke all on function public.criar_clinica(text, text, text, text, jsonb) from public, anon;
revoke all on function public.salvar_dados(uuid, jsonb, integer) from public, anon;
grant execute on function public.criar_clinica(text, text, text, text, jsonb) to authenticated;
grant execute on function public.salvar_dados(uuid, jsonb, integer) to authenticated;
grant execute on function public.e_membro(uuid), public.e_admin(uuid), public.e_dono() to authenticated;
