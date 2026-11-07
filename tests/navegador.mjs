// Teste no navegador: executa o mesmo roteiro de uso no protótipo original (legacy),
// na versão modular e no arquivo único gerado (dist) e compara, em cada passo, o resultado
// funcional da tela e, no fim, os dados salvos.
// Desde a etapa 2A o visual é o do MUSUBI, então o HTML das telas mudou de propósito. Por isso a
// comparação é do conteúdo funcional: pacientes listados, sinais marcados, hipóteses e status,
// avisos de segurança, pentagrama (mesmo componente), pontos filtrados, agendamentos, campos da
// anamnese e alertas, sessões registradas e paciente selecionado. Os dados gravados no navegador
// precisam ser idênticos byte a byte aos do original: o original grava na chave spazio-v1 e o MUSUBI
// grava no modelo v2 (musubi-v2), que é convertido de volta para o formato v1 antes de comparar.
// Uso: node tests/navegador.mjs   (requer Playwright com Chromium instalado)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { paraV1 } from '../js/dados/migracao.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// Telas redesenhadas por completo: Painel (verificado em tests/interface.mjs) e Agenda (etapa 6A,
// verificada em tests/agenda-ui.mjs). Na Agenda o roteiro faz o mesmo uso pelos controles novos e
// os dados salvos continuam comparados byte a byte.
const REDESENHADAS = new Set(['abertura', 'tela painel']);
// Passos feitos na Agenda: compara tudo menos o que é da própria Agenda.
const NA_AGENDA = new Set(['tela agenda', 'próxima semana', 'agendamento criado', 'agendamento concluído', 'restaurar exemplos']);
// Prontuário único (07/11/2026): avaliação energética e pentagrama viraram abas do prontuário do paciente
// aberto, sem o seletor de paciente próprio. Nesses passos compara tudo menos o seletor.
const SEM_SELETOR = new Set(['tela avaliacao', 'tela pentagrama', 'avaliação preenchida', 'pentagrama Água', 'pentagrama sem Ke']);
const semAgenda = (etapa, html) => { if (!NA_AGENDA.has(etapa) && !SEM_SELETOR.has(etapa)) return html; const o = JSON.parse(html);
  if (SEM_SELETOR.has(etapa)) { delete o.selecionado; return JSON.stringify(o); } delete o.agenda; delete o.semana; o.selecionado = o.selecionado.slice(0, 2); return JSON.stringify(o); };
const ALVOS = { 'original (legacy)': 'legacy/prototipo-v1.html', 'modular': 'index.html', 'arquivo único (dist)': 'dist/spazio.html' };
// Math.random previsível, para que os ids gerados sejam iguais nas três versões.
const SEMENTE = () => { let s = 42; Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };

// Resultado funcional da tela, igual para qualquer layout.
const CONTEUDO = () => {
  const q = s => [...document.querySelectorAll('#view ' + s)], txt = e => e.textContent.replace(/\s+/g, ' ').trim();
  const sel = id => document.getElementById(id)?.value ?? null;
  return JSON.stringify({
    pacientes: q('#plist [data-pid]').map(e => e.dataset.pid),
    sinais: q('[data-act="sign"]').filter(b => b.classList.contains('on')).map(b => b.dataset.s),
    hipoteses: q('[data-act="hyp"]').map(b => `${b.dataset.p}:${b.dataset.st}:${b.textContent.trim()}`),
    avisos: q('#ns-warn > *').map(txt),
    pentagrama: q('svg.penta').map(e => e.outerHTML),
    elemento: q('.corr').map(txt),
    pontos: q('#ptlist .code').map(txt),
    meridiano: q('[data-act="mer"].on').map(e => e.dataset.m),
    agenda: q('.appt').map(e => e.dataset.id + (e.classList.contains('done') ? ':concluido' : '')),
    semana: q('.week .day h3').map(txt),
    anamnese: q('[data-anam]').map(e => e.dataset.anam + '=' + e.value),
    alertas: q('[data-alert]').map(e => e.dataset.alert + '=' + e.checked),
    sessoes: q('.sess').map(txt),
    selecionado: [sel('as-patient'), sel('pt-patient'), sel('na-p')],
    nota: sel('as-nota')
  });
};

