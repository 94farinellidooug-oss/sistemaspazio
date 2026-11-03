// Camada de dados. Grava no navegador na chave musubi-v2 (modelo v2, ver migracao.js).
// Na primeira abertura, os dados do protótipo (chave spazio-v1) são convertidos para o v2.
// A chave spazio-v1 nunca é alterada nem apagada: fica como cópia de segurança.
import { seed } from './exemplos.js';
import { ehV1, ehV2, hidratar, migrarV1, paraV1 } from './migracao.js';

export const KEY='musubi-v2';
export const KEY_V1='spazio-v1';
const ler = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const gravar = (k,v) => { try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } };
const lerJSON = k => { try{ return JSON.parse(ler(k)); }catch(e){ return undefined; } };

function carregar(){
  const bruto = ler(KEY), v2 = lerJSON(KEY);
  if(ehV2(v2)) return hidratar(v2);
  // Dados v2 ilegíveis não são descartados: ficam guardados à parte antes de qualquer outra coisa.
  if(bruto !== null) gravar(KEY+'-ilegivel', bruto);
  const v1 = lerJSON(KEY_V1);
  if(ehV1(v1)){ const d = migrarV1(v1); gravar(KEY, JSON.stringify(d)); return hidratar(d); }
  return hidratar(migrarV1(seed(), new Date().toISOString(), 'exemplos'));
}
export let db = carregar();
export const save = () => { gravar(KEY, JSON.stringify(db)); };
export const patient = id => db.patients.find(p=>p.id===id);
// Substitui todos os dados pelos exemplos (botão "Restaurar exemplos").
export function restaurarExemplos(){ db = hidratar(migrarV1(seed(), new Date().toISOString(), 'exemplos')); save(); }

// Cópia de segurança em arquivo: v2 completo, ou no formato do protótipo v1 (para voltar a ele).
export const exportarV2 = () => JSON.stringify(db, null, 2);
export const exportarV1 = () => JSON.stringify(paraV1(db), null, 2);
// Importa um arquivo exportado (v2 ou v1). Devolve uma mensagem de erro, ou '' se deu certo.
export function importar(texto){
  let d; try{ d = JSON.parse(texto); }catch(e){ return 'O arquivo não é um JSON válido.'; }
  if(ehV2(d)) db = hidratar(d);
  else if(ehV1(d)) db = hidratar(migrarV1(d, new Date().toISOString(), 'importacao'));
  else return 'O arquivo não tem o formato de dados do MUSUBI nem do protótipo v1.';
  save(); return '';
}
