-- MUSUBI · Área do paciente (pedido do Maicon em 12/11/2026).
-- Uma página só, aberta por um link secreto (id) que o profissional manda pelo WhatsApp. Para abrir, o paciente
-- confirma a data de nascimento. Mostra só o que a clínica liberou: próximas consultas, orientações para casa,
-- documentos escolhidos, evolução da dor e o resumo da avaliação. A avaliação completa, o pentagrama e as
-- anotações clínicas nunca vão para cá.
-- O sistema da clínica publica o conteúdo já pronto (publicar_area_paciente); o paciente só lê (ver_area_paciente).
-- Desligar o link apaga o conteúdo publicado. Cada abertura fica registrada (quando, IP e navegador) por 6 meses.
-- Rode no SQL Editor do Supabase depois do 016_teleconsulta.sql. Pode rodar de novo sem problema.

create table if not exists public.areas_paciente (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id text not null,
  nascimento date,
  conteudo jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  tentativas int not null default 0,      -- datas de nascimento erradas seguidas
  bloqueado_ate timestamptz,              -- muitas tentativas erradas: espera antes de tentar de novo
  unique (clinica_id, paciente_id)
);
alter table public.areas_paciente enable row level security;
drop policy if exists areas_paciente_ler on public.areas_paciente;
create policy areas_paciente_ler on public.areas_paciente for select to authenticated using (public.e_membro(clinica_id));
revoke insert, update, delete, truncate on public.areas_paciente from anon, authenticated;

create table if not exists public.areas_paciente_acessos (
  id bigint generated always as identity primary key,
  area_id uuid not null references public.areas_paciente(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  em timestamptz not null default now(),
  ip text not null default '',
  agente text not null default ''
);
alter table public.areas_paciente_acessos enable row level security;
drop policy if exists areas_paciente_acessos_ler on public.areas_paciente_acessos;
create policy areas_paciente_acessos_ler on public.areas_paciente_acessos for select to authenticated using (public.e_membro(clinica_id));
revoke insert, update, delete, truncate on public.areas_paciente_acessos from anon, authenticated;
create index if not exists areas_paciente_acessos_area on public.areas_paciente_acessos (area_id, em desc);

-- Quem é da clínica publica (cria o link na 1ª vez) ou desliga. Devolve o id do link.
create or replace function public.publicar_area_paciente(p_clinica uuid, p_paciente text, p_nascimento date, p_conteudo jsonb, p_ativo boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.e_membro(p_clinica) then raise exception 'sem_acesso'; end if;
  if coalesce(trim(p_paciente), '') = '' then raise exception 'paciente_invalido'; end if;
  if p_ativo and pg_column_size(p_conteudo) > 400000 then raise exception 'conteudo_grande'; end if;
  insert into areas_paciente as a (clinica_id, paciente_id, nascimento, conteudo, ativo, atualizado_por)
  values (p_clinica, p_paciente, p_nascimento, case when p_ativo then coalesce(p_conteudo, '{}'::jsonb) else '{}'::jsonb end, p_ativo, auth.uid())
  on conflict (clinica_id, paciente_id) do update
    set nascimento = excluded.nascimento, conteudo = excluded.conteudo, ativo = excluded.ativo,
        atualizado_em = now(), atualizado_por = auth.uid(), tentativas = case when excluded.ativo then a.tentativas else 0 end
  returning a.id into v_id;
  return v_id;
end $$;
revoke all on function public.publicar_area_paciente(uuid, text, date, jsonb, boolean) from public, anon;
grant execute on function public.publicar_area_paciente(uuid, text, date, jsonb, boolean) to authenticated;

-- Página do paciente (sem login). Sem a data: só diz se o link existe. Com a data certa: devolve o conteúdo e
-- registra o acesso. 5 erros seguidos bloqueiam por 15 minutos; 10, por 24 horas.
create or replace function public.ver_area_paciente(p_id uuid, p_nascimento date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a areas_paciente; h jsonb; v_t int;
begin
  select * into a from areas_paciente where id = p_id;
  if not found or not a.ativo then return jsonb_build_object('erro', 'nao_encontrada'); end if;
  if a.bloqueado_ate is not null and a.bloqueado_ate > now() then
    return jsonb_build_object('erro', 'bloqueado', 'ate', a.bloqueado_ate);
  end if;
  if p_nascimento is null then return jsonb_build_object('ok', true, 'pedir', 'nascimento'); end if;
  if a.nascimento is null or a.nascimento <> p_nascimento then
    v_t := a.tentativas + 1;
    update areas_paciente set tentativas = v_t,
      bloqueado_ate = case when v_t >= 10 then now() + interval '24 hours' when v_t >= 5 then now() + interval '15 minutes' else null end
      where id = a.id;
    return jsonb_build_object('erro', case when v_t >= 5 then 'bloqueado' else 'data' end, 'restam', greatest(0, 5 - v_t));
  end if;
  update areas_paciente set tentativas = 0, bloqueado_ate = null where id = a.id;
  h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  delete from areas_paciente_acessos where em < now() - interval '6 months' - interval '7 days';
  insert into areas_paciente_acessos (area_id, clinica_id, ip, agente) values (a.id, a.clinica_id,
    left(trim(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), ''), h->>'x-real-ip', '')), 64),
    left(coalesce(h->>'user-agent', ''), 300));
  return jsonb_build_object('ok', true, 'conteudo', a.conteudo, 'atualizado_em', a.atualizado_em);
end $$;
revoke all on function public.ver_area_paciente(uuid, date) from public;
grant execute on function public.ver_area_paciente(uuid, date) to anon, authenticated;
