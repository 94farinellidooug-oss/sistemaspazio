// Histórico de alterações (LGPD): o que muda entre duas versões dos dados vira eventos (sem copiar valores), e a
// sincronia manda os eventos junto com o salvamento. As regras do banco ficam em tests/sql/regras.sql.
// Uso: node tests/historico.mjs
import { eventosEntre, campoTxt } from '../js/dados/historico.js';
import { criarNuvem, criarSincronia } from '../js/dados/nuvem.js';
import { servidor } from './lib/supabase-falso.mjs';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const copia = x => structuredClone(x);

const antes = {
  patients:[{ id:'p1', name:'Ana Souza', phone:'54 9999', cadastro:{ cpf:'111', email:'a@x' }, anam:{ queixa:'dor' }, atendimentos:[{ id:'a1', data:'2026-11-01', texto:'x' }], avaliacoes:[], documentos:[{ id:'d1', nome:'Atestado', texto:'t' }], diagnosticos:[] },
    { id:'p2', name:'Bruno Lima', atendimentos:[], avaliacoes:[], documentos:[] }],
  appts:[{ id:'h1', pid:'p1', date:'2026-11-10', time:'14:00', status:'marcado' }],
  financeiro:{ recebimentos:[], pacotes:[], despesas:[{ id:'x1', descricao:'Aluguel', valor:1000 }], notas:[] },
  config:{ clinica:{ nome:'Spazio' } }, modelosDoc:[], mensagensWa:{ lembrete:'oi' }
};
ok(eventosEntre(antes, copia(antes)).length === 0, 'nada mudou, nenhum evento');

const d = copia(antes);
d.patients[0].phone = '54 8888'; d.patients[0].cadastro.cpf = '222';
d.patients[0].atendimentos[0].texto = 'corrigido'; d.patients[0].atendimentos.push({ id:'a2', data:'2026-11-08' });
d.patients[0].documentos = []; d.patients[0].diagnosticos.push({ id:'g1', codigo:'M54.5' });
d.patients.push({ id:'p3', name:'Carla Dias', atendimentos:[], avaliacoes:[], documentos:[] });
d.desativados = [d.patients.splice(1, 1)[0]];
d.appts[0].time = '15:00';
d.financeiro.recebimentos.push({ id:'r1', pid:'p1', data:'2026-11-08', valor:150 }); d.financeiro.despesas = [];
d.config.clinica.nome = 'Spazio Stabilità'; d.mensagensWa.lembrete = 'olá';
const E = eventosEntre(antes, d), ach = (tipo, acao, alvo) => E.find(e => e.tipo === tipo && e.acao === acao && (!alvo || e.alvo === alvo));

const cad = ach('paciente', 'alterou', 'p1');
ok(cad && cad.campos.includes('phone') && cad.campos.includes('cadastro.cpf') && !cad.campos.includes('atendimentos') && cad.titulo === 'Ana Souza' && cad.paciente_id === 'p1', 'cadastro alterado: diz quais campos (telefone, CPF), sem misturar o prontuário');
ok(!JSON.stringify(E).includes('8888') && !JSON.stringify(E).includes('222') && !JSON.stringify(E).includes('corrigido'), 'os valores não vão para o histórico, só os nomes dos campos');
ok(ach('atendimento', 'alterou', 'a1')?.campos.join() === 'texto' && ach('atendimento', 'criou', 'a2')?.titulo === 'Ana Souza · atendimento de 08/11/2026', 'atendimento corrigido e atendimento novo, com o paciente e a data');
ok(ach('documento', 'apagou', 'd1')?.titulo === 'Ana Souza · Atestado' && ach('diagnostico', 'criou', 'g1')?.titulo === 'Ana Souza · CID M54.5', 'documento apagado e CID novo no prontuário');
ok(ach('paciente', 'criou', 'p3')?.titulo === 'Carla Dias' && ach('paciente', 'desativou', 'p2')?.titulo === 'Bruno Lima', 'paciente novo e paciente desativado');
ok(ach('horario', 'alterou', 'h1')?.campos.join() === 'time' && ach('horario', 'alterou', 'h1').paciente_id === 'p1', 'horário remarcado na agenda, ligado ao paciente');
ok(ach('recebimento', 'criou', 'r1')?.paciente_id === 'p1' && ach('despesa', 'apagou', 'x1')?.titulo === 'Despesa · Aluguel', 'financeiro: recebimento novo e despesa apagada');
ok(ach('configuracao', 'alterou')?.campos.join() === 'clinica' && ach('mensagens', 'alterou'), 'configurações e modelos de mensagem');
const vol = copia(d); vol.patients.push(vol.desativados.pop());
ok(eventosEntre(d, vol).some(e => e.tipo === 'paciente' && e.acao === 'reativou' && e.alvo === 'p2'), 'paciente reativado');
ok(campoTxt('cadastro.cpf') === 'CPF' && campoTxt('phone') === 'telefone' && campoTxt('contatoEmergencia') === 'contato emergencia', 'nomes dos campos em português');

// Sincronia: eventos vão junto com o salvamento, com o login e a hora do servidor.
const S = servidor(); let relogio = 1e6;
const m = () => { const x = new Map(); return { getItem:k => x.get(k) ?? null, setItem:(k, v) => x.set(k, String(v)), removeItem:k => x.delete(k) }; };
const N = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem:m(), agora:() => relogio });
await N.entrar('maicon@x.com', 'segredo123');
const c = await N.criarClinica({ nome:'Spazio', cidade:'Caxias do Sul', uf:'RS', nomePessoa:'Maicon' }, copia(antes));
let local = null;
const sinc = criarSincronia({ nuvem:N, clinica:c, obter:() => local, aplicar:x => { local = copia(x); }, mem:m(), relogio:{ definir:() => 1, limpar:() => {} } });
await sinc.iniciar();
local.patients[0].phone = '54 7777'; await sinc.agora();
const H = await N.historico(c);
ok(H.length === 1 && H[0].tipo === 'paciente' && H[0].acao === 'alterou' && H[0].campos.join() === 'phone' && H[0].email === 'maicon@x.com' && H[0].em, 'salvar grava o evento com o e-mail de quem salvou e a hora');
ok((await N.historico(c, { paciente:'p1' })).length === 1 && (await N.historico(c, { paciente:'p2' })).length === 0, 'filtra o histórico por paciente');
await sinc.agora();
ok((await N.historico(c)).length === 1, 'salvar sem mudança não cria evento');
S.semHistorico = true; local.patients[0].name = 'Ana S.'; await sinc.agora();
ok(S.dados[c].doc.patients[0].name === 'Ana S.' && N.semHistorico(), 'servidor sem o 006: salva os dados mesmo assim e avisa que falta o histórico');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nO histórico de alterações passou.');
process.exit(falhas ? 1 : 0);
