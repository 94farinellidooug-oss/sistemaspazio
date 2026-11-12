-- MUSUBI · Registro de acesso (Marco Civil da Internet, Lei 12.965/2014, art. 15) e aviso de renovação do anual.
-- A cada entrada no sistema guarda QUEM (o login), DE ONDE (o endereço de internet, IP) e QUANDO (a hora do servidor).
-- Guarda por 6 meses, como a lei pede, e depois apaga sozinho. Fica em sigilo: só o dono do MUSUBI lê
-- (para atender uma ordem judicial ou investigar um acesso indevido); ninguém altera nem apaga pelo sistema.
-- Rode no SQL Editor do Supabase depois do 013_fornecedor.sql. Pode rodar de novo sem problema.

create table if not exists public.acessos (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null default '',
  ip text not null default '',
  agente text not null default '',
  evento text not null default 'entrou'
);
create index if not exists acessos_em on public.acessos (em);
create index if not exists acessos_user on public.acessos (user_id, em desc);
alter table public.acessos enable row level security;
drop policy if exists acessos_ler on public.acessos;
create policy acessos_ler on public.acessos for select to authenticated using (public.e_dono());
revoke insert, update, delete, truncate on public.acessos from anon, authenticated;

-- Chamado pelo sistema ao entrar (e ao reabrir com o login guardado). O IP vem do cabeçalho da requisição,
-- não do navegador, para não poder ser inventado. Repetições do mesmo aparelho em 30 minutos não duplicam.
create or replace function public.registrar_acesso(p_evento text default 'entrou')
returns boolean language plpgsql security definer set search_path = public as $$
declare h jsonb; v_ip text; v_ag text; v_ev text; v_email text;
begin
  if auth.uid() is null then return false; end if;
  h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip := left(trim(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), ''), h->>'x-real-ip', '')), 64);
  v_ag := left(coalesce(h->>'user-agent', ''), 300);
  v_ev := case when p_evento in ('entrou', 'voltou') then p_evento else 'entrou' end;
  delete from acessos where em < now() - interval '6 months' - interval '7 days';
  if exists (select 1 from acessos where user_id = auth.uid() and ip = v_ip and agente = v_ag and em > now() - interval '30 minutes') then return false; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into acessos (user_id, email, ip, agente, evento) values (auth.uid(), coalesce(v_email, ''), v_ip, v_ag, v_ev);
  return true;
end $$;
revoke all on function public.registrar_acesso(text) from public, anon;
grant execute on function public.registrar_acesso(text) to authenticated;

-- Aviso por e-mail 30 dias antes do fim de cada ciclo do anual com pagamento mensal (função cobranca).
alter table public.assinaturas add column if not exists cartao_renov_aviso_para timestamptz;
