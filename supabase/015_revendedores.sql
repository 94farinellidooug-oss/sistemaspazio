-- MUSUBI · revendedores com link próprio e comissão (pedido do Maicon em 12/11/2026).
-- Cada revendedor tem um código e um link (musubisistema.com.br/inicio/?r=codigo). A página conta as visitas do link,
-- a clínica criada por quem veio pelo link fica marcada com o revendedor e, quando ela paga, a comissão é calculada
-- sozinha. Regras combinadas: mensal = 20% das 3 primeiras mensalidades pagas; anual (com pagamento mensal ou à
-- vista) = 50% de uma mensalidade cheia, uma vez; a comissão fica liberada 7 dias depois do pagamento (prazo de
-- arrependimento). As regras ficam na tabela revenda_regras e o dono muda pelo Painel do MUSUBI.
-- Só o dono do MUSUBI lê e muda. Nenhum dado de paciente entra aqui.
-- Rode no SQL Editor do Supabase depois do 014_acessos.sql. Pode rodar de novo sem problema.

create table if not exists public.revendedores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  nome text not null check (length(trim(nome)) between 1 and 120),
  whats text not null default '',
  pix text not null default '',
  obs text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.revendedores enable row level security;
drop policy if exists revendedores_dono on public.revendedores;
create policy revendedores_dono on public.revendedores for all to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, insert, update on public.revendedores to authenticated;

-- Regras da comissão (uma linha só).
create table if not exists public.revenda_regras (
  id integer primary key default 1 check (id = 1),
  pct_mensal numeric not null default 20 check (pct_mensal between 0 and 100),         -- % de cada mensalidade
  meses_mensal integer not null default 3 check (meses_mensal between 1 and 24),      -- quantas mensalidades
  pct_anual numeric not null default 50 check (pct_anual between 0 and 300),          -- % de UMA mensalidade cheia, no anual
  dias_liberar integer not null default 7 check (dias_liberar between 0 and 90),      -- espera depois do pagamento
  atualizado_em timestamptz not null default now()
);
insert into public.revenda_regras (id) values (1) on conflict do nothing;
alter table public.revenda_regras enable row level security;
drop policy if exists revenda_regras_dono on public.revenda_regras;
create policy revenda_regras_dono on public.revenda_regras for all to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, update on public.revenda_regras to authenticated;

-- Visitas pelo link, por dia.
create table if not exists public.revenda_visitas (
  codigo text not null,
  dia date not null,
  visitas integer not null default 0,
  primary key (codigo, dia)
);
alter table public.revenda_visitas enable row level security;
drop policy if exists revenda_visitas_dono on public.revenda_visitas;
create policy revenda_visitas_dono on public.revenda_visitas for select to authenticated using (public.e_dono());
grant select on public.revenda_visitas to authenticated;

-- Qual revendedor trouxe cada clínica.
create table if not exists public.revenda_clinicas (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  revendedor_id uuid not null references public.revendedores(id) on delete restrict,
  em timestamptz not null default now()
);
alter table public.revenda_clinicas enable row level security;
drop policy if exists revenda_clinicas_dono on public.revenda_clinicas;
create policy revenda_clinicas_dono on public.revenda_clinicas for all to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, insert, update, delete on public.revenda_clinicas to authenticated;

-- Comissões: uma linha por pagamento que gera comissão. Fica mesmo se a clínica for excluída depois.
create table if not exists public.revenda_comissoes (
  id uuid primary key default gen_random_uuid(),
  revendedor_id uuid not null references public.revendedores(id) on delete restrict,
  clinica_id uuid not null,
  clinica_nome text not null default '',
  pagamento_id uuid not null unique,
  plano text not null default '',
  forma text not null check (forma in ('mensal', 'anual12', 'anual')),
  valor_base integer not null,            -- centavos: a mensalidade paga (mensal) ou a mensalidade cheia (anual)
  comissao integer not null,              -- centavos
  pago_cliente_em timestamptz not null,
  libera_em timestamptz not null,
  paga_em timestamptz,
  paga_obs text not null default '',
  cancelada_em timestamptz,
  cancelada_motivo text not null default '',
  criado_em timestamptz not null default now()
);
create index if not exists revenda_comissoes_rev on public.revenda_comissoes (revendedor_id, pago_cliente_em desc);
alter table public.revenda_comissoes enable row level security;
drop policy if exists revenda_comissoes_ler on public.revenda_comissoes;
create policy revenda_comissoes_ler on public.revenda_comissoes for select to authenticated using (public.e_dono());
drop policy if exists revenda_comissoes_mudar on public.revenda_comissoes;
create policy revenda_comissoes_mudar on public.revenda_comissoes for update to authenticated using (public.e_dono()) with check (public.e_dono());
grant select, update on public.revenda_comissoes to authenticated;
-- O dono só marca como paga ou cancela: o valor calculado e a origem não mudam à mão.
create or replace function public.revenda_comissao_travada()
returns trigger language plpgsql as $$
begin
  if (new.revendedor_id, new.clinica_id, new.pagamento_id, new.plano, new.forma, new.valor_base, new.comissao, new.pago_cliente_em, new.libera_em)
     is distinct from (old.revendedor_id, old.clinica_id, old.pagamento_id, old.plano, old.forma, old.valor_base, old.comissao, old.pago_cliente_em, old.libera_em)
  then raise exception 'comissao_travada' using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists revenda_comissao_travada on public.revenda_comissoes;
