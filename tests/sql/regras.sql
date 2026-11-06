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

-- Pacotes e teste grátis (002_planos.sql)
select pg_temp.checar((select plano from assinaturas where clinica_id = :'c1') = 'profissional' and (select teste_ate from assinaturas where clinica_id = :'c1') between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour', 'clínica nova: Profissional com 7 dias de teste');
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.criar_clinica('Clínica Sol', 'Pelotas', 'RS', 'Outra', '{"v":2}'::jsonb, 'essencial') as c2 \gset
select pg_temp.checar((select plano from assinaturas where clinica_id = :'c2') = 'essencial', 'quem cria escolhe o pacote');
select pg_temp.checar((select count(*) from assinaturas) = 1, 'cada clínica só vê a própria assinatura');
update assinaturas set teste_ate = now() + interval '1 year', gratis_sempre = true;
select pg_temp.checar((select not gratis_sempre and teste_ate < now() + interval '8 days' from assinaturas), 'administrador não muda o próprio teste nem dá acesso grátis a si');
do $$ begin perform public.painel_dono(); raise exception 'FALHA: conta comum abriu o painel';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    conta comum não abre o Painel do MUSUBI'; end $$;
do $$ begin perform public.dar_gratis((select id from clinicas limit 1), null, 'eu'); raise exception 'FALHA: conta comum deu acesso grátis';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    conta comum não dá acesso grátis'; end $$;
do $$ begin perform public.criar_clinica('X', '', '', '', '{}'::jsonb, 'ouro'); raise exception 'FALHA: aceitou pacote inexistente';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    pacote inexistente é recusado'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from public.painel_dono()) = 2 and (select count(*) from clinicas) = 2, 'dono vê todas as clínicas no painel');
select pg_temp.checar((select pessoas_ativas from public.painel_dono() where id = :'c2') = 1 and (select email_dono from public.painel_dono() where id = :'c2') = 'outra@y.com' and (select plano from public.painel_dono() where id = :'c2') = 'essencial', 'painel mostra pessoas, e-mail de quem criou e pacote');
select pg_temp.checar((select count(*) from dados) = 1, 'dono NÃO lê os dados dos pacientes de outras clínicas');
select public.dar_gratis(:'c2', null, 'Teste do Rafael');
select pg_temp.checar((select gratis_sempre and gratis_motivo = 'Teste do Rafael' from public.painel_dono() where id = :'c2'), 'dono dá acesso grátis sem prazo');
select public.dar_gratis(:'c2', now() + interval '30 days', 'Mais um mês');
select pg_temp.checar((select not gratis_sempre and gratis_ate > now() + interval '29 days' from public.painel_dono() where id = :'c2'), 'dono dá acesso grátis com prazo');
select public.dar_gratis(:'c2', null, '', true);
select pg_temp.checar((select not gratis_sempre and gratis_ate is null from public.painel_dono() where id = :'c2'), 'dono tira o acesso grátis');
select public.mudar_plano(:'c2', 'clinica');
select public.estender_teste(:'c2', 7);
select pg_temp.checar((select plano = 'clinica' and teste_ate > now() + interval '13 days' from public.painel_dono() where id = :'c2'), 'dono troca o pacote e dá mais dias de teste');
reset role;
select pg_temp.como(null);
set role anon;
do $$ begin perform public.painel_dono(); raise exception 'anon abriu o painel'; exception when insufficient_privilege then raise notice 'ok    sem login não abre o painel'; end $$;
reset role;
\echo 'Todas as regras do banco passaram.'
