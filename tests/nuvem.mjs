// Regras da ligação com o servidor (etapa 10) contra um servidor falso na memória que responde como o
// Supabase: entrar, criar conta (com e sem confirmação de e-mail), renovar o token, erros em português,
// sem internet, criar a clínica levando os dados, baixar, salvar com versão, conflito entre aparelhos
// (guarda cópia e traz a do servidor), pedido de contato da página de apresentação.
// As regras de acesso do próprio banco são testadas em tests/banco.sh.  Uso: node tests/nuvem.mjs
import { criarNuvem, criarSincronia, KEY_SESSAO } from '../js/dados/nuvem.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const memoria = () => { const m = new Map(); return { getItem:k => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k), m }; };
const resp = (status, corpo) => ({ ok:status < 300, status, text:async () => corpo === undefined ? '' : JSON.stringify(corpo) });

// Servidor falso
function servidor({ confirmar = false } = {}){
  const S = { usuarios:{ 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } }, tokens:{}, clinicas:[], dados:{}, interessados:[], chamadas:[], offline:false, n:0 };
  const novoToken = u => { const t = 'at' + (++S.n); S.tokens[t] = u; return { access_token:t, refresh_token:'rt-' + u.id + '-' + S.n, expires_in:3600, user:{ id:u.id, email:u.email, user_metadata:{ nome:u.nome } } }; };
  S.fetch = async (url, op) => {
    if (S.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : null, auth = (op.headers.Authorization || '').replace('Bearer ', ''), eu = S.tokens[auth];
    S.chamadas.push({ caminho:u.pathname + u.search, op });
    if (op.headers.apikey !== 'pub') return resp(401, { message:'Invalid API key' });
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const x = S.usuarios[corpo.email]; if (!x || x.senha !== corpo.password) return resp(400, { error_code:'invalid_credentials', msg:'Invalid login credentials' });
      return resp(200, novoToken({ ...x, email:corpo.email }));
    }
    if (u.pathname === '/auth/v1/token') { const id = corpo.refresh_token.split('-')[1]; const e = Object.entries(S.usuarios).find(([, v]) => v.id === id); return e ? resp(200, novoToken({ ...e[1], email:e[0] })) : resp(400, { error_code:'refresh_token_not_found' }); }
    if (u.pathname === '/auth/v1/signup') {
      if (S.usuarios[corpo.email]) return resp(422, { code:422, error_code:'user_already_exists', msg:'User already registered' });
      if (corpo.password.length < 8) return resp(422, { error_code:'weak_password' });
      const x = S.usuarios[corpo.email] = { id:'u' + (++S.n), senha:corpo.password, nome:corpo.data.nome };
      return confirmar ? resp(200, { id:x.id, email:corpo.email }) : resp(200, novoToken({ ...x, email:corpo.email }));
    }
    if (u.pathname === '/auth/v1/recover') return resp(200, {});
    if (u.pathname === '/auth/v1/logout') { delete S.tokens[auth]; return resp(204); }
    if (u.pathname === '/rest/v1/interessados') { if (op.headers.Prefer !== 'return=minimal') return resp(401, { code:'42501', message:'new row violates row-level security' }); S.interessados.push(corpo); return resp(201); }
    if (!eu) return resp(401, { code:'PGRST301', message:'JWT expired' });
    if (u.pathname === '/rest/v1/rpc/criar_clinica') { const id = 'c' + (++S.n); S.clinicas.push({ id, nome:corpo.p_nome, cidade:corpo.p_cidade, uf:corpo.p_uf, membros:[{ user:eu.id, perfil:'adm' }] }); S.dados[id] = { doc:corpo.p_doc, versao:1 }; return resp(200, id); }
    const membro = c => S.clinicas.find(x => x.id === c)?.membros.some(m => m.user === eu.id);
    if (u.pathname === '/rest/v1/membros') return resp(200, S.clinicas.filter(c => c.membros.some(m => m.user === eu.id)).map(c => ({ perfil:'adm', nome:'', clinicas:{ id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf } })));
    if (u.pathname === '/rest/v1/dados') { const c = u.searchParams.get('clinica_id').replace('eq.', ''); return resp(200, membro(c) ? [S.dados[c]] : []); }
    if (u.pathname === '/rest/v1/rpc/salvar_dados') {
      if (!membro(corpo.p_clinica)) return resp(400, { code:'P0001', message:'sem_acesso' });
      const d = S.dados[corpo.p_clinica]; if (d.versao !== corpo.p_versao) return resp(200, -1);
      d.doc = corpo.p_doc; d.versao++; return resp(200, d.versao);
    }
    return resp(404, { message:'não encontrado' });
  };
  return S;
}

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

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as regras da ligação com o servidor passaram.');
process.exit(falhas ? 1 : 0);
