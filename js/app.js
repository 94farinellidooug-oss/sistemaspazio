// Ponto de entrada: rotas, renderização e eventos.
import { db, exportarV1, exportarV2, importar, patient, restaurarExemplos, save } from './dados/repositorio.js';
import { adicionarQueixa, alternarQueixa, hidratarPaciente, novoPaciente, registrarAvaliacao, registrarSessao } from './dados/migracao.js';
import { ui } from './estado.js';
import { pointWarnings } from './raciocinio/seguranca.js';
import { formAgenda, vAgenda } from './telas/agenda.js';
import { docAtual, folhaDoc, ligarPad, painelAss, previaDoc, textoComCampos, vDocumentos } from './telas/documentos.js';
import { vRelacionamento } from './telas/relacionamento.js';
import { servicoPacote, vFinanceiro } from './telas/financeiro.js';
import { dadosNota, desfazerRecebimento, faltaDe, financeiroDe, lerValor, novaDespesa, novoPacote, receber, removerDespesa } from './dados/financeiro.js';
import { abrirPainelWa, painelWa, textoComCamposWa, vMensagens } from './telas/whatsapp.js';
import { linkWa, registrarMensagem, salvarMensagemWa, voltarMensagemWa } from './dados/whatsapp.js';
import { naoRetomar, novoInteressado, registrarContato, situacaoInteressado, virouPaciente } from './dados/relacionamento.js';
import { MODELOS_DOC, apagarModelo, assinarNaTela, guardarDocumento, marcarAssinado, modeloDoc, salvarModelo, voltarOriginal } from './dados/documentos.js';
import { concluirHorario, conflito, desmarcar, marcarHorario, novoHorario, remarcar } from './dados/agenda.js';
import { vAvaliacao } from './telas/avaliacao.js';
import { atendimentoAberto, indicadosMarca, textoSalvo, vAtendimento } from './telas/atendimento.js';
import { TIPOS_MARCA, LADOS_MARCA, adicionarMarca, editarMarca, marcasDe, removerMarca, CATEGORIAS, PARES_VASOS, adicionarAchadoLivre, definirVaso, ehBasal, fotoVersao, registrarCorrecao, alternarAchado, alternarPulso, avaliacaoEditavel, definirAchado, definirAchadoLivre, definirPulso, notaCategoria, removerAchadoLivre, descartarRascunho, finalizarAtendimento, iniciarAtendimento, rascunhoDe, registrarAlteracao } from './dados/atendimento.js';
import { cpfFormatado, cpfValido, previaCadastro, vCadastro } from './telas/cadastro.js';
import { EM_BREVE, vAdministracao, vEmBreve } from './telas/em-breve.js';
import { PROF, listaBusca, renderNav } from './telas/menu.js';
import { notificacoes } from './dados/indicadores.js';
import { LOGO, ic } from './componentes/icones.js';
import { FACES, MERIDIANOS, TAM, VASOS_ATLAS, ladoDe, regiaoDoToque } from './componentes/corpo.js';
import { patientRows, vPacientes } from './telas/pacientes.js';
import { vPainel } from './telas/painel.js';
import { vPentagrama } from './telas/pentagrama.js';
import { listaTodos, pointCards, vPontos } from './telas/pontos.js';
import { corrigirPonto, linhaRx, definirLado, definirMotivo, definirSituacao, definirStatus, esquecerPonto, todosRealizados } from './dados/prescricao.js';
import { adicionarFichaParticular, definirNotaPonto, removerFichaParticular, revisarPosicao } from './dados/biblioteca.js';
import { CODIGOS } from './conhecimento/pontos.js';
import { vProntuario } from './telas/prontuario.js';
import { TODAY, addDays, brl, esc, fmt, uid } from './util.js';

export const VIEWS={painel:vPainel,agenda:vAgenda,pacientes:vPacientes,prontuario:vProntuario,cadastro:vCadastro,atendimento:vAtendimento,avaliacao:vAvaliacao,pentagrama:vPentagrama,pontos:vPontos,biblioteca:vPontos,administracao:vAdministracao,documentos:vDocumentos,crm:vRelacionamento,mensagens:vMensagens,financeiro:()=>{ if(financeiroDe(db,TODAY)[1]) save(); return vFinanceiro(); }};
EM_BREVE.forEach(k=>VIEWS[k]=()=>vEmBreve(k));
export function route(){ const r=location.hash.slice(1); return VIEWS[r]?r:'painel'; }
let ultimaRota='';
export function render(keepScroll){
  const r=route(), y=scrollY, v=document.getElementById('view');
  ui.crumbs=[]; const html=VIEWS[r](); renderNav(r);
  v.innerHTML=html;
  if(ui.ov==='ass'){ document.getElementById('camada').innerHTML=painelAss(); ligarPad(); }
  if(ui.ov==='wa'){ const c=document.getElementById('camada'); c.innerHTML=painelWa(); if(!c.innerHTML) ui.ov=null; }
  // Transição suave só quando a tela muda (não a cada clique dentro dela).
  if(r!==ultimaRota){ v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultimaRota=r; }
  if(keepScroll) scrollTo(0,y);
}
export function toast(m, tipo='ok'){ const t=document.getElementById('toast'); t.className='toast '+tipo; t.innerHTML=`${ic(tipo==='ok'?'okc':'info')}<span></span>`; t.lastChild.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,2600); }
// Camadas sobre a tela: busca global, notificações, perfil e atalhos.
function abrir(ov){ ui.ov=ui.ov===ov?null:ov; if(ov==='busca'){ ui.q=''; ui.bi=0; } render(true); }
// Abre a tela (ou a re-renderiza, se já estiver nela).
function irPara(h){ if(location.hash.slice(1)===h) render(); else location.hash=h; }
// Dica flutuante para elementos com data-tip (botões de ícone, gráficos, calendário).
const tip=document.getElementById('tip');
document.addEventListener('mouseover',ev=>{ const t=ev.target.closest('[data-tip]'); if(!t||!t.dataset.tip){ tip.hidden=true; return; }
  tip.textContent=t.dataset.tip; tip.hidden=false; const b=t.getBoundingClientRect(), w=tip.offsetWidth;
  tip.style.left=Math.max(8,Math.min(innerWidth-w-8,b.left+b.width/2-w/2))+'px'; tip.style.top=(b.top-tip.offsetHeight-8<4?b.bottom+8:b.top-tip.offsetHeight-8)+'px'; });
