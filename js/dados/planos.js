// Etapa 10: pacotes do MUSUBI e situação da assinatura (pedido do Maicon em 06/11/2026; valores conversados
// em 05/11, para ajustar depois). Toda clínica nova tem 7 dias grátis com as funções do pacote escolhido;
// o dono do MUSUBI pode dar acesso grátis (com prazo ou sem prazo) pelo Painel do MUSUBI.
export const PLANOS = [
  { k:'essencial', nome:'Essencial', preco:79, resumo:'Para começar a organizar a clínica.',
    itens:['Agenda', 'Pacientes e prontuário', 'Documentos editáveis', 'WhatsApp com mensagem pronta', 'Financeiro básico', 'Nota fiscal (até 30 por mês)', 'Consulta online (até 10 por mês)'] },
  { k:'profissional', nome:'Profissional', preco:149, resumo:'O MUSUBI completo para quem atende com MTC.', destaque:true,
    itens:['Tudo do Essencial', 'Avaliação MTC e pentagrama', 'Mapa corporal e pontos indicados', 'Dicas de vasos e estações', 'Evolução comparada', 'Relatórios', 'Nota fiscal (até 100 por mês)', 'Consulta online (até 40 por mês)'] },
  { k:'clinica', nome:'Clínica', preco:299, aPartir:true, resumo:'Para equipes com mais de um profissional.',
    itens:['Tudo do Profissional', 'Vários profissionais e permissões', 'Relatórios da clínica', 'Lembretes automáticos', 'Nota fiscal (até 300 por mês)', 'Consulta online (até 100 por mês)'] }
];
// O que cada pacote libera (etapa 10). O Essencial fica sem a parte de MTC (avaliação energética, pentagrama,
// síntese, mapa corporal, Biblioteca clínica e dicas de vasos e estações) e sem os relatórios. Nada é apagado:
// ao trocar para um pacote com o recurso, tudo o que já foi registrado volta a aparecer.
export const RECURSOS = {
  mtc:{ nome:'Avaliação MTC, pentagrama e mapa corporal', texto:'Avaliação energética, pentagrama, síntese clínica, mapa corporal com os pontos indicados, Biblioteca clínica e dicas de vasos e estações.', planos:['profissional', 'clinica'] },
  relatorios:{ nome:'Relatórios', texto:'Atendimentos e receita por período, por mês, por serviço e por forma de pagamento, evolução das queixas e dicas de gestão.', planos:['profissional', 'clinica'] }
};
export const RECURSO_ROTA = { avaliacao:'mtc', pentagrama:'mtc', pontos:'mtc', biblioteca:'mtc', relatorios:'relatorios' };
export const temRecurso = (k, r) => !RECURSOS[r] || RECURSOS[r].planos.includes(k);
export const pacoteDoRecurso = r => PLANOS.find(p => temRecurso(p.k, r)) || PLANOS[1];
export const planoDe = k => PLANOS.find(p => p.k === k) || PLANOS[1];
export const precoTxt = p => `${p.aPartir ? 'a partir de ' : ''}R$ ${p.preco}/mês`;
export const DIAS_TESTE = 7;
// Notas fiscais por mês em produção (decisão do Maicon em 08/11/2026). As de homologação (teste) não contam.
// A função nfse do servidor tem a mesma tabela e é ela que barra.
export const LIMITE_NOTAS = { essencial:30, profissional:100, clinica:300 };
// Consultas online (vídeo) por mês, decisão do Maicon em 12/11/2026. A função teleconsulta tem a mesma tabela e é ela que barra.
export const LIMITE_ONLINE = { essencial:10, profissional:40, clinica:100 };
// Pagamento pela InfinitePay (Pix ou cartão): mensal, ou anual com 2 meses grátis (paga 10 meses).
// Três formas (decisão do Maicon em 11/11/2026): mensal sem fidelidade; anual com pagamento mensal (12 meses de
// compromisso, 15% de desconto, só no cartão pelo Mercado Pago; quem cancela antes devolve o desconto recebido);
// anual à vista (10 mensalidades).
export const PERIODOS_PAG = [['mensal', 'Mensal'], ['anual12', 'Anual com pagamento mensal'], ['anual', 'Anual à vista']];
export const DESCONTO_FIDELIDADE = 0.15;
export const precoFidelidade = p => Math.round(p.preco * (1 - DESCONTO_FIDELIDADE));
export const valorPeriodo = (p, periodo) => periodo === 'anual12' ? precoFidelidade(p) : p.preco * (periodo === 'anual' ? 10 : 1);
export const precoPeriodoTxt = (p, periodo) => `R$ ${valorPeriodo(p, periodo).toLocaleString('pt-BR')}${periodo === 'anual' ? '/ano' : periodo === 'anual12' ? '/mês por 12 meses' : '/mês'}`;
// Contrato de assinatura (inicio/contrato.html): a versão aceita fica registrada no servidor.
export const CONTRATO_VERSAO = '2026-11-11';

const DIA = 86400000;
// Situação da assinatura: {tipo:'gratis'|'pago'|'teste'|'vencido', dias (que faltam), ate (iso), sempre}.
// Sem assinatura (servidor antigo, ou sem conta) conta como liberado.
export function situacaoAssinatura(a, agora = Date.now()){
  if (!a) return { tipo:'gratis', sempre:true, dias:null, ate:null };
  const t = d => d ? new Date(d).getTime() : 0, dias = d => Math.max(0, Math.ceil((t(d) - agora) / DIA));
  if (a.gratis_sempre) return { tipo:'gratis', sempre:true, dias:null, ate:null, motivo:a.gratis_motivo || '' };
  if (t(a.gratis_ate) > agora) return { tipo:'gratis', sempre:false, dias:dias(a.gratis_ate), ate:a.gratis_ate, motivo:a.gratis_motivo || '' };
  if (t(a.pago_ate) > agora) return { tipo:'pago', dias:dias(a.pago_ate), ate:a.pago_ate };
  if (t(a.teste_ate) > agora) return { tipo:'teste', dias:dias(a.teste_ate), ate:a.teste_ate };
  return { tipo:'vencido', dias:0, ate:a.teste_ate };
}
// Texto curto da situação (painel do dono e topo do sistema).
export function rotuloSituacao(s){
  const d = n => `${n} dia${n === 1 ? '' : 's'}`, data = iso => new Date(iso).toLocaleDateString('pt-BR');
  return s.tipo === 'gratis' ? (s.sempre ? 'Grátis sem prazo' : `Grátis até ${data(s.ate)}`)
    : s.tipo === 'pago' ? `Pago até ${data(s.ate)}`
    : s.tipo === 'teste' ? `Teste: falta${s.dias === 1 ? '' : 'm'} ${d(s.dias)}`
    : 'Teste terminou';
}
