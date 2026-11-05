// Regras do financeiro (etapa 8): A receber só com atendidos desde o início do financeiro, receber
// parcial sem passar do que falta, desfazer, pacote descontando os atendidos do mesmo serviço,
// despesas que repetem (e param de repetir), resumo do mês, dados da nota e nada na exportação v1.
// Uso: node tests/financeiro.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1 } from '../js/dados/migracao.js';
import { aReceber, coberturaPacotes, dadosNota, desfazerRecebimento, despesasDoMes, faltaDe, financeiroDe, lerValor, novaDespesa, novoPacote, receber, removerDespesa, resumoMes, usosPacote } from '../js/dados/financeiro.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const db = hidratar(migrarV1(seed(), 'exemplos', '2026-11-05T10:00:00Z'));
const HOJE = '2026-11-05', MES = '2026-11';
const ap = (id, pid, date, tipo, valor, done = true, extra = {}) => ({ id, pid, date, time: '09:00', tipo, valor, done, ...extra });
db.appts = [ap('a1', 'p1', '2026-11-03', 'Acupuntura', 180), ap('a2', 'p2', '2026-11-04', 'Auriculoterapia', 90), ap('a3', 'p1', '2026-11-05', 'Acupuntura', 180),
  ap('a4', 'p2', '2026-10-20', 'Acupuntura', 180), ap('a5', 'p1', '2026-11-06', 'Acupuntura', 180, false), ap('a6', 'p2', '2026-11-04', 'Ventosaterapia', 150, true, { st: 'desmarcado' }),
  ap('a7', 'p1', '2026-11-05', 'Auriculoterapia', 90, false)];
const v1Antes = JSON.stringify(paraV1(db));

ok(lerValor('1.150,50') === 1150.5 && lerValor('R$ 40,00') === 40 && lerValor('90') === 90 && Number.isNaN(lerValor('')), 'lê valores digitados em reais');
const [F, criado] = financeiroDe(db, HOJE);
ok(criado && F.inicio === '2026-11-01' && !financeiroDe(db, HOJE)[1], 'financeiro criado uma vez, a partir do mês atual');
ok(aReceber(db, HOJE).map(a => a.id).join() === 'a1,a2,a3', 'A receber: só atendidos desde o início, até hoje, sem desmarcados');

ok(receber(db, 'a1', { id: 'r1', valor: 200, forma: 'Pix', data: HOJE, por: 'M' }).startsWith('O valor passa do que falta'), 'valor acima do que falta não entra');
ok(receber(db, 'a1', { id: 'r1', valor: 0, forma: 'Pix', data: HOJE, por: 'M' }) === 'Informe o valor recebido', 'valor vazio não entra');
ok(receber(db, 'a1', { id: 'r1', valor: 100, forma: 'Cheque', data: HOJE, por: 'M' }) === 'Escolha a forma de pagamento', 'forma desconhecida não entra');
const r1 = receber(db, 'a1', { id: 'r1', valor: 100, forma: 'Dinheiro', data: HOJE, por: 'Maicon' });
ok(r1.valor === 100 && faltaDe(db, db.appts[0]) === 80 && aReceber(db, HOJE).length === 3, 'parcial: fica faltando o resto');
receber(db, 'a1', { id: 'r2', valor: 80, forma: 'Pix', data: HOJE, por: 'Maicon' });
ok(!aReceber(db, HOJE).some(a => a.id === 'a1'), 'quitado sai de A receber');
ok(desfazerRecebimento(db, 'r2') && faltaDe(db, db.appts[0]) === 80 && !desfazerRecebimento(db, 'r2'), 'desfazer volta o valor para A receber');

