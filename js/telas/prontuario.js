// Prontuário do paciente: concentra tudo num lugar só (pedido do Maicon, 07/11/2026). Abas: Resumo,
// Atendimentos, Anamnese e alertas, Avaliação energética, Pentagrama, Versões da avaliação, CID e Registro
// rápido. As antigas telas #avaliacao e #pentagrama abrem aqui, na aba correspondente.
// Detalhe das abas:
// - Resumo: indicadores, queixas com a evolução de cada uma, atendimentos recentes, mapa dos cinco
//   elementos, padrões validados e dados cadastrais;
// - Prontuário: evolução das queixas, avaliação basal × atual e linha do tempo dos atendimentos e
//   reavaliações;
// - Anamnese e alertas; Registro rápido de sessão (o atendimento completo fica em telas/atendimento.js).
// Nenhum cálculo clínico é feito aqui: os estados vêm de raciocinio/avaliacao.js, como antes.
import { elTag } from '../componentes/campos.js';
import { enderecoCompleto } from '../dados/endereco.js';
import { anel, barrasEl, delta, linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { pentagram } from '../componentes/pentagrama.js';
import { PT } from '../conhecimento/pontos.js';
import { SIGN } from '../conhecimento/sinais.js';
import { ativo } from '../dados/agenda.js';
import { db, patient } from '../dados/repositorio.js';
import { alertasDe, melhoraPct } from '../dados/indicadores.js';
import { QUEIXA_PRINCIPAL, serieQueixa } from '../dados/migracao.js';
import { bloqueio, pode } from './conta.js';
import { botaoHistorico } from './historico.js';
import { vAvaliacao } from './avaliacao.js';
import { vPentagrama } from './pentagrama.js';
import { diagnosticosAtivos } from '../dados/cid.js';
import { LADOS_MARCA, TIPOS_MARCA, basalDe, marcaComIntensidade, marcasDe, rascunhoDe, versaoOriginal, versoesDe } from '../dados/atendimento.js';
import { TECNICAS } from './atendimento.js';
import { iconeMarca, vistaNome } from '../componentes/corpo.js';
import { ui } from '../estado.js';
import { elemState, evaluate } from '../raciocinio/avaliacao.js';
import { TODAY, age, esc, fmt, initials } from '../util.js';

export const QCOR = ['var(--brand)','#b8894a','#5f7f9c','#9a6b8f','#6f8f8a'];
const corQ = (p,q) => QCOR[p.queixas.indexOf(q)%QCOR.length];
const aceitos = a => a?evaluate(a.signs).filter(h=>a.status[h.p.id]==='aceito'):[];
const ordinal = n => `${n}º`;

// Bloco de uma sessão, com o mesmo conteúdo da lista de sessões do protótipo.
const sessHtml = s => `<div class="sess"><div><b class="mono">${fmt(s.date)}</b><div class="eva muted">EVA ${s.eva}/10</div></div><div><div class="chips" style="margin-bottom:6px">${s.tec.map(t=>`<span class="pill">${esc(t)}</span>`).join('')}${s.pontos.map(c=>`<span class="pill acc mono" title="${esc(PT[c]?.pinyin||'')}">${esc(c)}</span>`).join('')}</div>${s.nota?`<p>${esc(s.nota)}</p>`:'<p class="muted">Sem anotações.</p>'}</div></div>`;

// Eventos do prontuário em ordem cronológica: atendimentos finalizados e avaliações sem atendimento no dia.
function eventos(p){
  const fin=p.atendimentos.filter(a=>a.status==='finalizado'), ss=p.sessions;
  const E=fin.map((a,i)=>({tipo:'at',data:a.data,n:i+1,a,s:ss[i],av:p.avaliacoes.find(x=>x.id===a.avaliacaoId)}));
  p.avaliacoes.filter(x=>!x.atendimentoId).forEach(av=>E.push({tipo:'av',data:av.date,av}));
  return E.sort((x,y)=>x.data.localeCompare(y.data));
}
// Marcações do mapa corporal registradas no atendimento (etapa 4A). Só leitura: nunca são sobrescritas.
function marcasProntuario(a){
  const L=marcasDe(a); if(!L.length) return '';
  const tn=k=>TIPOS_MARCA.find(x=>x[0]===k)?.[1]||k, ln=k=>LADOS_MARCA.find(x=>x[0]===k)?.[1]||'Não se aplica';
  return `<details class="mais pr-mapa"><summary>${ic('corpo')}Mapa corporal (${L.length} marcaç${L.length===1?'ão':'ões'}) ${ic('baixo')}</summary><div class="pr-mk">${L.map(m=>`<div class="pr-m" data-id="${esc(m.id)}">${iconeMarca(m.tipo)}<div class="grow"><b>${tn(m.tipo)}${m.regiao?' · '+esc(m.regiao):''}</b><small>${ln(m.lado)} · ${vistaNome(m.vista,m.face)}${marcaComIntensidade(m.tipo)?` · intensidade ${m.intensidade??'—'}/10`:' · '+esc(m.procedimento||'procedimento')}</small>${m.nota?`<p>${esc(m.nota)}</p>`:''}</div></div>`).join('')}</div></details>`;
}
const rotuloAv = (p,av) => av===p.avaliacoes[0]?'avaliação basal':'reavaliação';
function itemTempo(p,e){
  if(e.tipo==='av'){ const h=aceitos(e.av);
    return `<div class="lt-i av"><span class="hi-n">${ic('yin')}</span><div class="grow"><div class="lt-h"><b>${fmt(e.data)}</b><span class="pill acc">${rotuloAv(p,e.av)}</span><span class="muted sm">avaliação energética sem atendimento no dia</span></div>
      <p class="sm">${e.av.signs.length} sina${e.av.signs.length===1?'l':'is'} observado${e.av.signs.length===1?'':'s'}${h.length?` · padrões validados: ${h.map(x=>esc(x.p.nome)).join(', ')}`:''}</p>${e.av.nota?`<p class="muted sm">${esc(e.av.nota)}</p>`:''}</div></div>`; }
  const outras=p.queixas.filter(q=>q.id!==QUEIXA_PRINCIPAL&&e.a.evolucao.intensidades[q.id]!=null), h=aceitos(e.av);
  return `<div class="lt-i"><span class="hi-n">${e.n}</span><div class="grow"><div class="lt-h"><b>${ordinal(e.n)} atendimento</b>${e.a.edicoes?.length?`<span class="pill warn">${ic('editar')}editado</span>`:''}${e.av?`<span class="pill acc">${ic('yin')}${rotuloAv(p,e.av)}</span>`:''}${e.a.origem==='v1'?'<span class="pill" data-tip="Registro trazido do protótipo na conversão dos dados">protótipo</span>':''}</div>
    ${sessHtml(e.s)}
    ${outras.length?`<div class="chips">${outras.map(q=>`<span class="pill"><i class="dotq" style="background:${corQ(p,q)}"></i>${esc(q.descricao)}: ${e.a.evolucao.intensidades[q.id]}/10</span>`).join('')}</div>`:''}
    ${h.length?`<p class="muted sm">Padrões validados na avaliação: ${h.map(x=>esc(x.p.nome)).join(', ')}</p>`:''}
    ${e.a.sintese?`<p class="sm"><b>Síntese:</b> ${esc(e.a.sintese)}</p>`:''}
    ${marcasProntuario(e.a)}
    ${edicoesHtml(p,e.a)}
    <div class="lt-a">${e.a.historico.length>1?`<details class="mais"><summary>Histórico de alterações (${e.a.historico.length}) ${ic('baixo')}</summary><div class="hist-alt">${[...e.a.historico].reverse().map(x=>`<div><span class="mono muted">${fmt(x.em.slice(0,10))} ${new Date(x.em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(x.acao)}</span></div>`).join('')}</div></details>`:'<span></span>'}
      <div class="chips">${e.a.etapas?`<button class="btn ghost sm" data-act="abrir-atendimento" data-pid="${p.id}" data-id="${e.a.id}">${ic('lista')}Ver atendimento completo</button>`:''}<button class="btn sm" data-act="pr-editar" data-id="${e.a.id}">${ic('editar')}Editar registro</button></div></div></div></div>`;
}

// Original e edições de um atendimento editado depois de salvo: quem, quando, motivo e o que mudou.
function resumoFoto(p,f){
  const q=Object.entries(f.intensidades||{}).map(([id,v])=>`${esc(p.queixas.find(x=>x.id===id)?.descricao||'queixa')}: ${v}/10`);
  return [q.length?`<b>Intensidade:</b> ${q.join(' · ')}`:'',f.tec?.length?`<b>Técnicas:</b> ${esc(f.tec.join(', '))}`:'',f.pontos?.length?`<b>Pontos:</b> <span class="mono">${esc(f.pontos.join(', '))}</span>`:'',
    f.sintese?`<b>Síntese:</b> ${esc(f.sintese)}`:'',f.nota?`<b>Evolução:</b> ${esc(f.nota)}`:'',f.orient?`<b>Orientações:</b> ${esc(f.orient)}`:''].filter(Boolean).map(x=>`<p class="sm">${x}</p>`).join('')||'<p class="muted sm">Sem anotações.</p>';
}
function edicoesHtml(p,a){
  const E=a.edicoes||[]; if(!E.length) return '';
  const quando=t=>`${fmt(t.slice(0,10))} às ${new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  return `<details class="mais pr-ed"><summary>${ic('historico')}Versão original e edições (${E.length}) ${ic('baixo')}</summary>
    <div class="pr-ed-l">${[...E].reverse().map((x,i)=>`<div class="pr-ed-i"><b>Edição ${E.length-i}</b><small class="muted">${quando(x.em)}${x.por?' · '+esc(x.por):''} · alterou ${esc(x.mudou.join(', '))}</small><p class="sm"><b>Motivo:</b> ${esc(x.motivo)}</p></div>`).join('')}
    <div class="pr-ed-i orig"><b>Versão original</b><small class="muted">como foi salva em ${fmt(a.data)}; nunca é alterada</small>${resumoFoto(p,versaoOriginal(a))}</div></div></details>`;
}
// Janela para editar um atendimento salvo: tudo num lugar só, com o motivo obrigatório.
function janelaEdicao(p){
  const a=p.atendimentos.find(x=>x.id===ui.edReg&&x.status==='finalizado'); if(!a){ ui.edReg=null; return ''; }
  const I=a.evolucao?.intensidades||{}, Q=p.queixas.filter(q=>I[q.id]!=null||q.ativa), tec=a.plano?.tec||[];
  return `<div class="modal-fundo" id="ed-fundo" data-act="pr-editar-x"><form class="modal" id="f-edreg" role="dialog" aria-modal="true" aria-labelledby="ed-t" data-id="${a.id}">
    <div class="modal-h"><div class="grow"><h2 id="ed-t">Editar atendimento de ${fmt(a.data)}</h2><small class="muted">${esc(p.name)} · a versão original fica guardada no prontuário</small></div><button type="button" class="btn ghost sm" data-act="pr-editar-x" aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-c">
      <div class="ed-g">${Q.map(q=>`<label class="rx-f"><span class="lbl">${esc(q.descricao)} (0 a 10)</span><input type="number" min="0" max="10" data-edq="${q.id}" value="${I[q.id]??''}" placeholder="não medida"></label>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">Técnicas</div><div class="chips">${TECNICAS.map(t=>`<label class="chip"><input type="checkbox" name="ed-tec" value="${t}" ${tec.includes(t)?'checked':''}> ${t}</label>`).join('')}</div>
      <label class="rx-f full"><span class="lbl">Pontos (separe por vírgula)</span><input id="ed-pts" class="mono" value="${esc((a.plano?.pontos||[]).join(', '))}" autocomplete="off"></label>
      <label class="rx-f full"><span class="lbl">Síntese clínica</span><textarea id="ed-sint" rows="3">${esc(a.sintese||'')}</textarea></label>
      <label class="rx-f full"><span class="lbl">Evolução e observações</span><textarea id="ed-nota" rows="3">${esc(a.evolucao?.nota||'')}</textarea></label>
      <label class="rx-f full"><span class="lbl">Orientações para casa</span><textarea id="ed-orient" rows="2">${esc(a.plano?.orient||'')}</textarea></label>
      <label class="rx-f full ed-mot"><span class="lbl">Motivo da edição (obrigatório)</span><input id="ed-motivo" required maxlength="200" placeholder="Ex.: corrigir a intensidade anotada errada" autocomplete="off"></label>
    </div>
    <div class="modal-p"><button type="button" class="btn ghost" data-act="pr-editar-x">Cancelar</button><button class="btn pri">${ic('check')}Salvar edição</button></div>
  </form></div>`;
}

function cardQueixas(p){
  const ativas=p.queixas.filter(q=>q.ativa), resolvidas=p.queixas.filter(q=>!q.ativa);
  const cartao = q => { const s=serieQueixa(p,q.id).map(x=>x.valor), m=melhoraPct(s), cor=corQ(p,q);
    return `<div class="qc ${q.ativa?'':'res'}"><div class="qc-h"><i style="background:${cor}"></i><b class="grow">${esc(q.descricao)}</b>${q.id===QUEIXA_PRINCIPAL?'<span class="pill">principal</span>':`<button class="btn ghost sm" data-act="queixa-ativa" data-q="${q.id}">${q.ativa?`${ic('check')}Resolvida`:`${ic('retorno')}Reativar`}</button>`}</div>
      ${s.length?`<div class="qc-v"><span class="big">${s.at(-1)}</span><span class="muted">/10</span>${delta(s[0],s.at(-1))}<span class="muted sm">desde a 1ª medida (${s[0]})</span></div>
        ${s.length>1?linhas([{cor,vals:s}],[],{w:300,h:64,mini:1}):''}${m!==null?`<span class="pill ${m>0?'ok':'warn'}" style="justify-self:start">${m>0?'▼ '+m+'% de melhora':'sem melhora'}</span>`:''}`
      :`<p class="muted sm">${q.id===QUEIXA_PRINCIPAL?'A intensidade aparece com o primeiro atendimento registrado.':'A intensidade passa a ser medida no próximo atendimento.'}</p>`}</div>`; };
  return `<div class="card"><div class="card-h"><h2>Queixas</h2><span class="muted sm">intensidade de 0 a 10</span></div>
    <div class="qgrid">${ativas.map(cartao).join('')}</div>
    <form id="f-queixa" class="nq"><label class="so-leitor" for="nq-desc">Nova queixa</label><input id="nq-desc" placeholder="Adicionar outra queixa (ex.: insônia)" required maxlength="120"><button class="btn sm">${ic('mais')}Adicionar</button></form>
    ${resolvidas.length?`<details class="mais"><summary>${resolvidas.length} queixa${resolvidas.length===1?' resolvida':'s resolvidas'} ${ic('baixo')}</summary><div class="qgrid" style="margin-top:10px">${resolvidas.map(cartao).join('')}</div></details>`:''}</div>`;
}

function cardCadastro(p){
  const c=p.cadastro||{}, v=x=>x?esc(x):'<span class="muted">—</span>';
  const L=[['Telefone',p.phone],['CPF',c.cpf],['E-mail',c.email],['Cidade',c.cidade?`${c.cidade}${c.uf?` - ${c.uf}`:''} · hemisfério ${c.hemisferio||'Sul'}`:''],['Endereço',enderecoCompleto(c)],['Contato de emergência',c.contatoEmergencia],['Nascimento',p.birth?fmt(p.birth):''],['Consentimento LGPD',p.consentimento?`registrado em ${fmt(p.consentimento)}`:'']];
  return `<div class="card"><div class="card-h"><h2>Dados cadastrais</h2><button class="btn ghost sm" data-act="editar-paciente" data-pid="${p.id}">${ic('editar')}Editar</button></div>
    <div class="corr-g">${L.map(([l,x])=>`<div><small>${l}</small><b>${v(x)}</b></div>`).join('')}</div></div>`;
}

// Aviso de atendimento em andamento (rascunho salvo automaticamente).
function rascunho(p){
  const r=rascunhoDe(p); if(!r) return '';
  return `<div class="card rasc"><span class="tico acc">${ic('play')}</span><div class="grow"><b>Atendimento em andamento</b><small class="muted">Iniciado em ${fmt(r.data)} · salvo automaticamente às ${new Date(r.atualizadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div><button class="btn pri sm" data-act="novo-atendimento" data-pid="${p.id}">Continuar ${ic('dir')}</button></div>`;
}
function abaResumo(p){
  const a=p.assess.at(-1), a0=p.assess[0], st=a?elemState(a.signs,a.status):null, ac=aceitos(a);
  const ss=p.sessions, s=ss.map(x=>x.eva), m=melhoraPct(s);
  const prox=db.appts.filter(ativo).filter(x=>x.pid===p.id&&x.date>=TODAY&&!x.done).sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time))[0];
  const E=eventos(p);
  return `<div class="tiles">
    <div class="tile"><span class="tico acc">${ic('lista')}</span><div><b class="num">${p.sessions.length}</b><small>atendimento${p.sessions.length===1?'':'s'}${p.sessions[0]?` desde ${fmt(p.sessions[0].date)}`:''}</small></div></div>
    <div class="tile">${m!==null?anel(Math.max(0,m)/100,m+'%','var(--ok)'):`<span class="tico">${ic('evolucao')}</span>`}<div><b>${m!==null?(m>0?'Melhora':'Sem melhora'):'Sem evolução'}</b><small>${m!==null?'queixa principal, desde o 1º atendimento':'registre ao menos dois atendimentos'}</small></div></div>
    <div class="tile"><span class="tico acc">${ic('yin')}</span><div><b>${p.assess.length?p.assess.length+(p.assess.length===1?' avaliação':' avaliações'):'Sem avaliação'}</b><small>${a0?`basal em ${fmt(a0.date)}`:'avaliação energética pendente'}</small></div></div>
    <div class="tile"><span class="tico">${ic('agenda')}</span><div><b>${prox?`${fmt(prox.date)} · ${prox.time}`:'—'}</b><small>${prox?esc(prox.tipo):'sem próximo agendamento'}</small></div></div>
  </div>
  <div class="grid g-side">
    <div class="grid" style="align-content:start">
      ${rascunho(p)}${cardQueixas(p)}
      <div class="card"><div class="card-h"><h2>Atendimentos recentes</h2>${E.length?`<button class="btn ghost sm" data-act="tab" data-t="sessoes">Ver prontuário ${ic('dir')}</button>`:''}</div>
        ${ss.length?`<div class="hist">${ss.map((x,i)=>[x,i+1]).reverse().slice(0,3).map(([x,n])=>`<div class="hi on"><div class="hi-h"><span class="hi-n">${n}</span><span class="grow"><b>${fmt(x.date)}</b><small>${esc(x.tec.join(', '))||'atendimento'}</small></span><span class="pill">EVA ${x.eva}</span></div>${x.nota?`<div class="hi-b"><p>${esc(x.nota)}</p></div>`:''}</div>`).join('')}</div>`
          :vazio('lista','Nenhum atendimento','Use “Novo atendimento” para registrar o primeiro.')}</div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h2>Mapa dos cinco elementos</h2>${a?`<span class="pill">${p.assess.length>1?'reavaliação':'basal'} · ${fmt(a.date)}</span>`:''}</div>
        ${st?`${barrasEl(st, p.assess.length>1?elemState(a0.signs,a0.status):null)}${p.assess.length>1?`<p class="muted sm" style="margin-top:6px">Marca vertical: posição na avaliação basal (${fmt(a0.date)}).</p>`:''}
          <details class="mais"><summary>Ver pentagrama ${ic('baixo')}</summary>${pentagram(st,null)}</details>`
        :vazio('yin','Sem avaliação energética','Faça a avaliação para ver o mapa dos cinco elementos.',`<button class="btn sm pri" data-act="tab" data-t="avaliacao">${ic('yin')}Avaliar</button>`)}</div>
      <div class="card"><div class="card-h"><h2>Padrões validados</h2><button class="btn sm" data-act="tab" data-t="avaliacao">Nova avaliação</button></div>
        ${ac.length?ac.map(h=>`<div class="row"><div class="grow"><b>${h.p.nome}</b></div>${elTag(h.p.el)}<span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):'<p class="muted sm">Nenhum padrão validado.</p>'}
        ${a?.nota?`<p class="muted" style="margin-top:8px">Nota: ${esc(a.nota)}</p>`:''}
      </div>
      ${cardCadastro(p)}
    </div>
  </div>`;
}

function abaProntuario(p){
  const fin=p.atendimentos.filter(a=>a.status==='finalizado'), Q=p.queixas, E=eventos(p);
  const labels=fin.map(a=>fmt(a.data).slice(0,5)), series=Q.map(q=>({cor:corQ(p,q),nome:q.descricao,vals:fin.map(a=>a.evolucao.intensidades[q.id]??null)})).filter(x=>x.vals.some(v=>v!=null));
  const a0=p.avaliacoes[0], a1=p.avaliacoes.at(-1);
  const s0=a0&&new Set(a0.signs), s1=a1&&new Set(a1.signs), dois=p.avaliacoes.length>1;
  const resolv=dois?a0.signs.filter(x=>!s1.has(x)):[], novos=dois?a1.signs.filter(x=>!s0.has(x)):[];
  const qs=Q.filter(q=>serieQueixa(p,q.id).length);
  return `<div class="card"><div class="card-h"><h2>Evolução das queixas</h2>${series.length>1?`<div class="leg">${series.map((s,i)=>`<button class="leg-b" data-act="serie" data-s="${i}" aria-pressed="true" data-tip="Mostrar ou ocultar"><i style="background:${s.cor}"></i>${esc(s.nome)}</button>`).join('')}</div>`:'<span class="muted sm">intensidade de 0 a 10 por atendimento</span>'}</div>
    ${fin.length?`${linhas(series,labels,{label:'Intensidade das queixas por atendimento',w:1000,h:240})}
      <div class="qsum">${qs.map(q=>{ const v=serieQueixa(p,q.id).map(x=>x.valor); return `<div><i style="background:${corQ(p,q)}"></i><span>${esc(q.descricao)}${q.ativa?'':' (resolvida)'}</span><b>${v[0]} → ${v.at(-1)}</b>${delta(v[0],v.at(-1))}</div>`; }).join('')}</div>`
      :vazio('evolucao','Ainda sem atendimentos','A evolução aparece a partir do primeiro atendimento registrado.')}</div>
  ${a0?`<div class="card" style="margin-top:20px"><div class="card-h"><h2>Avaliação basal × atual</h2><span class="muted sm">${fmt(a0.date)}${dois?` → ${fmt(a1.date)}`:''}</span></div>
    ${dois?`<div class="cmp"><div><div class="lbl">Basal · ${fmt(a0.date)}</div>${pentagram(elemState(a0.signs,a0.status),null)}</div><div><div class="lbl">Atual · ${fmt(a1.date)}</div>${pentagram(elemState(a1.signs,a1.status),null)}</div></div>
      <div class="grid g2" style="margin-top:8px"><div>${barrasEl(elemState(a1.signs,a1.status),elemState(a0.signs,a0.status))}<p class="muted sm" style="margin-top:6px">Marca vertical: posição na avaliação basal.</p></div>
        <div class="sinais-cmp"><div><span class="pill ok">${ic('check')}${resolv.length} sina${resolv.length===1?'l':'is'} que não aparece${resolv.length===1?'':'m'} mais</span><p class="muted sm">${resolv.map(x=>esc(SIGN[x]||x)).join(', ')||'—'}</p></div>
        <div><span class="pill warn">${ic('mais')}${novos.length} sina${novos.length===1?'l':'is'} novo${novos.length===1?'':'s'}</span><p class="muted sm">${novos.map(x=>esc(SIGN[x]||x)).join(', ')||'—'}</p></div></div></div>`
    :`<div class="grid g2"><div>${pentagram(elemState(a0.signs,a0.status),null)}</div><div>${barrasEl(elemState(a0.signs,a0.status))}<p class="muted sm" style="margin-top:10px">Só existe a avaliação basal. A comparação aparece depois da primeira reavaliação.</p></div></div>`}</div>`:''}
  <div class="card" style="margin-top:20px"><div class="card-h"><h2>Linha do tempo</h2><span class="muted sm">${fin.length} atendimento${fin.length===1?'':'s'} · ${p.avaliacoes.length} avalia${p.avaliacoes.length===1?'ção':'ções'}</span></div>
    ${E.length?`<div class="lt">${[...E].reverse().map(e=>itemTempo(p,e)).join('')}</div>`:'<p class="muted">Nenhuma sessão registrada.</p>'}</div>`;
}

function abaAnamnese(p){
  const F=[['historia','História da queixa'],['sono','Sono'],['alimentacao','Alimentação e sede'],['evacuacao','Evacuação e micção'],['emocoes','Emoções'],['medicamentos','Medicamentos em uso']];
  return `<div class="grid g-side"><div class="card"><h3>Anamnese integrativa</h3><div class="form">${F.map(([k,l])=>`<div class="field full"><label class="lbl" for="an-${k}">${l}</label><textarea id="an-${k}" data-anam="${k}">${esc(p.anam[k])}</textarea></div>`).join('')}</div><p class="muted" style="font-size:.8rem;margin-top:8px">Salvo automaticamente ao sair do campo.</p></div>
    <div class="card" style="align-self:start"><h3>Alertas de segurança</h3><p class="muted" style="margin-bottom:10px;font-size:.86rem">Usados para avisar sobre pontos e técnicas contraindicados ao registrar a sessão.</p>
    ${[['gestante','Gestante'],['anticoagulante','Uso de anticoagulante'],['marcapasso','Portador de marcapasso']].map(([k,l])=>`<label style="display:flex;gap:8px;padding:6px 0"><input type="checkbox" id="al-${k}" data-alert="${k}" ${p.alerts[k]?'checked':''}> ${l}</label>`).join('')}</div></div>`;
}

function abaNova(p){
  const a=p.assess.at(-1), outras=p.queixas.filter(q=>q.ativa&&q.id!==QUEIXA_PRINCIPAL);
  const TEC=['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
  return `<div class="grid g-side"><div class="card"><h3>Registro rápido de sessão</h3><p class="muted sm" style="margin-bottom:10px">Para registrar uma sessão já realizada. O atendimento completo, com as 8 etapas, fica em “Novo atendimento”.</p>
    <form id="f-session" class="form">
      <div class="field"><label class="lbl" for="ns-date">Data</label><input id="ns-date" type="date" value="${TODAY}" required></div>
      <div class="field"><label class="lbl" for="ns-eva">${outras.length?`${esc(p.queixa)} (EVA)`:'Intensidade da queixa (EVA)'}: <b id="ns-eva-v">5</b></label><input id="ns-eva" type="range" min="0" max="10" value="5"></div>
      ${outras.map(q=>{ const ult=serieQueixa(p,q.id).at(-1)?.valor??5; return `<div class="field"><label class="lbl" for="ns-q-${q.id}">${esc(q.descricao)}: <b id="ns-q-${q.id}-v">${ult}</b></label><input id="ns-q-${q.id}" data-q="${q.id}" type="range" min="0" max="10" value="${ult}"></div>`; }).join('')}
      <div class="field full"><span class="lbl">Técnicas</span><div class="chips">${TEC.map(t=>`<label class="chip"><input type="checkbox" name="tec" value="${t}" style="margin-right:4px">${t}</label>`).join('')}</div></div>
      <div class="field full"><label class="lbl" for="ns-pts">Pontos utilizados (separe por vírgula)</label><input id="ns-pts" class="mono" placeholder="E36, BP6, F3"></div>
      <div class="full" id="ns-warn"></div>
      <div class="field full"><label class="lbl" for="ns-nota">Evolução e observações</label><textarea id="ns-nota"></textarea></div>
      <div class="full"><button class="btn pri">Salvar no prontuário</button></div>
    </form></div>
    <div class="card" style="align-self:start"><h3>Sugestões da última avaliação</h3><p class="muted" style="font-size:.82rem;margin-bottom:8px">Pontos ligados aos padrões validados. Clique para adicionar.</p>
    ${a?aceitos(a).map(h=>`<div style="margin-bottom:10px"><b>${h.p.nome}</b><div class="chips" style="margin-top:6px">${h.p.pontos.map(([c,j])=>`<button type="button" class="chip mono" data-act="addpt" data-c="${c}" title="${esc(j)}">${c}</button>`).join('')}</div></div>`).join('')||'<p class="muted">Nenhum padrão validado.</p>':'<p class="muted">Sem avaliação.</p>'}</div></div>`;
}

// Versões da avaliação (etapa 3C): todas as avaliações registradas, da basal à mais recente.
const horaV = t => t ? new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
function abaVersoes(p){
  const L=versoesDe(p), B=basalDe(p), num=v=>L.indexOf(v)+1;
  const ctx=v=>{ const at=v.atendimentoId&&p.atendimentos.find(x=>x.id===v.atendimentoId); return at?`Atendimento de ${fmt(at.data)}`:'Reavaliação avulsa (fora de atendimento)'; };
  const A=L.find(v=>v.id===ui.vA)||B, Bv=L.find(v=>v.id===ui.vB)||L.at(-1);
  const sA=new Set(A?.signs||[]), sB=new Set(Bv?.signs||[]), sai=A?A.signs.filter(x=>!sB.has(x)):[], entra=Bv?Bv.signs.filter(x=>!sA.has(x)):[];
  const opt=sel=>L.map(v=>`<option value="${v.id}" ${v===sel?'selected':''}>Versão ${num(v)}${v===B?' · basal':''} · ${fmt(v.date)}</option>`).join('');
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h2>Versões da avaliação</h2><span class="pill acc">${L.length}</span></div>
      <form id="f-reav" class="reav-f"><div class="field"><label class="lbl" for="rv-motivo">Nova reavaliação avulsa: motivo *</label><input id="rv-motivo" required maxlength="200" placeholder="Ex.: piora dos sintomas após viagem"></div>
        <button class="btn sm pri">${ic('mais')}Iniciar reavaliação</button></form>
      ${L.length?`<div class="vers">${[...L].reverse().map(v=>{ const h=v.historico||[], basal=v===B; return `<div class="ver ${basal?'basal':''}"><div class="ver-h"><span class="hi-n">${num(v)}</span><div class="grow"><b>Versão ${num(v)}${basal?' · avaliação basal':''}</b><small class="muted">${fmt(v.date)}${v.prof&&h[0]?.em?' às '+horaV(h[0].em):''} · ${v.prof?esc(v.prof):'profissional não registrado'}</small></div>
          ${basal?`<span class="pill">${ic('escudo')}bloqueada</span>`:''}</div>
        <div class="ver-m"><span>${ic(v.atendimentoId?'play':'yin')}${ctx(v)}</span><span>${ic('info')}Motivo: ${v.motivo?esc(v.motivo):v.atendimentoId?'avaliação do atendimento':'não informado'}</span><span>${ic('lista')}${v.signs.length} sinais</span></div>
        ${h.length?`<details class="mais"><summary>Histórico desta versão (${h.length}) ${ic('baixo')}</summary><div class="hist-alt">${h.map(x=>`<div><span class="mono muted">${x.em?fmt(x.em.slice(0,10))+' '+horaV(x.em):''}</span><span>${esc(x.acao)}${x.anterior?`<small class="muted" style="display:block">Antes: ${x.anterior.signs.map(k=>esc(SIGN[k]||k)).join(', ')||'nenhum sinal'}</small>`:''}</span></div>`).join('')}</div></details>`:''}</div>`; }).join('')}</div>`
        :vazio('yin','Nenhuma avaliação registrada','A primeira avaliação vira a basal.')}
      <p class="muted sm" style="margin-top:10px">A basal nunca é sobrescrita: cada avaliação nova cria outra versão. Correções feitas depois de finalizar um atendimento ficam no histórico da versão, com os valores anteriores.</p></div>
    <div class="card" style="align-self:start"><div class="card-h"><h2>Comparar duas versões</h2></div>
      ${L.length>1?`<div class="form"><div class="field"><label class="lbl" for="v-a">De</label><select id="v-a" data-vcmp="vA">${opt(A)}</select></div><div class="field"><label class="lbl" for="v-b">Para</label><select id="v-b" data-vcmp="vB">${opt(Bv)}</select></div></div>
      <div class="cmp" style="margin-top:10px"><div><div class="lbl">Versão ${num(A)}</div>${pentagram(elemState(A.signs,A.status),null)}</div><div><div class="lbl">Versão ${num(Bv)}</div>${pentagram(elemState(Bv.signs,Bv.status),null)}</div></div>
      ${barrasEl(elemState(Bv.signs,Bv.status),elemState(A.signs,A.status))}<p class="muted sm" style="margin-top:6px">Marca vertical: versão ${num(A)}.</p>
      <div class="sinais-cmp" style="margin-top:12px"><div><span class="pill ok">${sai.length} não aparecem mais</span><p class="muted sm">${sai.map(x=>esc(SIGN[x]||x)).join(', ')||'—'}</p></div><div><span class="pill warn">${entra.length} novos</span><p class="muted sm">${entra.map(x=>esc(SIGN[x]||x)).join(', ')||'—'}</p></div></div>`
      :'<p class="muted sm">A comparação aparece quando houver duas versões.</p>'}</div></div>`;
}

