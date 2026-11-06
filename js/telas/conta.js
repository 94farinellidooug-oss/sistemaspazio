// Etapa 10: conta no servidor. Tela de acesso (entrar, criar conta, esqueci a senha, nova senha) e
// primeiro acesso da clínica (levando os dados deste aparelho ou começando do zero); depois disso,
// mantém os dados iguais no aparelho e no servidor e mostra no topo se está tudo salvo.
// No computador de desenvolvimento e no arquivo aberto do disco o sistema segue sem conta, como antes,
// a não ser que o modo servidor seja escolhido (musubi-modo = nuvem).
import { criarNuvem, criarSincronia } from '../dados/nuvem.js';
import { dadosNovaClinica, dadosVazios, db, ouvirSalvar, resumoDados, trocarDados } from '../dados/repositorio.js';
import { definirNomeClinica } from '../dados/documentos.js';
import { PROF } from './menu.js';
import { PERIODOS_PAG, PLANOS, planoDe, precoPeriodoTxt, precoTxt, rotuloSituacao, situacaoAssinatura } from '../dados/planos.js';
import { LOGO, ic } from '../componentes/icones.js';
import { esc } from '../util.js';

const KEY_PLANO_SITE = 'musubi-plano-site', KEY_MODO = 'musubi-modo', KEY_CLINICA = 'musubi-clinica', KEY_CACHE_DE = 'musubi-v2-clinica';
const UFS_BR = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const lerC = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const gravarC = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const voltarAoSite = () => location.origin + location.pathname;

// Estado da conta: modo 'local' (sem conta) ou 'nuvem'; tela de acesso aberta (ou null); clínica atual.
export const conta = { modo:'local', tela:null, msg:'', erro:'', ocupado:false, nuvem:null, clinica:null, clinicas:[], sinc:null, estado:'', levar:true, dono:false, plano:'profissional', periodo:'mensal', assin:null, sit:null, retorno:null, pagamentos:null };
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
  const lk = conta.nuvem.sessaoDoLink(location.hash);
  if (lk) { history.replaceState(null, '', location.pathname); if (lk.tipo === 'recovery') { abrirAcesso('nova-senha'); return; } }
  const pe = lerC(KEY_PLANO_SITE); if (PLANOS.some(p => p.k === pe)) conta.plano = pe;
  if (!conta.nuvem.sessao()) { const criar = location.hash === '#criar'; if (criar) history.replaceState(null, '', location.pathname); abrirAcesso(criar ? 'criar' : 'entrar'); return; }
  conectar(!!lk);
}
function abrirAcesso(tela, msg = ''){ conta.tela = tela; conta.msg = msg; conta.erro = ''; conta.ocupado = false; desenharAcesso(); }
function fecharAcesso(){ conta.tela = null; desenharAcesso(); }

