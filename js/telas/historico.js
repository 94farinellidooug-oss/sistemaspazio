// Tela Histórico de alterações (LGPD, pedido do Maicon em 08/11/2026), na Administração e no prontuário de cada
// paciente: quem criou, alterou ou apagou o quê, com data e hora. Só o administrador da clínica vê. Os registros
// vêm do servidor (supabase/006_historico.sql) e ninguém consegue alterá-los ou apagá-los pelo sistema.
import { ic, vazio } from '../componentes/icones.js';
import { db } from '../dados/repositorio.js';
import { ACAO_HIST, TIPO_HIST, campoTxt } from '../dados/historico.js';
import { conta, semPermissao, souAdm } from './conta.js';
import { esc } from '../util.js';

const hs = { lista:null, carregando:false, erro:'', falta006:false, paciente:'', pessoa:'', tipo:'', fim:false };
let hsApp = { render:() => {} };
const POR_VEZ = 100;
const ligadoHist = () => conta.modo === 'nuvem' && !!conta.clinica?.id && !!conta.nuvem;
const nomePac = id => [...db.patients, ...(db.desativados || [])].find(p => String(p.id) === String(id))?.name || '';
const horaTxt = iso => { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`; };

async function carregarHist(mais = false){
  if (!ligadoHist() || hs.carregando) return;
  hs.carregando = true; hs.erro = ''; if (!mais) { hs.lista = null; hs.fim = false; }
  try {
    const L = await conta.nuvem.historico(conta.clinica.id, { paciente:hs.paciente || undefined, antes:mais ? hs.lista?.at(-1)?.em : undefined, limite:POR_VEZ });
    hs.lista = mais ? [...(hs.lista || []), ...L] : L; hs.fim = L.length < POR_VEZ; hs.falta006 = false;
  } catch (e) { if (e.status === 404 || e.codigo === '42P01' || e.codigo === 'PGRST205') { hs.falta006 = true; hs.lista = []; } else hs.erro = e.message; }
  hs.carregando = false; hsApp.render(true);
}

// Botão no prontuário (só o administrador, com conta).
export const botaoHistorico = pid => ligadoHist() && souAdm() ? `<a class="btn ghost" href="#historico" data-hs="paciente" data-pid="${esc(pid)}">${ic('historico')}Histórico</a>` : '';

export function vHistorico(){
  const cab = `<div class="head"><div><h1>Histórico de alterações</h1><p>Quem criou, alterou ou apagou cada registro, com data e hora</p></div></div>`;
  if (conta.modo !== 'nuvem') return cab + vazio('historico', 'Histórico só com conta no servidor', 'Neste aparelho o sistema funciona sem conta. Com a conta no servidor, cada alteração fica registrada com o login de quem fez, a data e a hora.');
  if (!souAdm()) return semPermissao();
  if (hs.lista === null && !hs.carregando && !hs.erro) carregarHist();
  const L = (hs.lista || []).filter(h => (!hs.pessoa || h.email === hs.pessoa) && (!hs.tipo || h.tipo === hs.tipo));
  const pessoas = [...new Map((hs.lista || []).map(h => [h.email, h.pessoa || h.email])).entries()];
  const tipos = [...new Set((hs.lista || []).map(h => h.tipo))];
  const pacientes = [...db.patients, ...(db.desativados || [])].filter(p => !p.exemplo || String(p.id) === hs.paciente).sort((a, b) => a.name.localeCompare(b.name));
  return `${cab}
  ${hs.falta006 || conta.nuvem.semHistorico?.() ? `<div class="notice" id="hs-falta">${ic('info')}<div>Para começar a registrar o histórico, rode uma vez o arquivo <b>supabase/006_historico.sql</b> no SQL Editor do Supabase.</div></div>` : ''}
  ${hs.erro ? `<div class="notice">${ic('alerta')}<div>${esc(hs.erro)} <button class="btn sm ghost" data-hs="recarregar">Tentar de novo</button></div></div>` : ''}
  <div class="card" id="hs-l"><div class="card-h"><h2>Registros<small>ninguém consegue alterar ou apagar este histórico pelo sistema</small></h2></div>
    <div class="form hs-f">
      <label class="field"><span class="lbl">Paciente</span><select data-hs="filtro" name="paciente"><option value="">Todos</option>${pacientes.map(p => `<option value="${esc(p.id)}" ${String(p.id) === hs.paciente ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Quem</span><select data-hs="filtro" name="pessoa"><option value="">Todos</option>${pessoas.map(([e, n]) => `<option value="${esc(e)}" ${e === hs.pessoa ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">O quê</span><select data-hs="filtro" name="tipo"><option value="">Tudo</option>${tipos.map(t => `<option value="${esc(t)}" ${t === hs.tipo ? 'selected' : ''}>${esc(TIPO_HIST[t] || t)}</option>`).join('')}</select></label>
    </div>
    ${hs.lista === null ? `<p class="muted sm">${ic('carregando')} Carregando o histórico…</p>`
    : !L.length ? `<p class="muted sm" id="hs-vazio">${hs.paciente ? `Nenhuma alteração registrada para ${esc(nomePac(hs.paciente) || 'este paciente')}.` : 'Nenhuma alteração registrada ainda.'}</p>`
    : `<div class="list hs-lista">${L.map(h => `<div class="row hs-r"><span class="tico sm ${h.acao === 'apagou' ? 'crit' : 'acc'}">${ic(h.acao === 'criou' ? 'mais' : h.acao === 'apagou' ? 'x' : h.acao === 'desativou' || h.acao === 'reativou' ? 'retorno' : 'editar')}</span>
        <div class="grow"><b>${esc(h.pessoa || h.email)} ${esc(ACAO_HIST[h.acao] || h.acao)} ${esc((TIPO_HIST[h.tipo] || h.tipo).toLowerCase())}</b>
          <small class="muted">${esc(h.titulo || '')}${h.campos?.length ? ` · ${esc(h.campos.map(campoTxt).join(', '))}` : ''}</small>
          <small class="muted">${horaTxt(h.em)}${h.pessoa && h.email ? ` · ${esc(h.email)}` : ''}</small></div></div>`).join('')}</div>
      ${hs.fim ? '' : `<div class="cf-acoes"><button class="btn ghost" data-hs="mais" ${hs.carregando ? 'disabled' : ''}>${hs.carregando ? 'Carregando…' : 'Ver mais antigos'}</button></div>`}`}
  </div>`;
}

export function ligarHistorico(render){
  hsApp = { render };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-hs]'); if (!b || b.matches('select')) return; const a = b.dataset.hs;
    if (a === 'paciente') { hs.paciente = b.dataset.pid || ''; hs.manter = true; }
    else if (a === 'recarregar') { hs.erro = ''; carregarHist(); }
    else if (a === 'mais') carregarHist(true);
  });
  document.addEventListener('change', ev => {
    const s = ev.target; if (s.dataset?.hs !== 'filtro') return;
    if (s.name === 'paciente') { hs.paciente = s.value; carregarHist(); }
    else { hs[s.name] = s.value; render(true); }
  });
}
// Ao trocar de clínica ou sair da conta.
// Entrando pelo botão do prontuário, abre já filtrado naquele paciente.
export const esquecerHistorico = () => { hs.lista = null; hs.erro = ''; hs.pessoa = ''; hs.tipo = ''; if (!hs.manter) hs.paciente = ''; hs.manter = false; };
