-- MUSUBI · Histórico de alterações (LGPD), pedido do Maicon em 08/11/2026.
-- Cada vez que alguém da equipe salva, o sistema compara o que mudou e grava aqui QUEM (o login), QUANDO (a hora
-- do servidor) e O QUÊ (o paciente, o registro e os campos). Os valores em si não são copiados, para o histórico
-- não duplicar dados de saúde. Ninguém altera nem apaga o histórico pelo sistema: só a função salvar_dados grava,
-- junto com os dados, e só o administrador da clínica lê.
-- Rode no SQL Editor do Supabase depois do 005_nfse.sql. Pode rodar de novo sem problema.

create table if not exists public.historico (
  id bigint generated always as identity primary key,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  em timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  pessoa text not null default '',
  email text not null default '',
  tipo text not null,
  acao text not null,
  alvo text not null default '',
  paciente_id text not null default '',
  titulo text not null default '',
  campos text[] not null default '{}'
);
create index if not exists historico_clinica on public.historico (clinica_id, em desc);
create index if not exists historico_paciente on public.historico (clinica_id, paciente_id, em desc);
alter table public.historico enable row level security;
drop policy if exists historico_ler on public.historico;
create policy historico_ler on public.historico for select to authenticated using (public.e_admin(clinica_id));
revoke insert, update, delete, truncate on public.historico from anon, authenticated;

-- Salvar os dados e o histórico juntos: se o histórico não grava, os dados também não.
-- p_eventos = [{tipo, acao, alvo, paciente_id, titulo, campos:[...]}] (no máximo 500 por vez).
create or replace function public.salvar_dados(p_clinica uuid, p_doc jsonb, p_versao integer, p_eventos jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer; quem record;
begin
  if not public.e_membro(p_clinica) then raise exception 'sem_acesso'; end if;
  update dados set doc = p_doc, versao = versao + 1, atualizado_em = now(), atualizado_por = auth.uid()
    where clinica_id = p_clinica and versao = p_versao returning versao into v;
  if v is null then return -1; end if;
  if jsonb_typeof(p_eventos) = 'array' and jsonb_array_length(p_eventos) > 0 then
    select nome, email into quem from membros where clinica_id = p_clinica and user_id = auth.uid();
    insert into historico (clinica_id, user_id, pessoa, email, tipo, acao, alvo, paciente_id, titulo, campos)
    select p_clinica, auth.uid(), coalesce(quem.nome, ''), coalesce(quem.email, ''),
      left(coalesce(e->>'tipo', ''), 40), left(coalesce(e->>'acao', ''), 40), left(coalesce(e->>'alvo', ''), 80),
      left(coalesce(e->>'paciente_id', ''), 80), left(coalesce(e->>'titulo', ''), 200),
      coalesce((select array_agg(left(c, 80)) from (select jsonb_array_elements_text(case when jsonb_typeof(e->'campos') = 'array' then e->'campos' else '[]'::jsonb end) c limit 60) x), '{}')
    from (select e from jsonb_array_elements(p_eventos) e limit 500) y
    where coalesce(e->>'tipo', '') <> '' and coalesce(e->>'acao', '') <> '';
  end if;
  return v;
end $$;

revoke all on function public.salvar_dados(uuid, jsonb, integer, jsonb) from public, anon;
grant execute on function public.salvar_dados(uuid, jsonb, integer, jsonb) to authenticated;

-- O salvamento antigo (aba aberta numa versão anterior do sistema) também deixa rastro: quem e quando, sem detalhes.
create or replace function public.salvar_dados(p_clinica uuid, p_doc jsonb, p_versao integer)
returns integer language sql security definer set search_path = public as $$
  select public.salvar_dados(p_clinica, p_doc, p_versao,
    '[{"tipo":"dados","acao":"alterou","titulo":"Salvamento sem detalhes (versão anterior do sistema)"}]'::jsonb);
$$;
revoke all on function public.salvar_dados(uuid, jsonb, integer) from public, anon;
grant execute on function public.salvar_dados(uuid, jsonb, integer) to authenticated;
