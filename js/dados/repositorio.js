// Camada de dados. Hoje grava no navegador (chave spazio-v1, formato inalterado).
import { seed } from './exemplos.js';

export const KEY='spazio-v1';
export let db;
try{ db = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
if(!db || !db.patients) db = seed();
export const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){} };
export const patient = id => db.patients.find(p=>p.id===id);
// Substitui todos os dados pelos exemplos (botão "Restaurar exemplos").
export function restaurarExemplos(){ db = seed(); save(); }
