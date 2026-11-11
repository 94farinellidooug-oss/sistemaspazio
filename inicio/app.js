// Página de apresentação do MUSUBI (etapa 10, aprovada na prévia do PR #42): primeira página do site.
// "Entrar" usa a conta do servidor e abre o sistema; "Solicitar demonstração" vai para os Interessados do Painel do MUSUBI;
// "Começar 7 dias grátis" abre a criação de conta já com o pacote escolhido.
import { ICONES } from '../js/componentes/icones.js';
import { PLANOS, precoTxt, precoFidelidade, DIAS_TESTE } from '../js/dados/planos.js';
import { criarNuvem, KEY_SESSAO } from '../js/dados/nuvem.js';

const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n] || ''}</svg>`;
const $ = s => document.querySelector(s);
const pintarIcones = (raiz = document) => raiz.querySelectorAll('[data-i]').forEach(e => { e.outerHTML = ic(e.dataset.i); });

// [ícone, título, texto]
const MODULOS = [
  ['agenda', 'Agenda', 'Visão semanal, horários disponíveis por serviço, confirmação, remarcação e cancelamento com histórico preservado.'],
  ['pacientes', 'Pacientes e prontuário', 'Cadastro objetivo, alertas de segurança e histórico completo de atendimentos de cada paciente.'],
  ['plano', 'Atendimento guiado', 'Anamnese, avaliação, síntese, mapa corporal, plano terapêutico, evolução e documentos, em etapas organizadas.'],
  ['yin', 'Avaliação pela MTC', 'Língua, pulso e sinais organizados em Ba Gang e nos cinco elementos, com o Pentagrama atualizado automaticamente.'],
  ['corpo', 'Mapa corporal e pontos', 'Registro de dor e sintomas no mapa corporal, pontos do plano terapêutico e biblioteca de pontos com referência bibliográfica.'],
  ['assinatura', 'Documentos com assinatura', 'Orientações, atestados e termos gerados a partir de modelos próprios, com assinatura digital na tela.'],
  ['tel', 'WhatsApp', 'Lembretes de consulta e mensagens padronizadas e editáveis, enviadas pelo WhatsApp da clínica.'],
  ['financeiro', 'Financeiro', 'Recebimentos por forma de pagamento, pagamentos parciais, venda de pacotes e despesas recorrentes.'],
  ['relatorios', 'Relatórios', 'Atendimentos, receitas, faltas e novos pacientes comparados ao período anterior, com indicadores de gestão.']
];
// [chave, aba, imagem, legenda]
const TELAS = [
  ['painel', 'Painel', 'painel', 'Visão geral do dia: próximo paciente, alertas de segurança, pacientes que precisam de acompanhamento e agenda.'],
  ['agenda', 'Agenda', 'agenda', 'Agenda semanal com a situação de cada horário, horários disponíveis e acesso direto ao atendimento.'],
  ['avaliacao', 'Avaliação', 'avaliacao', 'Registro dos sinais de língua, pulso e sintomas, com Ba Gang e cinco elementos calculados automaticamente.'],
  ['pentagrama', 'Pentagrama', 'pentagrama', 'Ciclos de geração e de controle com os excessos e deficiências identificados na avaliação.'],
  ['mapa', 'Mapa corporal', 'mapa', 'Dor, irradiação e limitação funcional registradas no corpo, com pontos indicados e comparação entre atendimentos.'],
  ['biblioteca', 'Biblioteca', 'biblioteca', 'Pontos, meridianos e conteúdos de consulta, com uma biblioteca particular para cada profissional.'],
  ['documentos', 'Documentos', 'documentos', 'Modelos preenchidos com os dados do paciente, para imprimir, salvar em PDF ou arquivar no prontuário.'],
  ['financeiro', 'Financeiro', 'financeiro', 'Valores a receber, pacotes com sessões utilizadas e despesas do mês.'],
  ['relatorios', 'Relatórios', 'relatorios', 'Desempenho da clínica por mês, por serviço e por forma de pagamento.']
];
// [imagem, sobre, título, texto, itens]
const DESTAQUES = [
  ['avaliacao', 'Atendimento', 'Atendimento estruturado, com liberdade clínica', 'As etapas seguem a ordem do raciocínio clínico. A primeira consulta registra a avaliação basal, e as seguintes mostram a evolução lado a lado.',
    ['Salvamento automático durante o registro', 'Comparação entre a avaliação inicial e a atual', 'Vasos extraordinários e estação do ano como apoio ao plano terapêutico']],
  ['agenda', 'Agenda e WhatsApp', 'Menos faltas, melhor aproveitamento da agenda', 'Horários disponíveis por serviço, confirmação pelo WhatsApp com mensagem padronizada e registro de comparecimento.',
    ['Lembrete da consulta do dia seguinte', 'Remarcações com histórico de origem', 'Pacientes sem retorno há mais de 21 dias em destaque']],
  ['relatorios', 'Gestão', 'Indicadores da clínica, sem planilhas', 'Os relatórios são gerados a partir dos registros do dia a dia, sem preenchimento adicional, e trazem recomendações práticas para a gestão.',
    ['Comparação com o período anterior', 'Receitas por forma de pagamento e pacotes', 'Impressão ou exportação em PDF']]
];
const PERGUNTAS = [
  ['É necessário instalar algum programa?', 'Não. O MUSUBI funciona no navegador do computador, do tablet ou do celular. O acesso é feito com e-mail e senha.'],
  ['O sistema atende outras terapias além da acupuntura?', 'Sim. Agenda, cadastro, documentos, WhatsApp, financeiro e relatórios atendem qualquer especialidade, com os serviços e valores da própria clínica. A avaliação pela Medicina Tradicional Chinesa fica disponível para quem utiliza.'],
  ['É possível usar com uma equipe?', 'Sim. Cada profissional tem o seu próprio acesso, e todos os registros identificam o autor, a data e a hora.'],
  ['O sistema faz diagnóstico?', 'Não. As hipóteses e sugestões apoiam o raciocínio clínico; a decisão é sempre do profissional.'],
  ['O sistema emite nota fiscal?', 'Sim. A nota fiscal de serviço (NFS-e) sai direto do financeiro, pelo padrão nacional da Receita, com o certificado digital da própria clínica e sem intermediário. Cada pacote tem um limite de notas por mês.'],
  ['Quais são as formas de assinatura?', 'Mensal, sem fidelidade; anual com pagamento mensal no cartão, com 15% de desconto e compromisso de 12 meses; ou anual à vista, que equivale a 10 mensalidades. As regras estão no Contrato de assinatura, apresentado na hora de assinar.'],
  ['Como agendar uma demonstração?', 'Preencha o formulário acima com seu nome e WhatsApp. Nossa equipe entrará em contato para apresentar o sistema.']
];

// No site o sistema fica em /sistema (o arquivo spazio.html); no computador (testes), o index.html.
const SISTEMA = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname) ? '../index.html' : '../sistema';
const urlSistema = () => new URL(SISTEMA, location.href).href;
// Quem já entrou neste aparelho vai direto para o sistema (?ver mostra a página mesmo assim).
const temSessao = () => { try { return !!JSON.parse(localStorage.getItem(KEY_SESSAO))?.access_token; } catch (e) { return false; } };
if (temSessao() && !new URLSearchParams(location.search).has('ver')) location.replace(urlSistema());
const nuvem = criarNuvem();
const escHtml = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const img = n => `telas/${n}.png`;
function montar(){
  $('#mods').innerHTML = MODULOS.map(([i, t, d]) => `<article class="mod"><span class="mod-ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('');
  $('#abas').innerHTML = TELAS.map(([k, t], n) => `<button role="tab" id="aba-${k}" aria-controls="tela" aria-selected="${!n}" tabindex="${n ? -1 : 0}" data-a="aba" data-k="${k}">${t}</button>`).join('');
  $('#spots').innerHTML = DESTAQUES.map(([im, s, t, d, L], n) => `<div class="spot ${n % 2 ? 'inv' : ''}"><div class="spot-txt"><span class="sobre">${s}</span><h2>${t}</h2><p>${d}</p><ul class="garantias col">${L.map(x => `<li>${ic('check')}${x}</li>`).join('')}</ul></div>
    <div class="janela"><div class="janela-b"><i></i><i></i><i></i></div><img src="${img(im)}" alt="Tela de ${s.toLowerCase()} do MUSUBI" width="1366" height="860"></div></div>`).join('');
  $('#planos-l').innerHTML = PLANOS.map(p => `<article class="plano ${p.destaque ? 'dest' : ''}">${p.destaque ? '<span class="plano-selo">Recomendado</span>' : ''}<h3>${p.nome}</h3>
    <p class="plano-preco"><b>${precoTxt(p).replace('/mês', '')}</b><small>/mês</small></p><p class="plano-anual">ou R$ ${precoFidelidade(p)}/mês no plano anual</p><p class="muted">${p.resumo}</p>
    <ul class="garantias col">${p.itens.map(x => `<li>${ic('check')}${x}</li>`).join('')}</ul>
    <button class="btn ${p.destaque ? 'ouro' : 'linha'} largo" data-a="plano" data-k="${p.k}">Experimentar ${DIAS_TESTE} dias grátis</button></article>`).join('');
  $('#faq').innerHTML = PERGUNTAS.map(([q, r]) => `<details><summary>${q}${ic('baixo')}</summary><p>${r}</p></details>`).join('');
  mostrarTela('painel');
  pintarIcones();
}
function mostrarTela(k){
  const [, t, im, leg] = TELAS.find(x => x[0] === k);
  document.querySelectorAll('#abas [role=tab]').forEach(b => { const on = b.dataset.k === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $('#tela').setAttribute('aria-labelledby', 'aba-' + k);
  $('#tela').innerHTML = `<div class="janela"><div class="janela-b"><i></i><i></i><i></i><span>${t}</span></div><img src="${img(im)}" alt="Tela ${t} do MUSUBI" width="1366" height="860"></div><p class="legenda">${leg}</p>`;
}

// Tema: segue o aparelho até a pessoa escolher. No escuro entra o logo branco; no claro, o colorido.
const escuro = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function trocarTema(){
  const t = escuro() ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('musubi-tema', t); } catch (e) {}
  avisar(t === 'dark' ? 'Tema escuro' : 'Tema claro');
}

let tt;
function avisar(m){ const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2600); }