addEventListener('scroll',()=>{ tip.hidden=true; },{passive:true});
addEventListener('hashchange',()=>{ if(route()!=='cadastro') ui.editPid=null; ui.menuAberto=false; ui.ov=null; tip.hidden=true; render(); scrollTo(0,0); });
addEventListener('keydown',ev=>{
  const emCampo=ev.target.matches('input, textarea, select');
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ ev.preventDefault(); abrir('busca'); return; }
  if(ev.key==='Escape'){ if(ui.ov){ ui.ov=null; render(true); } else if(ui.menuAberto){ ui.menuAberto=false; render(true); } return; }
  if(ui.ov==='busca'&&['ArrowDown','ArrowUp','Enter'].includes(ev.key)){ ev.preventDefault(); const L=document.querySelectorAll('.pal-i');
    if(ev.key==='Enter'){ L[ui.bi]?.click(); return; } ui.bi=(ui.bi+(ev.key==='ArrowDown'?1:-1)+L.length)%Math.max(1,L.length); document.getElementById('pal-l').innerHTML=listaBusca(); return; }
  if(ev.altKey&&route()==='atendimento'&&(ev.key==='ArrowLeft'||ev.key==='ArrowRight')){ ev.preventDefault(); irEtapa((ui.etapa|0)+(ev.key==='ArrowRight'?1:-1)); return; }
  if(emCampo||ev.ctrlKey||ev.metaKey||ev.altKey) return;
  if(ev.key==='/'){ ev.preventDefault(); abrir('busca'); }
  else if(ev.key==='['){ ui.menuMini=!ui.menuMini; render(true); }
  else if(ev.key==='?'){ abrir('atalhos'); }
});
document.addEventListener('click',ev=>{
  tip.hidden=true;
  // Clique fora de uma camada aberta fecha a camada.
  if(ui.ov && !ev.target.closest('.dd-p, .pal, [data-act="busca"], [data-act="notif"], [data-act="perfil"], [data-act="atalhos"]')){ const fora=!ev.target.closest('[data-act],a'); ui.ov=null; render(true); if(fora) return; }
  // Itens da busca e das notificações: marcam como lida, fecham a camada e abrem o destino.
  const item=ev.target.closest('.pal-i, .dd-p .nt');
  if(item){ if(item.dataset.lida) ui.lidas.add(item.dataset.lida); ui.ov=null;
    if(item.getAttribute('href')==='#cadastro') ui.editPid=null;
    if(item.matches('a[href]')){ ev.preventDefault(); irPara(item.getAttribute('href').slice(1)); return; } }
  // Mapa corporal do atendimento: toque no desenho marca, seleciona ou define o destino da irradiação.
  const sv=ev.target.closest('svg.mapa4[data-mapa="atendimento"]'); if(sv){ toqueMapa(ev,sv); return; }
  // Atlas: toque num ponto abre a ficha; num trajeto, o painel do meridiano ou do vaso.
  const sa=ev.target.closest('svg.mapa4[data-mapa="atlas"]');
  if(sa){ const pt=ev.target.closest('.ptp'), tj=ev.target.closest('.tj'); if(pt){ ui.atlas.sel=pt.dataset.pt; ui.atlas.traj=null; render(true); } else if(tj){ ui.atlas.traj=tj.dataset.tj; ui.atlas.sel=null; render(true); } return; }
  const t=ev.target.closest('[data-act]'); if(!t||t.disabled) return;
  const a=t.dataset.act;
  if(a==='open'){ ui.pid=t.dataset.pid; ui.tab='resumo'; irPara('prontuario'); }
  // Financeiro (etapa 8)
  else if(a==='fin-receber'){ const x=db.appts.find(z=>z.id===t.dataset.ap); ui.finRec={ap:x.id,forma:'Pix',valor:String(faltaDe(db,x)).replace('.',',')}; render(true); document.getElementById('rec-v')?.focus(); }
  else if(a==='fin-forma'){ ui.finRec.valor=document.getElementById('rec-v').value; ui.finRec.forma=t.dataset.f; render(true); }
  else if(a==='fin-rec-x'){ ui.finRec=null; render(true); }
  else if(a==='fin-desf'){ ui.finDesf=t.dataset.r; render(true); }
  else if(a==='fin-desf-x'){ ui.finDesf=null; render(true); }
  else if(a==='fin-desf-ok'){ desfazerRecebimento(db,t.dataset.r); ui.finDesf=null; save(); render(true); toast('Recebimento desfeito; voltou para A receber','info'); }
  else if(a==='fin-nota'){ const r=db.financeiro?.recebimentos.find(x=>x.id===t.dataset.r); if(!r) return; const tx=dadosNota(db,r);
    (navigator.clipboard?.writeText(tx)||Promise.reject()).then(()=>toast('Dados da nota copiados'),()=>toast('Não deu para copiar: '+tx.replace(/\n/g,' · '),'info')); }
  else if(a==='fin-novo-pac'){ const pid=[...db.patients].sort((x,y)=>x.name.localeCompare(y.name))[0]?.id; ui.finPac={pid,total:'10',valor:''}; render(true); }
  else if(a==='fin-pac-x'){ ui.finPac=null; render(true); }
  else if(a==='fin-desp-x'){ ui.finDespX=t.dataset.d; render(true); }
  else if(a==='fin-desp-n'){ ui.finDespX=null; render(true); }
  else if(a==='fin-desp-ok'){ removerDespesa(db,t.dataset.d,TODAY.slice(0,7)); ui.finDespX=null; save(); render(true); toast('Despesa tirada deste mês','info'); }
  else if(a==='novo-atendimento'){ const p=patient(t.dataset.pid||ui.pid); let x=rascunhoDe(p);
    if(!x){ x=iniciarAtendimento(p,{id:uid(),data:TODAY},new Date().toISOString()); save(); }
    ui.pid=p.id; ui.atId=x.id; ui.etapa=0; ui.avAba=0; ui.el=null; ui.atCmp=false; limparMapa(); irPara('atendimento'); scrollTo(0,0); }
  else if(a==='abrir-atendimento'){ ui.pid=t.dataset.pid; ui.atId=t.dataset.id; fotografarAvaliacao(); ui.etapa=0; ui.avAba=0; ui.el=null; ui.atCmp=false; limparMapa(); irPara('atendimento'); scrollTo(0,0); }
  else if(a==='etapa'){ ev.preventDefault(); irEtapa(Number(t.dataset.i)); }
  else if(a.startsWith('at-')){ acaoAtendimento(a,t); }
  else if(a==='novo-paciente'){ ui.editPid=null; ui.cadPrevio=null; irPara('cadastro'); }
  else if(a==='editar-paciente'){ ui.editPid=t.dataset.pid; irPara('cadastro'); }
  else if(a==='queixa-ativa'){ const q=alternarQueixa(patient(ui.pid),t.dataset.q,new Date().toISOString()); if(q){ save(); render(true); toast(q.ativa?'Queixa reativada':'Queixa marcada como resolvida'); } }
  else if(a==='sessao'){ ui.pid=t.dataset.pid; ui.tab='nova'; irPara('prontuario'); }
  else if(a==='ver-ponto'){ ui.ptQ=t.dataset.c; ui.ptMer=''; ui.bib='central'; irPara('biblioteca'); }
  else if(a.startsWith('bib-')||a.startsWith('atl-')){ acaoBiblioteca(a,t); }
  else if(a==='busca'||a==='notif'||a==='perfil'||a==='atalhos'){ abrir(a); }
  else if(a==='fechar'){ ui.ov=null; render(true); }
  else if(a==='fechar-ir'){ ui.ov=null; ui.wa=null; }
  else if(a==='wa'){ abrirPainelWa(t.dataset.t,t.dataset.pid,t.dataset.ap); render(true); document.getElementById('wa-t')?.focus(); }
  else if(a==='wa-tipo'){ abrirPainelWa(t.dataset.k,ui.wa.pid,ui.wa.ap); render(true); }
  else if(a==='wa-abrir'){ const W=ui.wa, p=patient(W?.pid), url=p&&linkWa(p.phone,document.getElementById('wa-t').value); if(!url) return;
    window.open(url,'_blank','noopener'); const em=new Date().toISOString(); registrarMensagem(p,{tipo:W.tipo,em,por:PROF.nome,ap:W.ap});
    if(W.tipo==='retomar') registrarContato(p,em,PROF.nome); ui.ov=null; ui.wa=null; save(); render(true); toast(W.tipo==='retomar'?'WhatsApp aberto; contato registrado':'WhatsApp aberto com a mensagem'); }
  else if(a==='msg-campo'){ const ta=t.closest('form').querySelector('textarea'), c=`{${t.dataset.k}}`, i=ta.selectionStart??ta.value.length, f=ta.selectionEnd??i;
    ta.value=ta.value.slice(0,i)+c+ta.value.slice(f); ta.focus(); ta.setSelectionRange(i+c.length,i+c.length); ta.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(a==='msg-orig'){ if(voltarMensagemWa(db,t.dataset.k)){ save(); render(true); toast('Mensagem de volta ao texto original'); } }
  else if(a==='ler-todas'){ notificacoes().forEach(n=>ui.lidas.add(n.k)); ui.ov=null; render(true); toast('Notificações marcadas como lidas'); }
  else if(a==='aviso'){ ui.ov=null; render(true); toast(t.dataset.m,'info'); }
  else if(a==='dia'){ ui.dia=t.dataset.d; render(true); }
  else if(a==='rolar'){ const d=document.getElementById(t.dataset.to); d?.scrollIntoView({behavior:'smooth',block:'start'}); d?.querySelector('input')?.focus({preventScroll:true}); }
  else if(a==='serie'){ const on=t.getAttribute('aria-pressed')!=='false'; t.setAttribute('aria-pressed',String(!on)); t.closest('.card').querySelectorAll(`.chart .se[data-s="${t.dataset.s}"]`).forEach(g=>g.classList.toggle('oculta',on)); }
  else if(a==='book'){ ui.bookPid=t.dataset.pid; ui.agForm=null; ui.remarcar=null; }
  else if(a==='tab'){ ui.tab=t.dataset.t; render(true); }
  else if(a==='sign'){ const s=t.dataset.s, L=ui.assess.signs; const i=L.indexOf(s); i<0?L.push(s):L.splice(i,1); render(true); }
  else if(a==='hyp'){ const id=t.dataset.p; ui.assess.status[id] = ui.assess.status[id]===t.dataset.st ? '' : t.dataset.st; render(true); }
  else if(a==='save-assess'){ const A=ui.assess, p=patient(A.pid); const nv=registrarAvaliacao(p,{id:uid(),date:TODAY,signs:[...A.signs],status:{...A.status},nota:A.nota},new Date().toISOString()); nv.prof=PROF.nome; const rm=ui.reavMotivo?.pid===p.id; if(rm) nv.motivo=ui.reavMotivo.motivo; ui.reavMotivo=null; save(); ui.pid=p.id; ui.tab=rm?'versoes':'resumo'; ui.assess=null; toast('Avaliação salva no prontuário'); location.hash='prontuario'; }
  else if(a==='el'){ ui.el = t.dataset.e && ui.el!==t.dataset.e ? t.dataset.e : null; render(true); }
  else if(a==='mer'){ ui.ptMer=t.dataset.m; render(true); }
  else if(a==='week'||a==='ag-dia'){ ui.agDia = a==='ag-dia'?t.dataset.d:t.dataset.d==='0'?TODAY:addDays(7*Number(t.dataset.d),ui.agDia||TODAY);
    if(!ui.remarcar){ const F=formAgenda(); F.date=ui.agDia; F.time=''; } render(true); }
  else if(a==='ag-livre'){ formAgenda().time=t.dataset.h; render(true); document.getElementById('na-t')?.focus({preventScroll:true}); }
  else if(a==='ag-st'){ const x=db.appts.find(z=>z.id===t.dataset.id); if(x && marcarHorario(x,t.dataset.s)){ save(); render(true); } }
  else if(a==='ag-desm'){ const x=db.appts.find(z=>z.id===t.dataset.id); if(!x) return; desmarcar(x,TODAY); if(ui.remarcar===x.id){ ui.remarcar=null; ui.agForm=null; } save(); render(true); toast(`Horário de ${patient(x.pid)?.name.split(' ')[0]||''} desmarcado; ele fica na lista de desmarcados`,'info'); }
  else if(a==='ag-rem'){ const x=db.appts.find(z=>z.id===t.dataset.id); if(!x) return; ui.remarcar=x.id; ui.agForm={pid:x.pid,date:x.date,time:'',tipo:x.tipo}; ui.agDia=x.date; render(true); document.getElementById('f-appt')?.scrollIntoView({block:'nearest'}); }
  else if(a==='rel-agendar'){ ui.bookPid=t.dataset.pid; ui.agForm=null; ui.remarcar=null; ui.agDia=TODAY; irPara('agenda'); }
  else if(a==='rel-contato'){ registrarContato(patient(t.dataset.pid),new Date().toISOString(),PROF.nome); save(); render(true); toast('Contato registrado'); }
  else if(a==='rel-ocultar'||a==='rel-volta'){ naoRetomar(patient(t.dataset.pid),a==='rel-ocultar',new Date().toISOString(),PROF.nome); save(); render(true); if(a==='rel-ocultar') toast('Tirado da lista de retomar contato','info'); }
  else if(a==='rel-ver-oc'){ ui.relOcultos=!ui.relOcultos; render(true); }
  else if(a==='int-sit'){ const i=(db.interessados||[]).find(x=>x.id===t.dataset.id); if(!i) return;
    if(t.dataset.s==='paciente' && !i.pid){ ui.editPid=null; ui.cadPrevio={name:i.nome,phone:i.tel,intId:i.id}; irPara('cadastro'); return; }
    if(situacaoInteressado(i,t.dataset.s)){ save(); render(true); } }
  else if(a==='doc-abrir'){ ui.docPid=t.dataset.pid; ui.docMod=t.dataset.m||null; ui.docEd=null; irPara('documentos'); }
  else if(a==='doc-mod'){ ui.docMod=t.dataset.m; render(true); }
  else if(a==='doc-assinar'||a==='ass-limpar'){ ui.ov='ass'; render(true); }
  else if(a==='ass-ok'){ const c=document.getElementById('ass-c'), {p,k}=docAtual(); if(!c||!p) return; ui.docAss={pid:p.id,k,img:c.toDataURL('image/png'),em:new Date().toISOString()}; ui.ov=null; render(true); toast('Assinatura registrada; guarde no prontuário para salvar'); }
  else if(a==='doc-imp'||a==='doc-guardar'){ const {p,k,nome,assina,texto,ass}=docAtual();
    if(!texto){ toast('O documento está sem texto; edite o modelo antes','info'); return; }
    if(a==='doc-imp'){ document.getElementById('imp').innerHTML=folhaDoc(nome,assina,p,texto,TODAY,PROF.nome,ass); window.print(); return; }
    const d=guardarDocumento(p,{id:uid(),modelo:k,texto,em:new Date().toISOString(),por:PROF.nome},db.modelosDoc); if(d&&ass) assinarNaTela(p,d.id,{img:ass.img,em:ass.em,por:PROF.nome}); ui.docAss=null; save(); render(true); toast(`${nome} guardado no prontuário de ${p.name.split(' ')[0]}${ass?', com a assinatura':''}`); }
  else if(a==='doc-ass'){ const {p}=docAtual(); if(marcarAssinado(p,t.dataset.id,new Date().toISOString(),PROF.nome)){ save(); render(true); toast('Termo marcado como assinado'); } }
  else if(a==='doc-reimp'){ const {p}=docAtual(), d=(p.documentos||[]).find(x=>x.id===t.dataset.id); if(!d) return; const md=modeloDoc(d.modelo,db.modelosDoc);
    document.getElementById('imp').innerHTML=folhaDoc(d.nome||md?.[1]||'Documento',d.assina??md?.[3],p,d.texto,d.em.slice(0,10),d.por,d.naTela?{img:d.assinatura,em:d.assinadoEm}:null); window.print(); }
  else if(a==='doc-editar'){ const {m}=docAtual(); ui.docAss=null; ui.docMod=m[0]; ui.docEd={nome:m[1],texto:m[4],assina:m[3]}; render(true); document.getElementById('m-texto')?.focus(); }
  else if(a==='doc-novo-mod'){ ui.docEd={novo:true,nome:'',texto:'Eu, {paciente}, ',assina:true}; render(true); document.getElementById('m-nome')?.focus(); }
  else if(a==='doc-ed-x'){ ui.docEd=null; render(true); }
  else if(a==='doc-ed-orig'){ const o=MODELOS_DOC.find(x=>x[0]===ui.docMod); if(!o) return; if(!confirm('Voltar este modelo ao texto original? A sua versão será descartada.')) return;
    voltarOriginal(db,o[0]); ui.docEd=null; save(); render(true); toast('Modelo de volta ao texto original'); }
  else if(a==='doc-ed-apagar'){ const m=modeloDoc(ui.docMod,db.modelosDoc); if(!m||!confirm(`Apagar o modelo “${m[1]}”? Os documentos já guardados continuam no prontuário.`)) return;
    apagarModelo(db,m[0]); ui.docEd=null; ui.docMod=null; save(); render(true); toast('Modelo apagado','info'); }
  else if(a==='doc-campo'){ const ta=document.getElementById('m-texto'), c=`{${t.dataset.k}}`, i=ta.selectionStart??ta.value.length, f=ta.selectionEnd??i;
    ta.value=ta.value.slice(0,i)+c+ta.value.slice(f); ui.docEd.texto=ta.value; ta.focus(); ta.setSelectionRange(i+c.length,i+c.length); previaModelo(); }
  else if(a==='ag-rem-x'){ ui.remarcar=null; ui.agForm=null; render(true); }
  else if(a==='addpt'){ const i=document.getElementById('ns-pts'); const L=i.value.split(',').map(s=>s.trim()).filter(Boolean); if(!L.includes(t.dataset.c)) L.push(t.dataset.c); i.value=L.join(', '); i.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(a==='menu-mini'){ ui.menuMini=!ui.menuMini; render(true); }
  else if(a==='menu-abrir'){ ui.menuAberto=!ui.menuAberto; render(true); }
  else if(a==='menu-fechar'){ ui.menuAberto=false; render(true); }
  else if(a==='ir'){ ui.pid=t.dataset.pid; if(t.dataset.to==='avaliacao') ui.assess=null; if(t.dataset.to==='pentagrama') ui.el=null; irPara(t.dataset.to); }
  else if(a==='exportar'){ baixar(t.dataset.f==='v1'?exportarV1():exportarV2(), `${t.dataset.f==='v1'?'spazio-v1':'musubi'}-dados-${TODAY}.json`); toast('Arquivo exportado'); }
  else if(a==='reset'){ restaurarExemplos(); ui.assess=null; ui.pid='p1'; toast('Dados de exemplo restaurados'); render(); }
});
document.addEventListener('keydown',ev=>{ if((ev.key==='Enter'||ev.key===' ') && ev.target.matches('.node')){ ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true})); }});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.dataset.agf==='time'){ formAgenda().time=t.value; return; }
  if(t.dataset.int&&t.tagName==='INPUT'){ (ui.novoInt||={nome:'',tel:'',origem:'Instagram'})[t.dataset.int]=t.value; return; }
  if(t.dataset.msg){ const r=document.querySelector(`[data-raw="${t.dataset.msg}"]`); if(r) r.innerHTML=textoComCamposWa(t.value); return; }
  if(t.dataset.doced&&ui.docEd){ ui.docEd[t.dataset.doced]=t.type==='checkbox'?t.checked:t.value; previaModelo(); return; }
  if(t.id==='pal-q'){ ui.q=t.value; ui.bi=0; document.getElementById('pal-l').innerHTML=listaBusca(); return; }
  if(t.id==='pq'){ ui.pq=t.value; document.getElementById('plist').innerHTML=patientRows(); }
  else if(t.id==='pt-q'){ ui.ptQ=t.value; document.getElementById('ptlist').innerHTML=pointCards(); const ct=document.getElementById('c-todos'); if(ct) ct.innerHTML=listaTodos(); }
  else if(t.dataset.bibnota){ definirNotaPonto(db,t.dataset.bibnota,t.value); save(); }
  else if(t.id==='as-nota'){ ui.assess.nota=t.value; }
  else if(t.id==='ns-eva'){ document.getElementById('ns-eva-v').textContent=t.value; }
  else if(t.dataset.q&&t.type==='range'){ document.getElementById(t.id+'-v').textContent=t.value; }
  else if(t.id==='np-name'||t.id==='np-q'){ previaCadastro(); }
  else if(t.id==='np-cpf'){ t.setCustomValidity(''); }
  if(t.id==='ns-pts'||t.name==='tec') sessionWarn();
  if(t.dataset.rxmot||t.dataset.atorient){ const x=atendimentoAberto(); if(!x) return;
    if(t.dataset.rxmot){ if(x.a.status==='rascunho'&&definirMotivo(x.a,t.dataset.rxmot,t.value)) mudou(`plano terapêutico: motivo de ${t.dataset.rxmot} não realizado`,false); }
    else { x.a.plano.orient=t.value; mudou('plano terapêutico: orientações para casa',false); } return; }
  if(t.dataset.rxc){ if(ui.rxCorr) ui.rxCorr[t.dataset.rxc]=t.value; return; }
  if(t.dataset.mk&&t.tagName!=='SELECT'){ const x=atendimentoAberto(); if(x&&editarMarca(x.a,ui.mapa.sel,t.dataset.mk,t.value)) mudou(`mapa corporal: ${({procedimento:'procedimento',regiao:'região',nota:'anotação'})[t.dataset.mk]||t.dataset.mk} da marcação`,false); if(t.dataset.mk==='regiao'){ const x=atendimentoAberto(), m=x&&marcasDe(x.a).find(y=>y.id===ui.mapa.sel), e=document.getElementById('mk-ind'); if(m&&e) e.outerHTML=indicadosMarca(x.p,x.a,m); } return; }
  // Ambiente de atendimento: salva a cada alteração, sem redesenhar a tela enquanto se digita.
  const x=(t.dataset.atq||t.dataset.atan||t.dataset.atf||t.dataset.vnota||t.dataset.atp||t.dataset.atr||t.dataset.atln)&&atendimentoAberto(); if(!x) return;
  if(t.dataset.atln){ const av=avaliacaoEditavel(x.p,x.a); if(!av||travada(x.p,x.a,av)) return; notaCategoria(av,t.dataset.atln,t.value); mudou(`avaliação energética: ${catNome(t.dataset.atln)}: anotações`,false); return; }
  if(t.dataset.atp||t.dataset.atr){ const av=avaliacaoEditavel(x.p,x.a); if(!av||travada(x.p,x.a,av)) return;
    if(t.dataset.atp) definirPulso(av,t.dataset.atp,t.value); else av[t.dataset.atr]=t.value;
    mudou(t.dataset.atp?'avaliação energética: pulso':({linguaObs:'avaliação energética: língua',bgInterp:'avaliação energética: Ba Gang',interp:'avaliação energética: interpretação do pentagrama'})[t.dataset.atr],false); return; }
  if(t.dataset.atq){ x.a.evolucao.intensidades[t.dataset.atq]=Number(t.value); document.getElementById('qv-'+t.dataset.atq).textContent=t.value; mudou('intensidade das queixas',false); }
  else if(t.dataset.atan){ x.p.anam[t.dataset.atan]=t.value; mudou('anamnese',false); }
  else if(t.dataset.vnota){ const v=(x.a.vasos||={})[t.dataset.vnota]||={considerar:false,nota:''}; v.nota=t.value; mudou('plano terapêutico: vasos extraordinários',false); }
  else { const f=t.dataset.atf;
    if(f==='sintese') x.a.sintese=t.value; else if(f==='nota') x.a.evolucao.nota=t.value; else if(f==='mapa') (x.a.mapa||={nota:''}).nota=t.value;
    else if(f==='avnota'){ const av=avaliacaoEditavel(x.p,x.a); if(!av||travada(x.p,x.a,av)) return; av.nota=t.value; }
    mudou({sintese:'síntese clínica',nota:'evolução',mapa:'mapa corporal',avnota:'avaliação energética: observações'}[f],false); }
});
export function sessionWarn(){
  const p=patient(ui.pid), codes=document.getElementById('ns-pts').value.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const tec=[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value);
  document.getElementById('ns-warn').innerHTML=pointWarnings(codes,p,tec).map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:6px"><b>${k==='crit'?'Atenção':'Cautela'}</b> ${esc(m)}</div>`).join('');
}
// Ambiente de atendimento: troca de etapa, alterações com salvamento automático e histórico.
function irEtapa(i){ const x=atendimentoAberto(); if(!x) return; ui.etapa=Math.max(0,Math.min(7,i)); ui.rxCorr=null;
  if(x.a.status==='rascunho'&&!x.a.etapas.includes(ui.etapa)){ x.a.etapas.push(ui.etapa); save(); }
  render(); scrollTo(0,0); }
