// Camada de dados. Grava no navegador na chave musubi-v2 (modelo v2, ver migracao.js).
// Na primeira abertura, os dados do protótipo (chave spazio-v1) são convertidos para o v2.
// A chave spazio-v1 nunca é alterada nem apagada: fica como cópia de segurança.
import { seed } from './exemplos.js';
import { ehV1, ehV2, hidratar, migrarV1, paraV1, trocarNomeProfissional } from './migracao.js';
import { aplicarConfig } from './config.js';

export const KEY='musubi-v2';
export const KEY_V1='spazio-v1';
const ler = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const gravar = (k,v) => { try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } };
const lerJSON = k => { try{ return JSON.parse(ler(k)); }catch(e){ return undefined; } };

function carregar(){
  const bruto = ler(KEY), v2 = lerJSON(KEY);
  if(ehV2(v2)){ if(trocarNomeProfissional(v2, 'Mauren Turcatti', 'Maicon Farinelli')) gravar(KEY, JSON.stringify(v2)); return hidratar(v2); }
  // Dados v2 ilegíveis não são descartados: ficam guardados à parte antes de qualquer outra coisa.
  if(bruto !== null) gravar(KEY+'-ilegivel', bruto);
  const v1 = lerJSON(KEY_V1);
  if(ehV1(v1)){ const d = migrarV1(v1); gravar(KEY, JSON.stringify(d)); return hidratar(d); }
  return hidratar(migrarV1(seed(), new Date().toISOString(), 'exemplos'));
}
export let db = carregar();
aplicarConfig(db);
// Depois de gravar no aparelho, avisa quem estiver ouvindo (a sincronia com o servidor, etapa 10).
let ouvinteSalvar = null;
export const ouvirSalvar = fn => { ouvinteSalvar = fn; };
const tambemSalvar = new Set();
// Outros interessados em cada salvamento (ex.: a área do paciente publica de novo o que mudou).
export const tambemAoSalvar = fn => { tambemSalvar.add(fn); };
export const save = () => { gravar(KEY, JSON.stringify(db)); if(ouvinteSalvar) ouvinteSalvar(); tambemSalvar.forEach(fn => { try { fn(); } catch (e) {} }); };
// Troca todos os dados pelos que vieram do servidor (ou por uma clínica vazia), sem avisar a sincronia.
export function trocarDados(doc){ db = hidratar(JSON.parse(JSON.stringify(doc))); aplicarConfig(db); gravar(KEY, JSON.stringify(db)); }
export const dadosVazios = () => hidratar(migrarV1({ patients:[], appts:[] }, new Date().toISOString(), 'nova-clinica'));
// Clínica nova: começa com os pacientes de exemplo, com WhatsApp e CPF de mentira (0000…), para nenhuma
// mensagem de teste ir para alguém de verdade (o WhatsApp não abre com número repetido).
export const dadosNovaClinica = () => {
  const d = hidratar(migrarV1(seed(), new Date().toISOString(), 'exemplos'));
  d.patients.forEach(p => { p.phone = '(00) 00000-0000'; if (p.cadastro) p.cadastro.cpf = '000.000.000-00'; });
  return d;
};
// Quanta coisa tem neste aparelho (para o primeiro acesso dizer o que vai junto).
export const resumoDados = () => ({ pacientes:db.patients.filter(p=>!p.exemplo).length, exemplos:db.patients.some(p=>p.exemplo), atendimentos:db.patients.filter(p=>!p.exemplo).reduce((n,p)=>n+p.atendimentos.length,0), horarios:db.appts.filter(a=>!db.patients.find(p=>p.id===a.pid)?.exemplo).length });
export const patient = id => db.patients.find(p=>p.id===id);
// Substitui todos os dados pelos exemplos (botão "Restaurar exemplos").
export function restaurarExemplos(){ db = hidratar(migrarV1(seed(), new Date().toISOString(), 'exemplos')); aplicarConfig(db); save(); }

// Cópia de segurança em arquivo: v2 completo, ou no formato do protótipo v1 (para voltar a ele).
export const exportarV2 = () => JSON.stringify(db, null, 2);
export const exportarV1 = () => JSON.stringify(paraV1(db), null, 2);
// Importa um arquivo exportado (v2 ou v1). Devolve uma mensagem de erro, ou '' se deu certo.
export function importar(texto){
  let d; try{ d = JSON.parse(texto); }catch(e){ return 'O arquivo não é um JSON válido.'; }
  if(ehV2(d)) db = hidratar(d);
  else if(ehV1(d)) db = hidratar(migrarV1(d, new Date().toISOString(), 'importacao'));
  else return 'O arquivo não tem o formato de dados do MUSUBI nem do protótipo v1.';
  aplicarConfig(db); save(); return '';
}
