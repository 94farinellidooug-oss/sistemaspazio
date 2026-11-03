// Verifica a apresentação da proposta visual (proposta/): em várias larguras de tela e horários do dia,
// nenhum elemento posicionado (absolute) sai do componente a que pertence, nenhum conteúdo vaza do cartão, nenhuma tela tem rolagem
// horizontal e não há erros no console. Uso: node tests/proposta-layout.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROTAS = ['painel','agenda','pacientes','pacientes/novo','paciente/p1','paciente/p1/historico','paciente/p5',
  ...[0,1,2,3,4,5,6,7].map(i=>'atendimento/p1/'+i),'atendimento/p5/1','biblioteca','financeiro','relatorios','documentos','administracao','guia'];
const TELAS = [[1440,900],[1280,800],[1024,768],[900,1000],[768,1024],[390,844]];
const HORAS = ['08:30','12:00','15:40','18:50','21:00'];

let falhas = 0;
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/proposta/index.html`;
const browser = await chromium.launch();
for (const hora of HORAS) for (const [w,h] of TELAS) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, timezoneId:'America/Sao_Paulo' });
  const p = await ctx.newPage(), erros = [];
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type()==='error') erros.push(m.text()); });
  const hoje = new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  await p.clock.setFixedTime(new Date(`${hoje}T${hora}:00-03:00`));
  await p.goto(base); await p.waitForSelector('#view .head, #view .at-top', { timeout: 5000 });
  for (const r of ROTAS) {
    await p.evaluate(x => { location.hash = '/' + x; }, r); await p.waitForTimeout(40);
    const prob = await p.evaluate(() => {
      const L = [];
      for (const e of document.querySelectorAll('#view *')) {
        const cs = getComputedStyle(e); if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
        if (cs.position === 'fixed') { L.push('fixo dentro do conteúdo: ' + e.className); continue; }
        const pai = e.offsetParent; if (!pai || pai === document.body) { L.push('sem contêiner posicionado: ' + e.className); continue; }
        const a = e.getBoundingClientRect(), b = pai.getBoundingClientRect(), t = 12;
        if (a.width && (a.left < b.left - t || a.right > b.right + t || a.top < b.top - t || a.bottom > b.bottom + t)) L.push(`fora do contêiner: ${e.className} em ${pai.className}`);
      }
      for (const c of document.querySelectorAll('#view .card, #view .tile, #view .hero, #view .tl-c')) {
        const b = c.getBoundingClientRect();
        for (const e of c.querySelectorAll('*')) {
          let rola = false; for (let x = e.parentElement; x && x !== c; x = x.parentElement) if (/auto|scroll/.test(getComputedStyle(x).overflowX)) rola = true;
          if (rola || /auto|scroll/.test(getComputedStyle(c).overflowX)) continue;
          if (e.closest('details:not([open]) > :not(summary)')) continue;
          const a = e.getBoundingClientRect(); if (!a.width || getComputedStyle(e).position === 'absolute') continue;
          if (a.right > b.right + 2 || a.left < b.left - 2) { L.push(`conteúdo vaza do cartão: ${e.className || e.tagName} "${(e.textContent||'').trim().slice(0,30)}" em ${c.className}`); break; }
        }
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) L.push('rolagem horizontal');
      return L;
    });
    if (prob.length) { falhas++; console.log(`FALHA ${hora} ${w}px #/${r}: ${[...new Set(prob)].join(' | ')}`); }
  }
  if (erros.length) { falhas++; console.log(`FALHA ${hora} ${w}px: erros no console → ${erros.join(' | ')}`); }
  await ctx.close();
}
await browser.close(); srv.close();
const total = HORAS.length * TELAS.length * ROTAS.length;
console.log(falhas ? `\n${falhas} problema(s) em ${total} verificações.` : `\n${total} combinações de tela, horário e rota sem sobreposição, sem rolagem horizontal e sem erros.`);
process.exit(falhas ? 1 : 0);
