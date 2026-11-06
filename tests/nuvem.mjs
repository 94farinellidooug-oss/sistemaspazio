// Regras da ligação com o servidor (etapa 10) contra um servidor falso na memória que responde como o
// Supabase: entrar, criar conta (com e sem confirmação de e-mail), renovar o token, erros em português,
// sem internet, criar a clínica levando os dados, baixar, salvar com versão, conflito entre aparelhos
// (guarda cópia e traz a do servidor), pedido de contato da página de apresentação.
// As regras de acesso do próprio banco são testadas em tests/banco.sh.  Uso: node tests/nuvem.mjs
import { criarNuvem, criarSincronia, KEY_SESSAO } from '../js/dados/nuvem.js';
import { servidor } from './lib/supabase-falso.mjs';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const memoria = () => { const m = new Map(); return { getItem:k => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k), m }; };
let S = servidor(), relogio = 1e6, mem = memoria();
let N = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem, agora:() => relogio });
const erro = async p => { try { await p; return null; } catch (e) { return e; } };

let e = await erro(N.entrar('maicon@x.com', 'errada'));
ok(e?.message === 'E-mail ou senha incorretos.' && !N.sessao(), 'senha errada: mensagem em português e sem sessão');
await N.entrar(' maicon@x.com ', 'segredo123');
ok(N.sessao()?.user.id === 'u1' && JSON.parse(mem.getItem(KEY_SESSAO)).access_token === N.sessao().access_token, 'entrar guarda a sessão no aparelho');
ok(S.chamadas.at(-1).op.headers.apikey === 'pub' && !S.chamadas.at(-1).op.headers.Authorization, 'login usa só a chave pública');
const N2 = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem, agora:() => relogio });
ok(N2.sessao()?.user.email === 'maicon@x.com', 'reabrir o sistema continua conectado');

const doc = { v:2, patients:[{ id:'p1' }] };
const c = await N.criarClinica({ nome:'Spazio Stabilità', cidade:'Caxias do Sul', uf:'RS', nomePessoa:'Maicon' }, doc);
ok(S.dados[c]?.versao === 1 && S.dados[c].doc.patients.length === 1, 'criar a clínica leva os dados do aparelho');
ok(S.chamadas.at(-1).op.headers.Authorization === 'Bearer ' + N.sessao().access_token, 'chamadas de dados vão com o token da pessoa');
const cl = await N.minhasClinicas();
ok(cl.length === 1 && cl[0].nome === 'Spazio Stabilità' && cl[0].perfil === 'adm', 'lista as clínicas da pessoa');

relogio += 3600 * 1000; const antes = N.sessao().access_token;
await N.baixar(c);
ok(N.sessao().access_token !== antes && S.chamadas.some(x => x.caminho.includes('grant_type=refresh_token')), 'token vencendo é renovado sozinho');

S.offline = true; e = await erro(N.baixar(c)); S.offline = false;
ok(e?.codigo === 'offline' && e.message.includes('Sem conexão') && N.sessao(), 'sem internet: avisa e não desconecta');

// Conta nova
e = await erro(N.criarConta('maicon@x.com', 'outrasenha', 'M'));
ok(e?.message.includes('Já existe uma conta'), 'e-mail já cadastrado');
e = await erro(N.criarConta('nova@x.com', '123', 'Nova'));
ok(e?.message.includes('Senha fraca'), 'senha fraca');
const S2 = servidor({ confirmar:true }), N3 = criarNuvem({ chave:'pub', f:S2.fetch, mem:memoria() });
const r3 = await N3.criarConta('ana@x.com', 'segredo123', 'Ana', 'https://site/spazio.html');
ok(r3.confirmar && !N3.sessao() && S2.chamadas.at(-1).caminho.includes('redirect_to=https%3A%2F%2Fsite'), 'com confirmação de e-mail: pede para abrir o link, volta para o site');
const lk = N3.sessaoDoLink('#access_token=abc&refresh_token=rt-u9-1&expires_in=3600&type=signup');
ok(lk.tipo === 'signup' && N3.sessao().access_token === 'abc', 'link do e-mail conecta a pessoa');
ok(N3.sessaoDoLink('#/agenda') === null, 'endereço comum não é confundido com o link');

