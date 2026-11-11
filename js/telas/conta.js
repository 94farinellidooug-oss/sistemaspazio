// Etapa 10: conta no servidor. Tela de acesso (entrar, criar conta, esqueci a senha, nova senha) e
// primeiro acesso da clínica (levando os dados deste aparelho ou começando do zero); depois disso,
// mantém os dados iguais no aparelho e no servidor e mostra no topo se está tudo salvo.
// No computador de desenvolvimento e no arquivo aberto do disco o sistema segue sem conta, como antes,
// a não ser que o modo servidor seja escolhido (musubi-modo = nuvem).
import { criarNuvem, criarSincronia } from '../dados/nuvem.js';
import { dadosNovaClinica, dadosVazios, db, ouvirSalvar, resumoDados, trocarDados } from '../dados/repositorio.js';
import { definirNomeClinica } from '../dados/documentos.js';
import { PROF } from './menu.js';
import { PERIODOS_PAG, PLANOS, RECURSOS, pacoteDoRecurso, planoDe, temRecurso, precoPeriodoTxt, precoTxt, rotuloSituacao, situacaoAssinatura } from '../dados/planos.js';
import { LOGO, ic } from '../componentes/icones.js';
import { permite } from '../dados/equipe.js';
import { esc } from '../util.js';

const KEY_CONVITE = 'musubi-convite', KEY_PLANO_SITE = 'musubi-plano-site', KEY_MODO = 'musubi-modo', KEY_CLINICA = 'musubi-clinica', KEY_CACHE_DE = 'musubi-v2-clinica';
const UFS_BR = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const lerC = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const gravarC = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const voltarAoSite = () => location.origin + location.pathname;

// Estado da conta: modo 'local' (sem conta) ou 'nuvem'; tela de acesso aberta (ou null); clínica atual.
export const conta = { modo:'local', tela:null, msg:'', erro:'', ocupado:false, nuvem:null, clinica:null, clinicas:[], sinc:null, estado:'', levar:true, dono:false, plano:'profissional', periodo:'mensal', aceite:false, assin:null, sit:null, retorno:null, pagamentos:null };
export const PERFIL_NOME = { adm:'Administrador', prof:'Profissional', rec:'Recepção' };
let aoMudarConta = () => {};

const modoInicial = () => {
  const m = lerC(KEY_MODO); if (m === 'local' || m === 'nuvem') return m;
  return location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname) ? 'local' : 'nuvem';
};

// Chamado uma vez ao abrir o sistema. render = redesenhar o sistema.
export function iniciarConta(render, nuvem){
  aoMudarConta = render; conta.modo = modoInicial();
  if (conta.modo === 'local') return;
  conta.nuvem = nuvem || criarNuvem();
  // Volta do pagamento na InfinitePay: o endereço traz o pedido; confere depois de abrir a clínica.
  const q = new URLSearchParams(location.search);
  if (q.get('order_nsu') && q.get('transaction_nsu')) {
    conta.retorno = { order_nsu:q.get('order_nsu'), transaction_nsu:q.get('transaction_nsu'), slug:q.get('slug') || '', receipt_url:q.get('receipt_url') || '' };
    history.replaceState(null, '', location.pathname + location.hash);
  }
  // Volta da assinatura no Mercado Pago: confere depois de abrir a clínica.
  if (q.get('preapproval_id')) { conta.voltouCartao = true; history.replaceState(null, '', location.pathname + location.hash); }
  // Convite da equipe: o link traz o e-mail convidado (para já vir preenchido) e abre "Criar sua conta".
  if (q.get('convite')) { gravarC(KEY_CONVITE, q.get('convite')); history.replaceState(null, '', location.pathname + location.hash); }
  const lk = conta.nuvem.sessaoDoLink(location.hash);
  if (lk) { history.replaceState(null, '', location.pathname); if (lk.tipo === 'recovery') { abrirAcesso('nova-senha'); return; } }
  const pe = lerC(KEY_PLANO_SITE); if (PLANOS.some(p => p.k === pe)) conta.plano = pe;
  if (!conta.nuvem.sessao()) { const criar = location.hash === '#criar' || !!lerC(KEY_CONVITE); if (criar) history.replaceState(null, '', location.pathname); abrirAcesso(criar ? 'criar' : 'entrar'); return; }
  conectar(!!lk);
}
function abrirAcesso(tela, msg = ''){ conta.tela = tela; conta.msg = msg; conta.erro = ''; conta.ocupado = false; desenharAcesso(); }
function fecharAcesso(){ conta.tela = null; desenharAcesso(); }

