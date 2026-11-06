// Etapa 10: Painel do MUSUBI, só para a conta dona do MUSUBI (tabela donos no servidor).
// Mostra todas as clínicas com o pacote, a situação (teste, grátis, pago, vencido), quem usa e números gerais
// (nunca os dados dos pacientes), permite dar ou tirar acesso grátis, trocar o pacote e dar mais dias de teste,
// e lista os interessados da página de apresentação. Pagamentos entram com o serviço de cobrança.
import { ic } from '../componentes/icones.js';
import { PLANOS, planoDe, precoTxt, rotuloSituacao, situacaoAssinatura } from '../dados/planos.js';
import { conta } from './conta.js';
import { esc } from '../util.js';

const pd = { aba:'clinicas', lista:null, inter:null, erro:'', carregando:false, gratis:null, busca:'' };
let pdApp = { render:() => {}, toast:() => {} };
const SITU_INT = [['novo', 'Novo'], ['chamei', 'Já chamei'], ['cliente', 'Virou cliente'], ['nao', 'Não quis']];
const PRAZOS = [['30', '30 dias'], ['90', '90 dias'], ['365', '1 ano'], ['sempre', 'Sem prazo']];
const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
const quando = iso => { if (!iso) return 'nunca'; const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };
const zap = w => { const d = String(w).replace(/\D/g, ''); return d ? 'https://wa.me/' + (d.length <= 11 ? '55' + d : d) : ''; };

export const ehDono = () => conta.modo === 'nuvem' && conta.dono;

async function carregarPd(){
  if (pd.carregando) return; pd.carregando = true; pd.erro = ''; pdApp.render(true);
  try { const [L, I] = await Promise.all([conta.nuvem.painelDono(), conta.nuvem.interessados()]); pd.lista = L; pd.inter = I; }
  catch (e) { pd.erro = e.message; }
  pd.carregando = false; pdApp.render(true);
}

export function vPainelDono(){
  if (!ehDono()) return `<div class="head"><div><h1>Painel do MUSUBI</h1><p>Só a conta dona do MUSUBI abre esta página.</p></div></div>`;
  if (!pd.lista && !pd.carregando && !pd.erro) setTimeout(carregarPd);
  const L = pd.lista || [], I = pd.inter || [], S = L.map(c => situacaoAssinatura(c));
  const n = t => S.filter(s => s.tipo === t).length, novos = I.filter(i => i.situacao === 'novo').length;
  const cab = `<div class="head"><div><h1>Painel do MUSUBI</h1><p>Clínicas que usam o sistema, pacotes e interessados</p></div><button class="btn" data-pd="atualizar" ${pd.carregando ? 'disabled' : ''}>${ic('retorno')}${pd.carregando ? 'Atualizando…' : 'Atualizar'}</button></div>`;
  if (pd.erro) return cab + `<div class="notice">${ic('alerta')}<span>${esc(pd.erro)}</span></div>`;
  if (!pd.lista) return cab + `<p class="muted">${ic('carregando')} Carregando…</p>`;
  return cab + `<div class="pd-n">
      <div class="card"><small>Clínicas</small><b>${L.length}</b></div>
      <div class="card"><small>Em teste</small><b>${n('teste')}</b></div>
      <div class="card"><small>Grátis ou pagas</small><b>${n('gratis') + n('pago')}</b></div>
      <div class="card"><small>Teste terminou</small><b>${n('vencido')}</b></div>
      <div class="card"><small>Interessados novos</small><b>${novos}</b></div></div>
    <div class="tabs" role="tablist">${[['clinicas', 'Clínicas', 'admin'], ['interessados', `Interessados${novos ? ` (${novos})` : ''}`, 'sino'], ['pagamentos', 'Pagamentos', 'dinheiro']].map(([k, l, i]) => `<button role="tab" data-pd="aba" data-k="${k}" class="${pd.aba === k ? 'on' : ''}" aria-selected="${pd.aba === k}">${ic(i)}${l}</button>`).join('')}</div>
    ${pd.aba === 'clinicas' ? pdClinicas(L) : pd.aba === 'interessados' ? pdInteressados(I) : pdPagamentos()}`;
}