// Pacote: cobre os atendidos de Acupuntura do p1 a partir da compra, sem recebimento avulso.
ok(!novoPacote(db, { id: 'k0', pid: 'p1', serv: 'Acupuntura', total: 0, valor: 900, em: '2026-11-01', por: 'M' }), 'pacote sem sessões não entra');
const k = novoPacote(db, { id: 'k1', pid: 'p1', serv: 'Acupuntura', total: 2, valor: 340, em: '2026-11-01', por: 'M' });
let cob = coberturaPacotes(db);
ok(cob.get('a3') === k && !cob.has('a1') && usosPacote(db, k) === 1, 'pacote desconta o atendido do mesmo serviço (o já pago em parte fica de fora)');
ok(!aReceber(db, HOJE).some(a => a.id === 'a3'), 'atendido coberto pelo pacote sai de A receber');
db.appts.find(a => a.id === 'a5').done = true; db.appts.find(a => a.id === 'a7').done = true;
cob = coberturaPacotes(db);
ok(usosPacote(db, k, cob) === 2 && cob.has('a5') && !cob.has('a7'), 'outro serviço não usa o pacote');
db.appts.push(ap('a8', 'p1', '2026-11-07', 'Acupuntura', 180));
ok(!coberturaPacotes(db).has('a8') && faltaDe(db, db.appts.at(-1)) === 180, 'pacote esgotado: o próximo volta a ser cobrado');
db.appts.find(a => a.id === 'a5').done = false; db.appts.find(a => a.id === 'a7').done = false; db.appts.pop();

// Despesas
ok(!novaDespesa(db, { id: 'd0', desc: ' ', valor: 10, data: HOJE }), 'despesa sem descrição não entra');
novaDespesa(db, { id: 'd1', desc: 'Aluguel da sala', cat: 'Aluguel', valor: 1200, data: '2026-10-31', repete: true, por: 'M' });
novaDespesa(db, { id: 'd2', desc: 'Agulhas', cat: 'Material', valor: 230, data: '2026-11-03', repete: false, por: 'M' });
novaDespesa(db, { id: 'd3', desc: 'Café', cat: 'Lanche', valor: 20.5, data: '2026-10-10', repete: false, por: 'M' });
const D = despesasDoMes(db, MES);
ok(D.map(d => d.id).join() === 'd2,d1' && D[1].data === '2026-11-28' && D[1].repetida, 'despesa que repete entra no mês seguinte (até o dia 28)');
ok(db.financeiro.despesas.find(d => d.id === 'd3').cat === 'Outros', 'tipo desconhecido vira Outros');
const R = resumoMes(db, MES, HOJE);
ok(R.rec === 440 && R.aRec === 170 && R.pend === 2 && R.desp === 1430 && R.saldo === -990, 'resumo: recebido (avulso + pacote), a receber, despesas e saldo');
ok(removerDespesa(db, 'd1', MES) && db.financeiro.despesas.find(d => d.id === 'd1').ate === '2026-10' && despesasDoMes(db, '2026-10').some(d => d.id === 'd1') && !despesasDoMes(db, MES).some(d => d.id === 'd1'), 'parar de repetir mantém os meses anteriores');
ok(removerDespesa(db, 'd2', MES) && !db.financeiro.despesas.some(d => d.id === 'd2'), 'despesa do mês sai de vez');
ok(removerDespesa(db, 'd1', '2026-10') && !db.financeiro.despesas.some(d => d.id === 'd1'), 'na origem, a que repete sai de vez');
db.financeiro.despesas.push({ id: 'd4', desc: 'Luz', cat: 'Contas', valor: 100, data: '2025-12-15', repete: true });
ok(despesasDoMes(db, '2026-01').some(d => d.id === 'd4') && !removerDespesa(db, 'x', MES), 'repete também na virada do ano');
removerDespesa(db, 'd4', '2026-01');
ok(db.financeiro.despesas.find(d => d.id === 'd4').ate === '2025-12', 'parar de repetir em janeiro termina em dezembro');

const nota = dadosNota(db, r1);
ok(nota.includes(`Paciente: ${db.patients.find(p => p.id === 'p1').name}`) && nota.includes('Serviço: Acupuntura') && nota.includes('Valor: R$') && nota.includes('Data do atendimento: 03/11/2026') && nota.includes('Recebido em: 05/11/2026 (Dinheiro)'), 'dados da nota prontos para copiar');
ok(JSON.stringify(paraV1(db)) === v1Antes, 'exportação v1 não muda');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as regras do financeiro passaram.');
process.exit(falhas ? 1 : 0);
