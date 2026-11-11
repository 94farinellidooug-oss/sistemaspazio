-- MUSUBI · assinatura no cartão pelo Mercado Pago (pedido do Maicon em 08/11/2026).
-- O cliente cadastra o cartão uma vez no Mercado Pago e a cobrança é feita sozinha a cada mês (ou ano). A
-- InfinitePay continua para quem prefere pagar uma vez, com Pix ou cartão.
-- Como usar: no Supabase, SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Precisa do 002_planos.sql e do 003_pagamentos.sql antes. Pode rodar de novo sem estragar nada.
--
-- Só a função cobranca (supabase/functions/cobranca) grava aqui, depois de conferir no Mercado Pago. Cada
-- cobrança aprovada vira uma linha em pagamentos e estende a assinatura, como no pagamento pela InfinitePay.

alter table public.assinaturas add column if not exists cartao_id text not null default '';            -- id da assinatura no Mercado Pago
alter table public.assinaturas add column if not exists cartao_situacao text not null default '';      -- pendente, ativa, pausada, cancelada
alter table public.assinaturas add column if not exists cartao_plano text not null default '';
alter table public.assinaturas add column if not exists cartao_periodo text not null default '';
alter table public.assinaturas add column if not exists cartao_valor integer;                          -- em centavos
alter table public.assinaturas add column if not exists cartao_email text not null default '';
alter table public.assinaturas add column if not exists cartao_proxima timestamptz;                    -- próxima cobrança
alter table public.assinaturas add column if not exists cartao_aviso_para timestamptz;                 -- cobrança que já foi avisada por e-mail
create index if not exists assinaturas_cartao on public.assinaturas (cartao_id) where cartao_id <> '';

alter table public.pagamentos add column if not exists meio text not null default 'infinitepay';      -- infinitepay ou mercadopago
grant select, insert, update on public.assinaturas to service_role;