// Entrar
let antes = null, modo = 'entrar';
function abrirEntrar(){
  antes = document.activeElement; modo = 'entrar'; modoEntrar();
  $('#m-entrar').hidden = false; document.body.classList.add('travado'); fecharMenu();
  setTimeout(() => $('#f-entrar [name=email]').focus(), 30);
}
function fecharEntrar(){ $('#m-entrar').hidden = true; document.body.classList.remove('travado'); antes?.focus?.(); }
function modoEntrar(){
  const f = $('#f-entrar'); f.classList.remove('esqueci', 'enviado'); $('#e-erro').hidden = true;
  $('#m-entrar-t').textContent = 'Entrar no MUSUBI'; $('#m-entrar-d').textContent = 'Informe o e-mail e a senha da sua conta.';
  $('#e-botao').textContent = 'Entrar'; $('#e-botao').disabled = false;
  $('#m-rodape').innerHTML = 'Ainda não tem conta? <a href="#planos" data-a="fechar">Experimente por 7 dias</a>';
}
function modoEsqueci(){
  modo = 'esqueci'; const f = $('#f-entrar'); f.classList.add('esqueci'); $('#e-erro').hidden = true;
  $('#m-entrar-t').textContent = 'Criar uma nova senha'; $('#m-entrar-d').textContent = 'Informe o seu e-mail para receber o link de criação de uma nova senha.';
  $('#e-botao').textContent = 'Enviar link';
  $('#m-rodape').innerHTML = '<button type="button" class="lnk" data-a="voltar">Voltar para entrar</button>';
  f.email.focus();
}
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
async function enviarEntrar(e){
  e.preventDefault(); const f = e.target, erro = $('#e-erro');
  const msg = !emailOk(f.email.value) ? 'Verifique o e-mail informado.' : modo === 'entrar' && !f.senha.value ? 'Informe a sua senha.' : '';
  erro.textContent = msg; erro.hidden = !msg;
  if (msg) { (msg.includes('e-mail') ? f.email : f.senha).focus(); return; }
  const b = $('#e-botao'), txt = b.textContent; b.disabled = true; b.textContent = modo === 'esqueci' ? 'Enviando…' : 'Entrando…';
  try {
    if (modo === 'esqueci') {
      await nuvem.esqueci(f.email.value, urlSistema());
      f.classList.add('enviado'); $('#m-entrar-t').textContent = 'Verifique o seu e-mail';
      $('#m-entrar-d').textContent = `Se ${f.email.value.trim()} tiver uma conta, você receberá o link para criar uma nova senha em alguns minutos. Verifique também a caixa de spam.`;
      b.disabled = false; b.textContent = txt; return;
    }
    await nuvem.entrar(f.email.value, f.senha.value);
    try { localStorage.setItem('musubi-modo', 'nuvem'); } catch (er) {}
    location.href = urlSistema();
  } catch (er) {
    erro.textContent = er.message; erro.hidden = false; b.disabled = false; b.textContent = txt;
  }
}

