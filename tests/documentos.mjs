// Regras dos documentos (etapa 6B): modelos preenchidos com o que já está registrado, guardar no
// prontuário com quem e quando, marcar termo assinado e nada na exportação v1.
// Uso: node tests/documentos.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1 } from '../js/dados/migracao.js';
import { iniciarAtendimento, finalizarAtendimento } from '../js/dados/atendimento.js';
import { definirLado, definirStatus, definirSituacao } from '../js/dados/prescricao.js';
import { MODELOS_DOC, CAMPOS_DOC, apagarModelo, assinarNaTela, faltaModelo, guardarDocumento, marcarAssinado, modeloDoc, modelosDoc, preencherDoc, salvarModelo, textoModelo, voltarOriginal } from '../js/dados/documentos.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const db = hidratar(migrarV1(seed(), 'exemplos', '2026-11-05T10:00:00Z'));
const P = db.patients[0], HOJE = db.appts.find(a => a.pid === P.id).date, ctx = { appts: db.appts, hoje: HOJE, prof: 'Maicon Farinelli' };
const v1Antes = JSON.stringify(paraV1(db));

ok(MODELOS_DOC.length === 4 && modeloDoc('termo')[3] === true && modeloDoc('declaracao')[3] === false && modeloDoc('xx') === null, 'quatro modelos; só o termo pede assinatura');
const termo = textoModelo('termo', P, ctx);
ok(termo.includes(P.name) && termo.includes('Maicon Farinelli') && termo.includes('\n\n'), 'termo com o paciente e o profissional, em parágrafos');
ok(textoModelo('declaracao', P, ctx).endsWith(`no dia ${HOJE.split('-').reverse().join('/')}, das 09:00 às 10:00.`), 'declaração usa o horário de hoje na agenda');
ok(!textoModelo('declaracao', P, { ...ctx, appts: [] }).includes(' das '), 'sem horário na agenda, só o dia');
ok(textoModelo('orientacoes', P, ctx) === '' && faltaModelo('orientacoes').length > 0, 'sem orientações registradas, vem vazio e a tela explica');
const reg0 = textoModelo('registro', P, ctx);
ok(reg0.includes('Pontos registrados: F3 (bilateral); R3 (bilateral); VB20 (bilateral).') && !reg0.includes('realizado'), 'atendimento antigo: lista os pontos registrados, sem dizer se foram feitos');

// Atendimento novo com prescrição marcada, orientações e situação da queixa
const a = iniciarAtendimento(P, { id: 'atd', data: HOJE }, '2026-11-05T12:00:00Z');
a.plano.pontos.push('E36', 'VG20', 'C7'); a.plano.tec.push('Acupuntura');
definirStatus(a, 'E36', 'real'); definirStatus(a, 'VG20', 'real'); definirLado(a, 'E36', 'uni'); definirStatus(a, 'C7', 'nao');
definirSituacao(a, P.queixas[0].id, 'melhora'); a.plano.orient = '  Compressa morna na nuca.  ';
ok(textoModelo('orientacoes', P, ctx) === 'Compressa morna na nuca.', 'orientações vêm do atendimento (mesmo em rascunho)');
ok(textoModelo('registro', P, ctx) === reg0, 'registro só considera atendimento finalizado');
finalizarAtendimento(P, a, '2026-11-05T13:00:00Z', 'av');
const reg = textoModelo('registro', P, ctx);
ok(reg.includes('Pontos realizados: E36 (unilateral); VG20 (linha média).') && !reg.includes('C7') && reg.includes(`${P.queixas[0].descricao} (melhora)`) && reg.includes('Acupuntura'), 'registro do último atendimento: realizados com o lado, técnicas e situação das queixas');

// Guardar e assinar
ok(guardarDocumento(P, { id: 'd0', modelo: 'termo', texto: '   ', em: 'x', por: 'y' }) === null && !P.documentos, 'texto vazio não é guardado e nada é criado');
const d1 = guardarDocumento(P, { id: 'd1', modelo: 'declaracao', texto: ' Declaro... ', em: '2026-11-05T14:00:00Z', por: 'Maicon Farinelli' });
const d2 = guardarDocumento(P, { id: 'd2', modelo: 'termo', texto: termo + '\n\nAjuste.', em: '2026-11-05T14:05:00Z', por: 'Maicon Farinelli' });
ok(P.documentos[0] === d2 && P.documentos[1] === d1 && d1.texto === 'Declaro...' && d2.texto.endsWith('Ajuste.'), 'guarda o texto como ficou, mais recente primeiro');
ok(marcarAssinado(P, 'd1', 'e', 'p') === null && !d1.assinado, 'declaração não pede assinatura');
ok(marcarAssinado(P, 'd2', '2026-11-05T15:00:00Z', 'Maicon Farinelli') === d2 && d2.assinado && d2.assinadoPor === 'Maicon Farinelli', 'termo marcado como assinado com quem e quando');
ok(marcarAssinado(P, 'd2', 'outra', 'outro') === null && d2.assinadoEm === '2026-11-05T15:00:00Z', 'não marca duas vezes');
ok(guardarDocumento(P, { id: 'd3', modelo: 'xx', texto: 'a', em: 'x', por: 'y' }) === null, 'modelo desconhecido não é guardado');

