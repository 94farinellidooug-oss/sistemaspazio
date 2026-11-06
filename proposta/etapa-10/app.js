// Prévia da página de apresentação do MUSUBI (etapa 10): página comercial com o acesso de quem já usa.
// Nada é enviado: o formulário de contato e o "Entrar" só simulam o que vai acontecer.
import { ICONES } from '../icones.js';

const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n] || ''}</svg>`;
const $ = s => document.querySelector(s);
const pintarIcones = (raiz = document) => raiz.querySelectorAll('[data-i]').forEach(e => { e.outerHTML = ic(e.dataset.i); });

// [ícone, título, texto]
const MODULOS = [
  ['agenda', 'Agenda', 'A semana em um olhar, horários livres na hora, confirmar, remarcar e desmarcar sem perder o histórico.'],
  ['pacientes', 'Pacientes e prontuário', 'Cadastro com o mínimo de campos, alertas de segurança e todos os atendimentos do paciente em ordem.'],
  ['plano', 'Atendimento guiado', 'Anamnese, avaliação, síntese, mapa corporal, plano, evolução e documentos, uma etapa de cada vez.'],
  ['yin', 'Avaliação pela MTC', 'Língua, pulso e sinais organizados em Ba Gang e nos cinco elementos, com o Pentagrama atualizando sozinho.'],
  ['corpo', 'Mapa corporal e pontos', 'Marque dor e sintomas no corpo, veja os pontos do plano e consulte a biblioteca de pontos com a referência.'],
  ['assinatura', 'Documentos com assinatura', 'Orientações, atestados e termos a partir de modelos seus, assinados com o dedo na tela.'],
  ['tel', 'WhatsApp', 'Lembrete da consulta e mensagens prontas que você edita, enviadas pelo seu WhatsApp em um toque.'],
  ['financeiro', 'Financeiro', 'Receba com a forma de pagamento, aceite pagamento parcial, venda pacotes e lance despesas que se repetem.'],
  ['relatorios', 'Relatórios', 'Atendimentos, recebido, faltas e pacientes novos, comparados ao período anterior, com dicas do que fazer.']
];
// [chave, aba, imagem, legenda]
const TELAS = [
  ['painel', 'Painel', 'painel', 'O dia em uma tela: próximo paciente, alertas de segurança, quem precisa de acompanhamento e a agenda.'],
  ['agenda', 'Agenda', 'agenda', 'Semana, situação de cada horário ao lado, horários livres e o botão Atender.'],
  ['avaliacao', 'Avaliação', 'avaliacao', 'Toque nos sinais de língua, pulso e sintomas; o Ba Gang e os cinco elementos se posicionam sozinhos.'],
  ['pentagrama', 'Pentagrama', 'pentagrama', 'Ciclos de geração e de controle com o excesso e a deficiência da avaliação do paciente.'],
  ['mapa', 'Mapa corporal', 'mapa', 'Dor, irradiação e limitação marcadas no corpo, os pontos do plano e a comparação entre atendimentos.'],
  ['biblioteca', 'Biblioteca', 'biblioteca', 'Pontos, meridianos e conteúdos de consulta, com a sua biblioteca particular ao lado.'],
  ['documentos', 'Documentos', 'documentos', 'Modelos com os dados do paciente, para imprimir, salvar em PDF ou guardar no prontuário.'],
  ['financeiro', 'Financeiro', 'financeiro', 'O que falta receber, pacotes com as sessões usadas e as despesas do mês.'],
  ['relatorios', 'Relatórios', 'relatorios', 'Como a clínica está indo, por mês, por serviço e por forma de pagamento.']
];
// [imagem, sobre, título, texto, itens]
const DESTAQUES = [
  ['avaliacao', 'Atendimento', 'Um atendimento que guia, sem engessar', 'As etapas seguem a ordem do raciocínio clínico. A primeira consulta vira a avaliação basal, e as seguintes mostram, lado a lado, o que mudou.',
    ['Salva sozinho enquanto você escreve', 'Comparação da primeira consulta com a atual', 'Vasos extraordinários e estação do ano como dicas no plano']],
  ['agenda', 'Agenda e WhatsApp', 'Menos faltas, mais horários ocupados', 'Veja os horários livres de cada serviço, confirme pelo WhatsApp com a mensagem pronta e marque quem foi atendido ou faltou.',
    ['Lembrete do dia seguinte em um toque', 'Remarcar guarda de onde veio', 'Quem está sem vir há mais de 21 dias aparece para você chamar']],
  ['relatorios', 'Gestão', 'Saiba como a clínica está indo, sem planilha', 'Os relatórios saem do que você já registra: nada para preencher a mais. No final, dicas práticas para recuperar e aumentar o faturamento.',
    ['Comparação com o período anterior', 'Recebido por forma de pagamento e pacotes', 'Imprimir ou salvar em PDF']]
];
const PERGUNTAS = [
  ['Preciso instalar alguma coisa?', 'Não. O MUSUBI abre no navegador do computador, do tablet ou do celular. É só entrar com o seu e-mail e senha.'],
  ['Serve para outras terapias além da acupuntura?', 'Sim. Agenda, cadastro, documentos, WhatsApp, financeiro e relatórios servem para qualquer atendimento, e os serviços e preços são os da sua clínica. A avaliação pela Medicina Tradicional Chinesa fica à disposição de quem usa.'],
  ['Posso usar com a minha equipe?', 'Sim. Cada profissional entra com o próprio acesso, e cada registro mostra quem fez e quando.'],
  ['O sistema faz diagnóstico?', 'Não. As hipóteses e sugestões ajudam o raciocínio clínico, e a decisão é sempre do profissional.'],
  ['Emite nota fiscal?', 'O financeiro já organiza os dados da nota de cada atendimento. A emissão da nota de serviço pelo sistema, na cidade de cada clínica, está nos próximos passos.'],
  ['Como faço para conhecer?', 'Deixe seu nome e WhatsApp no formulário acima. A gente chama você para mostrar o sistema na prática.']
];

const img = n => `telas/${n}.png`;
function montar(){
  $('#mods').innerHTML = MODULOS.map(([i, t, d]) => `<article class="mod"><span class="mod-ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('');
  $('#abas').innerHTML = TELAS.map(([k, t], n) => `<button role="tab" id="aba-${k}" aria-controls="tela" aria-selected="${!n}" tabindex="${n ? -1 : 0}" data-a="aba" data-k="${k}">${t}</button>`).join('');
  $('#spots').innerHTML = DESTAQUES.map(([im, s, t, d, L], n) => `<div class="spot ${n % 2 ? 'inv' : ''}"><div class="spot-txt"><span class="sobre">${s}</span><h2>${t}</h2><p>${d}</p><ul class="garantias col">${L.map(x => `<li>${ic('check')}${x}</li>`).join('')}</ul></div>
    <div class="janela"><div class="janela-b"><i></i><i></i><i></i></div><img src="${img(im)}" alt="Tela de ${s.toLowerCase()} do MUSUBI" width="1366" height="860"></div></div>`).join('');
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
  try { localStorage.setItem('musubi-site-tema', t); } catch (e) {}
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
  $('#m-entrar-t').textContent = 'Entrar no MUSUBI'; $('#m-entrar-d').textContent = 'Use o e-mail e a senha da sua conta.';
  $('#e-botao').textContent = 'Entrar'; $('#e-botao').disabled = false;
  $('#m-rodape').innerHTML = 'Ainda não usa? <a href="#contato" data-a="fechar">Conheça o MUSUBI</a>';
}
function modoEsqueci(){
  modo = 'esqueci'; const f = $('#f-entrar'); f.classList.add('esqueci'); $('#e-erro').hidden = true;
  $('#m-entrar-t').textContent = 'Criar uma nova senha'; $('#m-entrar-d').textContent = 'Informe o seu e-mail. Mandamos um link para você criar uma nova senha.';
  $('#e-botao').textContent = 'Enviar link';
  $('#m-rodape').innerHTML = '<button type="button" class="lnk" data-a="voltar">Voltar para entrar</button>';
  f.email.focus();
}
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
function enviarEntrar(e){
  e.preventDefault(); const f = e.target, erro = $('#e-erro');
  const msg = !emailOk(f.email.value) ? 'Confira o e-mail.' : modo === 'entrar' && !f.senha.value ? 'Digite a sua senha.' : '';
  erro.textContent = msg; erro.hidden = !msg;
  if (msg) { (msg.includes('e-mail') ? f.email : f.senha).focus(); return; }
  if (modo === 'esqueci') {
    f.classList.add('enviado'); $('#m-entrar-t').textContent = 'Confira o seu e-mail';
    $('#m-entrar-d').textContent = `Se ${f.email.value.trim()} tiver uma conta, o link para criar a nova senha chega em alguns minutos. (Prévia: nada foi enviado.)`;
    return;
  }
  $('#e-botao').disabled = true; $('#e-botao').textContent = 'Entrando…';
  // Na prévia não há conta: abre o sistema como ele está hoje.
  setTimeout(() => { location.href = '../../index.html'; }, 500);
}

// Contato
function enviarContato(e){
  e.preventDefault(); const f = e.target, erro = $('#f-erro');
  const dig = f.whats.value.replace(/\D/g, '');
  const msg = !f.nome.value.trim() ? 'Escreva o seu nome.' : dig.length < 10 || dig.length > 13 ? 'Confira o WhatsApp, com o DDD.' : '';
  erro.textContent = msg; erro.hidden = !msg;
  if (msg) { (msg.includes('nome') ? f.nome : f.whats).focus(); return; }
  f.innerHTML = `<div class="enviado-ok">${ic('okc')}<b>Obrigado, ${f.nome.value.trim().split(' ')[0].replace(/[<>&"]/g, '')}!</b><p>Vamos chamar você no WhatsApp para mostrar o MUSUBI.</p><small class="muted">Prévia: nada foi enviado.</small></div>`;
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