// Sincronia entre aparelhos
const timers = new Map(); let tid = 0; const relogioFalso = { definir:fn => { timers.set(++tid, fn); return tid; }, limpar:id => timers.delete(id) };
const rodar = async () => { while (timers.size) { const [id, fn] = timers.entries().next().value; timers.delete(id); await fn(); } };
let local = null; const estados = [], memA = memoria();
const A = criarSincronia({ nuvem:N, clinica:c, obter:() => local, aplicar:d => { local = structuredClone(d); }, aoMudar:(s, x) => estados.push([s, x]), mem:memA, relogio:relogioFalso, agora:() => 'T1' });
await A.iniciar();
ok(local.patients.length === 1 && A.versao() === 1 && A.estado() === 'salvo', 'abre com os dados do servidor');
local.patients.push({ id:'p2' }); A.marcar(); A.marcar(); await rodar();
ok(S.dados[c].versao === 2 && S.dados[c].doc.patients.length === 2 && A.versao() === 2, 'mudança é enviada (uma vez só, mesmo marcando duas)');
ok(S.chamadas.filter(x => x.caminho.includes('salvar_dados')).length === 1, 'espera e junta as mudanças');

const B = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem:memoria() }); await B.entrar('maicon@x.com', 'segredo123');
await B.salvar(c, { v:2, patients:[{ id:'p1' }, { id:'p2' }, { id:'celular' }] }, 2);
local.patients.push({ id:'computador' }); A.marcar(); await rodar();
const conf = estados.at(-1);
ok(conf[0] === 'conflito' && JSON.parse(memA.getItem(conf[1].copia)).patients.at(-1).id === 'computador', 'conflito: guarda cópia do que estava neste aparelho');
ok(local.patients.at(-1).id === 'celular' && A.versao() === 3, 'e traz o que o outro aparelho salvou');

S.offline = true; local.patients.push({ id:'sem-internet' }); A.marcar(); await rodar();
ok(A.estado() === 'offline' && A.pendente(), 'sem internet fica pendente');
S.offline = false; A.tentarDeNovo(); await rodar();
ok(A.estado() === 'salvo' && S.dados[c].doc.patients.at(-1).id === 'sem-internet', 'quando volta a internet, envia o que ficou pendente');

// Outra conta não salva na clínica
S.usuarios['outra@y.com'] = { id:'u9', senha:'segredo123', nome:'Outra' };
const O = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem:memoria() }); await O.entrar('outra@y.com', 'segredo123');
e = await erro(O.salvar(c, {}, 4));
ok(e?.message === 'Sua conta não tem acesso a esta clínica.' && (await O.baixar(c)) === undefined || (await O.baixar(c)) === null, 'outra conta: sem acesso e sem dados');

// Página de apresentação e sair
const V = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S.fetch, mem:memoria() });
await V.pedirContato(' Carla Mendes ', '(51) 98888-1234');
ok(S.interessados.at(-1).nome === 'Carla Mendes' && !S.chamadas.at(-1).op.headers.Authorization, 'pedido de contato vai sem login');
await N.esqueci('maicon@x.com', 'https://site/');
ok(S.chamadas.at(-1).caminho.startsWith('/auth/v1/recover?redirect_to='), 'esqueci a senha manda o link de volta para o site');
await N.sair();
ok(!N.sessao() && mem.getItem(KEY_SESSAO) === null, 'sair apaga a sessão do aparelho');
e = await erro(N.baixar(c));
ok(e?.codigo === 'sem_login', 'depois de sair, pede para entrar de novo');

// Servidor ainda sem 002_planos.sql: criar clínica com pacote cai para a função antiga; sem assinatura = liberado
{ const S2 = servidor({ chave:'pub' }), f0 = S2.fetch;
  S2.fetch = async (u, op) => { if (op.body?.includes('p_plano')) return { ok:false, status:404, text:async () => JSON.stringify({ code:'PGRST202', message:'Could not find the function' }) };
    if (u.includes('/rest/v1/assinaturas')) return { ok:false, status:404, text:async () => JSON.stringify({ code:'PGRST205', message:'Could not find the table' }) }; return f0(u, op); };
  const A = criarNuvem({ url:'https://x.supabase.co', chave:'pub', f:S2.fetch, mem:memoria() });
  await A.entrar('maicon@x.com', 'segredo123');
  const id = await A.criarClinica({ nome:'X', cidade:'Y', uf:'RS', nomePessoa:'M', plano:'essencial' }, { v:2 });
  ok(!!id && S2.clinicas.length === 1 && await A.assinatura(id) === null, 'servidor sem os pacotes: cria a clínica mesmo assim e não bloqueia'); }

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as regras da ligação com o servidor passaram.');
process.exit(falhas ? 1 : 0);
