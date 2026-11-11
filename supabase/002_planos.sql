-- MUSUBI · pacotes, teste grátis e Painel do MUSUBI (etapa 10, segunda parte).
-- Como usar: no Supabase, SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Precisa do 001_inicio.sql antes (e depois deste, não rode o 001 de novo). Pode rodar este de novo sem estragar nada.
--
-- Cada clínica tem uma assinatura: o pacote (essencial, profissional ou clínica), o fim do teste grátis
-- (7 dias depois de criar a conta), o acesso grátis que o dono do MUSUBI der (com prazo ou sem prazo)
-- e, mais tarde, até quando está pago. A assinatura fica numa tabela à parte para o administrador da
-- clínica não conseguir mudar o próprio prazo: só o dono do MUSUBI muda, pelas funções abaixo.
-- O dono vê as clínicas, quem usa cada uma e números gerais, mas NÃO vê os dados dos pacientes.

create table if not exists public.assinaturas (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  plano text not null default 'profissional' check (plano in ('essencial', 'profissional', 'clinica')),
  teste_ate timestamptz not null default now() + interval '7 days',
  gratis_ate timestamptz,
  gratis_sempre boolean not null default false,
  gratis_motivo text not null default '',
  pago_ate timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
drop policy if exists assinaturas_ler on public.assinaturas;
create policy assinaturas_ler on public.assinaturas for select to authenticated using (public.e_membro(clinica_id) or public.e_dono());

-- Clínicas criadas antes desta parte: entram no Profissional, com 7 dias de teste a partir de agora.
insert into public.assinaturas (clinica_id) select id from public.clinicas on conflict do nothing;

-- O dono do MUSUBI enxerga todas as clínicas e quem usa cada uma (não os dados).
drop policy if exists clinicas_dono on public.clinicas;
create policy clinicas_dono on public.clinicas for select to authenticated using (public.e_dono());
drop policy if exists membros_dono on public.membros;
create policy membros_dono on public.membros for select to authenticated using (public.e_dono());

-- Criar a clínica escolhendo o pacote (substitui a versão sem pacote).
drop function if exists public.criar_clinica(text, text, text, text, jsonb);
create or replace function public.criar_clinica(p_nome text, p_cidade text, p_uf text, p_nome_pessoa text, p_doc jsonb, p_plano text default 'profissional')
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  if p_doc is null then raise exception 'sem_dados'; end if;
  if coalesce(p_plano, '') not in ('essencial', 'profissional', 'clinica') then raise exception 'plano_invalido'; end if;
  insert into clinicas (nome, cidade, uf, criado_por) values (trim(p_nome), trim(coalesce(p_cidade, '')), coalesce(p_uf, ''), auth.uid()) returning id into c;
  insert into membros (clinica_id, user_id, nome, email, perfil)
    values (c, auth.uid(), trim(coalesce(p_nome_pessoa, '')), coalesce(auth.jwt() ->> 'email', ''), 'adm');
  insert into dados (clinica_id, doc, versao, atualizado_por) values (c, p_doc, 1, auth.uid());
  insert into assinaturas (clinica_id, plano) values (c, p_plano);
  return c;
end $$;

-- Painel do MUSUBI: uma linha por clínica, com números gerais (nada dos pacientes além da contagem).
drop function if exists public.painel_dono();   -- o 009 acrescenta colunas; recriar evita erro de tipo ao rodar de novo
create function public.painel_dono()
returns table (id uuid, nome text, cidade text, uf text, criado_em timestamptz, email_dono text,
  plano text, teste_ate timestamptz, gratis_ate timestamptz, gratis_sempre boolean, gratis_motivo text, pago_ate timestamptz,
  pessoas integer, pessoas_ativas integer, pacientes integer, ultimo_uso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_dono() then raise exception 'sem_acesso'; end if;
  return query
  select c.id, c.nome, c.cidade, c.uf, c.criado_em,
    coalesce((select u.email from auth.users u where u.id = c.criado_por), '')::text,
    a.plano, a.teste_ate, a.gratis_ate, a.gratis_sempre, a.gratis_motivo, a.pago_ate,
    (select count(*) from membros m where m.clinica_id = c.id)::integer,
    (select count(*) from membros m where m.clinica_id = c.id and m.ativo)::integer,
    coalesce((select jsonb_array_length(coalesce(d.doc -> 'patients', '[]'::jsonb)) from dados d where d.clinica_id = c.id), 0)::integer,
    (select d.atualizado_em from dados d where d.clinica_id = c.id)
  from clinicas c left join assinaturas a on a.clinica_id = c.id
  order by c.criado_em desc;
end $$;

-- Dar acesso grátis (p_ate nulo = sem prazo) ou tirar (p_tirar).
create or replace function public.dar_gratis(p_clinica uuid, p_ate timestamptz, p_motivo text default '', p_tirar boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_dono() then raise exception 'sem_acesso'; end if;
  insert into assinaturas (clinica_id) values (p_clinica) on conflict do nothing;
  update assinaturas set
    gratis_sempre = not p_tirar and p_ate is null,
    gratis_ate = case when p_tirar then null else p_ate end,
    gratis_motivo = case when p_tirar then '' else trim(coalesce(p_motivo, '')) end,
    atualizado_em = now()
  where clinica_id = p_clinica;
end $$;

-- Trocar o pacote de uma clínica (pelo dono).
create or replace function public.mudar_plano(p_clinica uuid, p_plano text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_dono() then raise exception 'sem_acesso'; end if;
  if coalesce(p_plano, '') not in ('essencial', 'profissional', 'clinica') then raise exception 'plano_invalido'; end if;
  insert into assinaturas (clinica_id) values (p_clinica) on conflict do nothing;
  update assinaturas set plano = p_plano, atualizado_em = now() where clinica_id = p_clinica;
end $$;

-- Mais dias de teste para uma clínica (pelo dono).
create or replace function public.estender_teste(p_clinica uuid, p_dias integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_dono() then raise exception 'sem_acesso'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then raise exception 'dias_invalidos'; end if;
  update assinaturas set teste_ate = greatest(teste_ate, now()) + make_interval(days => p_dias), atualizado_em = now() where clinica_id = p_clinica;
end $$;

revoke all on function public.criar_clinica(text, text, text, text, jsonb, text) from public, anon;
revoke all on function public.painel_dono() from public, anon;
revoke all on function public.dar_gratis(uuid, timestamptz, text, boolean) from public, anon;
revoke all on function public.mudar_plano(uuid, text) from public, anon;
revoke all on function public.estender_teste(uuid, integer) from public, anon;
grant execute on function public.criar_clinica(text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.painel_dono() to authenticated;
grant execute on function public.dar_gratis(uuid, timestamptz, text, boolean) to authenticated;
grant execute on function public.mudar_plano(uuid, text) to authenticated;
grant execute on function public.estender_teste(uuid, integer) to authenticated;
