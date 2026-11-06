// Tela Equipe e permissões (etapa 10, proposta aprovada nos PRs #43/#44): quem usa o sistema na clínica, convite
// pelo e-mail (com link para mandar pelo WhatsApp ou copiar), perfil, tirar e devolver o acesso (nada é apagado)
// e o que cada perfil abre. Limite por pacote: Essencial e Profissional com 1 profissional e até 2 na recepção.
import { ic, vazio } from '../componentes/icones.js';
import { PERFIS, PERMISSOES, cabeNaEquipe, mudouDoPadrao, perfilNome, permite } from '../dados/equipe.js';
import { conta, situacaoConta, souAdm } from './conta.js';
import { esc, initials } from '../util.js';

const eq = { lista:null, convites:null, erro:'', carregando:false, convite:false, ocupado:false, aviso:null };
let eqApp = { render:() => {}, toast:() => {} };
const linkConvite = email => `${location.origin}${location.pathname}?convite=${encodeURIComponent(email)}`;
const textoConvite = c => `Olá${c.nome ? ', ' + c.nome.split(' ')[0] : ''}! Você foi convidado(a) para usar o MUSUBI na ${conta.clinica?.nome || 'clínica'}. Crie a sua conta com o e-mail ${c.email} por este link: ${linkConvite(c.email)}`;
const planoK = () => situacaoConta()?.plano.k || 'profissional';
const regraPacote = k => k === 'clinica' ? 'Pacote Clínica: equipe sem limite.' : `Pacote ${k === 'essencial' ? 'Essencial' : 'Profissional'}: 1 profissional (você) e até 2 pessoas na recepção. No pacote Clínica a equipe não tem limite.`;

async function carregarEq(){
  if (conta.modo !== 'nuvem' || !conta.clinica?.id) return;
  eq.carregando = true; eq.erro = '';
  try { [eq.lista, eq.convites] = await Promise.all([conta.nuvem.equipe(conta.clinica.id), souAdm() ? conta.nuvem.convites(conta.clinica.id) : Promise.resolve([])]); }
  catch (e) { eq.erro = e.message; }
  eq.carregando = false; eqApp.render(true);
}

