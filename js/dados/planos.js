// Etapa 10: pacotes do MUSUBI e situação da assinatura (pedido do Maicon em 06/11/2026; valores conversados
// em 05/11, para ajustar depois). Toda clínica nova tem 7 dias grátis com as funções do pacote escolhido;
// o dono do MUSUBI pode dar acesso grátis (com prazo ou sem prazo) pelo Painel do MUSUBI.
export const PLANOS = [
  { k:'essencial', nome:'Essencial', preco:79, resumo:'Para começar a organizar a clínica.',
    itens:['Agenda', 'Pacientes e prontuário', 'Documentos editáveis', 'WhatsApp com mensagem pronta', 'Financeiro básico'] },
  { k:'profissional', nome:'Profissional', preco:149, resumo:'O MUSUBI completo para quem atende com MTC.', destaque:true,
    itens:['Tudo do Essencial', 'Avaliação MTC e pentagrama', 'Mapa corporal e pontos indicados', 'Dicas de vasos e estações', 'Evolução comparada', 'Relatórios'] },
  { k:'clinica', nome:'Clínica', preco:299, aPartir:true, resumo:'Para equipes com mais de um profissional.',
    itens:['Tudo do Profissional', 'Vários profissionais e permissões', 'Relatórios da clínica', 'Lembretes automáticos', 'Nota fiscal (até um limite)'] }
];
export const planoDe = k => PLANOS.find(p => p.k === k) || PLANOS[1];
export const precoTxt = p => `${p.aPartir ? 'a partir de ' : ''}R$ ${p.preco}/mês`;
export const DIAS_TESTE = 7;

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
