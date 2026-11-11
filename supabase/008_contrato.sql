-- MUSUBI · Contrato de assinatura e anual com pagamento mensal (pedido do Maicon em 11/11/2026).
-- Quem assina lê o Contrato de assinatura (inicio/contrato.html) e marca que concorda. A função cobranca só cria a
-- cobrança com esse aceite e grava aqui QUEM aceitou (login e e-mail), QUANDO (hora do servidor), QUAL versão do
-- contrato e o pacote/período escolhidos. Ninguém altera nem apaga um aceite pelo sistema.
-- Anual com pagamento mensal (anual12): 15% de desconto por 12 meses no cartão; cancelar antes dos 12 meses devolve
-- só o desconto já recebido (cartao_multa, em centavos).
-- Rode no SQL Editor do Supabase depois do 007_mercadopago.sql. Pode rodar de novo sem problema.

create table if not exists public.aceites (
  id bigint generated always as identity primary key,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null default '',
  versao text not null,
  plano text not null default '',
  periodo text not null default '',
  meio text not null default '',
  em timestamptz not null default now()
);
create index if not exists aceites_clinica on public.aceites (clinica_id, em desc);
alter table public.aceites enable row level security;
drop policy if exists aceites_ler on public.aceites;
create policy aceites_ler on public.aceites for select to authenticated using (public.e_admin(clinica_id) or public.e_dono());
revoke insert, update, delete, truncate on public.aceites from anon, authenticated;
grant select, insert on public.aceites to service_role;

alter table public.assinaturas add column if not exists cartao_inicio timestamptz;            -- início da assinatura no cartão atual
alter table public.assinaturas add column if not exists cartao_compromisso_ate timestamptz;   -- fim dos 12 meses do anual com pagamento mensal
alter table public.assinaturas add column if not exists cartao_multa integer not null default 0; -- multa justa ao cancelar antes (centavos)
