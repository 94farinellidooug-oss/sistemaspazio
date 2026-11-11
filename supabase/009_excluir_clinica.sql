-- MUSUBI · excluir clínica pelo Painel do MUSUBI (pedido do Maicon em 08/11/2026).
-- Para clínicas que desistiram e não querem mais receber cobranças. Só o dono do MUSUBI exclui, digitando o
-- nome da clínica para confirmar. Se houver assinatura no cartão ativa, ela precisa ser cancelada antes (o
-- Painel faz isso sozinho pela função cobranca), para o Mercado Pago não cobrar mais nada.
-- A exclusão apaga a clínica e tudo dela (equipe, dados dos pacientes, agenda, notas, histórico). Fica só um
-- resumo comercial em clinicas_excluidas (nome, cidade, e-mail de quem criou, pacote, motivo e os pagamentos
-- feitos ao MUSUBI), para o controle financeiro do MUSUBI e para um eventual contato futuro. Nenhum dado de
-- paciente fica guardado.
-- Rode no SQL Editor do Supabase depois do 008_contrato.sql. Pode rodar de novo sem problema.

create table if not exists public.clinicas_excluidas (
  id bigint generated always as identity primary key,
  clinica_id uuid not null,
  nome text not null default '',
  cidade text not null default '',
  uf text not null default '',
  whats text not null default '',
  email_dono text not null default '',
  plano text not null default '',
  criada_em timestamptz,
  pacientes integer not null default 0,
  pago_total integer not null default 0,           -- centavos pagos ao MUSUBI
  pagamentos jsonb not null default '[]'::jsonb,   -- [{pago_em, valor, plano, periodo, meio, forma, order_nsu}]
  motivo text not null default '',
  excluida_em timestamptz not null default now(),
  excluida_por uuid references auth.users(id) on delete set null
);
alter table public.clinicas_excluidas enable row level security;
drop policy if exists clinicas_excluidas_ver on public.clinicas_excluidas;
create policy clinicas_excluidas_ver on public.clinicas_excluidas for select to authenticated using (public.e_dono());
revoke insert, update, delete, truncate on public.clinicas_excluidas from anon, authenticated;

create or replace function public.excluir_clinica(p_clinica uuid, p_nome text, p_motivo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare c clinicas; a assinaturas;
begin
  if not public.e_dono() then raise exception 'sem_acesso'; end if;
  select * into c from clinicas where id = p_clinica;
  if not found then raise exception 'nao_encontrada'; end if;
  if lower(trim(coalesce(p_nome, ''))) <> lower(trim(c.nome)) then raise exception 'nome_diferente'; end if;
  if exists (select 1 from membros where clinica_id = p_clinica and user_id = auth.uid()) then raise exception 'propria_clinica'; end if;
  select * into a from assinaturas where clinica_id = p_clinica;
  if found and a.cartao_id <> '' and a.cartao_situacao in ('ativa', 'pausada', 'pendente') then raise exception 'cartao_ativo'; end if;
  insert into clinicas_excluidas (clinica_id, nome, cidade, uf, whats, email_dono, plano, criada_em, pacientes, pago_total, pagamentos, motivo, excluida_por)
  select c.id, c.nome, c.cidade, c.uf, c.whats,
    coalesce((select u.email from auth.users u where u.id = c.criado_por), ''),
    coalesce(a.plano, ''), c.criado_em,
    coalesce((select jsonb_array_length(coalesce(d.doc -> 'patients', '[]'::jsonb)) from dados d where d.clinica_id = c.id), 0),
    coalesce((select sum(coalesce(g.valor_pago, g.valor)) from pagamentos g where g.clinica_id = c.id and g.situacao = 'pago'), 0),
    coalesce((select jsonb_agg(jsonb_build_object('pago_em', g.pago_em, 'valor', coalesce(g.valor_pago, g.valor), 'plano', g.plano, 'periodo', g.periodo, 'meio', g.meio, 'forma', g.forma, 'order_nsu', g.order_nsu) order by g.pago_em)
      from pagamentos g where g.clinica_id = c.id and g.situacao = 'pago'), '[]'::jsonb),
    left(trim(coalesce(p_motivo, '')), 300), auth.uid();
  delete from clinicas where id = p_clinica;
end $$;
revoke all on function public.excluir_clinica(uuid, text, text) from public, anon;
grant execute on function public.excluir_clinica(uuid, text, text) to authenticated;

-- Painel do MUSUBI: também mostra a assinatura no cartão de cada clínica.
drop function if exists public.painel_dono();
create function public.painel_dono()
returns table (id uuid, nome text, cidade text, uf text, criado_em timestamptz, email_dono text,
  plano text, teste_ate timestamptz, gratis_ate timestamptz, gratis_sempre boolean, gratis_motivo text, pago_ate timestamptz,
  pessoas integer, pessoas_ativas integer, pacientes integer, ultimo_uso timestamptz,
  cartao_situacao text, cartao_periodo text, cartao_valor integer, cartao_proxima timestamptz)
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
    (select d.atualizado_em from dados d where d.clinica_id = c.id),
    coalesce(a.cartao_situacao, ''), coalesce(a.cartao_periodo, ''), a.cartao_valor, a.cartao_proxima
  from clinicas c left join assinaturas a on a.clinica_id = c.id
  order by c.criado_em desc;
end $$;
revoke all on function public.painel_dono() from public, anon;
grant execute on function public.painel_dono() to authenticated;
