-- MUSUBI · pagamentos pela InfinitePay (etapa 10, terceira parte).
-- Como usar: no Supabase, SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Precisa do 001_inicio.sql e do 002_planos.sql antes. Pode rodar este de novo sem estragar nada.
--
-- Cada pedido de pagamento (mensal ou anual) vira uma linha em pagamentos. Quem cria a linha e quem marca
-- como pago é só a função cobranca do servidor (supabase/functions/cobranca), depois de conferir o pagamento
-- na InfinitePay. Ao marcar como pago, a assinatura da clínica ganha 1 mês ou 1 ano a partir do fim do que já
-- estava pago (ou de hoje) e fica com o pacote pago. A clínica e o dono do MUSUBI só leem.

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  plano text not null check (plano in ('essencial', 'profissional', 'clinica')),
  periodo text not null check (periodo in ('mensal', 'anual')),
  valor integer not null check (valor >= 100),            -- em centavos
  order_nsu text not null unique,
  link text not null default '',
  situacao text not null default 'aberto' check (situacao in ('aberto', 'pago')),
  forma text not null default '',                          -- pix ou credit_card
  valor_pago integer,
  recibo text not null default '',
  transacao text not null default '',
  pedido_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);
create index if not exists pagamentos_clinica on public.pagamentos (clinica_id, criado_em desc);
alter table public.pagamentos enable row level security;
drop policy if exists pagamentos_ler on public.pagamentos;
create policy pagamentos_ler on public.pagamentos for select to authenticated using (public.e_membro(clinica_id) or public.e_dono());
revoke insert, update, delete on public.pagamentos from anon, authenticated;

-- Marca o pedido como pago e estende a assinatura. Devolve false se já estava pago (o aviso pode chegar duas vezes).
create or replace function public.registrar_pagamento(p_order_nsu text, p_forma text, p_valor_pago integer, p_recibo text, p_transacao text)
returns boolean language plpgsql security definer set search_path = public as $$
declare p pagamentos;
begin
  select * into p from pagamentos where order_nsu = p_order_nsu for update;
  if not found then raise exception 'pagamento_desconhecido'; end if;
  if p.situacao = 'pago' then return false; end if;
  update pagamentos set situacao = 'pago', pago_em = now(), forma = coalesce(p_forma, ''), valor_pago = p_valor_pago,
    recibo = coalesce(p_recibo, ''), transacao = coalesce(p_transacao, '') where id = p.id;
  insert into assinaturas (clinica_id) values (p.clinica_id) on conflict do nothing;
  update assinaturas set plano = p.plano,
    pago_ate = greatest(coalesce(pago_ate, now()), now()) + case when p.periodo = 'anual' then interval '1 year' else interval '1 month' end,
    atualizado_em = now()
  where clinica_id = p.clinica_id;
  return true;
end $$;

revoke all on function public.registrar_pagamento(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pagamento(text, text, integer, text, text) to service_role;
grant select, insert, update on public.pagamentos to service_role;