// Contato
async function enviarContato(e){
  e.preventDefault(); const f = e.target, erro = $('#f-erro');
  const dig = f.whats.value.replace(/\D/g, '');
  const msg = !f.nome.value.trim() ? 'Informe o seu nome.' : dig.length < 10 || dig.length > 13 ? 'Informe o WhatsApp com DDD.' : '';
  erro.textContent = msg; erro.hidden = !msg;
  if (msg) { (msg.includes('nome') ? f.nome : f.whats).focus(); return; }
  const b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
  try { await nuvem.pedirContato(f.nome.value.slice(0, 120), f.whats.value.slice(0, 30)); }
  catch (er) { erro.textContent = er.codigo === 'offline' ? 'Sem conexão. Verifique a internet e tente novamente.' : 'Não foi possível enviar agora. Tente novamente em instantes.'; erro.hidden = false; b.disabled = false; b.textContent = 'Solicitar demonstração'; return; }
  f.innerHTML = `<div class="enviado-ok">${ic('okc')}<b>Obrigado, ${escHtml(f.nome.value.trim().split(' ')[0])}!</b><p>Solicitação recebida. Nossa equipe entrará em contato pelo WhatsApp em breve.</p></div>`;
}

// Menu do celular
function fecharMenu(){ document.body.classList.remove('menu-aberto'); $('[data-a=menu]')?.setAttribute('aria-expanded', 'false'); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) { if (e.target.closest('.menu a')) fecharMenu(); return; }
  const a = t.dataset.a;
  if (a === 'entrar') abrirEntrar();
  else if (a === 'fechar') fecharEntrar();
  else if (a === 'tema') trocarTema();
  else if (a === 'aba') mostrarTela(t.dataset.k);
  else if (a === 'plano') { try { localStorage.setItem('musubi-plano-site', t.dataset.k); localStorage.setItem('musubi-modo', 'nuvem'); } catch (er) {} location.href = urlSistema() + '#criar'; }
  else if (a === 'esqueci') modoEsqueci();
  else if (a === 'voltar') { modo = 'entrar'; modoEntrar(); $('#f-entrar').email.focus(); }
  else if (a === 'ver-senha') { const s = $('#f-entrar').senha, v = s.type === 'password'; s.type = v ? 'text' : 'password'; t.textContent = v ? 'Ocultar' : 'Mostrar'; t.setAttribute('aria-pressed', v); }
  else if (a === 'menu') { const ab = document.body.classList.toggle('menu-aberto'); t.setAttribute('aria-expanded', ab); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#m-entrar').hidden) fecharEntrar(); else fecharMenu(); }
  if (e.key === 'Tab' && !$('#m-entrar').hidden) {
    const F = [...$('#m-entrar').querySelectorAll('input,button:not([disabled]),a[href]')].filter(x => x.offsetParent);
    if (e.shiftKey && document.activeElement === F[0]) { e.preventDefault(); F.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === F.at(-1)) { e.preventDefault(); F[0].focus(); }
  }
  const tab = e.target.closest?.('#abas [role=tab]');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const B = [...document.querySelectorAll('#abas [role=tab]')], i = (B.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + B.length) % B.length;
    mostrarTela(B[i].dataset.k); B[i].focus();
  }
});
$('#f-entrar').addEventListener('submit', enviarEntrar);
$('#f-contato').addEventListener('submit', enviarContato);
addEventListener('scroll', () => $('#topo').classList.toggle('rolou', scrollY > 8), { passive: true });

montar();
if (location.hash === '#entrar') abrirEntrar();
