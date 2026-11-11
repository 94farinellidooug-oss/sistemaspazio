// Painel do MUSUBI para vender melhor: números de gestão, tarefas do dia e mensagens de WhatsApp para cada tipo
// de contato. Só cálculos (sem tela), a partir do que o painel já carrega: clínicas (painel_dono), pagamentos,
// interessados, clínicas excluídas e o acompanhamento de cada contato (relacionamento_musubi).
import { PLANOS, situacaoAssinatura } from './planos.js';

const DIA_VD = 864e5;
const tempoV = d => d ? new Date(d).getTime() : 0;
const diasDesdeV = (d, agora) => Math.floor((agora - tempoV(d)) / DIA_VD);
const mesDeV = d => String(d || '').slice(0, 7);
const precoMesV = plano => (PLANOS.find(p => p.k === plano) || PLANOS[1]).preco * 100;
const pagoDeV = g => g.valor_pago || g.valor || 0;
const ehTesteV = g => g.valor === 100;   // pagamento de teste do dono (R$ 1,00)

// Valor por mês que a clínica paga hoje (centavos), ou 0. Cartão ativo: o valor do cartão (anual à vista dividido
// por 12). Pago pela InfinitePay e ainda dentro do prazo: o preço mensal do pacote.
export function valorMensalClinica(c, agora = Date.now()){
  if (['ativa', 'pausada'].includes(c.cartao_situacao) && c.cartao_valor) return c.cartao_periodo === 'anual' ? Math.round(c.cartao_valor / 12) : c.cartao_valor;
  return situacaoAssinatura(c, agora).tipo === 'pago' ? precoMesV(c.plano) : 0;
}

export function numerosGestao({ clinicas = [], pagamentos = [], excluidas = [], agora = Date.now() } = {}){
  const S = clinicas.map(c => ({ c, s:situacaoAssinatura(c, agora) }));
  const pagos = pagamentos.filter(g => g.situacao === 'pago' && !ehTesteV(g));
  const pagantes = S.filter(x => x.s.tipo === 'pago' || ['ativa', 'pausada'].includes(x.c.cartao_situacao));
  const mrr = clinicas.reduce((t, c) => t + valorMensalClinica(c, agora), 0);
  const ano = new Date(agora).getFullYear();
  const meses = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(agora); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
  const jaPagaram = new Set(pagos.map(g => g.clinica_id));
  const totalHistorico = clinicas.length + excluidas.length;
  const convertidas = clinicas.filter(c => jaPagaram.has(c.id)).length + excluidas.filter(x => (x.pago_total || 0) > 0).length;
  return {
    mrr,
    ticket:pagantes.length ? Math.round(mrr / pagantes.length) : 0,
    recebido30:pagos.filter(g => tempoV(g.pago_em) > agora - 30 * DIA_VD).reduce((t, g) => t + pagoDeV(g), 0),
    recebidoAno:pagos.filter(g => new Date(tempoV(g.pago_em)).getFullYear() === ano).reduce((t, g) => t + pagoDeV(g), 0),
    porMes:meses.map(m => ({ mes:m, valor:pagos.filter(g => mesDeV(g.pago_em) === m).reduce((t, g) => t + pagoDeV(g), 0) })),
    pagantes:pagantes.length,
    emTeste:S.filter(x => x.s.tipo === 'teste').length,
    gratis:S.filter(x => x.s.tipo === 'gratis').length,
    vencidas:S.filter(x => x.s.tipo === 'vencido').length,
    novas30:clinicas.filter(c => tempoV(c.criado_em) > agora - 30 * DIA_VD).length,
    ativas7:clinicas.filter(c => tempoV(c.ultimo_uso) > agora - 7 * DIA_VD).length,
    conversao:totalHistorico ? Math.round(100 * convertidas / totalHistorico) : 0,
    desistencias90:excluidas.filter(x => tempoV(x.excluida_em) > agora - 90 * DIA_VD).length,
    porPacote:PLANOS.map(p => ({ k:p.k, nome:p.nome, n:pagantes.filter(x => (x.c.plano || 'profissional') === p.k).length })),
    cartao:clinicas.filter(c => ['ativa', 'pausada'].includes(c.cartao_situacao)).length
  };
}