export function vEquipe(){
  if (conta.modo !== 'nuvem') return `<div class="head"><div><h1>Equipe e permissões</h1></div></div>${vazio('pacientes', 'Equipe só com conta no servidor', 'Neste aparelho o sistema funciona sem conta, para uma pessoa. Com a conta no servidor, cada pessoa da equipe entra com o próprio e-mail.')}`;
  if (!eq.lista && !eq.carregando && !eq.erro) carregarEq();
  const adm = souAdm(), L = eq.lista || [], C = eq.convites || [], eu = conta.nuvem?.sessao()?.user?.id, perm = conta.clinica?.permissoes || {}, k = planoK();
  const semTabela = eq.convites === null && eq.lista;
  const cabe = p => cabeNaEquipe(k, L, C, p);
  const ativos = L.filter(m => m.ativo).length;
  return `<div class="head"><div><h1>Equipe e permissões</h1><p>${ativos} pessoa${ativos === 1 ? '' : 's'} com acesso em ${esc(conta.clinica?.nome || '')}</p></div>
    ${adm && !semTabela ? `<button class="btn pri" data-eq="convidar" ${eq.convite ? 'disabled' : ''}>${ic('mais')}Convidar pessoa</button>` : ''}</div>
  ${eq.erro ? `<div class="notice">${ic('alerta')}<div>${esc(eq.erro)} <button class="btn sm ghost" data-eq="recarregar">Tentar de novo</button></div></div>` : ''}
  ${semTabela && adm ? `<div class="notice">${ic('info')}<div>Para convidar pessoas, rode uma vez o arquivo <b>supabase/004_equipe.sql</b> no SQL Editor do Supabase.</div></div>` : ''}
  <div class="grid eq-g">
    <div class="card" id="eq-l"><div class="card-h"><h2>Quem usa o sistema<small>cada pessoa entra com o próprio e-mail e senha</small></h2></div>
      ${eq.aviso ? `<div class="eq-aviso" id="eq-aviso"><b>${ic('okc')} Convite criado para ${esc(eq.aviso.email)}</b>
        <p class="muted sm">Mande o link para a pessoa. Ela cria a conta com esse e-mail e, depois de confirmar o e-mail, já entra na clínica.</p>
        <div class="eq-link"><input readonly value="${esc(linkConvite(eq.aviso.email))}" aria-label="Link do convite"></div>
        <div class="chips"><a class="btn sm wa" href="https://wa.me/?text=${encodeURIComponent(textoConvite(eq.aviso))}" target="_blank" rel="noopener">${ic('mensagem')}Enviar pelo WhatsApp</a><button class="btn sm" data-eq="copiar">${ic('doc')}Copiar convite</button><button class="btn sm ghost" data-eq="aviso-fechar">Fechar</button></div></div>` : ''}
      ${eq.convite ? `<form class="eq-conv" id="eq-conv" novalidate><div class="form">
        <label class="field"><span class="lbl">Nome</span><input name="nome" required autocomplete="off"></label>
        <label class="field"><span class="lbl">E-mail</span><input name="email" type="email" required autocomplete="off"></label>
        <label class="field"><span class="lbl">Perfil</span><select name="perfil">${PERFIS.filter(([p]) => p !== 'adm').map(([p, n]) => `<option value="${p}" ${!cabe(p) ? 'disabled' : ''} ${p === (cabe('prof') ? 'prof' : 'rec') ? 'selected' : ''}>${n}${!cabe(p) ? ' (não cabe no pacote)' : ''}</option>`).join('')}</select></label></div>
        <p class="erro-c" id="eq-erro" ${eq.erroConv ? '' : 'hidden'}>${esc(eq.erroConv || '')}</p>
        <div class="cf-acoes"><button class="btn pri" type="submit" ${eq.ocupado ? 'disabled' : ''}>${ic('mail')}${eq.ocupado ? 'Criando…' : 'Criar convite'}</button><button class="btn ghost" type="button" data-eq="conv-fechar">Cancelar</button></div>
        <small class="muted">${esc(regraPacote(k))}</small></form>` : ''}
      ${eq.carregando && !eq.lista ? `<p class="muted sm">${ic('carregando')} Carregando a equipe…</p>` : ''}
      <div class="list">${L.map(m => { const voce = m.user_id === eu; return `<div class="row eq-u ${m.ativo ? '' : 'off'}" data-u="${m.user_id}"><span class="avatar">${esc(initials(m.nome || m.email))}</span>
        <div class="grow"><b>${esc(m.nome || m.email)}${voce ? ' <span class="muted sm">(você)</span>' : ''}</b><small class="muted trunc">${esc(m.email)}</small></div>
        <div class="eq-ctl">${m.ativo ? '' : '<span class="pill">sem acesso</span>'}
          ${adm && !voce ? `<label><span class="so-leitor">Perfil de ${esc(m.nome || m.email)}</span><select data-eq="perfil" data-u="${m.user_id}">${PERFIS.map(([p, n]) => `<option value="${p}" ${m.perfil === p ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <button class="btn sm ghost" data-eq="${m.ativo ? 'tirar' : 'devolver'}" data-u="${m.user_id}">${m.ativo ? 'Tirar acesso' : 'Devolver acesso'}</button>` : `<span class="pill ${m.perfil === 'adm' ? 'acc' : ''}">${perfilNome(m.perfil)}</span>`}</div></div>`; }).join('')}
        ${C.map(c => `<div class="row eq-u conv" data-c="${c.id}"><span class="avatar">${esc(initials(c.nome || c.email))}</span>
          <div class="grow"><b>${esc(c.nome || c.email)}</b><small class="muted trunc">${esc(c.email)} · ${perfilNome(c.perfil)}</small></div>
          <div class="eq-ctl"><span class="pill warn">convite enviado</span>${adm ? `<button class="btn sm" data-eq="reenviar" data-c="${c.id}">Reenviar</button><button class="btn sm ghost" data-eq="cancelar" data-c="${c.id}">Cancelar</button>` : ''}</div></div>`).join('')}</div>
      <p class="muted sm cf-obs">Tirar o acesso não apaga nada: os atendimentos e registros continuam com o nome de quem fez. ${esc(regraPacote(k))}</p></div>
    <div class="card" id="eq-p"><div class="card-h"><h2>O que cada perfil abre<small>${adm ? 'começa no padrão; marque o que cada perfil abre nesta clínica' : 'definido pelo administrador da clínica'}</small></h2>${adm && mudouDoPadrao(perm) ? `<button class="btn sm" data-eq="padrao">${ic('retorno')}Voltar ao padrão</button>` : ''}</div>
      <div class="eq-tab" role="table" aria-label="Permissões por perfil"><div class="eq-tr eq-th" role="row"><span role="columnheader"></span>${PERFIS.map(([, n]) => `<span role="columnheader"><span class="eq-lg">${n}</span><span class="eq-ct" aria-hidden="true">${{ Administrador:'Admin.', Profissional:'Prof.', 'Recepção':'Recep.' }[n]}</span></span>`).join('')}</div>
      ${PERMISSOES.map(([ch, o]) => `<div class="eq-tr" role="row"><span role="rowheader">${o}</span><span role="cell" class="sim fixo" title="O administrador sempre abre tudo" aria-label="Administrador: sempre">${ic('check')}</span>${['prof', 'rec'].map(f => { const x = permite(perm, f, ch);
        return `<span role="cell"><label class="eq-ck ${x ? 'sim' : 'nao'}"><input type="checkbox" data-eq="perm" data-f="${f}" data-k="${ch}" ${x ? 'checked' : ''} ${adm ? '' : 'disabled'} aria-label="${perfilNome(f)} abre ${o}">${ic(x ? 'check' : 'x')}</label></span>`; }).join('')}</div>`).join('')}</div>
      <p class="muted sm cf-obs">O administrador sempre abre tudo, para a clínica nunca ficar sem quem cuide da equipe. Vale para todas as pessoas com o mesmo perfil nesta clínica.</p>
      <div class="eq-perfis"><small class="lbl">No padrão</small>${PERFIS.map(([, n, d]) => `<p><b>${n}:</b> ${d}</p>`).join('')}</div></div>
  </div>`;
}

const eqFaz = async (fn, ok) => { try { await fn(); if (ok) eqApp.toast(ok); } catch (e) { eqApp.toast(e.message, 'info'); } await carregarEq(); };

export function ligarEquipe(r, t){
  eqApp = { render:r, toast:t };
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-eq]'); if (!b || b.matches('input, select')) return;
    const a = b.dataset.eq, m = eq.lista?.find(x => x.user_id === b.dataset.u), c = eq.convites?.find(x => x.id === b.dataset.c);
    if (a === 'convidar') { eq.convite = true; eq.erroConv = ''; eq.aviso = null; eqApp.render(true); document.querySelector('#eq-conv [name=nome]')?.focus(); }
    else if (a === 'conv-fechar') { eq.convite = false; eqApp.render(true); }
    else if (a === 'aviso-fechar') { eq.aviso = null; eqApp.render(true); }
    else if (a === 'recarregar') { eq.erro = ''; eq.lista = null; carregarEq(); }
    else if (a === 'copiar') { try { await navigator.clipboard.writeText(textoConvite(eq.aviso)); eqApp.toast('Convite copiado. Cole no WhatsApp ou no e-mail.'); } catch (e) { document.querySelector('#eq-aviso input')?.select(); eqApp.toast('Selecione o link e copie', 'info'); } }
    else if (a === 'reenviar' && c) { eq.aviso = { nome:c.nome, email:c.email }; eqApp.render(true); }
    else if (a === 'cancelar' && c) eqFaz(() => conta.nuvem.cancelarConvite(c.id), `Convite de ${c.email} cancelado`);
    else if (a === 'tirar' && m) eqFaz(() => conta.nuvem.mudarMembro(conta.clinica.id, m.user_id, m.perfil, false), `${m.nome || m.email} não entra mais. Os registros continuam.`);
    else if (a === 'devolver' && m) eqFaz(() => conta.nuvem.mudarMembro(conta.clinica.id, m.user_id, m.perfil, true), `${m.nome || m.email} voltou a ter acesso`);
    else if (a === 'padrao') salvarPerm({}, 'Permissões de volta ao padrão');
  });
  document.addEventListener('change', ev => {
    const t = ev.target, a = t.dataset?.eq; if (!a) return;
    if (a === 'perfil') { const m = eq.lista?.find(x => x.user_id === t.dataset.u); if (m) eqFaz(() => conta.nuvem.mudarMembro(conta.clinica.id, m.user_id, t.value, m.ativo), `${m.nome || m.email} agora é ${perfilNome(t.value)}`); }
    else if (a === 'perm') { const f = t.dataset.f, k = t.dataset.k, P = JSON.parse(JSON.stringify(conta.clinica?.permissoes || {}));
      P[f] = { ...(P[f] || {}), [k]:t.checked }; salvarPerm(P, `${perfilNome(f)} ${t.checked ? 'agora abre' : 'não abre mais'}: ${PERMISSOES.find(p => p[0] === k)[1]}`); }
  });
  document.addEventListener('submit', async ev => {
    if (ev.target.id !== 'eq-conv') return; ev.preventDefault();
    const f = ev.target, nome = f.nome.value.trim(), email = f.email.value.trim(), perfil = f.perfil.value;
    eq.erroConv = !nome ? 'Escreva o nome.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Confira o e-mail.' : '';
    if (eq.erroConv) { eqApp.render(true); return; }
    eq.ocupado = true; eqApp.render(true);
    try { await conta.nuvem.convidar(conta.clinica.id, nome, email, perfil); eq.convite = false; eq.aviso = { nome, email:email.toLowerCase() }; eqApp.toast('Convite criado'); }
    catch (e) { eq.erroConv = e.message; }
    eq.ocupado = false; await carregarEq();
  });
}

async function salvarPerm(P, msg){
  const antes = conta.clinica.permissoes; conta.clinica.permissoes = P; eqApp.render(true);
  try { await conta.nuvem.salvarPermissoes(conta.clinica.id, P); eqApp.toast(msg); }
  catch (e) { conta.clinica.permissoes = antes; eqApp.render(true); eqApp.toast(e.message, 'info'); }
}
// Ao trocar de clínica ou sair, a lista é carregada de novo.
export const esquecerEquipe = () => { Object.assign(eq, { lista:null, convites:null, erro:'', convite:false, aviso:null }); };
