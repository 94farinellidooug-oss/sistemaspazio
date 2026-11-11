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
-- Pagamentos (003_pagamentos.sql): só a função do servidor cria e marca como pago
set role service_role;
insert into pagamentos (clinica_id, plano, periodo, valor, order_nsu) values (:'c2', 'profissional', 'mensal', 14900, 'musubi-t1'), (:'c2', 'essencial', 'anual', 79000, 'musubi-t2');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from pagamentos) = 2, 'a clínica vê os próprios pagamentos');
update pagamentos set situacao = 'pago';
select pg_temp.checar((select count(*) from pagamentos where situacao = 'pago') = 0, 'a clínica não marca o próprio pagamento como pago');
do $$ begin insert into pagamentos (clinica_id, plano, periodo, valor, order_nsu) values ((select id from clinicas limit 1), 'essencial', 'mensal', 7900, 'falso'); raise exception 'FALHA: clínica criou pagamento';
exception when insufficient_privilege then raise notice 'ok    a clínica não cria pagamento por conta própria'; end $$;
do $$ begin perform public.registrar_pagamento('musubi-t1', 'pix', 14900, '', ''); raise exception 'FALHA: clínica registrou pagamento';
exception when insufficient_privilege then raise notice 'ok    a clínica não chama o registro de pagamento'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from pagamentos where clinica_id = :'c2') = 2 and (select count(*) from pagamentos where clinica_id = :'c1') = 0, 'o dono vê os pagamentos de todas as clínicas');
reset role;
select pg_temp.como(null);
set role service_role;
update assinaturas set pago_ate = null where clinica_id = :'c2';
select pg_temp.checar(public.registrar_pagamento('musubi-t1', 'pix', 14900, 'https://recibo/1', 'tx1'), 'pagamento confirmado é registrado');
select pg_temp.checar((select plano = 'profissional' and pago_ate between now() + interval '27 days' and now() + interval '32 days' from assinaturas where clinica_id = :'c2'), 'mensal pago: pacote pago e acesso por 1 mês');
select pg_temp.checar(not public.registrar_pagamento('musubi-t1', 'pix', 14900, '', ''), 'o mesmo aviso duas vezes não dá mais um mês');
select pg_temp.checar(public.registrar_pagamento('musubi-t2', 'credit_card', 79000, '', 'tx2'), 'anual registrado');
select pg_temp.checar((select plano = 'essencial' and pago_ate > now() + interval '1 year 27 days' from assinaturas where clinica_id = :'c2'), 'anual soma 1 ano depois do que já estava pago');
select pg_temp.checar((select situacao = 'pago' and forma = 'credit_card' and pago_em is not null from pagamentos where order_nsu = 'musubi-t2'), 'pagamento guarda forma e data');
do $$ begin perform public.registrar_pagamento('nao-existe', 'pix', 100, '', ''); raise exception 'FALHA: aceitou pedido inexistente';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    pedido desconhecido é recusado'; end $$;
reset role;

