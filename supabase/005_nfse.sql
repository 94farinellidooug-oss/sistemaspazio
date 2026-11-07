-- MUSUBI · nota fiscal de serviço (NFS-e) pelo Padrão Nacional (etapa 10, quinta parte).
-- Como usar: no Supabase, SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Precisa do 001_inicio.sql antes. Pode rodar este de novo sem estragar nada.
--
-- Cada clínica emite com o próprio certificado digital A1. O certificado fica cifrado (a função nfse tranca com o
-- segredo NFSE_SEGREDO, que fica só no Supabase) e ninguém o lê pelo sistema: só a função do servidor. As notas
-- emitidas ficam guardadas com o XML devolvido pela Receita; a equipe da clínica vê as próprias notas.

create table if not exists public.nfse_certificados (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  cifrado text not null,
  iv text not null,
  titular text not null default '',
  documento text not null default '',
  validade timestamptz not null,
  enviado_em timestamptz not null default now(),
  enviado_por uuid references auth.users(id) on delete set null
);
alter table public.nfse_certificados enable row level security;
-- Sem regra de leitura: nem a equipe lê o certificado (só a função, com a chave do servidor).
revoke all on public.nfse_certificados from anon, authenticated;

create table if not exists public.nfse_notas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacao', 'producao')),
  serie text not null,
  ndps bigint not null check (ndps > 0),
  id_dps text not null,
  situacao text not null default 'enviando' check (situacao in ('enviando', 'emitida', 'rejeitada', 'cancelada')),
  chave text,
  numero text,
  valor integer not null check (valor > 0),
  tomador text not null default '',
  referencia text not null default '',
  erros jsonb,
  xml text,
  emitida_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  unique (clinica_id, ambiente, serie, ndps)
);
create index if not exists nfse_notas_clinica on public.nfse_notas (clinica_id, criado_em desc);
alter table public.nfse_notas enable row level security;
drop policy if exists nfse_notas_ler on public.nfse_notas;
create policy nfse_notas_ler on public.nfse_notas for select to authenticated using (public.e_membro(clinica_id));
-- Só a função nfse cria e muda as notas (o número da DPS não pode repetir).
revoke insert, update, delete on public.nfse_notas from anon, authenticated;