// Mensagens prontas para o WhatsApp, em tom profissional. {nome} = nome da pessoa ou da clínica.
export const MENSAGENS_VENDA = {
  interessado:'Olá, {nome}! Aqui é o Maicon, do MUSUBI. Vi que você pediu para conhecer o sistema. Posso te mostrar em uma chamada rápida de 15 minutos como ficam a agenda, o prontuário e os documentos? Qual o melhor horário para você?',
  teste:'Olá! Aqui é o Maicon, do MUSUBI. O teste grátis da {nome} termina em breve. Está tudo certo com o sistema? Se quiser, te ajudo a configurar o que faltar e a escolher o melhor pacote.',
  vencido:'Olá! Aqui é o Maicon, do MUSUBI. O teste da {nome} terminou, mas os dados continuam guardados. Posso te ajudar a continuar? Se precisar de mais alguns dias para conhecer, é só me dizer.',
  parado:'Olá! Aqui é o Maicon, do MUSUBI. Notei que a {nome} não usa o sistema há alguns dias. Ficou alguma dúvida ou algo que eu possa ajudar a configurar?',
  cartao:'Olá! Aqui é o Maicon, do MUSUBI. A última cobrança da assinatura da {nome} no cartão não foi aprovada. Pode conferir o cartão no Mercado Pago? Se preferir, também dá para pagar com Pix pelo sistema, em Configurações > Sua conta.',
  ex:'Olá! Aqui é o Maicon, do MUSUBI. Faz um tempoV que a {nome} deixou de usar o sistema e queria saber como estão as coisas. Fizemos várias melhorias e, se quiser voltar, posso preparar uma condição especial.',
  cliente:'Olá! Aqui é o Maicon, do MUSUBI. Tudo certo com o sistema na {nome}? Se você conhece outro profissional que possa gostar do MUSUBI, ficarei muito grato pela indicação.'
};
export const mensagemVenda = (tipo, nome) => (MENSAGENS_VENDA[tipo] || MENSAGENS_VENDA.cliente).replace('{nome}', String(nome || '').trim() || 'sua clínica');
export const linkWhats = (whats, texto = '') => { const d = String(whats || '').replace(/\D/g, ''); if (d.length < 10) return ''; return `https://wa.me/${d.length <= 11 ? '55' + d : d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`; };

// Contatos para o relacionamento: interessados, clínicas e ex-clientes, com o tipo de mensagem de cada um.
export function contatosVenda({ clinicas = [], interessados = [], excluidas = [], acompanhamento = {}, agora = Date.now() } = {}){
  const R = ref => acompanhamento[ref] || {};
  const L = [];
  for (const i of interessados) L.push({ ref:'i:' + i.id, grupo:'interessado', nome:i.nome, whats:i.whats, email:'', desde:i.criado_em, situacao:i.situacao, msg:'interessado', id:i.id, ...R('i:' + i.id) });
  for (const c of clinicas) {
    const s = situacaoAssinatura(c, agora), parado = tempoV(c.ultimo_uso) && diasDesdeV(c.ultimo_uso, agora) >= 14;
    const grupo = s.tipo === 'teste' ? 'teste' : s.tipo === 'vencido' ? 'vencido' : 'cliente';
    const msg = c.cartao_situacao === 'pausada' ? 'cartao' : grupo === 'cliente' && parado ? 'parado' : grupo;
    L.push({ ref:'c:' + c.id, grupo, nome:c.nome, whats:c.whats || '', email:c.email_dono || '', desde:c.criado_em, cidade:[c.cidade, c.uf].filter(Boolean).join(' - '), msg, id:c.id, s, ...R('c:' + c.id) });
  }
  for (const x of excluidas) L.push({ ref:'x:' + x.id, grupo:'ex', nome:x.nome, whats:x.whats || '', email:x.email_dono || '', desde:x.excluida_em, cidade:[x.cidade, x.uf].filter(Boolean).join(' - '), motivo:x.motivo || '', msg:'ex', id:x.id, ...R('x:' + x.id) });
  return L;
}