// Modelos editados na página (pedido do Maicon em 05/11)
ok(CAMPOS_DOC.length === 8 && preencherDoc('A {paciente}, {nada} e {xx}.', { paciente:'Ana', nada:'' }) === 'A Ana e {xx}.', 'dado vazio some com a vírgula; chave desconhecida fica');
ok(salvarModelo(db, 'termo', { nome:'Termo', texto:'  ', assina:true }, 'e', 'p') === null && !db.modelosDoc, 'sem texto não salva e nada é criado');
ok(salvarModelo(db, 'termo', { nome:'Termo de consentimento', texto:'Eu, {paciente}, {cpf}, autorizo. {data}', assina:false }, '2026-11-05T16:00:00Z', 'Maicon Farinelli') === 'termo', 'salva o termo editado');
ok(modeloDoc('termo', db.modelosDoc)[5] === 'editado' && modeloDoc('termo', db.modelosDoc)[3] === false && textoModelo('termo', P, ctx, db.modelosDoc) === `Eu, ${P.name}, autorizo. ${HOJE.split('-').reverse().join('/')}`, 'documento usa o modelo editado (sem CPF, o dado some)');
ok(textoModelo('termo', P, ctx) === termo, 'sem os modelos do profissional, vale o original');
const d4 = guardarDocumento(P, { id:'d4', modelo:'termo', texto:'x', em:'e', por:'p' }, db.modelosDoc);
ok(d4.assina === false && marcarAssinado(P, 'd4', 'e', 'p') === null, 'documento guarda se pede assinatura conforme o modelo usado');
ok(voltarOriginal(db, 'termo') && !db.modelosDoc.termo && modeloDoc('termo', db.modelosDoc)[5] === 'original' && !voltarOriginal(db, 'termo'), 'voltar ao texto original');
salvarModelo(db, 'declaracao', { nome:MODELOS_DOC[1][1], texto:MODELOS_DOC[1][4], assina:false }, 'e', 'p');
ok(!db.modelosDoc.declaracao, 'salvar igual ao original não vira versão própria');
const k = salvarModelo(db, null, { nome:' Atestado ', texto:'Atesto que {paciente} precisa de repouso.', assina:true }, 'e', 'Maicon Farinelli', 'mod1');
ok(k === 'mod1' && modelosDoc(db.modelosDoc).length === 5 && modeloDoc('mod1', db.modelosDoc)[1] === 'Atestado' && modeloDoc('mod1', db.modelosDoc)[5] === 'proprio', 'cria modelo próprio');
const d5 = guardarDocumento(P, { id:'d5', modelo:'mod1', texto:textoModelo('mod1', P, ctx, db.modelosDoc), em:'e', por:'p' }, db.modelosDoc);
ok(d5.nome === 'Atestado' && d5.texto === `Atesto que ${P.name} precisa de repouso.`, 'documento de modelo próprio guarda o nome');
ok(!apagarModelo(db, 'termo') && apagarModelo(db, 'mod1') && !modeloDoc('mod1', db.modelosDoc) && marcarAssinado(P, 'd5', 'e', 'p') === d5, 'apaga só modelo próprio; o documento continua e pode ser marcado assinado');
ok(salvarModelo(db, 'mod1', { nome:'x', texto:'y' }, 'e', 'p') === null, 'não salva em modelo apagado');

// Assinatura na tela (etapa 7B)
const IMG = 'data:image/png;base64,iVBORw0KGgo=';
const d6 = guardarDocumento(P, { id:'d6', modelo:'termo', texto:'Eu, paciente.', em:'2026-11-05T22:00:00Z', por:'Maicon Farinelli' });
ok(assinarNaTela(P, 'd6', { img:'javascript:alert(1)', em:'e', por:'p' }) === null && !d6.assinado, 'só aceita imagem PNG');
ok(assinarNaTela(P, 'd1', { img:IMG, em:'e', por:'p' }) === null, 'declaração não pede assinatura');
ok(assinarNaTela(P, 'd6', { img:IMG, em:'2026-11-05T22:01:00Z', por:'Maicon Farinelli' }) === d6 && d6.assinado && d6.naTela && d6.assinatura === IMG && d6.assinadoEm === '2026-11-05T22:01:00Z', 'assinado na tela com a imagem, quando e quem');
ok(assinarNaTela(P, 'd6', { img:IMG, em:'x', por:'y' }) === null && marcarAssinado(P, 'd6', 'x', 'y') === null, 'não assina duas vezes');

// Exportação no formato do protótipo: documentos não existem lá
const v1 = paraV1(db);
ok(!JSON.stringify(v1).includes('"documentos":[{') && !JSON.stringify(v1.patients[0]).includes('Ajuste.') && !('modelosDoc' in v1), 'documentos e modelos não vão para a exportação v1');
ok(v1Antes.length > 0, 'dados de exemplo carregados');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações dos documentos passaram.');
process.exit(falhas ? 1 : 0);