create trigger revenda_comissao_travada before update on public.revenda_comissoes for each row execute function public.revenda_comissao_travada();

-- A página de apresentação conta a visita (sem login). Código desconhecido ou revendedor parado: não conta.
create or replace function public.registrar_visita_revenda(p_codigo text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := lower(trim(coalesce(p_codigo, '')));
begin
  if not exists (select 1 from revendedores where codigo = k and ativo) then return; end if;
  insert into revenda_visitas (codigo, dia, visitas) values (k, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (codigo, dia) do update set visitas = revenda_visitas.visitas + 1;
end $$;

-- Logo depois de criar a clínica, o administrador marca o revendedor do link (só nos 3 primeiros dias, uma vez).
create or replace function public.marcar_revendedor(p_clinica uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if auth.uid() is null or not public.e_admin(p_clinica) then return false; end if;
  if not exists (select 1 from clinicas where id = p_clinica and criado_em > now() - interval '3 days') then return false; end if;
  select id into r from revendedores where codigo = lower(trim(coalesce(p_codigo, ''))) and ativo;
  if r is null then return false; end if;
  insert into revenda_clinicas (clinica_id, revendedor_id) values (p_clinica, r) on conflict do nothing;
  return found;
end $$;

-- Quando um pagamento é confirmado, calcula a comissão do revendedor (se a clínica veio por um link).
-- Não conta o pagamento de teste de R$ 1,00.
create or replace function public.revenda_comissao_do_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare rc revenda_clinicas; g revenda_regras; f text; cheia integer; base integer; ja integer; ja_anual boolean; quando timestamptz;
begin
  if new.situacao <> 'pago' or coalesce(new.valor, 0) <= 100 then return new; end if;
  if tg_op = 'UPDATE' and old.situacao = 'pago' then return new; end if;
  select * into rc from revenda_clinicas where clinica_id = new.clinica_id;
  if not found then return new; end if;
  select * into g from revenda_regras where id = 1;
  if not found then g := row(1, 20, 3, 50, 7, now())::revenda_regras; end if;
  f := case when new.periodo = 'anual' then 'anual'
            when new.meio = 'mercadopago' and exists (select 1 from assinaturas a where a.clinica_id = new.clinica_id and a.cartao_periodo = 'anual12') then 'anual12'
            else 'mensal' end;
  cheia := case new.plano when 'essencial' then 7900 when 'clinica' then 29900 else 14900 end;
  select count(*), coalesce(bool_or(forma <> 'mensal'), false) into ja, ja_anual from revenda_comissoes where clinica_id = new.clinica_id and cancelada_em is null;
  if ja_anual then return new; end if;
  if f = 'mensal' then
    if ja >= g.meses_mensal then return new; end if;
    base := new.valor;
  else
    if ja > 0 then return new; end if;
    base := cheia;
  end if;
  quando := coalesce(new.pago_em, now());
  insert into revenda_comissoes (revendedor_id, clinica_id, clinica_nome, pagamento_id, plano, forma, valor_base, comissao, pago_cliente_em, libera_em)
  values (rc.revendedor_id, new.clinica_id, coalesce((select nome from clinicas where id = new.clinica_id), ''), new.id, new.plano, f, base,
    round(base * (case when f = 'mensal' then g.pct_mensal else g.pct_anual end) / 100.0)::integer, quando, quando + make_interval(days => g.dias_liberar))
  on conflict (pagamento_id) do nothing;
  return new;
end $$;
drop trigger if exists revenda_comissao on public.pagamentos;
create trigger revenda_comissao after insert or update of situacao on public.pagamentos
  for each row execute function public.revenda_comissao_do_pagamento();

revoke all on function public.registrar_visita_revenda(text) from public;
revoke all on function public.marcar_revendedor(uuid, text) from public, anon;
revoke all on function public.revenda_comissao_do_pagamento() from public, anon, authenticated;
grant execute on function public.registrar_visita_revenda(text) to anon, authenticated;
grant execute on function public.marcar_revendedor(uuid, text) to authenticated;
