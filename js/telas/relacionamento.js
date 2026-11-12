// Tela Relacionamento (etapa 6C, na Administração): retomar contato e interessados.
import { ORIGENS, SITUACOES_INTERESSADO, paraRetomar } from '../dados/relacionamento.js';
import { db } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { btnWa } from './whatsapp.js';
import { TODAY, esc, fmt, initials } from '../util.js';

export function vRelacionamento(){
  ui.crumbs = [['#administracao','Administração'],[null,'Relacionamento']];
  const R = paraRetomar(db, TODAY), vis = R.filter(x => !x.oculto), oc = R.length - vis.length, L = ui.relOcultos ? R : vis;
  const I = db.interessados || [], N = ui.novoInt ||= { nome:'', tel:'', origem:ORIGENS[0] };
  return `<div class="head"><div><h1>Relacionamento</h1><p>Quem retomar contato e quem procurou e ainda não é paciente</p></div></div>
  <div class="grid g-side ag-cols"><div class="card" id="rel-ret"><div class="card-h"><h2>Retomar contato<small>último atendimento há mais de 21 dias e nada agendado</small></h2><span class="pill warn">${vis.length}</span></div>
      <div class="ctt-l">${L.map(({p,ult,dias,contato,oculto})=>`<div class="ctt ${oculto?'oc':''}" data-rel="${p.id}"><span class="avatar">${initials(p.name)}</span><div class="grow"><button class="lk" data-act="open" data-pid="${p.id}">${esc(p.name)}</button><small>há ${dias} dias · ${fmt(ult)}${p.phone?` · <span class="tel">${esc(p.phone)}</span>`:''}</small>${contato?`<small class="ctt-c">${ic('check')}contato em ${fmt(contato.em.slice(0,10))} · ${esc(contato.por)}</small>`:''}</div>
        <div class="hor-a">${oculto?`<button class="btn sm ghost" data-act="rel-volta" data-pid="${p.id}">Mostrar de novo</button>`:`${btnWa('retomar', p.id)}<button class="btn sm pri" data-act="rel-agendar" data-pid="${p.id}">${ic('agenda')}Agendar</button><button class="btn sm ${contato?.em.slice(0,10)===TODAY?'ghost':''}" data-act="rel-contato" data-pid="${p.id}" ${contato?.em.slice(0,10)===TODAY?'disabled':''}>${ic('tel')}Contato feito</button><button class="btn sm ghost" data-act="rel-ocultar" data-pid="${p.id}" aria-label="Não retomar" data-tip="Não retomar">${ic('x')}</button>`}</div></div>`).join('') || `<div class="vazio">${ic('okc')}Ninguém para retomar agora.</div>`}</div>
      ${oc?`<button class="btn sm ghost" data-act="rel-ver-oc" style="margin-top:10px">${ui.relOcultos?'Esconder':'Mostrar'} ${oc} que você preferiu não retomar</button>`:''}</div>
    <div class="grid" style="align-content:start"><div class="card" id="rel-int"><div class="card-h"><h2>Interessados<small>quem procurou e ainda não é paciente</small></h2><span class="pill">${I.filter(i=>i.sit==='novo'||i.sit==='agendou').length}</span></div>
      <div class="ctt-l">${I.map(i=>`<div class="ctt int ${i.sit}" data-int="${i.id}"><div class="grow"><b>${esc(i.nome)}</b><small>${i.tel?`<span class="tel">${esc(i.tel)}</span> · `:''}${esc(i.origem)} · ${fmt(i.em.slice(0,10))}</small></div>
        <div class="int-s" role="group" aria-label="Situação de ${esc(i.nome)}">${SITUACOES_INTERESSADO.map(([k,n])=>`<button class="chip ${i.sit===k?'on':''}" data-act="int-sit" data-id="${i.id}" data-s="${k}" aria-pressed="${i.sit===k}">${n}</button>`).join('')}</div></div>`).join('') || '<p class="muted sm">Nenhum interessado registrado.</p>'}</div>
      <form id="f-int" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Nome</span><input id="int-nome" data-int="nome" value="${esc(N.nome)}" required autocomplete="off"></label>
        <label class="rx-f"><span class="lbl">Telefone</span><input id="int-tel" data-int="tel" data-mask="tel" maxlength="15" value="${esc(N.tel)}" inputmode="tel" autocomplete="off"></label>
        <label class="rx-f"><span class="lbl">Como chegou</span><select id="int-origem" data-int="origem">${ORIGENS.map(o=>`<option ${o===N.origem?'selected':''}>${o}</option>`).join('')}</select></label>
        <div class="full"><button class="btn sm pri">${ic('mais')}Incluir interessado</button></div></form></div>
      <div class="card"><h2>Como funciona</h2><p class="muted sm">A lista de retomar contato se monta sozinha pela agenda e pelos atendimentos. <b>Contato feito</b> registra o dia e quem falou. Em <b>Paciente</b>, o cadastro abre com o nome e o telefone do interessado. <b>WhatsApp</b> abre a mensagem pronta e já registra o contato feito.</p></div></div></div>`;
}
