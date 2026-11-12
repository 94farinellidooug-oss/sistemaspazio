-- MUSUBI · Consulta online (teleconsulta por vídeo), pedido do Maicon em 12/11/2026.
-- Cada horário da agenda marcado como online ganha uma linha aqui, com um código secreto (id) que vai no link
-- do paciente. A sala de vídeo (Daily) é criada pela função teleconsulta na primeira entrada e só abre perto
-- do horário. O aceite do termo de teleconsulta pelo paciente fica registrado (quando, IP e navegador).
-- A chamada não é gravada. Só a função (com a chave de serviço) grava; a equipe da clínica só lê.
-- Rode no SQL Editor do Supabase depois do 014_acessos.sql. Pode rodar de novo sem problema.

create table if not exists public.teleconsultas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  consulta_id text not null,
  primeiro text not null default '',
  clinica_nome text not null default '',
  inicio timestamptz not null,
  fim timestamptz not null,
  cancelada boolean not null default false,
  sala text,
  sala_url text,
  sala_em timestamptz,   -- quando a sala foi aberta (conta no limite de consultas online do mês do pacote)
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,   -- quem marcou ou mudou o horário por último
  aceite_em timestamptz,
  aceite_ip text,
  aceite_agente text,
  unique (clinica_id, consulta_id)
);
alter table public.teleconsultas enable row level security;
drop policy if exists teleconsultas_ler on public.teleconsultas;
create policy teleconsultas_ler on public.teleconsultas for select to authenticated using (public.e_membro(clinica_id));
revoke insert, update, delete, truncate on public.teleconsultas from anon, authenticated;
create index if not exists teleconsultas_mes on public.teleconsultas (clinica_id, sala_em);
