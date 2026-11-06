// Etapa 10: Configurações (proposta aprovada pelo Maicon em 06/11/2026, proposta/etapa-10/sistema.html#/configuracoes).
// Abas: Clínica, Serviços e preços, Horário de atendimento, Sua conta e segurança. Só o administrador
// vê as três primeiras; os outros perfis veem só a própria conta.
// Serviços e horário salvam a cada mudança; dados da clínica e da conta, no botão Salvar.
import { ic } from '../componentes/icones.js';
import { db } from '../dados/repositorio.js';
import { DIAS_SEMANA, DURACOES, UFS, configDe, resumoHorario, salvarClinica, salvarHorario, salvarServicos } from '../dados/config.js';
import { clinicaNoServidor, contaAtual, situacaoConta, mudarEmailConta, sairDosOutrosConta, salvarNomeConta, trocarSenhaConta } from './conta.js';
import { esc } from '../util.js';
import { PLANOS, precoTxt } from '../dados/planos.js';

const cf = { aba:'clinica', senha:false, ocupado:false };
let cfApp = { save:() => {}, render:() => {}, toast:() => {} };
const ABAS_CF = [['clinica', 'Clínica', 'local'], ['servicos', 'Serviços e preços', 'dinheiro'], ['horario', 'Horário de atendimento', 'relogio'], ['conta', 'Sua conta e segurança', 'escudo']];
const valorTxt = v => String(v).replace('.', ',');
const lerNum = t => Number(String(t).replace(/\./g, '').replace(',', '.')) || 0;

export function vConfiguracoes(){
  const C = contaAtual(), abas = C.perfil === 'adm' ? ABAS_CF : ABAS_CF.filter(a => a[0] === 'conta');
  if (!abas.some(a => a[0] === cf.aba)) cf.aba = abas[0][0];
  return `<div class="head"><div><h1>Configurações</h1><p>${esc(configDe(db).clinica.nome)}</p></div></div>
  <div class="tabs" role="tablist">${abas.map(([k, l, i]) => `<button role="tab" data-cf="aba" data-k="${k}" class="${cf.aba === k ? 'on' : ''}" aria-selected="${cf.aba === k}">${ic(i)}${l}</button>`).join('')}</div>` +
  ({ clinica:cfClinica, servicos:cfServicos, horario:cfHorario, conta:cfConta })[cf.aba]();
}

