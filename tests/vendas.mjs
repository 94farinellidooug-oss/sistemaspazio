// Painel do MUSUBI para vender melhor: números de gestão, tarefas do dia, contatos e mensagens.
// Uso: node tests/vendas.mjs
import { numerosGestao, tarefasDoDia, contatosVenda, mensagemVenda, linkWhats, valorMensalClinica } from '../js/dados/vendas.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const AGORA = Date.parse('2026-11-11T15:00:00Z'), D = 864e5, iso = n => new Date(AGORA + n * D).toISOString();
const base = { gratis_sempre:false, gratis_ate:null, pago_ate:null, teste_ate:null, cartao_situacao:'', cartao_valor:null, cartao_periodo:'', whats:'', ultimo_uso:iso(0), criado_em:iso(-60) };
const clinicas = [
  { ...base, id:'a', nome:'Clínica Pix', plano:'profissional', pago_ate:iso(20) },
  { ...base, id:'b', nome:'Clínica Cartão', plano:'clinica', cartao_situacao:'ativa', cartao_valor:25400, cartao_periodo:'anual12', pago_ate:iso(10) },
  { ...base, id:'c', nome:'Clínica Anual', plano:'essencial', cartao_situacao:'ativa', cartao_valor:79000, cartao_periodo:'anual', pago_ate:iso(300) },
  { ...base, id:'d', nome:'Clínica Teste', plano:'profissional', teste_ate:iso(1), criado_em:iso(-6), whats:'(54) 99999-0000' },
  { ...base, id:'e', nome:'Clínica Venceu', plano:'profissional', teste_ate:iso(-3), criado_em:iso(-10) },
  { ...base, id:'f', nome:'Clínica Parada', plano:'essencial', pago_ate:iso(5), ultimo_uso:iso(-20) },
  { ...base, id:'g', nome:'Clínica Recusada', plano:'profissional', cartao_situacao:'pausada', cartao_valor:14900, cartao_periodo:'mensal', pago_ate:iso(-1) },
  { ...base, id:'h', nome:'Testadora', plano:'clinica', gratis_sempre:true }
];
const pagamentos = [
  { clinica_id:'a', situacao:'pago', valor:14900, pago_em:iso(-10) },
  { clinica_id:'b', situacao:'pago', valor:25400, valor_pago:25400, pago_em:iso(-40) },
  { clinica_id:'c', situacao:'pago', valor:79000, pago_em:iso(-65) },
  { clinica_id:'h', situacao:'pago', valor:100, pago_em:iso(-2) },
  { clinica_id:'e', situacao:'aberto', valor:14900, pago_em:null }
];
const excluidas = [{ id:1, nome:'Saiu Faz Tempo', whats:'54988887777', excluida_em:iso(-45), motivo:'achou caro', pago_total:14900 }, { id:2, nome:'Saiu Agora', excluida_em:iso(-5), pago_total:0 }];
const interessados = [{ id:'i1', nome:'Ana', whats:'(51) 98888-1111', situacao:'novo', criado_em:iso(-1) }, { id:'i2', nome:'Bia', whats:'51977776666', situacao:'chamei', criado_em:iso(-8) }];

ok(valorMensalClinica(clinicas[0], AGORA) === 14900 && valorMensalClinica(clinicas[1], AGORA) === 25400 && valorMensalClinica(clinicas[2], AGORA) === 6583 && valorMensalClinica(clinicas[3], AGORA) === 0 && valorMensalClinica(clinicas[7], AGORA) === 0, 'valor por mês: Pix pelo pacote, cartão pelo valor, anual dividido por 12; teste e grátis não contam');
const N = numerosGestao({ clinicas, pagamentos, excluidas, agora:AGORA });
ok(N.mrr === 14900 + 25400 + 6583 + 7900 + 14900, 'receita por mês soma os pagantes (a pausada ainda conta)');
ok(N.pagantes === 5 && N.emTeste === 1 && N.gratis === 1 && N.vencidas === 2, 'pagantes, em teste, grátis e teste terminado');
ok(N.recebido30 === 14900 && N.recebidoAno === 14900 + 25400 + 79000, 'recebido nos 30 dias e no ano, sem o pagamento de teste de R$ 1,00');
ok(N.porMes.length === 6 && N.porMes.at(-1).mes === '2026-11' && N.porMes.at(-1).valor === 14900 && N.porMes.find(m => m.mes === '2026-10').valor === 25400, 'recebido por mês nos últimos 6 meses');
ok(N.conversao === Math.round(100 * 4 / 10) && N.desistencias90 === 2 && N.novas30 === 2, 'conversão do teste, desistências e clínicas novas');
ok(N.ticket === Math.round(N.mrr / 5) && N.porPacote.find(p => p.k === 'profissional').n === 2, 'ticket médio e pagantes por pacote');

const acompanhamento = { 'i:i2':{ retornar_em:'2026-11-10' }, 'c:e':{ retornar_em:'2026-11-20' } };
const T = tarefasDoDia({ clinicas, interessados, excluidas, acompanhamento, agora:AGORA });
const t = n => T.find(x => x.nome === n);
ok(t('Bia')?.nivel === 1 && t('Bia').detalhe.includes('atrasado'), 'retorno marcado e atrasado vira tarefa de hoje');
ok(t('Ana')?.nivel === 1 && t('Ana').msg === 'interessado' && t('Ana').titulo.includes('WhatsApp'), 'interessado novo: chamar no WhatsApp');
ok(t('Clínica Recusada')?.msg === 'cartao', 'cobrança no cartão recusada vira tarefa');
ok(t('Clínica Teste')?.nivel === 2 && t('Clínica Teste').titulo.includes('1 dia'), 'teste terminando em 1 dia');
ok(!t('Clínica Venceu'), 'teste terminado com retorno já marcado para depois não repete');
ok(t('Clínica Parada')?.msg === 'parado' && t('Clínica Parada').titulo.includes('20 dias'), 'cliente sem usar há 20 dias');
ok(t('Saiu Faz Tempo')?.detalhe.includes('achou caro') && !t('Saiu Agora'), 'ex-cliente há mais de 30 dias: convidar a voltar (com o motivo)');
ok(!t('Clínica Pix') && !t('Testadora'), 'quem está bem não vira tarefa');
ok(T.every((x, i) => !i || T[i - 1].nivel <= x.nivel), 'tarefas da mais urgente para a menos');

const C = contatosVenda({ clinicas, interessados, excluidas, acompanhamento, agora:AGORA });
ok(C.length === 12 && C.filter(k => k.grupo === 'ex').length === 2 && C.find(k => k.ref === 'c:e').retornar_em === '2026-11-20', 'contatos juntam interessados, clínicas e ex-clientes, com o acompanhamento');
ok(mensagemVenda('teste', 'Clínica Sol').includes('Clínica Sol') && mensagemVenda('ex', '').includes('sua clínica'), 'mensagem com o nome');
ok(linkWhats('(54) 99999-0000', 'Olá!') === 'https://wa.me/5554999990000?text=Ol%C3%A1!' && linkWhats('123') === '', 'link do WhatsApp com a mensagem');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nOs números e tarefas do Painel do MUSUBI passaram.');
process.exit(falhas ? 1 : 0);