function pdClinicas(L){
  const q = pd.busca.trim().toLowerCase(), F = L.filter(c => !q || [c.nome, c.cidade, c.email_dono].join(' ').toLowerCase().includes(q));
  return `<div class="card" id="pd-cl"><div class="card-h"><h2>Clínicas<small>${L.length} no total · a mais nova primeiro</small></h2><input class="pd-busca" data-pd="busca" type="search" placeholder="Buscar por nome, cidade ou e-mail" value="${esc(pd.busca)}" aria-label="Buscar clínica"></div>
    <div class="list">${F.map(c => { const s = situacaoAssinatura(c), aberto = pd.gratis === c.id;
      return `<div class="row pd-c" data-c="${c.id}"><span class="tico sm acc">${ic('local')}</span>
        <div class="grow"><b>${esc(c.nome)}</b><small class="muted">${esc([c.cidade, c.uf].filter(Boolean).join(' - '))}${c.email_dono ? ' · ' + esc(c.email_dono) : ''}</small>
          <small class="muted">${c.pessoas_ativas} pessoa${c.pessoas_ativas === 1 ? '' : 's'} com acesso${c.pessoas > c.pessoas_ativas ? ` (${c.pessoas - c.pessoas_ativas} sem acesso)` : ''} · ${c.pacientes} paciente${c.pacientes === 1 ? '' : 's'} · usou ${quando(c.ultimo_uso)} · desde ${dataBR(c.criado_em)}</small>
          ${s.tipo === 'gratis' && s.motivo ? `<small class="muted">Grátis: ${esc(s.motivo)}</small>` : ''}</div>
        <div class="pd-ctl"><span class="pill ${s.tipo === 'vencido' ? 'warn' : s.tipo === 'teste' ? '' : 'ok'}">${rotuloSituacao(s)}</span>
          <label><span class="so-leitor">Pacote de ${esc(c.nome)}</span><select data-pd="plano" data-c="${c.id}">${PLANOS.map(p => `<option value="${p.k}" ${p.k === (c.plano || 'profissional') ? 'selected' : ''}>${p.nome}</option>`).join('')}</select></label>
          ${s.tipo === 'gratis' ? `<button class="btn sm ghost" data-pd="tirar" data-c="${c.id}">Tirar acesso grátis</button>` : `<button class="btn sm" data-pd="gratis" data-c="${c.id}">${ic('mais')}Dar acesso grátis</button>`}
          ${s.tipo === 'teste' || s.tipo === 'vencido' ? `<button class="btn sm ghost" data-pd="mais7" data-c="${c.id}">+7 dias de teste</button>` : ''}</div>
        ${aberto ? `<form class="pd-g" id="pd-g" novalidate><div class="form">
            <label class="field"><span class="lbl">Por quanto tempo</span><select name="prazo">${PRAZOS.map(([k, l]) => `<option value="${k}" ${k === '90' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field"><span class="lbl">Motivo (só você vê)</span><input name="motivo" placeholder="Ex.: testar o sistema" autocomplete="off"></label></div>
          <div class="cf-acoes"><button class="btn pri" type="submit">${ic('check')}Dar acesso grátis</button><button class="btn ghost" type="button" data-pd="gratis-fechar">Cancelar</button></div></form>` : ''}</div>`; }).join('') || '<p class="muted sm">Nenhuma clínica encontrada.</p>'}</div>
    <p class="muted sm cf-obs">Os dados dos pacientes de cada clínica não aparecem aqui: só os números gerais.</p></div>`;
}

function pdInteressados(I){
  return `<div class="card" id="pd-int"><div class="card-h"><h2>Interessados<small>quem pediu para conhecer ou para continuar depois do teste</small></h2></div>
    <div class="list">${I.map(i => `<div class="row pd-i st-${i.situacao}"><span class="avatar">${esc(String(i.nome).trim()[0] || '?').toUpperCase()}</span>
      <div class="grow"><b>${esc(i.nome)}</b><small class="muted">${esc(i.whats)} · ${dataBR(i.criado_em)}</small></div>
      <div class="pd-ctl">${zap(i.whats) ? `<a class="btn sm wa" href="${zap(i.whats)}" target="_blank" rel="noopener">${ic('mensagem')}WhatsApp</a>` : ''}
        <label><span class="so-leitor">Situação de ${esc(i.nome)}</span><select data-pd="situ" data-i="${i.id}">${SITU_INT.map(([k, l]) => `<option value="${k}" ${i.situacao === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></div>`).join('') || '<p class="muted sm">Ninguém pediu contato ainda.</p>'}</div></div>`;
}

function pdPagamentos(){
  return `<div class="card cf-max" id="pd-pag"><div class="card-h"><h2>Pagamentos</h2></div>
    <p class="sm">Os pacotes já estão no sistema: ${PLANOS.map(p => `<b>${p.nome}</b> (${precoTxt(p)})`).join(', ')}, com 7 dias grátis para toda clínica nova.</p>
    <p class="muted sm cf-obs">A cobrança automática (Pix, boleto e cartão, mensal ou anual) entra quando escolhermos o serviço de cobrança. Aí cada pagamento aparece aqui sozinho, e quem atrasar recebe aviso antes de o acesso ser limitado, sem perder os dados.</p></div>`;
}

const pdFaz = async (fn, ok) => { try { await fn(); pdApp.toast(ok); await carregarPd(); } catch (e) { pdApp.toast(e.message, 'info'); } };

export function ligarPainelDono(r, t){
  pdApp = { render:r, toast:t };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pd]'); if (!b || b.matches('input, select')) return; const a = b.dataset.pd, c = b.dataset.c;
    const nome = () => pd.lista?.find(x => x.id === c)?.nome || '';
    if (a === 'atualizar') carregarPd();
    else if (a === 'aba') { pd.aba = b.dataset.k; pdApp.render(true); }
    else if (a === 'gratis') { pd.gratis = c; pdApp.render(true); document.querySelector('#pd-g [name=motivo]')?.focus(); }
    else if (a === 'gratis-fechar') { pd.gratis = null; pdApp.render(true); }
    else if (a === 'tirar') pdFaz(() => conta.nuvem.darGratis(c, null, '', true), `Acesso grátis de ${nome()} retirado`);
    else if (a === 'mais7') pdFaz(() => conta.nuvem.estenderTeste(c, 7), `${nome()} ganhou mais 7 dias de teste`);
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (!t.dataset?.pd) return;
    if (t.dataset.pd === 'plano') pdFaz(() => conta.nuvem.mudarPlano(t.dataset.c, t.value), `Pacote trocado para ${planoDe(t.value).nome}`);
    if (t.dataset.pd === 'situ') pdFaz(() => conta.nuvem.mudarInteressado(t.dataset.i, t.value), 'Situação salva');
  });
  document.addEventListener('input', ev => { if (ev.target.dataset?.pd === 'busca') { pd.busca = ev.target.value; pdApp.render(true); const i = document.querySelector('.pd-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
  document.addEventListener('submit', ev => {
    if (ev.target.id !== 'pd-g') return; ev.preventDefault();
    const f = ev.target, prazo = f.elements.prazo.value, c = pd.gratis, nome = pd.lista?.find(x => x.id === c)?.nome || '';
    const ate = prazo === 'sempre' ? null : new Date(Date.now() + Number(prazo) * 864e5).toISOString();
    pd.gratis = null;
    pdFaz(() => conta.nuvem.darGratis(c, ate, f.elements.motivo.value.trim()), `${nome} com acesso grátis ${prazo === 'sempre' ? 'sem prazo' : 'por ' + PRAZOS.find(p => p[0] === prazo)[1]}`);
  });
}
