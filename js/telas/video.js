// Consulta online por vídeo (pedido do Maicon em 12/11/2026): o horário marcado como online ganha uma sala de
// vídeo (Daily) no servidor (função teleconsulta). O paciente recebe o link pelo WhatsApp e entra pela página
// consulta/ do site, depois de aceitar o termo. O profissional abre o vídeo numa janela que fica por cima do
// sistema enquanto ele usa o prontuário (dá para aumentar, diminuir e encerrar). A chamada não é gravada.
import { dadosTeleconsulta, linkConsulta } from '../dados/agenda.js';
import { CLINICA } from '../dados/documentos.js';
import { db, patient } from '../dados/repositorio.js';
import { ic } from '../componentes/icones.js';
import { esc } from '../util.js';
import { conta } from './conta.js';

let V = { salvar:() => {}, toast:() => {} };
export const ligarVideo = (o) => { V = { ...V, ...o }; };
const naNuvem = () => conta.modo === 'nuvem' && conta.nuvem && conta.clinica?.id;
export const MSG_SEM_CONTA = 'A consulta online precisa da conta no servidor (entre na sua conta do MUSUBI).';

// Cria ou atualiza no servidor a consulta online do horário (agendar, remarcar, desmarcar). Devolve o código ou ''.
export const sincronizarOnline = async (a, avisar = true) => {
  if (!a?.online && !a?.video) return '';
  if (!naNuvem()) { if (avisar) V.toast(MSG_SEM_CONTA, 'info'); return ''; }
  const p = patient(a.pid), primeiro = (p?.name || '').trim().split(/\s+/)[0] || '';
  try {
    const r = await conta.nuvem.salvarTeleconsulta(conta.clinica.id, { ...dadosTeleconsulta(a, primeiro, CLINICA), cancelada:a.st === 'desmarcado' || !a.online });
    if (r?.id && a.video !== r.id) { a.video = r.id; V.salvar(); }
    return a.video || '';
  } catch (e) { if (avisar) V.toast(`Não deu para preparar a consulta online: ${e.message}`, 'info'); return ''; }
};

// Janela do vídeo: fica no canto, por cima de qualquer tela, até encerrar.
export function fecharVideo(){ document.getElementById('video-jan')?.remove(); }
export const abrirVideo = async apId => {
  const a = db.appts.find(x => x.id === apId); if (!a) return;
  if (!naNuvem()) { V.toast(MSG_SEM_CONTA, 'info'); return; }
  const id = a.video || await sincronizarOnline(a); if (!id) return;
  let r;
  try { r = await conta.nuvem.entrarTeleconsulta(conta.clinica.id, id); }
  catch (e) { V.toast(e.message, 'info'); return; }
  fecharVideo();
  const p = patient(a.pid), j = document.createElement('section');
  j.id = 'video-jan'; j.className = 'vjan'; j.setAttribute('role', 'dialog'); j.setAttribute('aria-label', 'Consulta online');
  j.innerHTML = `<div class="vjan-h"><span class="vjan-t">${ic('video')}<b>${esc(p?.name || 'Consulta online')}</b><small>${esc(a.tipo)} · ${a.time}</small></span>
    <button class="ib" data-v="copiar" aria-label="Copiar o link do paciente" data-tip="Copiar o link do paciente">${ic('copiar')}</button>
    <button class="ib" data-v="tamanho" aria-label="Aumentar ou diminuir" data-tip="Aumentar ou diminuir">${ic('expandir')}</button>
    <button class="ib vjan-x" data-v="sair" aria-label="Encerrar a chamada" data-tip="Encerrar a chamada">${ic('x')}</button></div>
    <iframe title="Vídeo da consulta" src="${esc(r.url)}" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"></iframe>`;
  j.addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'sair') { if (confirm('Encerrar a chamada de vídeo?')) fecharVideo(); }
    else if (b.dataset.v === 'tamanho') j.classList.toggle('grande');
    else if (b.dataset.v === 'copiar') { const l = linkConsulta(a.video, location.origin); navigator.clipboard?.writeText(l).then(() => V.toast('Link do paciente copiado'), () => V.toast(l, 'info')); }
  });
  document.body.appendChild(j);
};
// WhatsApp de um horário online: garante o código (para o link) antes de abrir a mensagem.
export const prepararWaOnline = async apId => { const a = db.appts.find(x => x.id === apId); if (a && !a.video) await sincronizarOnline(a); return a; };
