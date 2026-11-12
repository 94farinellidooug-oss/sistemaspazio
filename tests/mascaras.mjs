// Máscaras de digitação (CPF, telefone, data) e conversão da data digitada para o formato do banco.
// Uso: node tests/mascaras.mjs
import { dataIso, mascaraCpf, mascaraData, mascaraTel } from '../js/componentes/mascaras.js';

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const igual = (f, casos, nome) => { for (const [e, s] of casos) ok(f(e) === s, `${nome}(${JSON.stringify(e)}) = ${JSON.stringify(s)} (veio ${JSON.stringify(f(e))})`); };

igual(mascaraCpf, [['', ''], ['529', '529'], ['5299', '529.9'], ['529982', '529.982'], ['5299822', '529.982.2'], ['529982247', '529.982.247'], ['5299822472', '529.982.247-2'], ['52998224725', '529.982.247-25'], ['529.982.247-259', '529.982.247-25'], ['529.98', '529.98']], 'mascaraCpf');
igual(mascaraTel, [['', ''], ['5', '(5'], ['54', '(54'], ['549', '(54) 9'], ['549999', '(54) 9999'], ['5499999', '(54) 9999-9'], ['5433334444', '(54) 3333-4444'], ['54999991234', '(54) 99999-1234'], ['549999912345', '(54) 99999-1234'], ['+55 54 99999-1234', '(54) 99999-1234'], ['(54) 99999-1234', '(54) 99999-1234'], ['(54) 3333-4444', '(54) 3333-4444']], 'mascaraTel');
igual(mascaraData, [['', ''], ['1', '1'], ['12', '12'], ['120', '12/0'], ['1204', '12/04'], ['12041', '12/04/1'], ['12041988', '12/04/1988'], ['120419889', '12/04/1988'], ['12/04/1988', '12/04/1988'], ['1988-04-12', '12/04/1988'], [undefined, '']], 'mascaraData');
igual(dataIso, [['12/04/1988', '1988-04-12'], ['1988-04-12', '1988-04-12'], ['29/02/2024', '2024-02-29'], ['29/02/2023', ''], ['31/04/1990', ''], ['00/01/1990', ''], ['12/13/1990', ''], ['12/04/88', ''], ['01/01/1800', ''], ['', ''], ['abc', '']], 'dataIso');

console.log(falhas ? `\n${falhas} falha(s)` : '\nMáscaras: tudo certo');
process.exit(falhas ? 1 : 0);