// Correção de uma versão já registrada: guarda os valores de antes, uma vez por abertura do atendimento.
function fotografarAvaliacao(){ const x=atendimentoAberto(), av=x&&x.a.status==='finalizado'&&avaliacaoEditavel(x.p,x.a); ui.avFoto=av?{id:av.id,foto:fotoVersao(av)}:null; }
const travada = (p,a,av) => !!av && a.status==='finalizado' && ehBasal(p,av);
function mudou(acao, redesenhar=true){ const x=atendimentoAberto(); if(!x) return; const em=new Date().toISOString();
  registrarAlteracao(x.a,acao,em);
  if(x.a.status==='finalizado'&&ui.avFoto){ const av=avaliacaoEditavel(x.p,x.a); if(av&&av.id===ui.avFoto.id&&JSON.stringify(fotoVersao(av))!==JSON.stringify(ui.avFoto.foto)){ registrarCorrecao(av,ui.avFoto.foto,em); ui.avFoto=null; } }
  if(x.a.status==='finalizado'&&/avalia/.test(acao)){ const av=avaliacaoEditavel(x.p,x.a); if(av) registrarAlteracao(av,'avaliação alterada após finalizar o atendimento',em); }
  save(); if(redesenhar) render(true); else { const e=document.getElementById('autosave'); if(e) e.innerHTML=textoSalvo(x.a); } }