// CID-10: busca por código ou descrição (a lista carrega na primeira busca) e os CIDs do paciente.
function abaCid(p){
  const A=diagnosticosAtivos(p), R=(p.diagnosticos||[]).filter(d=>d.ativo===false), C=ui.cid||{};
  const quando=t=>fmt(String(t).slice(0,10));
  return `<div class="grid g-side"><div class="card" id="cid-card"><div class="card-h"><h2>CID-10 do paciente</h2><span class="pill acc">${A.length}</span></div>
      <div class="cid-busca"><label class="lbl" for="cid-q">Buscar CID por código ou descrição</label>
        <input id="cid-q" data-cid="q" value="${esc(C.q||'')}" placeholder="Ex.: F41 ou ansiedade" autocomplete="off" role="combobox" aria-expanded="${!!C.lista?.length}" aria-controls="cid-l">
        <div id="cid-l" class="cid-l" role="listbox">${cidLista(C)}</div></div>
      ${A.length?`<div class="cid-sel">${A.map(d=>`<div class="cid-i" data-d="${d.id}"><b class="mono">${esc(d.codigo)}</b><span class="grow">${esc(d.descricao)}<small class="muted">incluído em ${quando(d.em)}${d.por?' · '+esc(d.por):''}</small></span><button class="btn ghost sm" data-act="cid-tirar" data-d="${d.id}" aria-label="Retirar ${esc(d.codigo)}" data-tip="Retirar">${ic('x')}</button></div>`).join('')}</div>`
        :`<p class="muted sm" style="margin-top:12px">Nenhum CID registrado. Digite uma letra, um número ou parte da descrição e escolha na lista.</p>`}
      ${R.length?`<details class="mais"><summary>${R.length} CID${R.length===1?' retirado':'s retirados'} ${ic('baixo')}</summary><div class="cid-sel">${R.map(d=>`<div class="cid-i fora"><b class="mono">${esc(d.codigo)}</b><span class="grow">${esc(d.descricao)}<small class="muted">incluído em ${quando(d.em)} · retirado em ${quando(d.retiradoEm)}${d.retiradoPor?' · '+esc(d.retiradoPor):''}</small></span></div>`).join('')}</div></details>`:''}</div>
    <div class="card" style="align-self:start"><h3>Sobre o CID</h3><p class="muted sm">Tabela CID-10 do DATASUS (Ministério da Saúde). Os CIDs ficam no prontuário e aparecem no resumo do paciente. Retirar um CID não apaga: ele fica na lista de retirados, com a data.</p></div></div>`;
}
export function cidLista(C){
  if(C.carregando) return `<p class="muted sm cid-msg">Carregando a tabela CID-10…</p>`;
  if(C.erro) return `<p class="muted sm cid-msg">${esc(C.erro)}</p>`;
  if(!C.q?.trim()) return '';
  if(!C.lista?.length) return `<p class="muted sm cid-msg">Nenhum CID encontrado para “${esc(C.q)}”.</p>`;
  return C.lista.map((x,i)=>`<button type="button" class="cid-o ${i===(C.i|0)?'on':''}" role="option" aria-selected="${i===(C.i|0)}" data-act="cid-add" data-c="${esc(x.c)}" data-d="${esc(x.d)}"><b class="mono">${esc(x.c)}</b><span>${esc(x.d)}</span></button>`).join('');
}
const abaMtc = f => p => pode('mtc') ? f(p) : bloqueio('mtc');
const ABAS = { resumo:abaResumo, sessoes:abaProntuario, anamnese:abaAnamnese, avaliacao:abaMtc(()=>vAvaliacao(true)), pentagrama:abaMtc(()=>vPentagrama(true)), versoes:abaVersoes, cid:abaCid, nova:abaNova };
export function vProntuario(){
  const p=patient(ui.pid)||db.patients[0];
  if(!p) return `<div class="head"><div><h1>Prontuário</h1></div></div>${vazio('pacientes','Nenhum paciente cadastrado','Cadastre um paciente para abrir o prontuário.',`<button class="btn pri sm" data-act="novo-paciente">${ic('novo')}Cadastrar paciente</button>`)}`;
  ui.pid=p.id; if(!ABAS[ui.tab]) ui.tab='resumo';
  const alerts=alertasDe(p);
  const tabs=[['resumo','Resumo','painel'],['sessoes','Atendimentos','historico'],['anamnese','Anamnese e alertas','folha'],['avaliacao','Avaliação energética','yin'],['pentagrama','Pentagrama','estrela'],['versoes','Versões da avaliação','historico'],['cid','CID','lista'],['nova','Registro rápido','mais']];
  const cids=diagnosticosAtivos(p);
  ui.crumbs=[['#pacientes','Pacientes'],[null,p.name]];
  return `<div class="perfil-h"><span class="avatar xl">${initials(p.name)}</span><div class="grow"><h1>${esc(p.name)}</h1>
    <div class="meta"><span>${p.birth?age(p.birth)+' anos':'idade não informada'}</span>${p.phone?`<span>${ic('tel')}${esc(p.phone)}</span>`:''}${p.cadastro?.cidade?`<span>${ic('local')}${esc(p.cadastro.cidade)}</span>`:''}${p.exemplo?'<span class="pill ex">exemplo</span>':''}</div>
    ${alerts.length||cids.length?`<div class="chips" style="margin-top:8px">${alerts.map(x=>`<span class="pill crit">${ic('escudo')}${x}</span>`).join('')}${cids.map(d=>`<button class="pill cid-pill" data-act="tab" data-t="cid" data-tip="${esc(d.descricao)}">CID ${esc(d.codigo)}</button>`).join('')}</div>`:''}</div>
    <div class="perfil-a">${botaoHistorico(p.id)}<button class="btn" data-act="editar-paciente" data-pid="${p.id}">${ic('editar')}Cadastro</button><button class="btn" data-act="doc-abrir" data-pid="${p.id}">${ic('doc')}Documentos</button><button class="btn pri" data-act="novo-atendimento" data-pid="${p.id}">${ic('play')}${rascunhoDe(p)?'Continuar atendimento':'Novo atendimento'}</button></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k,l,i])=>`<button role="tab" data-act="tab" data-t="${k}" class="${ui.tab===k?'on':''}" aria-selected="${ui.tab===k}">${ic((k==='avaliacao'||k==='pentagrama')&&!pode('mtc')?'cadeado':i)}${l}</button>`).join('')}</div>${ABAS[ui.tab](p)}${ui.edReg?janelaEdicao(p):''}`;
}