// Tarefas do dia, da mais urgente para a menos. Cada uma: { ref, nivel (1 = hoje), titulo, detalhe, msg, whats, email }.
export function tarefasDoDia({ clinicas = [], interessados = [], excluidas = [], acompanhamento = {}, agora = Date.now() } = {}){
  const hoje = new Date(agora - 3 * 36e5).toISOString().slice(0, 10);   // dia em Brasília
  const C = contatosVenda({ clinicas, interessados, excluidas, acompanhamento, agora });
  const T = [], ja = new Set();
  const add = (k, t) => { if (ja.has(k.ref)) return; ja.add(k.ref); T.push({ ref:k.ref, nome:k.nome, whats:k.whats, email:k.email, msg:k.msg, ...t }); };
  for (const k of C) if (k.retornar_em && k.retornar_em <= hoje) add(k, { nivel:1, titulo:`Retornar o contato com ${k.nome}`, detalhe:k.retornar_em < hoje ? `Marcado para ${new Date(k.retornar_em + 'T12:00:00').toLocaleDateString('pt-BR')}, está atrasado.` : 'Marcado para hoje.' });
  for (const k of C) if (k.grupo === 'interessado' && k.situacao === 'novo') add(k, { nivel:1, titulo:`Chamar ${k.nome} no WhatsApp`, detalhe:`Pediu para conhecer ${diasDesdeV(k.desde, agora) <= 0 ? 'hoje' : `há ${diasDesdeV(k.desde, agora)} dia${diasDesdeV(k.desde, agora) === 1 ? '' : 's'}`}. Responder rápido aumenta a chance de fechar.` });
  for (const k of C) if (k.msg === 'cartao') add(k, { nivel:1, titulo:`${k.nome}: cobrança no cartão recusada`, detalhe:'A assinatura no Mercado Pago está pausada. Peça para conferir o cartão.' });
  for (const k of C) if (k.grupo === 'teste' && k.s.dias <= 2) add(k, { nivel:2, titulo:`${k.nome}: teste termina em ${k.s.dias} dia${k.s.dias === 1 ? '' : 's'}`, detalhe:'Ofereça ajuda para configurar e para escolher o pacote.' });
  for (const k of C) if (k.grupo === 'vencido' && !k.retornar_em) add(k, { nivel:2, titulo:`${k.nome}: teste terminou sem assinatura`, detalhe:'Pergunte o que faltou. Se fizer sentido, dê mais 7 dias de teste.' });
  for (const k of C) if (k.msg === 'parado') add(k, { nivel:3, titulo:`${k.nome} não usa o sistema há ${diasDesdeV(clinicas.find(c => c.id === k.id)?.ultimo_uso, agora)} dias`, detalhe:'Quem para de usar costuma desistir. Pergunte se precisa de ajuda.' });
  for (const k of C) if (k.grupo === 'ex' && !k.retornar_em && diasDesdeV(k.desde, agora) >= 30) add(k, { nivel:3, titulo:`Convidar ${k.nome} a voltar`, detalhe:`Saiu há ${diasDesdeV(k.desde, agora)} dias${k.motivo ? ` (motivo: ${k.motivo})` : ''}.` });
  return T.sort((a, b) => a.nivel - b.nivel);
}

// Dicas para vender melhor (fixas, mostradas no painel).
export const DICAS_VENDA = [
  ['Demonstração curta', 'Mostre o sistema em 15 minutos com um paciente de exemplo: agenda, atendimento, documentos e financeiro. Uma tela vale mais que a explicação.'],
  ['Responda no mesmo dia', 'Quem pediu para conhecer está procurando uma solução agora. Quanto mais cedo o primeiro contato, maior a chance de fechar.'],
  ['Acompanhe o teste', 'Dois ou três dias depois do cadastro, pergunte se a pessoa conseguiu montar a agenda e o primeiro atendimento. Quem usa no teste assina.'],
  ['Ofereça o anual com pagamento mensal', 'Para quem já usa todo dia: 15% mais barato para o cliente e 12 meses de assinatura para o MUSUBI.'],
  ['Peça indicação', 'Cada cliente satisfeito conhece outros profissionais. Peça a indicação logo depois de resolver uma dúvida ou de um elogio.'],
  ['Mostre nas redes', 'Poste uma tela do sistema por semana (há imagens prontas na página de apresentação), sempre com a chamada para os 7 dias grátis.'],
  ['Aprenda com quem saiu', 'Ao excluir uma clínica, anote o motivo. Os motivos que se repetem mostram o que melhorar no sistema ou na oferta.']
];