function cfClinica(){
  const D = configDe(db).clinica;
  return `<form class="card cf-max" id="cf-clinica" novalidate><div class="card-h"><h2>Dados da clínica<small>aparecem nos documentos impressos, nos relatórios e nas mensagens</small></h2></div>
    <div class="form">
      <label class="field full"><span class="lbl">Nome da clínica</span><input name="nome" value="${esc(D.nome)}" required></label>
      <label class="field"><span class="lbl">Cidade</span><input name="cidade" value="${esc(D.cidade)}" required></label>
      <label class="field"><span class="lbl">Estado</span><select name="uf">${UFS.map(u => `<option ${u === D.uf ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">WhatsApp da clínica</span><input name="whats" type="tel" value="${esc(D.whats)}" placeholder="(54) 99999-0000"></label>
    </div>
    <details class="cf-mais" ${D.end || D.doc ? 'open' : ''}><summary>Mais dados (opcional)</summary><div class="form">
      <label class="field full"><span class="lbl">Endereço</span><input name="end" value="${esc(D.end)}" placeholder="Rua, número, bairro"></label>
      <label class="field"><span class="lbl">CNPJ ou CPF</span><input name="doc" value="${esc(D.doc)}" inputmode="numeric" placeholder="Usado na nota fiscal, mais tarde"></label></div></details>
    <p class="muted sm">A cidade e o estado definem, mais tarde, a prefeitura da nota fiscal.</p>
    <p class="erro-c" id="cf-cl-erro" hidden></p>
    <div class="cf-acoes"><button class="btn pri" type="submit" ${cf.ocupado ? 'disabled' : ''}>${ic('check')}Salvar</button></div></form>`;
}

function cfServicos(){
  const L = configDe(db).servicos;
  return `<div class="card cf-max" id="cf-serv"><div class="card-h"><h2>Serviços e preços<small>aparecem na Agenda, no Financeiro e nos Relatórios</small></h2></div>
    <div class="cf-serv"><div class="cf-s cf-sh" aria-hidden="true"><span>Serviço</span><span>Duração</span><span>Valor (R$)</span><span></span></div>${L.map((s, i) => `<div class="cf-s ${s.ativo ? '' : 'off'}" data-i="${i}">
      <label class="field cf-sn"><span class="lbl">Serviço</span><input data-cf="serv" data-k="nome" data-i="${i}" value="${esc(s.nome)}"></label>
      <label class="field"><span class="lbl">Duração</span><select data-cf="serv" data-k="dur" data-i="${i}">${[...new Set([...DURACOES, s.dur])].sort((a, b) => a - b).map(m => `<option value="${m}" ${s.dur === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Valor (R$)</span><input data-cf="serv" data-k="valor" data-i="${i}" inputmode="decimal" value="${valorTxt(s.valor)}"></label>
      <label class="cf-sw"><input type="checkbox" data-cf="serv" data-k="ativo" data-i="${i}" ${s.ativo ? 'checked' : ''}> Em uso</label></div>`).join('')}</div>
    <div class="cf-acoes"><button class="btn" data-cf="serv-novo">${ic('mais')}Novo serviço</button></div>
    <p class="muted sm">Serviço fora de uso some da Agenda, mas continua nos atendimentos que já foram feitos. Mudar o preço não muda o que já foi combinado.</p></div>`;
}

function cfHorario(){
  const H = configDe(db).horario, P = H.pausa;
  return `<div class="card cf-max" id="cf-hor"><div class="card-h"><h2>Horário de atendimento<small>a Agenda mostra os horários livres dentro dele</small></h2></div>
    <div class="cf-hor">${H.dias.map((h, i) => `<div class="cf-h ${h.aberto ? '' : 'off'}"><label class="cf-sw"><input type="checkbox" data-cf="dia" data-i="${i}" ${h.aberto ? 'checked' : ''}> ${DIAS_SEMANA[i]}</label>
      ${h.aberto ? `<span class="cf-hh"><input type="time" data-cf="hora" data-i="${i}" data-k="ini" value="${h.ini}" aria-label="${DIAS_SEMANA[i]}: abre"><span class="muted">às</span><input type="time" data-cf="hora" data-i="${i}" data-k="fim" value="${h.fim}" aria-label="${DIAS_SEMANA[i]}: fecha"></span>` : '<span class="muted sm">fechado</span>'}</div>`).join('')}</div>
    <div class="cf-h cf-pausa"><label class="cf-sw"><input type="checkbox" data-cf="pausa" ${P.tem ? 'checked' : ''}> Intervalo</label>
      ${P.tem ? `<span class="cf-hh"><input type="time" data-cf="pausa-h" data-k="ini" value="${P.ini}" aria-label="Intervalo começa"><span class="muted">às</span><input type="time" data-cf="pausa-h" data-k="fim" value="${P.fim}" aria-label="Intervalo termina"></span>` : '<span class="muted sm">sem intervalo</span>'}</div>
    <p class="muted sm" id="cf-hor-resumo">${resumoHorario(H)}</p></div>`;
}

function cfConta(){
  const C = contaAtual();
  const seg = `<div class="card" id="cf-seg"><div class="card-h"><h2>Segurança e dados</h2></div><div class="list">
      ${C.nuvem ? `<div class="row"><span class="tico sm acc">${ic('escudo')}</span><div class="grow"><b>Dados guardados no servidor</b><small class="muted">Cada clínica só enxerga os próprios dados.</small></div></div>
      <div class="row"><span class="tico sm acc">${ic('historico')}</span><div class="grow"><b>Outros aparelhos</b><small class="muted">Esqueceu a conta aberta em outro celular ou computador?</small></div><button class="btn sm" data-cf="sair-outros" ${cf.ocupado ? 'disabled' : ''}>Sair dos outros</button></div>`
      : `<div class="row"><span class="tico sm acc">${ic('info')}</span><div class="grow"><b>Dados só neste aparelho</b><small class="muted">Sem conta, nada vai para o servidor. Exporte uma cópia com frequência.</small></div></div>`}
      <div class="row"><span class="tico sm acc">${ic('baixar')}</span><div class="grow"><b>Baixar todos os dados</b><small class="muted">Pacientes, atendimentos e financeiro em um arquivo, quando quiser.</small></div><button class="btn sm" data-act="exportar" data-f="v2">Baixar</button></div>
    </div></div>`;
  if (!C.nuvem) return `<div class="grid cf-g"><div class="card" id="cf-conta"><div class="card-h"><h2>Sua conta</h2></div>
      <p class="muted sm">Você está usando o MUSUBI sem conta, só neste aparelho. Com uma conta, os dados ficam guardados no servidor e abrem em qualquer aparelho.</p>
      <div class="cf-acoes"><button class="btn pri" data-act="conta-entrar">${ic('sair')}Entrar na sua conta</button></div></div>${seg}</div>`;
  return `<div class="grid cf-g">
    <form class="card" id="cf-conta" novalidate><div class="card-h"><h2>Sua conta<small>vale para todas as clínicas em que você atende</small></h2></div>
      <div class="form"><label class="field full"><span class="lbl">Seu nome (sai nos registros e documentos)</span><input name="nome" value="${esc(C.nome)}" autocomplete="name"></label>
      <label class="field full"><span class="lbl">E-mail para entrar</span><input name="email" type="email" value="${esc(C.email)}" autocomplete="email"></label></div>
      <div class="form cf-senha" ${cf.senha ? '' : 'hidden'}><label class="field full"><span class="lbl">Nova senha</span><input name="senha" type="password" minlength="8" autocomplete="new-password" placeholder="Pelo menos 8 caracteres"></label></div>
      <p class="erro-c" id="cf-ct-erro" hidden></p>
      <div class="cf-acoes"><button class="btn pri" type="submit" ${cf.ocupado ? 'disabled' : ''}>${ic('check')}Salvar</button><button class="btn" type="button" data-cf="senha" ${cf.senha ? 'hidden' : ''}>${ic('escudo')}Trocar senha</button></div>
      <p class="muted sm cf-obs">Entrou como <b>${esc({ adm:'Administrador', prof:'Profissional', rec:'Recepção' }[C.perfil] || '')}</b>${C.clinica ? ` em ${esc(C.clinica)}` : ''}.</p></form>
    ${seg}${cfPacote()}</div>`;
}
// Pacote da clínica: qual é, quanto tempo falta e o que cada pacote tem.
function cfPacote(){
  const S = situacaoConta(); if (!S) return '';
  return `<div class="card" id="cf-pacote"><div class="card-h"><h2>Seu pacote<small>${esc(S.rotulo)}</small></h2><span class="pill ${S.tipo === 'vencido' ? 'warn' : 'acc'}">${esc(S.plano.nome)}</span></div>
    <div class="cf-planos">${PLANOS.map(p => `<div class="cf-plano ${p.k === S.plano.k ? 'on' : ''}"><b>${p.nome}</b><small class="muted">${precoTxt(p)}</small><ul>${p.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>
    <p class="muted sm cf-obs">${S.tipo === 'teste' ? 'Durante o teste você usa tudo o que o pacote tem. ' : ''}O pagamento pelo site (Pix, boleto e cartão) entra em breve; para trocar de pacote, fale com o MUSUBI.</p></div>`;
}

/* ---------- Eventos ---------- */
const erroCf = (id, m) => { const e = document.getElementById(id); if (e) { e.textContent = m; e.hidden = !m; } return !!m; };
const okEmailCf = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
function mudarServ(t){
  const L = configDe(db).servicos, i = +t.dataset.i, k = t.dataset.k;
  L[i][k] = k === 'ativo' ? t.checked : k === 'dur' ? +t.value : k === 'valor' ? lerNum(t.value) : t.value;
  const e = salvarServicos(db, L);
  if (e) { cfApp.toast(e, 'info'); cfApp.render(true); return; }
  cfApp.save(); cfApp.render(true); cfApp.toast(k === 'ativo' ? (t.checked ? 'Serviço de volta à Agenda' : 'Serviço fora de uso') : 'Serviço salvo');
}
function mudarHor(t){
  const H = configDe(db).horario, a = t.dataset.cf, i = +t.dataset.i;
  if (a === 'dia') H.dias[i].aberto = t.checked;
  else if (a === 'hora') H.dias[i][t.dataset.k] = t.value;
  else if (a === 'pausa') H.pausa.tem = t.checked;
  else if (a === 'pausa-h') H.pausa[t.dataset.k] = t.value;
  const e = salvarHorario(db, H);
  if (e) { cfApp.toast(e, 'info'); cfApp.render(true); return; }
  cfApp.save(); cfApp.render(true); cfApp.toast('Horário salvo');
}
async function enviarClinica(f){
  const D = Object.fromEntries(['nome', 'cidade', 'uf', 'whats', 'end', 'doc'].map(k => [k, f.elements[k]?.value || '']));
  const e = salvarClinica(db, D); if (erroCf('cf-cl-erro', e)) return;
  cfApp.save(); cf.ocupado = true; cfApp.render(true);
  const C = configDe(db).clinica, eS = await clinicaNoServidor({ nome:C.nome, cidade:C.cidade, uf:C.uf, whats:C.whats });
  cf.ocupado = false; cfApp.render(true);
  cfApp.toast(eS ? 'Salvo neste aparelho e nos dados da clínica; o cadastro no servidor não atualizou: ' + eS : 'Dados da clínica salvos', eS ? 'info' : 'ok');
}
async function enviarConta(f){
  const C = contaAtual(), nome = f.elements.nome.value.trim(), email = f.elements.email.value.trim(), senha = f.elements.senha?.value || '';
  if (!nome) { erroCf('cf-ct-erro', 'Escreva o seu nome.'); return; }
  if (!okEmailCf(email)) { erroCf('cf-ct-erro', 'Confira o e-mail.'); return; }
  if (cf.senha && senha.length < 8) { erroCf('cf-ct-erro', 'A senha precisa de pelo menos 8 caracteres.'); return; }
  const mudaNome = nome !== C.nome, mudaEmail = email.toLowerCase() !== C.email.toLowerCase();
  if (!mudaNome && !mudaEmail && !cf.senha) { cfApp.toast('Nada mudou', 'info'); return; }
  cf.ocupado = true; cfApp.render(true);
  const msgs = [];
  let e = mudaNome ? await salvarNomeConta(nome) : '';
  if (!e && mudaNome) msgs.push('nome salvo');
  if (!e && cf.senha) { e = await trocarSenhaConta(senha); if (!e) { msgs.push('senha trocada'); cf.senha = false; } }
  if (!e && mudaEmail) { e = await mudarEmailConta(email); if (!e) msgs.push(`mandamos um link para ${email}; o e-mail muda quando você abrir o link`); }
  cf.ocupado = false; cfApp.render(true);
  if (e) { erroCf('cf-ct-erro', e); return; }
  const m = msgs.join('; '); cfApp.toast(m[0].toUpperCase() + m.slice(1));
}

// Liga os eventos das Configurações (s, r, t = save, render e toast do sistema).
export function ligarConfig(s, r, t){
  cfApp = { save:s, render:r, toast:t };
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-cf]'); if (!b || b.matches('input, select')) return; const a = b.dataset.cf;
    if (a === 'ir') { cf.aba = b.dataset.k; cf.senha = false; if (location.hash === '#configuracoes') cfApp.render(); }
    else if (a === 'aba') { cf.aba = b.dataset.k; cf.senha = false; cfApp.render(true); }
    else if (a === 'serv-novo') { const L = configDe(db).servicos; let n = 'Novo serviço', k = 2; while (L.some(s => s.nome === n)) n = 'Novo serviço ' + k++;
      L.push({ nome:n, dur:60, valor:0, ativo:true }); salvarServicos(db, L); cfApp.save(); cfApp.render(true);
      const i = document.querySelector(`#cf-serv [data-k="nome"][data-i="${L.length - 1}"]`); if (i) { i.focus(); i.select(); } }
    else if (a === 'senha') { cf.senha = true; b.hidden = true; const c = document.querySelector('#cf-conta .cf-senha'); if (c) { c.hidden = false; c.querySelector('input').focus(); } }
    else if (a === 'sair-outros') { cf.ocupado = true; cfApp.render(true); const e = await sairDosOutrosConta(); cf.ocupado = false; cfApp.render(true); cfApp.toast(e || 'Os outros aparelhos vão pedir para entrar de novo', e ? 'info' : 'ok'); }
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (!t.dataset?.cf) return;
    if (t.dataset.cf === 'serv') mudarServ(t); else if (['dia', 'hora', 'pausa', 'pausa-h'].includes(t.dataset.cf)) mudarHor(t);
  });
  document.addEventListener('submit', ev => {
    const f = ev.target; if (f.id !== 'cf-clinica' && f.id !== 'cf-conta') return;
    ev.preventDefault(); if (cf.ocupado) return;
    if (f.id === 'cf-clinica') enviarClinica(f); else enviarConta(f);
  });
}