async function roteiro(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(SEMENTE);
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const fotos = [];
  const foto = async nome => fotos.push([nome, await p.evaluate(CONTEUDO)]);
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(60); };

  await p.goto(url); await p.waitForSelector('#view h1');
  await foto('abertura');
  for (const r of ['painel', 'agenda', 'pacientes', 'prontuario', 'avaliacao', 'pentagrama', 'pontos']) { await ir(r); await foto('tela ' + r); }

  await ir('pacientes');
  await p.fill('#pq', 'lom'); await foto('busca de paciente');
  // Desde a etapa 2C o cadastro tem tela própria (botão Novo paciente); no original fica na lista.
  if (!await p.$('#np-name')) { await p.click('[data-act="novo-paciente"]'); await p.waitForTimeout(60); }
  await p.fill('#np-name', 'Ana Teste'); await p.fill('#np-birth', '1990-05-10'); await p.fill('#np-phone', '(11) 90000-0000');
  await p.fill('#np-q', 'Dor no ombro'); await p.check('#np-lgpd'); await p.click('#f-patient button');
  await p.waitForTimeout(80); await foto('cadastro de paciente');
  await p.check('#al-gestante'); await p.waitForTimeout(40); await foto('alerta gestante');
  await p.fill('#an-sono', 'Acorda cansada'); await p.press('#an-sono', 'Tab'); await foto('anamnese salva');
  await p.click('[data-t="nova"]'); await p.click('[name=tec][value="Ventosa"]');
  await p.fill('#ns-pts', 'IG4, BP6, B13, XX1'); await p.waitForTimeout(40); await foto('avisos de pontos');
  await p.fill('#ns-nota', 'Primeira sessão'); await p.click('#f-session button'); await p.waitForTimeout(60); await foto('sessão registrada');

  await ir('avaliacao');
  // No original a avaliação continua no paciente escolhido na primeira visita (o primeiro da lista); no
  // prontuário único ela é do prontuário aberto: abre o mesmo paciente, pela lista, e a aba Avaliação.
  if (!(await p.$('#as-patient'))) { const pid = await p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).patients[0].id);
    await ir('pacientes'); await p.fill('#pq', ''); await p.waitForTimeout(40); await p.click(`[data-act="open"][data-pid="${pid}"]`); await p.waitForTimeout(60); await p.click('[data-act="tab"][data-t="avaliacao"]'); await p.waitForTimeout(60); }
  for (const s of ['pulso_corda', 'irritabilidade', 'tpm', 'suspiros']) await p.click(`[data-s="${s}"]`);
  await p.click('[data-act="hyp"][data-p="f_estag"][data-st="aceito"]');
  await p.fill('#as-nota', 'Observação de teste'); await foto('avaliação preenchida');
  await p.click('[data-act="save-assess"]'); await p.waitForTimeout(80); await foto('avaliação salva');

  await ir('pentagrama');
  await p.click('.node[data-e="agua"]'); await foto('pentagrama Água');
  await p.evaluate(() => { const c = document.getElementById('cb-ke'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await foto('pentagrama sem Ke');

  await ir('pontos'); await p.fill('#pt-q', 'shen'); await foto('busca de ponto');
  await p.click('[data-act="mer"][data-m="R"]'); await foto('filtro meridiano R');

  await ir('agenda'); await p.click('[data-act="week"][data-d="1"]'); await foto('próxima semana');
  if (!(await p.$('.ag-sem'))) {
    await p.fill('#na-t', '14:30'); await p.click('#f-appt button'); await p.waitForTimeout(60); await foto('agendamento criado');
    await p.click('[data-act="week"][data-d="0"]'); await p.click('.appt'); await foto('agendamento concluído');
  } else {
    // Agenda nova: no original o dia do agendamento fica em hoje mesmo vendo a próxima semana.
    const hoje = await p.evaluate(() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
    await p.fill('#na-d', hoje); await p.waitForTimeout(40);
    await p.fill('#na-t', '14:30'); await p.click('#f-appt button.pri'); await p.waitForTimeout(60); await foto('agendamento criado');
    await p.click('[data-act="week"][data-d="0"]'); await p.waitForTimeout(40);
    // O original conclui (ou reabre) o primeiro agendamento da semana: o mesmo aqui, pela situação do horário.
    const alvo = await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('musubi-v2')).appts, d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`, ini = iso(d); d.setDate(d.getDate() + 6); const fim = iso(d);
      const S = [...Array(7)].flatMap((_, i) => { const x = new Date(ini + 'T12:00:00'); x.setDate(x.getDate() + i); return L.filter(a => a.date === iso(x)).sort((a, b) => a.time.localeCompare(b.time)); });
      return S[0] && fim && { id: S[0].id, date: S[0].date, done: S[0].done }; });
    if (alvo) { await p.click(`[data-act="ag-dia"][data-d="${alvo.date}"]`); await p.waitForTimeout(40);
      await p.click(`[data-act="ag-st"][data-id="${alvo.id}"][data-s="${alvo.done ? 'agendado' : 'atendido'}"]`); await p.waitForTimeout(40); }
    await foto('agendamento concluído');
  }

  const chaves = await p.evaluate(() => ({ v1: localStorage.getItem('spazio-v1'), v2: localStorage.getItem('musubi-v2') }));
  const dados = chaves.v2 ? JSON.stringify(paraV1(JSON.parse(chaves.v2))) : chaves.v1;
  if (chaves.v2 && chaves.v1 !== null) erros.push('a versão nova gravou na chave do protótipo (spazio-v1)');
  await p.click('[data-act="reset"]'); await p.waitForTimeout(60); await foto('restaurar exemplos');
  await ctx.close();
  return { fotos, erros, dados };
}

const srv = await iniciar(0);
const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
const res = {};
for (const [nome, cam] of Object.entries(ALVOS)) res[nome] = await roteiro(browser, base + cam);
await browser.close(); srv.close();

const ref = res['original (legacy)'];
let falhas = 0;
for (const [nome, r] of Object.entries(res)) {
  if (r.erros.length) { falhas++; console.log(`FALHA ${nome}: erros no console`, r.erros); }
  if (r === ref) continue;
  r.fotos.forEach(([etapa, html], i) => {
    if (REDESENHADAS.has(etapa)) return;
    const ok = semAgenda(etapa, html) === semAgenda(etapa, ref.fotos[i][1]);
    if (!ok) falhas++;
    if (!ok) { const A = JSON.parse(html), B = JSON.parse(ref.fotos[i][1]); console.log(`FALHA ${nome} · ${etapa}: difere em ${Object.keys(A).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k])).join(', ')}`); }
  });
  const okDados = r.dados === ref.dados;
  if (!okDados) { falhas++; console.log(`FALHA ${nome} · dados salvos diferentes`); }
  const comparadas = r.fotos.filter(([e]) => !REDESENHADAS.has(e));
  console.log(`${nome}: ${comparadas.filter(([e, h]) => semAgenda(e, h) === semAgenda(e, ref.fotos.find(([e2]) => e2 === e)[1])).length} de ${comparadas.length} telas com conteúdo idêntico ao original (conteúdo funcional; Painel e Agenda redesenhados ficam fora); dados salvos ${okDados ? 'idênticos' : 'diferentes'}.`);
}
console.log(falhas ? `\n${falhas} diferença(s) encontrada(s).` : '\nRoteiro completo sem erros e com resultado idêntico ao original.');
process.exit(falhas ? 1 : 0);
