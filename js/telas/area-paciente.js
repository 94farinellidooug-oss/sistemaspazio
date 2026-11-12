// Área do paciente (pedido do Maicon em 12/11/2026). No prontuário, o botão "Área do paciente" abre uma janela
// para criar o link, escolher o que o paciente vê, escrever o resumo da avaliação em palavras simples, mandar
// pelo WhatsApp e desligar. O conteúdo vai pronto para o servidor (supabase/017_area_paciente.sql) e é publicado
// de novo sozinho quando algo dele muda (nova consulta, orientações, documento liberado...).
import { SECOES_AREA, configArea, conteudoArea, linkArea, marcaConteudo, resumoSugerido } from '../dados/area-paciente.js';
import { CLINICA } from '../dados/documentos.js';
import { db, patient, tambemAoSalvar } from '../dados/repositorio.js';
import { ic } from '../componentes/icones.js';
import { ui } from '../estado.js';
import { TODAY, esc, fmt } from '../util.js';
import { conta } from './conta.js';
import { PROF } from './menu.js';

let AR = { salvar:() => {}, toast:() => {}, render:() => {} };
export const ligarArea = o => { AR = { ...AR, ...o }; };
const naNuvemArea = () => conta.modo === 'nuvem' && conta.nuvem && conta.clinica?.id;
const KEY_MARCAS_AREA = 'musubi-area-marcas';
const lerMarcasArea = () => { try { return JSON.parse(localStorage.getItem(KEY_MARCAS_AREA)) || {}; } catch (e) { return {}; } };
const gravarMarcaArea = (k, v) => { try { const M = lerMarcasArea(); if (v) M[k] = v; else delete M[k]; localStorage.setItem(KEY_MARCAS_AREA, JSON.stringify(M)); } catch (e) {} };

const montarArea = p => conteudoArea(p, { appts:db.appts, hoje:TODAY, clinica:CLINICA, prof:PROF.nome, base:location.origin });

// Envia para o servidor. Devolve o código do link (ou lança o erro).
async function publicarArea(p, ativo = true){
  const c = montarArea(p), chave = `${conta.clinica.id}:${p.id}`;
  const id = await conta.nuvem.publicarArea(conta.clinica.id, p.id, p.birth || null, ativo ? c : {}, ativo);
  gravarMarcaArea(chave, ativo ? marcaConteudo(c, p.birth) : '');
  return id;
}

// Depois de cada salvamento: publica de novo, em silêncio, as áreas cujo conteúdo mudou; desliga as de quem saiu.
let esperaArea = null, rodandoArea = false;
export const sincronizarAreas = async () => {
  if (!naNuvemArea() || rodandoArea) return; rodandoArea = true;
  try {
    const cl = conta.clinica.id, M = lerMarcasArea();
    for (const p of db.patients) {
      const A = p.areaPaciente; if (!A?.ativo || !A.id) continue;
      if (M[`${cl}:${p.id}`] !== marcaConteudo(montarArea(p), p.birth)) { try { await publicarArea(p); } catch (e) { /* tenta no próximo salvamento */ } }
    }
    for (const k of Object.keys(M)) {
      const [c, pid] = k.split(':'); if (c !== cl) continue;
      const p = patient(pid);
      if (!p || !p.areaPaciente?.ativo) { try { await conta.nuvem.publicarArea(cl, pid, null, {}, false); gravarMarcaArea(k, ''); } catch (e) {} }
    }
  } finally { rodandoArea = false; }
};
tambemAoSalvar(() => { clearTimeout(esperaArea); esperaArea = setTimeout(sincronizarAreas, 2500); });

