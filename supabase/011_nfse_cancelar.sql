-- MUSUBI · cancelar nota fiscal (NFS-e) pelo próprio MUSUBI (pedido do Maicon em 07/11/2026).
-- O administrador da clínica escolhe o motivo e explica; a função nfse pede o cancelamento à Receita (evento de
-- cancelamento do Padrão Nacional) e, aceito, marca a nota como cancelada com a data e o motivo.
-- Rode no SQL Editor do Supabase depois do 005_nfse.sql. Pode rodar de novo sem problema.

alter table public.nfse_notas add column if not exists cancelada_em timestamptz;
alter table public.nfse_notas add column if not exists cancelamento jsonb;   -- { motivo, descricao, por, evento (XML devolvido) }
