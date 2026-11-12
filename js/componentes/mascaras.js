// Máscaras de digitação: o campo vai ficando formatado enquanto a pessoa digita.
// Uso: <input data-mask="cpf|tel|data">; um ouvinte de 'input' chama aplicarMascara(campo).
// Sem dependências, para servir também à página de apresentação.

const soNum = (v, max) => String(v ?? '').replace(/\D/g, '').slice(0, max);

// 000.000.000-00, aos poucos.
export const mascaraCpf = v => {
  const d = soNum(v, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

// (00) 0000-0000 com 10 números e (00) 00000-0000 com 11, aos poucos.
// Número com +55 na frente perde o código do país.
export const mascaraTel = v => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `, r = d.slice(2);
  if (r.length <= 4) return ddd + r;
  const corte = r.length === 9 ? 5 : 4;
  return `${ddd}${r.slice(0, corte)}-${r.slice(corte)}`;
};

// dd/mm/aaaa, aos poucos. Uma data no formato do banco (aaaa-mm-dd) é mostrada como dd/mm/aaaa.
export const mascaraData = v => {
  const s = String(v ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = soNum(s, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

// 'dd/mm/aaaa' (ou já 'aaaa-mm-dd') → 'aaaa-mm-dd'; data impossível → ''.
export const dataIso = v => {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/), a, me, di;
  if (m) [, a, me, di] = m;
  else { m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return ''; [, di, me, a] = m; }
  const d = new Date(Date.UTC(+a, +me - 1, +di));
  if (+a < 1900 || d.getUTCFullYear() !== +a || d.getUTCMonth() !== +me - 1 || d.getUTCDate() !== +di) return '';
  return `${a}-${me}-${di}`;
};

const MASCARAS = { cpf: mascaraCpf, tel: mascaraTel, data: mascaraData };

// Formata o campo mantendo o cursor no mesmo número em que a pessoa estava.
export const aplicarMascara = el => {
  const f = MASCARAS[el?.dataset?.mask]; if (!f) return;
  const antes = el.value, pos = el.selectionStart ?? antes.length;
  const numerosAntes = antes.slice(0, pos).replace(/\D/g, '').length;
  const novo = f(antes);
  if (novo === antes) return;
  el.value = novo;
  if (document.activeElement !== el) return;
  let p = 0, n = 0;
  while (p < novo.length && n < numerosAntes) { if (/\d/.test(novo[p])) n++; p++; }
  try { el.setSelectionRange(p, p); } catch { /* tipo de campo sem seleção */ }
};
