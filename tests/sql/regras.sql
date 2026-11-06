-- Verifica as regras de acesso de supabase/001_inicio.sql. Para no primeiro erro (ON_ERROR_STOP).
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'maicon@x.com'), ('00000000-0000-0000-0000-00000000000b', 'outra@y.com');

create or replace function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  perform set_config('request.jwt.claims', case when u is null then '{}' else json_build_object('sub', u, 'email', (select email from auth.users where id = u::uuid))::text end, false);
end $$;
create or replace function pg_temp.checar(cond boolean, msg text) returns void language plpgsql as $$ begin
  if not cond then raise exception 'FALHA: %', msg; end if; raise notice 'ok    %', msg; end $$;

-- Maicon cria a clínica levando os dados
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.criar_clinica('Spazio Stabilità', 'Caxias do Sul', 'RS', 'Maicon Farinelli', '{"v":2,"patients":[]}'::jsonb) as c1 \gset
select pg_temp.checar((select perfil from membros where clinica_id = :'c1') = 'adm', 'quem cria a clínica vira administrador');
select pg_temp.checar((select versao from dados where clinica_id = :'c1') = 1, 'dados do aparelho entram na versão 1');
select pg_temp.checar(public.salvar_dados(:'c1', '{"v":2,"patients":[1]}', 1) = 2, 'salvar com a versão certa avança para 2');
select pg_temp.checar(public.salvar_dados(:'c1', '{"v":2,"patients":[9]}', 1) = -1, 'salvar com versão antiga não grava (outro aparelho salvou antes)');
select pg_temp.checar((select doc->'patients' from dados where clinica_id = :'c1') = '[1]', 'o documento ficou com o que foi salvo primeiro');
reset role;

-- Outra pessoa não enxerga nem grava a clínica do Maicon
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from clinicas) = 0 and (select count(*) from dados) = 0 and (select count(*) from membros) = 0, 'outra conta não vê clínica, dados nem equipe alheios');
select set_config('teste.c1', :'c1', false) \g /dev/null
do $$ begin perform public.salvar_dados(current_setting('teste.c1')::uuid, '{}', 2); raise exception 'FALHA: outra conta salvou';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    outra conta recebe "sem acesso" ao tentar salvar'; end $$;
reset role;
select pg_temp.checar((select versao from dados) = 2, 'outra conta não consegue salvar na clínica alheia');
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
update clinicas set nome = 'invadida';
reset role;
select pg_temp.checar((select nome from clinicas) = 'Spazio Stabilità', 'outra conta não renomeia a clínica alheia');

-- Página de apresentação: qualquer um pede para conhecer, ninguém de fora lê a lista
select pg_temp.como(null);
set role anon;
insert into interessados (nome, whats) values ('Carla Mendes', '(51) 98888-1234');
select pg_temp.checar((select count(*) from interessados) = 0, 'visitante envia o pedido mas não lê a lista');
do $$ begin insert into interessados (nome, whats) values ('X', '123'); raise exception 'aceitou WhatsApp curto'; exception when check_violation then raise notice 'ok    WhatsApp incompleto é recusado'; end $$;
do $$ begin insert into interessados (nome, whats, situacao) values ('Y', '54999990000', 'cliente'); raise exception 'aceitou situação'; exception when insufficient_privilege or check_violation then raise notice 'ok    visitante não escolhe a situação'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from interessados) = 0, 'conta comum não lê os interessados');
reset role;
insert into donos values ('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from interessados) = 1, 'dono do MUSUBI lê os interessados');
update interessados set situacao = 'chamei';
select pg_temp.checar((select situacao from interessados) = 'chamei', 'dono muda a situação');
reset role;
select pg_temp.como(null);
set role anon;
do $$ begin perform public.criar_clinica('a','b','c','d','{}'); raise exception 'anon criou clínica'; exception when insufficient_privilege then raise notice 'ok    sem login não cria clínica'; end $$;
reset role;
\echo 'Todas as regras do banco passaram.'