// Depois de entrar: descobre as clínicas da pessoa e abre a última usada (ou o primeiro acesso).
async function conectar(completar){
  conta.ocupado = true; desenharAcesso();
  try {
    if (completar || !conta.nuvem.sessao().user.email) await conta.nuvem.completarUsuario();
    conta.clinicas = await conta.nuvem.minhasClinicas();
    if (!conta.clinicas.length) { abrirAcesso('clinica'); return; }
    await abrirClinica(conta.clinicas.find(c => c.id === lerC(KEY_CLINICA)) || conta.clinicas[0]);
  } catch (e) {
    if (e.codigo === 'sem_login') abrirAcesso('entrar', 'Entre de novo para continuar.');
    else if (e.codigo === 'offline' && lerC(KEY_CACHE_DE)) { conta.clinica = { id:lerC(KEY_CACHE_DE), nome:'' }; ligarSincronia(); conta.estado = 'offline'; fecharAcesso(); aoMudarConta(); }
    else { conta.erro = e.message; conta.ocupado = false; conta.tela = conta.tela || 'entrar'; desenharAcesso(); }
  }
}
function ligarSincronia(){
  conta.sinc = criarSincronia({ nuvem:conta.nuvem, clinica:conta.clinica.id, obter:() => db, aplicar:doc => { trocarDados(doc); },
    aoMudar:(e, x) => { conta.estado = e; if (e === 'conflito') avisoConta('Outro aparelho salvou antes. Abrimos a versão mais nova; o que estava aqui ficou guardado como cópia neste aparelho.'); aoMudarConta(true); } });
  ouvirSalvar(() => conta.sinc.marcar());
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
  const E = { salvo:['okc', 'Salvo', 'ok'], salvando:['carregando', 'Salvando…', ''], carregando:['carregando', 'Abrindo…', ''], offline:['alerta', 'Sem internet', 'warn'], erro:['alerta', 'Não salvou', 'warn'], conflito:['okc', 'Atualizado', 'ok'] }[conta.estado] || ['okc', 'Salvo', 'ok'];
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
// Pagamentos da clínica (null enquanto carrega; recarrega a tela quando chegam).
export const pagamentosConta = () => {
  if (conta.modo !== 'nuvem' || !conta.clinica?.id) return [];
  if (conta.pagamentos === null) { conta.pagamentos = []; conta.nuvem.pagamentos(conta.clinica.id).then(L => { conta.pagamentos = L; aoMudarConta(true); }).catch(() => {}); }
  return conta.pagamentos;
};
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
const escolherPeriodo = () => `<div class="acesso-opc acesso-periodo" role="radiogroup" aria-label="Período">${PERIODOS_PAG.map(([k, l]) => `<label class="${conta.periodo === k ? 'on' : ''}"><input type="radio" name="periodo" value="${k}" data-ac="periodo" ${conta.periodo === k ? 'checked' : ''}><span><b>${l} <span class="acesso-preco">${precoPeriodoTxt(planoDe(conta.plano), k)}</span></b>${k === 'anual' ? '<small>2 meses grátis</small>' : ''}</span></label>`).join('')}</div>`;
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
    : t === 'criar' ? `${campoA('nome', 'Seu nome', 'text', 'autocomplete="name"')}${campoA('email', 'E-mail', 'email', 'autocomplete="email"')}${campoA('senha', 'Crie uma senha', 'password', 'autocomplete="new-password" minlength="8"')}`
    : t === 'esqueci' ? campoA('email', 'E-mail', 'email', 'autocomplete="email"')
    : t === 'nova-senha' ? campoA('senha', 'Nova senha', 'password', 'autocomplete="new-password" minlength="8"')
    : t === 'clinica' ? `${campoA('clinica', 'Nome da clínica')}<div class="acesso-2">${campoA('cidade', 'Cidade')}<label class="field"><span class="lbl">Estado</span><select name="uf">${UFS_BR.map(u => `<option ${u === 'RS' ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
        ${temDados ? `<div class="acesso-opc" role="radiogroup" aria-label="Dados deste aparelho"><p><b>Encontramos dados neste aparelho:</b> ${R.pacientes} paciente${R.pacientes === 1 ? '' : 's'}${R.exemplos ? ' (além dos exemplos)' : ''}, ${R.atendimentos} atendimento${R.atendimentos === 1 ? '' : 's'} e ${R.horarios} horário${R.horarios === 1 ? '' : 's'} na agenda.</p>
          <label class="${conta.levar ? 'on' : ''}"><input type="radio" name="levar" value="1" data-ac="levar" ${conta.levar ? 'checked' : ''}><span><b>Levar para a minha conta</b><small>Tudo passa a ficar no servidor e aparece em qualquer aparelho. Recomendado.</small></span></label>
          <label class="${conta.levar ? '' : 'on'}"><input type="radio" name="levar" value="0" data-ac="levar" ${conta.levar ? '' : 'checked'}><span><b>Começar do zero</b><small>A clínica começa com pacientes de exemplo (WhatsApp e CPF 0000…) para conhecer o sistema. Dá para excluir depois.</small></span></label></div>` : ''}
        ${escolherPlano('Escolha o pacote: 7 dias grátis com tudo o que ele tem')}`
    : t === 'vencido' ? `${escolherPlano('Pacote')}${escolherPeriodo()}`
    : t === 'contato' ? `${escolherPlano('Pacote')}${campoA('whats', 'Seu WhatsApp', 'tel', 'autocomplete="tel" placeholder="(54) 99999-0000"')}` : '';
  const botao = { entrar:'Entrar', criar:'Criar conta', esqueci:'Enviar link', 'nova-senha':'Salvar e entrar', clinica:'Começar os 7 dias grátis', vencido:'Pagar com Pix ou cartão', contato:'Enviar' }[t];
  const rodape = t === 'entrar' ? `<p class="muted sm">Ainda não tem conta? <button type="button" class="lnk" data-ac="criar">Criar conta</button></p><p class="muted sm"><button type="button" class="lnk suave" data-ac="local">Usar só neste aparelho, sem conta</button></p><p class="muted sm"><a class="lnk suave" href="inicio/index.html">Conhecer o MUSUBI</a></p>`
    : ['criar', 'esqueci'].includes(t) ? `<p class="muted sm"><button type="button" class="lnk" data-ac="entrar">Voltar para entrar</button></p>`
    : t === 'vencido' ? `<p class="muted sm"><button type="button" class="lnk" data-ac="contato">Prefiro que a equipe entre em contato</button></p><p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>`
    : t === 'contato' ? `<p class="muted sm"><button type="button" class="lnk" data-ac="vencido">Voltar para o pagamento</button></p><p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>`
    : ['clinica', 'aguardando'].includes(t) ? `<p class="muted sm"><button type="button" class="lnk" data-ac="sair">Sair</button></p>` : '';
  return `<div class="acesso-f"><form class="acesso-card card" id="f-acesso" novalidate>
    <div class="acesso-h">${LOGO}<b>Musubi</b></div>
    <h1>${conta.tela === 'confirmar' ? 'Confira o seu e-mail' : conta.tela === 'enviado' ? 'Link enviado' : TIT[0]}</h1>
    <p class="muted">${esc(conta.msg || TIT[1])}</p>
    ${corpo}
    <p class="erro-a" role="alert" ${conta.erro ? '' : 'hidden'}>${esc(conta.erro)}</p>
    ${carregando || ['confirmar', 'enviado', 'aguardando'].includes(t) ? '' : `<button class="btn pri largo" type="submit" ${conta.ocupado ? 'disabled' : ''}>${conta.ocupado ? 'Aguarde…' : botao}</button>`}
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
    : t === 'contato' ? (String(v('whats')).replace(/\D/g, '').length < 10 ? 'Confira o WhatsApp, com o DDD.' : '') : '';
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
    else if (a === 'sair') sairDaConta();
  });
  el.addEventListener('change', ev => {
    if (ev.target.dataset.ac === 'levar') { conta.levar = ev.target.value === '1'; desenharAcesso(); }
    if (ev.target.dataset.ac === 'plano') { conta.plano = ev.target.value; desenharAcesso(); }
    if (ev.target.dataset.ac === 'periodo') { conta.periodo = ev.target.value; desenharAcesso(); }
  });
}