// Folha para o paciente: só as orientações para casa, o nome, a data e o profissional. Nada clínico.
function imprimirOrientacoes(p,A){
  const o=(A.plano.orient||'').trim(); if(!o){ toast('Escreva as orientações antes de imprimir','info'); return; }
  document.getElementById('imp').innerHTML=`<div class="imp-h">${LOGO}<div><b>Orientações para casa</b><small>${esc(p.name)} · ${fmt(A.data)}</small></div></div><div class="imp-t">${esc(o).replace(/\n/g,'<br>')}</div><div class="imp-a">${esc(PROF.nome)}</div>`;
  window.print(); }
const catNome = c => CATEGORIAS.find(x=>x[0]===c)?.[1]||c;
function acaoAtendimento(a,t){
  const x=atendimentoAberto(); if(!x) return; const {p}=x, A=x.a, av0=avaliacaoEditavel(p,A), av=travada(p,A,av0)?null:av0;
  const alterna=(L,v)=>{ const i=L.indexOf(v); i<0?L.push(v):L.splice(i,1); };
  if(a==='at-sinal'&&av){ alternarAchado(av,t.dataset.s,t.dataset.o||''); mudou('avaliação energética: sinais'); }
  else if(a==='at-pulso'&&av){ alternarPulso(av,t.dataset.l,t.dataset.k); mudou('avaliação energética: pulso'); }
  else if(a==='at-levar'&&av){ const c=t.dataset.cat, d=t.dataset.dest, it=av.categorias?.[c]?.itens.find(x=>x.id===t.dataset.id); if(!it) return;
    definirAchadoLivre(av,c,it.id,d,!it[d]); const l=d==='plano'?'Plano':'Síntese';
    mudou(`avaliação energética: ${catNome(c)}: "${it.texto}" ${it[d]?'levado para':'retirado'} ${it[d]?(d==='plano'?'o ':'a ')+l:'d'+(d==='plano'?'o ':'a ')+l}`); toast(it[d]?`Levado para ${d==='plano'?'o':'a'} ${l}`:`Retirado d${d==='plano'?'o':'a'} ${l}`,'info'); }
  else if(a==='at-livre-rm'&&av){ const c=t.dataset.cat, it=av.categorias?.[c]?.itens.find(x=>x.id===t.dataset.id); if(!it||!confirm(`Remover o achado "${it.texto}"? A remoção fica registrada no histórico do atendimento.`)) return;
    removerAchadoLivre(av,c,it.id); mudou(`avaliação energética: ${catNome(c)}: achado removido ("${it.texto}")`); }
  else if(a==='at-par'){ const par=PARES_VASOS.find(y=>y[0]===t.dataset.v); if(!par) return; par.slice(1).forEach(c=>{ if(!A.plano.pontos.includes(c)) A.plano.pontos.push(c); }); definirVaso(A,par[0],'considerar',true); mudou(`plano terapêutico: pontos (par de ${par[0]} incluído pelo profissional)`); toast(`${par[1]} e ${par[2]} incluídos`); }
  else if(a==='at-camada'){ ui.camada=t.dataset.k; render(true); }
  else if(a.startsWith('at-mv-')||a.startsWith('at-mk-')){ acaoMapa(a,t,A); }
  else if(a==='at-aba'){ ui.avAba=Number(t.dataset.i); render(true); document.querySelector('.ab-bar')?.scrollIntoView({block:'nearest'}); }
  else if(a==='at-hip'&&av){ const id=t.dataset.p; av.status[id]=av.status[id]===t.dataset.st?'':t.dataset.st; mudou('avaliação energética: hipóteses'); }
  else if(a==='at-pt'){ alterna(A.plano.pontos,t.dataset.c); if(!A.plano.pontos.includes(t.dataset.c)) esquecerPonto(A,t.dataset.c); mudou('plano terapêutico: pontos'); }
  else if(a==='at-rx-lado'){ if(A.status==='rascunho'&&definirLado(A,t.dataset.c,t.dataset.l)) mudou(`plano terapêutico: lado de ${t.dataset.c}`); }
  else if(a==='at-rx-st'){ if(A.status==='rascunho'&&definirStatus(A,t.dataset.c,t.dataset.s)) mudou(`plano terapêutico: ${t.dataset.c} ${({plan:'planejado',real:'realizado',nao:'não realizado'})[t.dataset.s]}`); }
  else if(a==='at-rx-todos'){ if(A.status==='rascunho'&&todosRealizados(A).length){ mudou('plano terapêutico: pontos planejados marcados como realizados'); toast('Pontos planejados marcados como realizados'); } }
  else if(a==='at-rx-corr'){ const l=linhaRx(A,t.dataset.c); ui.rxCorr={c:t.dataset.c,lado:l.lado,status:l.status,motivo:''}; render(true); }
  else if(a==='at-rx-corrx'){ ui.rxCorr=null; render(true); }
  else if(a==='at-sit'){ definirSituacao(A,t.dataset.q,t.dataset.s); mudou('evolução: situação da queixa'); }
  else if(a==='at-ir-plano'){ irEtapa(5); }
  else if(a==='at-imprimir'){ imprimirOrientacoes(p,A); }
  else if(a==='at-tec'){ alterna(A.plano.tec,t.dataset.t); mudou('plano terapêutico: técnicas'); }
  else if(a==='at-cmp'){ ui.atCmp=!ui.atCmp; render(true); }
  else if(a==='at-prontuario'){ ui.pid=p.id; ui.tab='sessoes'; irPara('prontuario'); }
  else if(a==='at-doc'){ if(t.dataset.d==='retorno'){ ui.bookPid=p.id; ui.agForm=null; ui.remarcar=null; irPara('agenda'); } else if(t.dataset.d.startsWith('doc-')){ ui.docPid=p.id; ui.docMod=t.dataset.d.slice(4); ui.docEd=null; irPara('documentos'); } else { ui.pid=p.id; ui.tab='sessoes'; irPara('prontuario'); } }
  else if(a==='at-finalizar'){ finalizarAtendimento(p,A,new Date().toISOString(),uid()); concluirHorario(db.appts,p.id,A.data); const nv=p.avaliacoes.find(v=>v.id===A.avaliacaoId); if(nv) nv.prof=PROF.nome; save(); ui.pid=p.id; ui.tab='sessoes'; toast('Atendimento finalizado e registrado no prontuário'); irPara('prontuario'); }
  else if(a==='at-descartar'){ if(!confirm('Descartar este rascunho? O que foi preenchido nele será apagado. A anamnese e as queixas do paciente continuam salvas.')) return;
    descartarRascunho(p,A); save(); ui.pid=p.id; ui.tab='resumo'; toast('Rascunho descartado','info'); irPara('prontuario'); }
}
// Biblioteca clínica (etapa 4B): Central, Particular e Atlas.
function acaoBiblioteca(a,t){
  const A=ui.atlas, ZA=[1,1.5,2,3], c=t.dataset.c;
  if(a==='bib-area'){ ui.bib=t.dataset.a; render(true); }
  else if(a==='bib-pt'){ ui.bibSel=ui.bibSel===c?null:c; render(true); }
  else if(a==='bib-fx-x'){ ui.bibSel=null; render(true); }
  else if(a==='bib-pa-pt'){ if(!CODIGOS.includes(c)){ toast(`${c}: ponto não encontrado na Central`,'info'); return; } ui.bib='central'; ui.bibSel=c; ui.ptQ=''; ui.ptMer=''; render(true); }
  else if(a==='bib-rev'){ const c=t.dataset.c, ok=t.dataset.ok==='1'; if(revisarPosicao(db,c,ok,PROF.nome,new Date().toISOString())){ save(); render(true); toast(ok?`Posição de ${c} revisada`:'Revisão retirada',ok?'ok':'info'); } }
  else if(a==='bib-pa-rm'){ if(!confirm('Apagar esta ficha particular?')) return; if(removerFichaParticular(db,t.dataset.id)){ save(); render(true); toast('Ficha particular apagada','info'); } }
  else if(a==='atl-tj'){ const k=t.dataset.k, i=A.ativos.indexOf(k); i<0?A.ativos.push(k):A.ativos.splice(i,1); if(i>=0&&A.traj===k) A.traj=null; render(true); }
  else if(a==='atl-todos'||a==='atl-nenhum'){ const L=t.dataset.g==='m'?MERIDIANOS:VASOS_ATLAS; A.ativos=a==='atl-todos'?[...new Set([...A.ativos,...L])]:A.ativos.filter(k=>!L.includes(k)); if(A.traj&&!A.ativos.includes(A.traj)) A.traj=null; render(true); }
  else if(a==='atl-vista'){ A.vista=t.dataset.v; render(true); }
  else if(a==='atl-face'){ A.face[A.vista]=t.dataset.f; render(true); }
  else if(a==='atl-zoom'){ A.zoom=ZA[Math.max(0,Math.min(ZA.length-1,ZA.indexOf(A.zoom)+Number(t.dataset.d)))]; render(true); }
  else if(a==='atl-pt'){ A.sel=c; A.traj=null; render(true); }
  else if(a==='atl-fx-x'){ A.sel=null; A.traj=null; render(true); }
}
// Mapa corporal (etapa 4A): marcações no atendimento em andamento. Depois de finalizado, só leitura.
function limparMapa(){ Object.assign(ui.mapa,{ferr:'sel',sel:null,rm:false,rad:null,hist:'',pt:null}); }
const nomeTipo = k => TIPOS_MARCA.find(x=>x[0]===k)?.[1]||k;
const nomeLadoMarca = k => LADOS_MARCA.find(x=>x[0]===k)?.[1]||'';
function acaoMapa(a,t,A){
  const M=ui.mapa, m=marcasDe(A).find(x=>x.id===M.sel), ZM=[1,1.5,2,3];
  if(a==='at-mv-vista'){ M.vista=t.dataset.v; M.rad=null; render(true); }
  else if(a==='at-mv-face'){ M.face[M.vista]=t.dataset.f; render(true); }
  else if(a==='at-mv-ferr'){ const k=t.dataset.t; M.ferr=(k===M.ferr&&k!=='sel')?'sel':k; M.rad=null; if(M.ferr!=='sel') M.rm=false; render(true); }
  else if(a==='at-mv-zoom'){ M.zoom=ZM[Math.max(0,Math.min(ZM.length-1,ZM.indexOf(M.zoom)+Number(t.dataset.d)))]; render(true); }
  else if(a==='at-mv-ant'){ M.ant=!M.ant; render(true); }
  else if(a==='at-mv-plano'){ M.plano=!M.plano; render(true); }
  else if(a==='at-mv-ptf'){ M.pt=null; render(true); }
  else if(a==='at-mv-ptv'){ M.pt=t.dataset.c; render(true); }
  else if(a==='at-mv-ptx'){ const c=t.dataset.c; if(A.status!=='rascunho'||!c) return; const L=A.plano.pontos, tinha=L.includes(c); tinha?(L.splice(L.indexOf(c),1),esquecerPonto(A,c)):L.push(c);
    if(tinha) toast(`${c} retirado do plano`,'info'); else toast(`${c} incluído no plano`);
    mudou(`plano terapêutico: pontos (${c} ${tinha?'retirado':'indicado'} no mapa corporal)`); }
  else if(a==='at-mk-sel'){ const x=marcasDe(A).find(y=>y.id===t.dataset.id); if(!x) return; M.sel=x.id; M.pt=null; M.rm=false; M.vista=x.vista; if(FACES[x.vista]) M.face[x.vista]=x.face; render(true); }
  else if(a==='at-mk-ok'){ M.sel=null; M.rm=false; render(true); }
  else if(a==='at-mk-radx'){ M.rad=null; render(true); }
  else if(!m||A.status!=='rascunho') return;
  else if(a==='at-mk-int'){ const n=Number(t.dataset.n); editarMarca(A,m.id,'intensidade',m.intensidade===n?null:n); mudou(`mapa corporal: intensidade (${nomeTipo(m.tipo).toLowerCase()})`); }
  else if(a==='at-mk-rad'){ M.rad=m.id; M.vista=m.vista; if(FACES[m.vista]) M.face[m.vista]=m.face; render(true); }
  else if(a==='at-mk-rm'){ M.rm=true; render(true); }
  else if(a==='at-mk-rmn'){ M.rm=false; render(true); }
  else if(a==='at-mk-rms'){ removerMarca(A,m.id); M.sel=null; M.rm=false; M.rad=null; mudou(`mapa corporal: marcação removida (${nomeTipo(m.tipo).toLowerCase()}${m.regiao?', '+m.regiao:''})`); toast('Marcação removida','info'); }
}
function toqueMapa(ev,svg){
  const x=atendimentoAberto(); if(!x) return; const A=x.a, M=ui.mapa, rasc=A.status==='rascunho';
  const v=svg.dataset.vista, f=svg.dataset.face||'', [w,h]=TAM[v];
  const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY; const q=pt.matrixTransform(svg.getScreenCTM().inverse());
  const mk=ev.target.closest('.mk'), sobre=ev.target.closest('.corpo, .mk, .ptp');
  if(rasc&&M.rad){ if(!sobre){ toast('Toque sobre o corpo para marcar o destino','info'); return; }
    const m=editarMarca(A,M.rad,'destino',[q.x/w,q.y/h]); M.rad=null; if(m){ M.sel=m.id; mudou('mapa corporal: trajeto da irradiação'); toast('Trajeto da irradiação marcado'); } else render(true); return; }
  const ptp=ev.target.closest('.ptp');
  if(ptp&&(!rasc||M.ferr==='sel')){ M.pt=ptp.dataset.pt; M.rm=false; render(true); return; }
  if(!rasc||M.ferr==='sel'){ if(mk){ M.sel=mk.dataset.id; M.pt=null; M.rm=false; render(true); } return; }
  // Com um tipo ativo, tocar numa marcação deste atendimento apaga a marcação.
  if(mk&&marcasDe(A).some(y=>y.id===mk.dataset.id)){ const x=marcasDe(A).find(y=>y.id===mk.dataset.id); removerMarca(A,x.id); if(M.sel===x.id){ M.sel=null; M.rm=false; } M.pt=null;
    toast(`${nomeTipo(x.tipo)} apagada`,'info'); mudou(`mapa corporal: marcação removida (${nomeTipo(x.tipo).toLowerCase()}${x.regiao?', '+x.regiao:''})`); return; }
  if(!sobre){ toast('Toque sobre o corpo para marcar','info'); return; }
  const tipo=M.ferr, m=adicionarMarca(A,{id:uid(),tipo,vista:v,face:f,x:q.x/w,y:q.y/h,lado:ladoDe(v,f,q.x)},new Date().toISOString()); if(!m) return;
  const rg=regiaoDoToque(v,f,q.x,q.y,!!ev.target.closest('.b2')); if(rg) editarMarca(A,m.id,'regiao',rg);
  M.sel=m.id; M.pt=null; M.rm=false;
  if(tipo==='irradiacao'){ M.rad=m.id; toast('Origem marcada. Agora toque no destino','info'); }
  else toast(`${nomeTipo(tipo)} marcada · ${m.regiao?m.regiao.toLowerCase()+' · ':''}${nomeLadoMarca(m.lado).toLowerCase()}`);
  mudou(`mapa corporal: marcação de ${nomeTipo(tipo).toLowerCase()} adicionada`);
}
// Atualiza só a prévia e o texto destacado enquanto o modelo é editado, sem perder o cursor do campo.
function previaModelo(){ const pv=document.getElementById('doc-pv'), r=document.getElementById('mod-raw'); if(pv) pv.innerHTML=previaDoc(); if(r) r.innerHTML=textoComCampos(); }
// Baixa um texto como arquivo (cópia de segurança).
function baixar(texto, nome){ const u=URL.createObjectURL(new Blob([texto],{type:'application/json'})), l=document.createElement('a'); l.href=u; l.download=nome; document.body.append(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
document.addEventListener('change',ev=>{
  if(ev.target.id==='np-p'&&ui.finPac){ Object.assign(ui.finPac,{pid:ev.target.value,total:document.getElementById('np-s').value,valor:document.getElementById('np-v').value}); render(true); return; }
  const t=ev.target;
  if(t.matches('[data-atltodos]')){ ui.atlas.todos=t.checked; render(true); return; }
  if(t.id==='imp-arq' && t.files[0]){ const f=t.files[0]; t.value='';
    if(!confirm(`Importar “${f.name}”? Os dados atuais deste navegador serão substituídos. Exporte antes se quiser guardá-los.`)) return;
    f.text().then(x=>{ const erro=importar(x); if(erro){ toast(erro,'info'); return; } ui.assess=null; ui.pid=db.patients[0]?.id||''; toast('Dados importados'); render(); }); return; }
  if(t.dataset.vcmp){ ui[t.dataset.vcmp]=t.value; render(true); return; }
  if(t.dataset.int){ (ui.novoInt||={nome:'',tel:'',origem:'Instagram'})[t.dataset.int]=t.value; return; }
  if(t.dataset.docp){ ui.docPid=t.value; render(true); return; }
  if(t.dataset.agf){ const F=formAgenda(); F[t.dataset.agf]=t.value; if(t.dataset.agf==='date'&&t.value) ui.agDia=t.value; if(t.dataset.agf!=='time') render(true); return; }
  if(t.hasAttribute('data-mvhist')){ ui.mapa.hist=t.value; render(true); return; }
  if(t.dataset.mk&&t.tagName==='SELECT'){ const x=atendimentoAberto(); if(x&&editarMarca(x.a,ui.mapa.sel,t.dataset.mk,t.value)){ if(t.dataset.mk==='tipo'&&t.value==='irradiacao'&&marcasDe(x.a).find(m=>m.id===ui.mapa.sel)?.x2==null) ui.mapa.rad=ui.mapa.sel; mudou(`mapa corporal: ${t.dataset.mk==='tipo'?'tipo':'lado'} da marcação`); } return; }
  if(t.dataset.atlsit||t.dataset.atlorig){ const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(av&&!travada(x.p,x.a,av)){ const [c,id]=(t.dataset.atlsit||t.dataset.atlorig).split('.'); definirAchadoLivre(av,c,id,t.dataset.atlsit?'sit':'orig',t.value); mudou(`avaliação energética: ${catNome(c)}: ${t.dataset.atlsit?'situação':'origem'} do achado`); } return; }
  if(t.dataset.atsit||t.dataset.atorig){ const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(av&&!travada(x.p,x.a,av)){ definirAchado(av,t.dataset.atsit||t.dataset.atorig,t.dataset.atsit?'sit':'orig',t.value); mudou('avaliação energética: '+(t.dataset.atsit?'situação':'origem')+' dos achados'); } return; }
  if(t.dataset.vaso){ const x=atendimentoAberto(); if(x){ const v=(x.a.vasos||={})[t.dataset.vaso]||={considerar:false,nota:''}; v.considerar=t.checked; mudou('avaliação energética: vasos extraordinários'); } return; }
  if(t.id==='pr-patient'){ ui.pid=t.value; render(true); }
  else if(t.id==='as-patient'){ ui.pid=t.value; ui.assess={pid:t.value,signs:[],status:{},nota:''}; render(true); }
  else if(t.id==='pt-patient'){ ui.pid=t.value; render(true); }
  else if(t.id==='cb-sheng'){ ui.sheng=t.checked; render(true); }
  else if(t.id==='cb-ke'){ ui.ke=t.checked; render(true); }
  else if(t.dataset.anam){ patient(ui.pid).anam[t.dataset.anam]=t.value; save(); toast('Anamnese salva'); }
  else if(t.dataset.alert){ patient(ui.pid).alerts[t.dataset.alert]=t.checked; save(); render(true); }
  else if(t.name==='tec'){ t.closest('.chip').classList.toggle('on',t.checked); }
});
document.addEventListener('submit',ev=>{
  ev.preventDefault(); const f=ev.target, v=id=>document.getElementById(id).value;
  if(f.id==='f-rx-corr'){ const x=atendimentoAberto(), C=ui.rxCorr; if(!x||!C) return; if(!C.motivo.trim()){ toast('Escreva o motivo da correção','info'); return; }
    const em=new Date().toISOString(), mud=corrigirPonto(x.a,C.c,C,C.motivo,PROF.nome,em); if(!mud){ toast('Nada mudou neste ponto','info'); return; }
    ui.rxCorr=null; mudou(`plano terapêutico: correção de ${C.c} (${mud.map(([k,a,b])=>`${k.toLowerCase()}: ${a} → ${b}`).join('; ')}). Motivo: ${C.motivo.trim()}`); toast('Correção registrada'); return; }
  if(f.matches('.f-msg')){ const k=f.dataset.k, tx=f.querySelector('textarea').value; if(!tx.trim()){ toast('Escreva o texto da mensagem','info'); return; }
    salvarMensagemWa(db,k,tx,new Date().toISOString(),PROF.nome); save(); render(true); toast('Mensagem salva'); return; }
  if(f.id==='f-mod'){ const E=ui.docEd; if(!E) return; if(!E.nome.trim()||!E.texto.trim()){ toast('Dê um nome e escreva o texto do modelo','info'); return; }
    const k=salvarModelo(db,E.novo?null:ui.docMod,E,new Date().toISOString(),PROF.nome,'mod-'+uid()); if(!k) return;
    ui.docMod=k; ui.docEd=null; save(); render(true); toast(E.novo?'Modelo criado':'Modelo salvo'); return; }
  if(f.matches('.fin-rec')){ const r=receber(db,f.dataset.ap,{id:uid(),valor:lerValor(v('rec-v')),forma:ui.finRec?.forma,data:TODAY,por:PROF.nome});
    if(typeof r==='string'){ toast(r,'info'); return; } const x=db.appts.find(z=>z.id===f.dataset.ap), falta=faltaDe(db,x);
    ui.finRec=null; save(); render(true); toast(falta>0?`${brl(r.valor)} recebido; ficou faltando ${brl(falta)}`:`${brl(r.valor)} recebido de ${patient(x.pid)?.name.split(' ')[0]||''}`); return; }
  if(f.id==='f-novo-pac'){ const pid=v('np-p'), k=novoPacote(db,{id:uid(),pid,serv:servicoPacote(pid),total:v('np-s'),valor:lerValor(v('np-v')),em:TODAY,por:PROF.nome});
    if(!k){ toast('Informe as sessões e o valor','info'); return; } ui.finPac=null; save(); render(true); toast('Pacote criado'); return; }
  if(f.id==='f-nova-desp'){ const d=novaDespesa(db,{id:uid(),desc:v('nd-d'),cat:v('nd-c'),valor:lerValor(v('nd-v')),data:TODAY,repete:document.getElementById('nd-r').checked,por:PROF.nome});
    if(!d){ toast('Informe a despesa e o valor','info'); return; } save(); render(true); toast('Despesa lançada'); return; }
  if(f.id==='f-int'){ if(novoInteressado(db,{id:uid(),nome:v('int-nome'),tel:v('int-tel'),origem:v('int-origem'),em:new Date().toISOString(),por:PROF.nome})){ ui.novoInt=null; save(); render(true); toast('Interessado incluído'); } return; }
  if(f.id==='f-part'){ const d=Object.fromEntries(new FormData(f)); if(adicionarFichaParticular(db,d,new Date().toISOString(),uid())){ save(); render(true); toast('Ficha adicionada à Particular'); } return; }
  if(f.id==='f-patient'){
    const cpf=document.getElementById('np-cpf');
    if(!cpfValido(cpf.value)){ cpf.setCustomValidity('CPF inválido: confira os 11 números.'); cpf.reportValidity(); return; }
    const em=new Date().toISOString(), lgpd=document.getElementById('np-lgpd');
    const cadastro={cpf:cpf.value.trim()?cpfFormatado(cpf.value.trim()):'',email:v('np-email').trim(),endereco:v('np-end').trim(),cidade:v('np-cid').trim(),hemisferio:v('np-hem'),contatoEmergencia:v('np-emerg').trim()};
    const alerts=Object.fromEntries(['gestante','anticoagulante','marcapasso'].map(k=>[k,document.getElementById('np-al-'+k).checked]));
    if(ui.editPid){ const p=patient(ui.editPid);
      p.name=v('np-name').trim(); p.birth=v('np-birth'); p.phone=v('np-phone'); p.queixas.find(q=>q.id==='q1').descricao=v('np-q').trim();
      Object.assign(p.alerts,alerts); p.cadastro={...p.cadastro,...cadastro,atualizadoEm:em};
      if(lgpd?.checked) p.consentimento=TODAY;
      save(); ui.pid=p.id; ui.editPid=null; ui.tab='resumo'; toast('Cadastro atualizado'); location.hash='prontuario'; return; }
    const p=hidratarPaciente(novoPaciente({id:uid(),name:v('np-name').trim(),birth:v('np-birth'),phone:v('np-phone'),queixa:v('np-q'),consentimento:TODAY,em}));
    Object.assign(p.alerts,alerts); p.cadastro=cadastro;
    db.patients.push(p); const ni=ui.cadPrevio?.intId&&(db.interessados||[]).find(x=>x.id===ui.cadPrevio.intId); if(ni) virouPaciente(ni,p.id); ui.cadPrevio=null; save(); ui.pid=p.id; ui.tab='anamnese'; toast('Paciente cadastrado'); location.hash='prontuario';
  } else if(f.id==='f-reav'){
    const m=v('rv-motivo').trim(); if(!m) return; ui.reavMotivo={pid:ui.pid,motivo:m}; ui.assess=null; irPara('avaliacao'); toast('Registre a reavaliação; ela vira uma nova versão','info');
  } else if(f.classList.contains('livre-f')){
    const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(!av||travada(x.p,x.a,av)) return; const c=f.dataset.cat, texto=v('lv-'+c).trim(); if(!texto) return;
    adicionarAchadoLivre(av,c,{id:uid(),texto,orig:v(`lv-${c}-o`),sit:v(`lv-${c}-s`)},new Date().toISOString()); mudou(`avaliação energética: ${catNome(c)}: achado registrado`); toast('Achado registrado');
  } else if(f.id==='f-at-queixa'||f.id==='f-at-pt'){
    const x=atendimentoAberto(); if(!x) return;
    if(f.id==='f-at-queixa'){ const d=v('atq-desc').trim(); if(!d) return; const q=adicionarQueixa(x.p,{id:uid(),descricao:d},new Date().toISOString()); x.a.evolucao.intensidades[q.id]=5; mudou('queixa adicionada'); toast('Queixa adicionada'); }
    else { const L=v('at-pt-c').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean).filter(c=>!x.a.plano.pontos.includes(c)); if(!L.length) return; x.a.plano.pontos.push(...L); mudou('plano terapêutico: pontos'); }
  } else if(f.id==='f-queixa'){
    const d=v('nq-desc').trim(); if(!d) return;
    adicionarQueixa(patient(ui.pid),{id:uid(),descricao:d},new Date().toISOString()); save(); render(true); toast('Queixa adicionada');
  } else if(f.id==='f-session'){
    const p=patient(ui.pid);
    registrarSessao(p,{id:uid(),date:v('ns-date'),eva:Number(v('ns-eva')),intensidades:Object.fromEntries([...f.querySelectorAll('input[data-q]')].map(x=>[x.dataset.q,Number(x.value)])),pontos:v('ns-pts').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),tec:[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value),nota:v('ns-nota')},new Date().toISOString());
    save(); ui.tab='sessoes'; toast('Sessão registrada'); render();
  } else if(f.id==='f-appt'){
    const date=v('na-d'), time=v('na-t'), tipo=v('na-tipo'), R=ui.remarcar&&db.appts.find(a=>a.id===ui.remarcar);
    if(!date||!time){ toast('Escolha o dia e o horário','info'); return; }
    const c=conflito(db.appts,date,time,tipo,R?.id), nome=pid=>patient(pid)?.name.split(' ')[0]||'';
    if(R){ remarcar(R,date,time,tipo); toast(`${nome(R.pid)} remarcado para ${fmt(date)} às ${time}`); }
    else { db.appts.push(novoHorario(uid(),v('na-p'),date,time,tipo)); toast(`Agendamento criado${c?`; atenção: encosta no horário de ${nome(c.pid)} às ${c.time}`:''}`, c?'info':'ok'); }
    save(); ui.bookPid=null; ui.remarcar=null; ui.agForm=null; ui.agDia=date; render(true);
  }
});
render();