// ---- Janela no prontuário ----
export function janelaArea(p){
  const c = configArea(p), A = p.areaPaciente, ligado = !!(A?.ativo && A.id), link = ligado ? linkArea(A.id, location.origin) : '';
  const docs = p.documentos || [], resumo = A?.resumo ?? resumoSugerido(p);
  const fechar = `<button type="button" class="btn ghost sm" data-act="area-x" aria-label="Fechar">${ic('x')}</button>`;
  const cab = `<div class="modal-h"><div class="grow"><h2 id="ar-t">Área do paciente</h2><small class="muted">${esc(p.name)} · uma página com o que você liberar, aberta pelo link e pela data de nascimento</small></div>${fechar}</div>`;
  if (!naNuvemArea()) return `<div class="modal-fundo" id="ar-fundo" data-act="area-x"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ar-t">${cab}
    <div class="modal-c"><p>A área do paciente precisa da conta no servidor (entre na sua conta do MUSUBI).</p></div><div class="modal-p"><button type="button" class="btn" data-act="area-x">Fechar</button></div></div></div>`;
  return `<div class="modal-fundo" id="ar-fundo" data-act="area-x"><form class="modal" id="f-area" role="dialog" aria-modal="true" aria-labelledby="ar-t" data-pid="${p.id}">${cab}
    <div class="modal-c">
      ${!p.birth ? `<p class="ar-aviso">${ic('escudo')}<span>Falta a data de nascimento no cadastro: é com ela que o paciente abre a página. <button type="button" class="btn sm" data-act="editar-paciente" data-pid="${p.id}">Abrir o cadastro</button></span></p>` : ''}
      ${ligado ? `<div class="ar-link"><span class="lbl">Link do paciente</span><div class="ar-l"><input id="area-link" readonly value="${esc(link)}" aria-label="Link do paciente">
        <button type="button" class="btn sm" data-act="area-copiar">${ic('copiar')}Copiar</button>
        <button type="button" class="btn sm wa" data-act="wa" data-t="area" data-pid="${p.id}">${ic('mensagem')}WhatsApp</button>
        <a class="btn sm ghost" href="${esc(link)}" target="_blank" rel="noopener">${ic('dir')}Ver como o paciente</a></div>
        <small class="muted" id="area-ac">Atualiza sozinho quando algo muda no prontuário.</small></div>` : ''}
      <div class="lbl" style="margin-top:4px">O que o paciente vê</div>
      <div class="chips">${SECOES_AREA.map(([k, n]) => `<label class="chip"><input type="checkbox" name="area-sec" value="${k}" ${c.mostrar[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <p class="muted sm">A avaliação completa, o pentagrama e as anotações clínicas não aparecem para o paciente.</p>
      <div class="lbl" style="margin-top:12px">Documentos liberados</div>
      ${docs.length ? `<div class="ar-docs">${docs.map(d => `<label class="chip"><input type="checkbox" name="area-doc" value="${esc(d.id)}" ${c.docs.includes(d.id) ? 'checked' : ''}> ${esc(d.nome || 'Documento')} · ${fmt(String(d.em || '').slice(0, 10))}</label>`).join('')}</div>`
        : '<p class="muted sm">Nenhum documento guardado ainda. Os documentos guardados aparecem aqui para você liberar.</p>'}
      <label class="rx-f full" style="margin-top:12px"><span class="lbl">Resumo da avaliação para o paciente</span>
        <textarea id="area-resumo" rows="4" maxlength="3000" placeholder="Em palavras simples: o que foi visto e o objetivo do tratamento.">${esc(resumo)}</textarea>
        <small class="muted">${A?.resumo == null && resumo ? 'Veio da síntese clínica do último atendimento. Ajuste o texto antes de liberar.' : 'É exatamente este texto que o paciente lê.'}</small></label>
    </div>
    <div class="modal-p">${ligado ? `<button type="button" class="btn ghost" data-act="area-desligar">${ic('x')}Desligar o link</button>` : ''}<span class="grow"></span>
      <button type="button" class="btn ghost" data-act="area-x">Cancelar</button><button class="btn pri" ${p.birth ? '' : 'disabled'}>${ic('check')}${ligado ? 'Salvar e atualizar' : 'Criar o link'}</button></div>
  </form></div>`;
}

// Últimas aberturas, depois que a janela aparece.
export const mostrarAcessosArea = async () => {
  const el = document.getElementById('area-ac'), p = patient(ui.areaP), id = p?.areaPaciente?.id;
  if (!el || !id || !naNuvemArea()) return;
  try {
    const L = await conta.nuvem.acessosArea(id);
    el.textContent = L.length ? `Aberta ${L.length === 5 ? '5 ou mais vezes' : L.length === 1 ? '1 vez' : L.length + ' vezes'} · última em ${new Date(L[0].em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}. Atualiza sozinha quando algo muda.` : 'O paciente ainda não abriu. Atualiza sozinha quando algo muda no prontuário.';
  } catch (e) {}
};

export const salvarArea = async f => {
  const p = patient(f.dataset.pid); if (!p || !naNuvemArea()) return;
  if (!p.birth) { AR.toast('Cadastre a data de nascimento do paciente antes', 'info'); return; }
  const marcados = new Set([...f.querySelectorAll('[name=area-sec]:checked')].map(i => i.value));
  const resumo = document.getElementById('area-resumo').value.trim(), A = p.areaPaciente || {}, em = new Date().toISOString();
  const novo = { ...A, ativo:true, mostrar:Object.fromEntries(SECOES_AREA.map(([k]) => [k, marcados.has(k)])),
    docs:[...f.querySelectorAll('[name=area-doc]:checked')].map(i => i.value), resumo,
    resumoEm:resumo !== (A.resumo ?? '') ? TODAY : A.resumoEm || (resumo ? TODAY : ''), criadoEm:A.criadoEm || em, criadoPor:A.criadoPor || PROF.nome };
  const b = f.querySelector('button.pri'); if (b) { b.disabled = true; b.textContent = 'Publicando…'; }
  const antes = p.areaPaciente; p.areaPaciente = novo;
  try { const id = await publicarArea(p); p.areaPaciente.id = id; }
  catch (e) { p.areaPaciente = antes; AR.toast(`Não deu para publicar: ${e.message}`, 'info'); AR.render(true); return; }
  AR.salvar(); AR.toast(A.id && A.ativo ? 'Área do paciente atualizada' : 'Link criado: envie pelo WhatsApp'); AR.render(true); mostrarAcessosArea();
};

export const desligarArea = async pid => {
  const p = patient(pid); if (!p?.areaPaciente?.id || !naNuvemArea()) return;
  if (!confirm('Desligar o link? O paciente não consegue mais abrir a página e o conteúdo publicado é apagado do servidor. Dá para criar um novo depois.')) return;
  try { await publicarArea(p, false); } catch (e) { AR.toast(`Não deu para desligar: ${e.message}`, 'info'); return; }
  p.areaPaciente = { ...p.areaPaciente, ativo:false }; AR.salvar(); AR.toast('Link desligado'); AR.render(true);
};

export const copiarLinkArea = () => {
  const l = document.getElementById('area-link')?.value; if (!l) return;
  navigator.clipboard?.writeText(l).then(() => AR.toast('Link copiado'), () => AR.toast(l, 'info'));
};
