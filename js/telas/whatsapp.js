// WhatsApp (etapa 7A): botão que abre a mensagem pronta, o painel para conferir e ajustar antes de
// abrir o WhatsApp, e a tela Modelos de mensagens (na Administração).
import { CAMPOS_WA, mensagemWa, mensagensWa, numeroWa, preencherWa, valoresWa } from '../dados/whatsapp.js';
import { CLINICA, valoresDoc } from '../dados/documentos.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { PROF } from './menu.js';
import { TODAY, addDays, esc } from '../util.js';

// Botão "WhatsApp": tipo da mensagem pronta, paciente e (opcional) o horário da agenda.
export const btnWa = (tipo, pid, ap = '', so = false) => `<button class="btn sm wa" data-act="wa" data-t="${tipo}" data-pid="${pid}"${ap ? ` data-ap="${ap}"` : ''}${so ? ' aria-label="WhatsApp" data-tip="WhatsApp"' : ''}>${ic('mensagem')}${so ? '' : 'WhatsApp'}</button>`;

// Texto da mensagem pronta já preenchido para o paciente.
export function textoWa(tipo, pid, ap){
  const p = patient(pid), a = ap ? db.appts.find(x => x.id === ap) : null, m = mensagemWa(tipo, db.mensagensWa);
  if (!p || !m) return '';
  const orientacoes = tipo === 'orientacoes' ? valoresDoc(p, { appts:db.appts, hoje:TODAY, prof:PROF.nome }).orientacoes : '';
  return preencherWa(m[2], valoresWa(p, a, { hoje:TODAY, amanha:addDays(1, TODAY), clinica:CLINICA, prof:PROF.nome, orientacoes }));
}
export function abrirPainelWa(tipo, pid, ap){ ui.wa = { tipo, pid, ap: ap || '', texto: textoWa(tipo, pid, ap) }; ui.ov = 'wa'; }

// Painel sobre a tela: mensagem pronta, ajuste só desta mensagem e Abrir no WhatsApp.
export function painelWa(){
  const W = ui.wa, p = W && patient(W.pid); if (!p) return '';
  const num = numeroWa(p.phone);
  return `<div class="veu" data-act="fechar"></div><div class="pal wa-p" role="dialog" aria-modal="true" aria-label="Mensagem pelo WhatsApp">
    <div class="card-h"><h3>${ic('mensagem')}Mensagem para ${esc(p.name.split(' ')[0])}<small>${p.phone ? esc(p.phone) : 'sem telefone no cadastro'}</small></h3><button class="ib" data-act="fechar" aria-label="Fechar">${ic('x')}</button></div>
    <div class="chips" role="group" aria-label="Modelo de mensagem">${mensagensWa(db.mensagensWa).map(([k, n]) => `<button class="chip ${k === W.tipo ? 'on' : ''}" data-act="wa-tipo" data-k="${k}" aria-pressed="${k === W.tipo}">${n}</button>`).join('')}</div>
    <label class="rx-f full" style="margin-top:10px"><span class="lbl">Mensagem</span><textarea id="wa-t" rows="6">${esc(W.texto)}</textarea></label>
    <small class="muted">Ajuste se quiser; vale só para esta mensagem. Para mudar o texto padrão, use <a href="#mensagens" data-act="fechar-ir">Modelos de mensagens</a>.</small>
    ${num ? '' : `<div class="notice" style="margin-top:10px">${ic('info')}<div>Cadastre o telefone do paciente (com DDD) para enviar pelo WhatsApp.</div></div>`}
    <div class="rx-a"><button class="btn pri" data-act="wa-abrir" ${num ? '' : 'disabled'}>${ic('mensagem')}Abrir no WhatsApp</button><button class="btn" data-act="fechar">Cancelar</button></div></div>`;
}

const comCamposWa = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('').replace(/\{(\w+)\}/g, (s, k) => { const c = CAMPOS_WA.find(x => x[0] === k); return c ? `<span class="cp">${c[1]}</span>` : s; });
// Tela Modelos de mensagens: um campo por mensagem, botões para inserir os dados e voltar ao original.
export function vMensagens(){
  ui.crumbs = [['#administracao','Administração'],[null,'Modelos de mensagens']];
  return `<div class="head"><div><h1>Modelos de mensagens</h1><p>Os textos que aparecem quando você toca em WhatsApp</p></div></div>
  <div class="grid g-side ag-cols"><div class="grid" style="align-content:start">${mensagensWa(db.mensagensWa).filter(m => m[0] !== 'livre').map(([k, n, t, s]) => `<form class="card f-msg" data-k="${k}"><div class="card-h"><h2>${n}</h2>${s === 'editada' ? '<span class="pill acc">sua</span>' : '<span class="pill">original</span>'}</div>
      <div class="chips cps">${CAMPOS_WA.map(([c, r]) => `<button type="button" class="chip" data-act="msg-campo" data-k="${c}">${ic('mais')}${r}</button>`).join('')}</div>
      <label class="rx-f full" style="margin-top:8px"><span class="lbl">Texto</span><textarea rows="4" data-msg="${k}">${esc(t)}</textarea></label>
      <div class="mod-raw sm" data-raw="${k}">${comCamposWa(t)}</div>
      <div class="rx-a"><button class="btn sm pri">${ic('check')}Salvar</button>${s === 'editada' ? `<button type="button" class="btn ghost sm" data-act="msg-orig" data-k="${k}">${ic('retorno')}Voltar ao texto original</button>` : ''}</div></form>`).join('')}</div>
    <div class="card"><h2>Como funciona</h2><p class="muted sm">Ao tocar em <b>WhatsApp</b> na Agenda, no Relacionamento ou em Documentos, a mensagem abre já escrita; você confere e toca em Enviar no WhatsApp. Os dados entre chaves são preenchidos sozinhos. Na hora de enviar ainda dá para ajustar só aquela mensagem.</p>
      <p class="muted sm" style="margin-top:8px">O sistema anota quando a mensagem foi aberta e por quem. Sem custo e sem cadastro em serviço externo.</p></div></div>`;
}
export const textoComCamposWa = comCamposWa;