// Depois de entrar: descobre as clínicas da pessoa e abre a última usada (ou o primeiro acesso).
async function conectar(completar){
  conta.ocupado = true; desenharAcesso();
  try {
    if (completar || !conta.nuvem.sessao().user.email) await conta.nuvem.completarUsuario();
    try { if (await conta.nuvem.aceitarConvites()) gravarC(KEY_CONVITE, null); } catch (e) {}
    conta.clinicas = await conta.nuvem.minhasClinicas();
    if (!conta.clinicas.length) { abrirAcesso('clinica'); return; }
    gravarC(KEY_CONVITE, null);
    await abrirClinica(conta.clinicas.find(c => c.id === lerC(KEY_CLINICA)) || conta.clinicas[0]);
  } catch (e) {
    if (e.codigo === 'sem_login') abrirAcesso('entrar', 'Entre de novo para continuar.');
    else if (e.codigo === 'offline' && lerC(KEY_CACHE_DE)) { conta.clinica = { id:lerC(KEY_CACHE_DE), nome:'' }; ligarSincronia(); conta.estado = 'offline'; fecharAcesso(); aoMudarConta(); }
    else { conta.erro = e.message; conta.ocupado = false; conta.tela = conta.tela || 'entrar'; desenharAcesso(); }
  }
}
// Traz as alterações de outras pessoas da equipe: ao voltar para a aba e a cada 45 segundos com a aba aberta.
let atualizacaoLigada = false;
function ligarAtualizacao(){
  if (atualizacaoLigada || typeof document === 'undefined') return; atualizacaoLigada = true;
  const vai = () => { if (document.visibilityState === 'visible' && conta.modo === 'nuvem' && !document.querySelector('input:focus, textarea:focus, select:focus')) conta.sinc?.atualizar(); };
  document.addEventListener('visibilitychange', vai); addEventListener('focus', vai); setInterval(vai, 45000);
}
function ligarSincronia(){
  conta.sinc = criarSincronia({ nuvem:conta.nuvem, clinica:conta.clinica.id, obter:() => db, aplicar:doc => { trocarDados(doc); },
    aoMudar:(e, x) => { conta.estado = e; if (e === 'juntado') avisoConta('Outra pessoa salvou ao mesmo tempo. Juntamos as duas alterações.'); aoMudarConta(true); } });
  ouvirSalvar(() => conta.sinc.marcar());
  ligarAtualizacao();
}
async function abrirClinica(c){
  conta.clinica = c; gravarC(KEY_CLINICA, c.id); ligarSincronia();
  await conta.sinc.iniciar(); gravarC(KEY_CACHE_DE, c.id);
  // Quem entrou assina os registros; a clínica sem nome salvo nas Configurações usa o nome do cadastro.
  const u = conta.nuvem.sessao()?.user;
  if (u?.nome) PROF.nome = u.nome;
  PROF.papel = PERFIL_NOME[c.perfil] || PROF.papel;
  if (!db.config?.clinica?.nome && c.nome) definirNomeClinica(c.nome);
  try { conta.dono = await conta.nuvem.souDono(); } catch (e) { conta.dono = false; }
  let avisoPago = '';
  if (conta.retorno) {
    const R = conta.retorno; conta.retorno = null;
    try { avisoPago = (await conta.nuvem.conferirPagamento(R))?.pago ? 'Pagamento confirmado. Obrigado!' : ''; } catch (e) {}
    avisoPago ||= 'Recebemos o seu pagamento. O acesso é liberado assim que a InfinitePay confirmar (no Pix, em instantes).';
  }
  // Assinatura no cartão: confere no Mercado Pago antes (uma cobrança aprovada já estende o acesso).
  try { conta.cartao = await conta.nuvem.cartao(c.id); } catch (e) { conta.cartao = null; }
  if (conta.voltouCartao) { conta.voltouCartao = false; avisoPago ||= conta.cartao?.situacao === 'ativa' ? 'Assinatura no cartão ativada. Obrigado!' : 'Recebemos a sua assinatura. Ela fica ativa assim que o Mercado Pago confirmar.'; }
  else if (avisoCobranca(conta.cartao)) avisoPago ||= avisoCobranca(conta.cartao);
  try { conta.assin = await conta.nuvem.assinatura(c.id); } catch (e) { conta.assin = null; }
  conta.sit = situacaoAssinatura(conta.assin); conta.pagamentos = null;
  // Teste terminado sem acesso grátis nem pagamento: os dados ficam guardados, o sistema pede para continuar.
  if (conta.sit.tipo === 'vencido' && !conta.dono) { conta.plano = conta.assin?.plano || conta.plano; abrirAcesso('vencido', avisoPago); aoMudarConta(); return; }
  fecharAcesso(); aoMudarConta();
  if (avisoPago) avisoConta(avisoPago);
}
let avisoH = null;
function avisoConta(m){ const t = document.getElementById('toast'); if (!t) return; t.className = 'toast info'; t.innerHTML = `${ic('info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(avisoH); avisoH = setTimeout(() => { t.hidden = true; }, 6000); }

// Selo no topo: está tudo salvo no servidor?
export function seloConta(){
  if (conta.modo !== 'nuvem' || !conta.sinc) return '';
  const E = { salvo:['okc', 'Salvo', 'ok'], salvando:['carregando', 'Salvando…', ''], carregando:['carregando', 'Abrindo…', ''], offline:['alerta', 'Sem internet', 'warn'], erro:['alerta', 'Não salvou', 'warn'], juntado:['okc', 'Salvo', 'ok'], atualizado:['okc', 'Salvo', 'ok'] }[conta.estado] || ['okc', 'Salvo', 'ok'];
  const dica = conta.estado === 'offline' ? 'Sem conexão: o que você fizer fica neste aparelho e é enviado quando a internet voltar' : conta.estado === 'erro' ? 'O servidor não aceitou; toque para tentar de novo' : 'Tudo guardado no servidor';
  const T = conta.sit?.tipo === 'teste' ? `<a class="selo-teste" href="#configuracoes" data-cf="ir" data-k="conta" data-tip="Seu pacote: ${planoDe(conta.assin?.plano).nome}">${ic('relogio')}<span>${rotuloSituacao(conta.sit)}</span></a>` : '';
  return T + `<button class="selo-nuvem ${E[2]}" data-act="nuvem-tentar" data-tip="${dica}" aria-label="${E[1]}. ${dica}">${ic(E[0])}<span>${E[1]}</span></button>`;
}
// Parte da conta no menu do perfil.
export function menuConta(){
  if (conta.modo !== 'nuvem') return `<button class="pf-i" data-act="conta-entrar">${ic('sair')}Entrar na sua conta</button>`;
  const s = conta.nuvem?.sessao();
  return `<div class="pf-conta muted sm">${esc(s?.user.email || '')}${conta.clinica?.nome ? `<br>${esc(conta.clinica.nome)}` : ''}</div><button class="pf-i sair" data-act="sair">${ic('sair')}Sair</button>`;
}
export function tentarDeNovoConta(){ conta.sinc?.tentarDeNovo(); }
export function entrarNaConta(){ gravarC(KEY_MODO, 'nuvem'); location.reload(); }
export const sairDaConta = async () => {
  if (conta.sinc?.pendente()) { await conta.sinc.agora(); if (conta.sinc.pendente()) { avisoConta('Ainda há mudanças que não chegaram ao servidor. Confira a internet e tente sair de novo.'); return; } }
  await conta.nuvem.sair();
  // Os dados da clínica estão no servidor: não ficam neste aparelho depois de sair.
  if (lerC(KEY_CACHE_DE)) { trocarDados(dadosVazios()); gravarC(KEY_CACHE_DE, null); }
  location.reload();
};

/* ---------- Usado em Configurações (Sua conta e dados da clínica) ---------- */
// Pagamento pela InfinitePay a partir de Minha conta: abre o link (devolve '' ou a mensagem de erro).
export const pagarConta = (plano, periodo, teste = false) => tentarC(async () => { const r = await conta.nuvem.pagar(conta.clinica.id, plano, periodo, teste); location.href = r.url; });
// Assinatura no cartão (Mercado Pago). Devolve '' ou a mensagem de erro.
const reaisC = c => ((c || 0) / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const diaC = d => new Date(d).toLocaleDateString('pt-BR');
// Aviso 7 dias antes de cada cobrança no cartão.
export const avisoCobranca = c => { if (c?.situacao !== 'ativa' || !c.proxima) return ''; const falta = new Date(c.proxima).getTime() - Date.now();
  return falta > 0 && falta <= 7 * 864e5 ? `Aviso: a assinatura do MUSUBI será cobrada no cartão em ${diaC(c.proxima)}, no valor de ${reaisC(c.valor)}.` : ''; };
export const cartaoConta = () => conta.modo === 'nuvem' ? conta.cartao : null;
export const assinarCartaoConta = async (plano, periodo, email) => { try { const r = await conta.nuvem.assinarCartao(conta.clinica.id, plano, periodo, email); location.href = r.url; return ''; }
  catch (e) { return e.codigo === 'acao' || (e.status === 404 && !e.corpo) ? 'A assinatura no cartão ainda não foi ligada no servidor (falta atualizar a função cobranca).' : e.message || 'Não foi possível agora. Tente de novo.'; } };
// Cancelar: no anual com pagamento mensal antes dos 12 meses, o servidor devolve a multa para confirmar ({ multa, meses, compromisso }).
export const cancelarCartaoConta = async (confirmarMulta = false) => { try { const r = await conta.nuvem.cancelarCartao(conta.clinica.id, confirmarMulta);
  if (r?.confirmar) return { multa:r.multa, meses:r.meses, compromisso:r.compromisso }; conta.cartao = r; aoMudarConta(true); return ''; }
  catch (e) { return e.message || 'Não foi possível agora. Tente de novo.'; } };
// Pagamentos da clínica (null enquanto carrega; recarrega a tela quando chegam).
// Cobrar por link (Financeiro): só com a conta no servidor. Devolve { url } ou { erro }.
export const cobrancaLigada = () => conta.modo === 'nuvem' && !!conta.clinica?.id && !!conta.nuvem;
export const cobrarLinkConta = async (tag, valor, descricao) => { try { return await conta.nuvem.cobrarLink(conta.clinica.id, tag, Math.round(valor * 100), descricao); }
  catch (e) { return { erro:e.codigo === 'acao' || e.status === 404 ? 'A cobrança por link ainda não foi ligada no servidor (falta atualizar a função cobranca).' : e.message || 'Não foi possível criar o link agora. Tente de novo.' }; } };
// Nota fiscal (função nfse): devolve a resposta do servidor ou { erro, ...corpo } com a mensagem pronta.
export const nfseConta = async (acao, extra = {}) => { try { return await conta.nuvem.nfse({ acao, clinica:conta.clinica.id, ...extra }); }
  catch (e) { return { ...(e.corpo || {}), erro:e.status === 404 && !e.corpo ? 'A nota fiscal ainda não foi ligada no servidor (falta publicar a função nfse).' : e.codigo === 'offline' ? 'Sem resposta do servidor da nota fiscal. Confira a internet; se ela estiver normal, no Supabase a função nfse precisa estar publicada com "Enforce JWT verification" desligado.' : e.message || 'Não deu certo agora. Tente de novo.', codigo:e.codigo || '' }; } };
export const pagamentosConta = () => {
  if (conta.modo !== 'nuvem' || !conta.clinica?.id) return [];
  if (conta.pagamentos === null) { conta.pagamentos = []; conta.nuvem.pagamentos(conta.clinica.id).then(L => { conta.pagamentos = L; aoMudarConta(true); }).catch(() => {}); }
  return conta.pagamentos;
};
// Permissões do perfil nesta clínica (Equipe). Sem conta (modo local) tudo fica liberado.
export const podeVer = chave => conta.modo !== 'nuvem' || !conta.clinica?.perfil || permite(conta.clinica.permissoes, conta.clinica.perfil, chave);
export const souAdm = () => conta.modo !== 'nuvem' || (conta.clinica?.perfil || 'adm') === 'adm';
// Recursos do pacote: sem conta (modo local) tudo fica liberado.
export const pode = r => { const S = situacaoConta(); return !S || temRecurso(S.plano.k, r); };
export const semPermissao = () => `<div class="card bloq" id="sem-permissao"><span class="tico acc">${ic('cadeado')}</span><div class="grow"><h2>Seu perfil não abre esta tela</h2>
    <p class="muted">Em ${esc(conta.clinica?.nome || 'esta clínica')} você entra como <b>${esc(PERFIL_NOME[conta.clinica?.perfil] || '')}</b>. O que cada perfil abre é escolhido pelo administrador da clínica, em Administração > Equipe e permissões.</p>
    <a class="btn" href="#painel">${ic('painel')}Ir para o painel</a></div></div>`;
export function bloqueio(r){
  const R = RECURSOS[r], P = pacoteDoRecurso(r), S = situacaoConta(), adm = (conta.clinica?.perfil || 'adm') === 'adm';
  return `<div class="card bloq" id="bloq-${r}"><span class="tico acc">${ic('cadeado')}</span><div class="grow"><h2>${esc(R.nome)}</h2>
    <p class="muted">${esc(R.texto)}</p><p>Disponível a partir do pacote <b>${esc(P.nome)}</b>. A sua clínica está no pacote <b>${esc(S?.plano.nome || '')}</b>. O que já foi registrado não se perde.</p>
    ${adm ? `<a class="btn pri" href="#configuracoes">${ic('dinheiro')}Ver pacotes</a>` : '<p class="muted sm">Para liberar, fale com o administrador da clínica.</p>'}</div></div>`;
}
export const situacaoConta = () => conta.modo === 'nuvem' && conta.sit ? { ...conta.sit, plano:planoDe(conta.assin?.plano), rotulo:rotuloSituacao(conta.sit) } : null;
export const contaAtual = () => {
  const u = conta.modo === 'nuvem' ? conta.nuvem?.sessao()?.user : null;
  return { nuvem:!!u, nome:u?.nome || PROF.nome, email:u?.email || '', perfil:conta.clinica?.perfil || 'adm', clinica:conta.clinica?.nome || '' };
};
// Cada uma devolve '' quando deu certo, ou a mensagem de erro em português.
const tentarC = async fn => { try { await fn(); return ''; } catch (e) { return e.message || 'Não foi possível agora. Tente de novo.'; } };
export const salvarNomeConta = nome => tentarC(async () => { await conta.nuvem.mudarNome(nome); PROF.nome = nome.trim(); });
export const mudarEmailConta = email => tentarC(() => conta.nuvem.mudarEmail(email, voltarAoSite()));
export const trocarSenhaConta = senha => tentarC(() => conta.nuvem.trocarSenha(senha));
export const sairDosOutrosConta = () => tentarC(() => conta.nuvem.sairDosOutros());
export const clinicaNoServidor = D => conta.modo === 'nuvem' && conta.clinica?.id ? tentarC(async () => {
  await conta.nuvem.mudarClinica(conta.clinica.id, D); conta.clinica.nome = D.nome;
  const c = conta.clinicas.find(x => x.id === conta.clinica.id); if (c) Object.assign(c, { nome:D.nome, cidade:D.cidade, uf:D.uf });
}) : Promise.resolve('');

/* ---------- Tela de acesso ---------- */
const escolherPlano = rot => `<div class="acesso-opc acesso-plano" role="radiogroup" aria-label="Pacote"><p><b>${rot}</b></p>${PLANOS.map(p => `<label class="${conta.plano === p.k ? 'on' : ''}"><input type="radio" name="plano" value="${p.k}" data-ac="plano" ${conta.plano === p.k ? 'checked' : ''}><span><b>${p.nome} <span class="acesso-preco">${precoTxt(p)}</span></b><small>${p.resumo}</small></span></label>`).join('')}</div>`;
// Aceite do Contrato de assinatura (obrigatório para pagar ou assinar; o servidor registra quem, quando e a versão).
export const TEXTO_ACEITE = 'Li e concordo com o <a class="lnk" href="inicio/contrato.html" target="_blank" rel="noopener">Contrato de assinatura</a> e os <a class="lnk" href="inicio/termos.html" target="_blank" rel="noopener">Termos de uso</a>.';
export const FALTA_ACEITE = 'Para continuar, marque que leu e concorda com o Contrato de assinatura.';
const marcarAceite = () => `<label class="aceite-c"><input type="checkbox" name="aceite" data-ac="aceite" ${conta.aceite ? 'checked' : ''}><span>${TEXTO_ACEITE}</span></label>`;
const escolherPeriodo = () => `<div class="acesso-opc acesso-periodo" role="radiogroup" aria-label="Período">${PERIODOS_PAG.map(([k, l]) => `<label class="${conta.periodo === k ? 'on' : ''}"><input type="radio" name="periodo" value="${k}" data-ac="periodo" ${conta.periodo === k ? 'checked' : ''}><span><b>${l} <span class="acesso-preco">${precoPeriodoTxt(planoDe(conta.plano), k)}</span></b>${k === 'anual' ? '<small>2 meses grátis</small>' : k === 'anual12' ? '<small>15% de desconto, 12 meses de compromisso, só no cartão</small>' : ''}</span></label>`).join('')}</div>`;
const campoA = (nome, rot, tipo = 'text', extra = '') => `<label class="field"><span class="lbl">${rot}</span><input name="${nome}" type="${tipo}" ${extra} required></label>`;
function htmlAcesso(){
  const t = conta.tela, carregando = conta.ocupado && !conta.erro;
  const TIT = { entrar:['Entrar no MUSUBI', 'Use o e-mail e a senha da sua conta.'], criar:['Criar sua conta', 'Comece com o seu e-mail e uma senha.'], esqueci:['Criar uma nova senha', 'Informe o seu e-mail. Mandamos um link para criar a nova senha.'],
    'nova-senha':['Escolha a nova senha', 'Pelo menos 8 caracteres.'], clinica:['Conte sobre a clínica', 'Atende sozinho? Use o seu nome. O resto dá para ajustar depois.'],
    vencido:['O teste grátis terminou', `Os dados${conta.clinica?.nome ? ' de ' + conta.clinica.nome : ''} continuam guardados. Para seguir usando, escolha o pacote e pague com Pix ou cartão.`],
    contato:['Falar com a equipe', 'Deixe o seu WhatsApp: a equipe entra em contato para combinar. Os seus dados continuam guardados.'],
    aguardando:['Pedido enviado', ''] }[t] || ['', ''];
  const R = resumoDados(), temDados = !lerC(KEY_CACHE_DE) && (R.pacientes > 0 || R.horarios > 0);
  const corpo = carregando ? `<p class="muted acesso-c">${ic('carregando')}${t === 'vencido' ? 'Abrindo o pagamento…' : 'Abrindo a sua clínica…'}</p>`
    : conta.msg && ['enviado', 'confirmar', 'aguardando'].includes(conta.tela) ? ''
    : t === 'entrar' ? `${campoA('email', 'E-mail', 'email', 'autocomplete="email"')}<label class="field"><span class="lbl">Senha</span><span class="senha-c"><input name="senha" type="password" autocomplete="current-password" required><button type="button" class="btn ghost sm" data-ac="ver">Mostrar</button></span></label>
        <div class="acesso-l"><button type="button" class="lnk" data-ac="esqueci">Esqueci minha senha</button></div>`
    : t === 'criar' ? `${campoA('nome', 'Seu nome', 'text', 'autocomplete="name"')}${campoA('email', 'E-mail', 'email', `autocomplete="email" value="${esc(lerC(KEY_CONVITE) || '')}"`)}${campoA('senha', 'Crie uma senha', 'password', 'autocomplete="new-password" minlength="8"')}`
    : t === 'esqueci' ? campoA('email', 'E-mail', 'email', 'autocomplete="email"')
    : t === 'nova-senha' ? campoA('senha', 'Nova senha', 'password', 'autocomplete="new-password" minlength="8"')
    : t === 'clinica' ? `${campoA('clinica', 'Nome da clínica')}<div class="acesso-2">${campoA('cidade', 'Cidade')}<label class="field"><span class="lbl">Estado</span><select name="uf">${UFS_BR.map(u => `<option ${u === 'RS' ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
        ${temDados ? `<div class="acesso-opc" role="radiogroup" aria-label="Dados deste aparelho"><p><b>Encontramos dados neste aparelho:</b> ${R.pacientes} paciente${R.pacientes === 1 ? '' : 's'}${R.exemplos ? ' (além dos exemplos)' : ''}, ${R.atendimentos} atendimento${R.atendimentos === 1 ? '' : 's'} e ${R.horarios} horário${R.horarios === 1 ? '' : 's'} na agenda.</p>
          <label class="${conta.levar ? 'on' : ''}"><input type="radio" name="levar" value="1" data-ac="levar" ${conta.levar ? 'checked' : ''}><span><b>Levar para a minha conta</b><small>Tudo passa a ficar no servidor e aparece em qualquer aparelho. Recomendado.</small></span></label>
          <label class="${conta.levar ? '' : 'on'}"><input type="radio" name="levar" value="0" data-ac="levar" ${conta.levar ? '' : 'checked'}><span><b>Começar do zero</b><small>A clínica começa com pacientes de exemplo (WhatsApp e CPF 0000…) para conhecer o sistema. Dá para excluir depois.</small></span></label></div>` : ''}
        ${escolherPlano('Escolha o pacote: 7 dias grátis com tudo o que ele tem')}`
    : t === 'vencido' ? `${escolherPlano('Pacote')}${escolherPeriodo()}${marcarAceite()}`
    : t === 'contato' ? `${escolherPlano('Pacote')}${campoA('whats', 'Seu WhatsApp', 'tel', 'autocomplete="tel" placeholder="(54) 99999-0000"')}` : '';
  const botao = { entrar:'Entrar', criar:'Criar conta', esqueci:'Enviar link', 'nova-senha':'Salvar e entrar', clinica:'Começar os 7 dias grátis', vencido:'Pagar com Pix ou cartão', contato:'Enviar' }[t];
  const termos = t === 'criar' ? `<p class="muted sm">Ao criar a conta, você concorda com os <a class="lnk" href="inicio/termos.html" target="_blank" rel="noopener">Termos de uso</a> e a <a class="lnk" href="inicio/privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>.</p>` : '';
  const rodape = termos + (t === 'entrar' ? `<p class="muted sm">Ainda não tem conta? <button type="button" class="lnk" data-ac="criar">Criar conta</button></p><p class="muted sm"><button type="button" class="lnk suave" data-ac="local">Usar só neste aparelho, sem conta</button></p><p class="muted sm"><a class="lnk suave" href="inicio/index.html">Conhecer o MUSUBI</a></p>`
    : ['criar', 'esqueci'].includes(t) ? `<p class="muted sm"><button type="button" class="lnk" data-ac="entrar">Voltar para entrar</button></p>`
    : t === 'vencido' ? `<button type="button" class="btn ${conta.periodo === 'anual12' ? 'pri ' : ''}largo" data-ac="assinar-cartao" ${conta.ocupado ? 'disabled' : ''}>${ic('dinheiro')}Assinar no cartão (cobrança automática)</button><p class="muted sm">No cartão, a cobrança é feita sozinha pelo Mercado Pago, com aviso 7 dias antes.</p><p class="muted sm"><button type="button" class="lnk" data-ac="contato">Prefiro que a equipe entre em contato</button></p><p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>`
    : t === 'contato' ? `<p class="muted sm"><button type="button" class="lnk" data-ac="vencido">Voltar para o pagamento</button></p><p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>`
    : ['clinica', 'aguardando'].includes(t) ? `${t === 'clinica' && lerC(KEY_CONVITE) ? `<p class="notice sm acesso-conv">${ic('info')}<span>Recebeu um convite de uma clínica? Ele vale para o e-mail convidado. Confirme o e-mail pelo link que mandamos e <button type="button" class="lnk" data-ac="de-novo">entre de novo</button>.</span></p>` : ''}<p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>` : '');
  return `<div class="acesso-f"><form class="acesso-card card" id="f-acesso" novalidate>
    <div class="acesso-h">${LOGO}<b>Musubi</b></div>
    <h1>${conta.tela === 'confirmar' ? 'Confira o seu e-mail' : conta.tela === 'enviado' ? 'Link enviado' : TIT[0]}</h1>
    <p class="muted">${esc(conta.msg || TIT[1])}</p>
    ${corpo}
    <p class="erro-a" role="alert" ${conta.erro ? '' : 'hidden'}>${esc(conta.erro)}</p>
    ${carregando || ['confirmar', 'enviado', 'aguardando'].includes(t) || (t === 'vencido' && conta.periodo === 'anual12') ? '' : `<button class="btn pri largo" type="submit" ${conta.ocupado ? 'disabled' : ''}>${conta.ocupado ? 'Aguarde…' : botao}</button>`}
    ${['confirmar', 'enviado'].includes(t) ? `<button class="btn largo" type="button" data-ac="entrar">Voltar para entrar</button>` : rodape}
  </form></div>`;
}
function desenharAcesso(){
  const el = document.getElementById('acesso'); if (!el) return;
  el.hidden = !conta.tela; document.body.classList.toggle('com-acesso', !!conta.tela);
  if (!conta.tela) { el.innerHTML = ''; return; }
  const foco = document.activeElement?.name, antes = {};
  el.querySelectorAll('input:not([type=radio]), select').forEach(i => { if (i.name && i.type !== 'password') antes[i.name] = i.value; });
  el.innerHTML = htmlAcesso();
  if (conta.tela === conta.telaDesenhada) el.querySelectorAll('input:not([type=radio]), select').forEach(i => { if (i.name in antes) i.value = antes[i.name]; });
  conta.telaDesenhada = conta.tela;
  const i = (foco && el.querySelector(`[name="${foco}"]`)) || el.querySelector('input');
  if (i && !conta.ocupado) i.focus();
}
const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
async function enviarAcesso(f){
  const t = conta.tela, v = n => f.elements[n]?.value || '';
  const falta = t === 'entrar' ? (!okEmail(v('email')) ? 'Confira o e-mail.' : !v('senha') ? 'Digite a sua senha.' : '')
    : t === 'criar' ? (!v('nome').trim() ? 'Escreva o seu nome.' : !okEmail(v('email')) ? 'Confira o e-mail.' : v('senha').length < 8 ? 'A senha precisa de pelo menos 8 caracteres.' : '')
    : t === 'esqueci' ? (!okEmail(v('email')) ? 'Confira o e-mail.' : '')
    : t === 'nova-senha' ? (v('senha').length < 8 ? 'A senha precisa de pelo menos 8 caracteres.' : '')
    : t === 'clinica' ? (!v('clinica').trim() ? 'Escreva o nome da clínica.' : !v('cidade').trim() ? 'Escreva a cidade.' : '')
    : t === 'contato' ? (String(v('whats')).replace(/\D/g, '').length < 10 ? 'Confira o WhatsApp, com o DDD.' : '')
    : t === 'vencido' ? (!conta.aceite ? FALTA_ACEITE : '') : '';
  if (falta) { conta.erro = falta; desenharAcesso(); return; }
  conta.erro = ''; conta.ocupado = true; desenharAcesso();
  try {
    if (t === 'entrar') { await conta.nuvem.entrar(v('email'), v('senha')); await conectar(); return; }
    if (t === 'criar') { const r = await conta.nuvem.criarConta(v('email'), v('senha'), v('nome'), voltarAoSite());
      if (r.confirmar) { abrirAcesso('confirmar', `Mandamos um link para ${v('email').trim()}. Abra o link para ativar a conta; ele traz você de volta para cá.`); return; }
      await conectar(); return; }
    if (t === 'esqueci') { await conta.nuvem.esqueci(v('email'), voltarAoSite()); abrirAcesso('enviado', `Se ${v('email').trim()} tiver uma conta, o link chega em alguns minutos. Confira também a caixa de spam.`); return; }
    if (t === 'nova-senha') { await conta.nuvem.trocarSenha(v('senha')); await conectar(true); return; }
    if (t === 'clinica') {
      const levar = !lerC(KEY_CACHE_DE) && conta.levar && (resumoDados().pacientes > 0 || resumoDados().horarios > 0);
      const doc = levar ? db : dadosNovaClinica();
      (doc.config ||= {}).clinica = { ...(doc.config.clinica || {}), nome:v('clinica').trim(), cidade:v('cidade').trim(), uf:v('uf') };
      const id = await conta.nuvem.criarClinica({ nome:v('clinica').trim(), cidade:v('cidade').trim(), uf:v('uf'), nomePessoa:conta.nuvem.sessao().user.nome || '', plano:conta.plano }, doc);
      await abrirClinica({ id, nome:v('clinica').trim(), perfil:'adm' });
    }
    if (t === 'vencido') {
      try { const r = await conta.nuvem.pagar(conta.clinica.id, conta.plano, conta.periodo); location.href = r.url; return; }
      catch (e) { if (e.codigo === 'sem_cobranca' || e.status === 404) { abrirAcesso('contato', 'O pagamento pelo site ainda não está disponível. Deixe o seu WhatsApp: a equipe entra em contato para combinar.'); return; } throw e; }
    }
    if (t === 'contato') {
      const u = conta.nuvem.sessao()?.user || {}, P = planoDe(conta.plano);
      await conta.nuvem.pedirContato(`${u.nome || u.email || 'Cliente'} · ${conta.clinica?.nome || ''} · quer o ${P.nome}`.slice(0, 120), v('whats'));
      abrirAcesso('aguardando', `Recebemos o seu pedido do pacote ${P.nome} (${precoTxt(P)}). A equipe entra em contato pelo WhatsApp ${v('whats').trim()} para combinar. Os seus dados continuam guardados.`);
    }
  } catch (e) { conta.erro = e.message; conta.ocupado = false; desenharAcesso(); }
}
// Eventos da tela de acesso (ficam nela; o resto do sistema não é afetado).
export function ligarAcesso(){
  const el = document.getElementById('acesso'); if (!el) return;
  el.addEventListener('submit', ev => { ev.preventDefault(); if (!conta.ocupado) enviarAcesso(ev.target); });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ac]'); if (!b) return; const a = b.dataset.ac;
    if (a === 'ver') { const s = el.querySelector('[name=senha]'), mostrar = s.type === 'password'; s.type = mostrar ? 'text' : 'password'; b.textContent = mostrar ? 'Ocultar' : 'Mostrar'; }
    else if (['entrar', 'criar', 'esqueci', 'contato', 'vencido'].includes(a)) abrirAcesso(a);
    else if (a === 'local') { gravarC(KEY_MODO, 'local'); conta.modo = 'local'; fecharAcesso(); aoMudarConta(); }
    else if (a === 'assinar-cartao' && !conta.ocupado && !conta.aceite) { conta.erro = FALTA_ACEITE; desenharAcesso(); }
    else if (a === 'assinar-cartao' && !conta.ocupado) { conta.erro = ''; conta.ocupado = true; desenharAcesso();
      assinarCartaoConta(conta.plano, conta.periodo, conta.nuvem.sessao()?.user.email || '').then(e => { if (e) { conta.erro = /falta atualizar|não está ligada/.test(e) ? 'A assinatura no cartão ainda não está disponível. Use Pix ou cartão acima.' : e; conta.ocupado = false; desenharAcesso(); } }); }
    else if (a === 'sair') sairDaConta();
    else if (a === 'de-novo') conectar(true);
  });
  el.addEventListener('change', ev => {
    if (ev.target.dataset.ac === 'levar') { conta.levar = ev.target.value === '1'; desenharAcesso(); }
    if (ev.target.dataset.ac === 'plano') { conta.plano = ev.target.value; desenharAcesso(); }
    if (ev.target.dataset.ac === 'periodo') { conta.periodo = ev.target.value; desenharAcesso(); }
    if (ev.target.dataset.ac === 'aceite') { conta.aceite = ev.target.checked; if (conta.aceite && conta.erro === FALTA_ACEITE) conta.erro = ''; desenharAcesso(); }
  });
}