-- Equipe (004_equipe.sql): convite pelo e-mail, limite por pacote, perfil e acesso
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'ana@z.com'), ('00000000-0000-0000-0000-00000000000d', 'julia@z.com'), ('00000000-0000-0000-0000-00000000000e', 'rita@z.com');
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000000f', 'semconfirmar@z.com', null);
update assinaturas set plano = 'profissional' where clinica_id = :'c1';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select set_config('teste.c1', :'c1', false) \g /dev/null
do $$ begin perform public.convidar(current_setting('teste.c1')::uuid, 'Ana', 'ana@z.com', 'prof'); raise exception 'FALHA: Profissional aceitou 2º profissional';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    Profissional: não cabe outro profissional (%)', sqlerrm; end $$;
select public.convidar(:'c1', 'Júlia', ' Julia@Z.com ', 'rec') is not null and public.convidar(:'c1', 'Rita', 'rita@z.com', 'rec') is not null as dois \gset
select pg_temp.checar(:'dois' and (select count(*) from convites where clinica_id = :'c1') = 2, 'administrador convida duas pessoas da recepção');
do $$ begin perform public.convidar(current_setting('teste.c1')::uuid, 'Sem', 'semconfirmar@z.com', 'rec'); raise exception 'FALHA: 3ª recepção';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    Profissional: no máximo 2 na recepção'; end $$;
do $$ begin perform public.convidar(current_setting('teste.c1')::uuid, 'Júlia', 'julia@z.com', 'rec'); raise exception 'FALHA: convite repetido';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    o mesmo e-mail não é convidado duas vezes'; end $$;
reset role;
-- Clínica: sem limite
update assinaturas set plano = 'clinica' where clinica_id = :'c1';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar(public.convidar(:'c1', 'Ana', 'ana@z.com', 'prof') is not null and public.convidar(:'c1', 'Sem', 'semconfirmar@z.com', 'rec') is not null, 'pacote Clínica: vários profissionais e recepção sem limite');
reset role;
-- Outra conta não convida para a clínica do Maicon nem vê os convites
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from convites) = 0, 'outra clínica não vê os convites');
do $$ begin perform public.convidar(current_setting('teste.c1')::uuid, 'X', 'x@z.com', 'prof'); raise exception 'FALHA: outra conta convidou';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    só o administrador da clínica convida'; end $$;
reset role;
-- Quem foi convidado entra e passa a fazer parte (só com o e-mail confirmado)
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select public.aceitar_convites() as aceitos \gset
select pg_temp.checar(:aceitos = 1 and public.e_membro(:'c1') and not public.e_admin(:'c1'), 'convidada entra e faz parte da clínica como recepção');
select pg_temp.checar((select perfil from membros where clinica_id = :'c1' and user_id = auth.uid()) = 'rec' and public.aceitar_convites() = 0, 'perfil do convite e nada a aceitar de novo');
do $$ begin perform public.convidar(current_setting('teste.c1')::uuid, 'X', 'x@z.com', 'rec'); raise exception 'FALHA: recepção convidou';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    recepção não convida ninguém'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000f');
set role authenticated;
select pg_temp.checar(public.aceitar_convites() = 0 and not public.e_membro(:'c1'), 'e-mail não confirmado não aceita o convite');
reset role;
-- Administrador muda perfil e tira/devolve acesso; com o pacote Profissional, o limite volta a valer
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.aceitar_convites() \g /dev/null
reset role;
update assinaturas set plano = 'profissional' where clinica_id = :'c1';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.mudar_membro(:'c1', '00000000-0000-0000-0000-00000000000c', 'prof', false) \g /dev/null
select pg_temp.checar(not (select ativo from membros where clinica_id = :'c1' and user_id = '00000000-0000-0000-0000-00000000000c'), 'tirar o acesso desliga sem apagar');
do $$ begin perform public.mudar_membro(current_setting('teste.c1')::uuid, '00000000-0000-0000-0000-00000000000c', 'prof', true); raise exception 'FALHA: devolveu acima do limite';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    devolver o acesso respeita o limite do pacote'; end $$;
do $$ begin perform public.mudar_membro(current_setting('teste.c1')::uuid, auth.uid(), 'rec', true); raise exception 'FALHA: mudou a si mesmo';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    administrador não muda o próprio perfil'; end $$;
select public.cancelar_convite(id) from convites where clinica_id = :'c1' and aceito_em is null \g /dev/null
select pg_temp.checar((select count(*) from convites where clinica_id = :'c1' and aceito_em is null) = 0, 'administrador cancela convites em aberto');
reset role;
-- Nota fiscal (005_nfse.sql): o certificado ninguém lê pelo sistema; as notas só a função cria
set role service_role;
insert into nfse_certificados (clinica_id, cifrado, iv, titular, documento, validade) values (:'c1', 'xxx', 'yyy', 'SPAZIO', '11222333000181', now() + interval '1 year');
insert into nfse_notas (clinica_id, ambiente, serie, ndps, id_dps, valor, situacao) values (:'c1', 'homologacao', '1', 1, 'DPS1', 15000, 'emitida');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from nfse_certificados) = 0, 'nem o administrador lê o certificado guardado');
select pg_temp.checar((select count(*) from nfse_notas) = 1, 'a equipe vê as notas da clínica');
update nfse_notas set situacao = 'cancelada';
select pg_temp.checar((select situacao from nfse_notas) = 'emitida', 'a equipe não muda a nota por fora da função');
do $$ begin insert into nfse_notas (clinica_id, ambiente, serie, ndps, id_dps, valor) values (current_setting('teste.c1')::uuid, 'homologacao', '1', 2, 'DPS2', 100); raise exception 'FALHA: criou nota';
exception when insufficient_privilege then raise notice 'ok    a equipe não cria nota por fora da função'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from nfse_notas) = 0, 'outra clínica não vê as notas');
reset role;
set role service_role;
do $$ begin insert into nfse_notas (clinica_id, ambiente, serie, ndps, id_dps, valor) values (current_setting('teste.c1')::uuid, 'homologacao', '1', 1, 'DPS1b', 100); raise exception 'FALHA: repetiu o número';
exception when unique_violation then raise notice 'ok    o número da DPS não repete na mesma série e ambiente'; end $$;
reset role;
-- Histórico de alterações (006_historico.sql): salvar grava quem e quando; ninguém mexe no histórico; só o administrador lê
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select versao as v0 from dados where clinica_id = :'c1' \gset
select pg_temp.checar(public.salvar_dados(:'c1', '{"v":2,"patients":[2]}', :v0, '[{"tipo":"paciente","acao":"alterou","alvo":"p1","paciente_id":"p1","titulo":"Ana","campos":["phone"]},{"tipo":"","acao":"x"}]') = :v0 + 1, 'salvar com o histórico avança a versão');
select pg_temp.checar((select count(*) from historico where clinica_id = :'c1' and tipo <> 'dados') = 1, 'grava só os eventos válidos');
select pg_temp.checar((select email = 'maicon@x.com' and pessoa = 'Maicon Farinelli' and user_id = auth.uid() and campos = '{phone}' and em > now() - interval '1 minute' from historico where clinica_id = :'c1' and tipo = 'paciente'), 'o evento leva o login, o nome, a hora do servidor e os campos');
select pg_temp.checar(public.salvar_dados(:'c1', '{"v":2,"patients":[3]}', :v0, '[{"tipo":"paciente","acao":"apagou"}]') = -1 and (select count(*) from historico where clinica_id = :'c1' and tipo <> 'dados') = 1, 'salvamento recusado (versão antiga) não grava histórico');
select count(*) as d0 from historico where clinica_id = :'c1' and tipo = 'dados' \gset
select pg_temp.checar(public.salvar_dados(:'c1', '{"v":2,"patients":[3]}', :v0 + 1) = :v0 + 2, 'o salvamento antigo continua funcionando');
select pg_temp.checar((select count(*) from historico where clinica_id = :'c1' and tipo = 'dados') = :d0 + 1, 'o salvamento antigo, sem detalhes, também registra quem e quando');
select count(*) as h0 from historico where clinica_id = :'c1' \gset
update historico set titulo = 'mudado';
delete from historico;
select pg_temp.checar((select count(*) from historico where clinica_id = :'c1' and titulo <> 'mudado') = :h0 and :h0 > 0, 'nem o administrador altera ou apaga o histórico');
do $$ begin insert into historico (clinica_id, tipo, acao) values (current_setting('teste.c1')::uuid, 'paciente', 'criou'); raise exception 'FALHA: inseriu no histórico';
exception when insufficient_privilege then raise notice 'ok    ninguém escreve no histórico por fora do salvamento'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.checar(public.e_membro(:'c1') and (select count(*) from historico) = 0, 'a recepção não lê o histórico');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from historico) = 0, 'outra clínica não vê o histórico');
reset role;
-- Assinatura no cartão (007_mercadopago.sql): só a função cobranca grava; a clínica só lê
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update assinaturas set cartao_situacao = 'ativa', cartao_id = 'falso', pago_ate = now() + interval '10 years' where clinica_id = :'c1';
reset role;
select pg_temp.checar((select cartao_situacao = '' and cartao_id = '' from assinaturas where clinica_id = :'c1'), 'a clínica não muda a assinatura no cartão nem o prazo pago por fora da função');
select pg_temp.checar((select count(*) from information_schema.columns where table_name = 'pagamentos' and column_name = 'meio') = 1, 'pagamentos guardam o meio (InfinitePay ou Mercado Pago)');
-- Contrato (008_contrato.sql): só a função cobranca grava o aceite; o administrador lê; ninguém altera
set role service_role;
insert into aceites (clinica_id, user_id, email, versao, plano, periodo, meio) values (:'c1', '00000000-0000-0000-0000-00000000000a', 'maicon@x.com', '2026-11-11', 'profissional', 'anual12', 'mercadopago');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select count(*) from aceites where versao = '2026-11-11' and em > now() - interval '1 minute') = 1, 'o administrador vê o aceite do contrato, com a versão e a hora');
update aceites set versao = 'mudado';
delete from aceites;
select pg_temp.checar((select count(*) from aceites where versao = '2026-11-11') = 1, 'ninguém altera nem apaga o aceite');
do $$ begin insert into aceites (clinica_id, versao) values (current_setting('teste.c1')::uuid, 'falso'); raise exception 'FALHA: inseriu aceite';
exception when insufficient_privilege then raise notice 'ok    a clínica não grava aceite por fora da função'; end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.checar((select count(*) from aceites) = 0, 'a recepção não vê os aceites');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.checar((select count(*) from aceites) = 0, 'outra clínica não vê os aceites');
reset role;
select pg_temp.checar((select count(*) from information_schema.columns where table_name = 'assinaturas' and column_name in ('cartao_inicio', 'cartao_compromisso_ate', 'cartao_multa')) = 3, 'assinatura guarda o compromisso de 12 meses e a multa');
-- Excluir clínica (009_excluir_clinica.sql): só o dono, com o nome certo, sem cartão ativo; fica só o resumo comercial
select set_config('teste.c2', :'c2', false) \g /dev/null
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin perform public.excluir_clinica(current_setting('teste.c2')::uuid, 'Clínica Sol'); raise exception 'FALHA: administrador comum excluiu';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    só o dono do MUSUBI exclui clínica'; end $$;
reset role;
select count(*) as pagos_c2 from pagamentos where clinica_id = :'c2' and situacao = 'pago' \gset
update assinaturas set cartao_id = 'pre9', cartao_situacao = 'ativa' where clinica_id = :'c2';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.checar((select cartao_situacao = 'ativa' from public.painel_dono() where id = :'c2'), 'painel mostra a assinatura no cartão da clínica');
do $$ begin perform public.excluir_clinica(current_setting('teste.c2')::uuid, 'Outro nome'); raise exception 'FALHA: excluiu com o nome errado';
exception when raise_exception then if sqlerrm like 'FALHA%' then raise; end if; raise notice 'ok    nome errado não exclui'; end $$;
do $$ begin perform public.excluir_clinica(current_setting('teste.c2')::uuid, 'Clínica Sol'); raise exception 'FALHA: excluiu com o cartão ativo';
exception when raise_exception then if sqlerrm <> 'cartao_ativo' then raise; end if; raise notice 'ok    com assinatura no cartão ativa não exclui (cancelar antes)'; end $$;
do $$ begin perform public.excluir_clinica(current_setting('teste.c1')::uuid, (select nome from clinicas where id = current_setting('teste.c1')::uuid)); raise exception 'FALHA: excluiu a própria clínica';
exception when raise_exception then if sqlerrm <> 'propria_clinica' then raise; end if; raise notice 'ok    o dono não exclui a própria clínica'; end $$;
reset role;
update assinaturas set cartao_situacao = 'cancelada' where clinica_id = :'c2';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.excluir_clinica(:'c2', '  clínica sol ', 'Desistiu: achou caro');
select pg_temp.checar((select count(*) from public.painel_dono() where id = :'c2') = 0, 'clínica excluída sai do painel');
select pg_temp.checar((select nome = 'Clínica Sol' and email_dono = 'outra@y.com' and motivo = 'Desistiu: achou caro' and jsonb_array_length(pagamentos) = :pagos_c2 and excluida_por = auth.uid() from clinicas_excluidas where clinica_id = :'c2'), 'fica o resumo comercial: nome, e-mail, motivo e pagamentos ao MUSUBI');
update clinicas_excluidas set motivo = 'x';
delete from clinicas_excluidas;
select pg_temp.checar((select count(*) from clinicas_excluidas where motivo = 'Desistiu: achou caro') = 1, 'ninguém altera nem apaga o resumo das excluídas');
reset role;
select pg_temp.checar((select count(*) from membros where clinica_id = :'c2') + (select count(*) from dados where clinica_id = :'c2') + (select count(*) from assinaturas where clinica_id = :'c2') + (select count(*) from pagamentos where clinica_id = :'c2') = 0, 'equipe, dados dos pacientes, assinatura e pagamentos da clínica foram apagados');
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.checar((select count(*) from clinicas_excluidas) = 0, 'quem não é dono não vê as clínicas excluídas');
reset role;
\echo 'Todas as regras do banco passaram.'
