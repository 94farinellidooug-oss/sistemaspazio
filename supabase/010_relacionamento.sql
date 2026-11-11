-- MUSUBI · Painel do MUSUBI para vender melhor (pedido do Maicon em 08/11/2026): números de gestão, tarefas do dia
-- e relacionamento com interessados, clínicas em teste e ex-clientes (anotações e data para retornar o contato).
-- Só o dono do MUSUBI lê e grava. Nenhum dado de paciente entra aqui.
-- Rode no SQL Editor do Supabase depois do 009_excluir_clinica.sql. Pode rodar de novo sem problema.

-- Acompanhamento de cada contato. ref = 'i:<id do interessado>', 'c:<id da clínica>' ou 'x:<id da excluída>'.
create table if not exists public.relacionamento_musubi (
  ref text primary key check (ref ~ '^[icx]:[0-9a-zA-Z-]{1,40}$'),
  notas jsonb not null default '[]'::jsonb,          -- [{em, texto}] (no máximo 200, a mais nova primeiro)
  retornar_em date,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
alter table public.relacionamento_musubi enable row level security;
drop policy if exists relacionamento_musubi_dono on public.relacionamento_musubi;
create policy relacionamento_musubi_dono on public.relacionamento_musubi for all to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, insert, update, delete on public.relacionamento_musubi to authenticated;

-- Painel do MUSUBI: também o WhatsApp da clínica (Configurações > Clínica), para o contato.
drop function if exists public.painel_dono();
create function public.painel_dono()
returns table (id uuid, nome text, cidade text, uf text, criado_em timestamptz, email_dono text,
  plano text, teste_ate timestamptz, gratis_ate timestamptz, gratis_sempre boolean, gratis_motivo text, pago_ate timestamptz,
  pessoas integer, pessoas_ativas integer, pacientes integer, ultimo_uso timestamptz,
  cartao_situacao text, cartao_periodo text, cartao_valor integer, cartao_proxima timestamptz, whats text)
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
    coalesce(a.cartao_situacao, ''), coalesce(a.cartao_periodo, ''), a.cartao_valor, a.cartao_proxima, c.whats
  from clinicas c left join assinaturas a on a.clinica_id = c.id
  order by c.criado_em desc;
end $$;
revoke all on function public.painel_dono() from public, anon;
grant execute on function public.painel_dono() to authenticated;
