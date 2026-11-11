-- MUSUBI · Identificação de quem vende o MUSUBI (Decreto 7.962/2013, art. 2º) no Contrato de assinatura.
-- Os dados (nome, CPF ou CNPJ e endereço) ficam só aqui no servidor, nunca no código (o repositório é público).
-- Quem está logado lê (aparece no contrato da tela de assinatura); só o dono do MUSUBI grava.
-- Rodar uma vez no SQL Editor do Supabase, depois do 001_inicio.sql. Pode rodar de novo sem problema.

create table if not exists public.musubi_fornecedor (
  id int primary key default 1 check (id = 1),
  nome text not null default '' check (length(nome) <= 160),
  documento text not null default '' check (length(documento) <= 30),
  endereco text not null default '' check (length(endereco) <= 300),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table public.musubi_fornecedor enable row level security;
drop policy if exists fornecedor_ler on public.musubi_fornecedor;
create policy fornecedor_ler on public.musubi_fornecedor for select to authenticated using (true);
drop policy if exists fornecedor_gravar on public.musubi_fornecedor;
create policy fornecedor_gravar on public.musubi_fornecedor for insert to authenticated with check (public.e_dono());
drop policy if exists fornecedor_mudar on public.musubi_fornecedor;
create policy fornecedor_mudar on public.musubi_fornecedor for update to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, insert, update on public.musubi_fornecedor to authenticated;
