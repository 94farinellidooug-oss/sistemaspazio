// Consulta online (função teleconsulta, supabase/functions/teleconsulta): salvar o horário online, entrada do
// profissional e do paciente, janela de horário, aceite do termo e sala privada do Daily. Sem rede: tudo simulado.
// Uso: node tests/teleconsulta.mjs
import { criarTeleconsulta, situacaoSala, JANELA, LIMITE_ONLINE, inicioDoMes } from '../supabase/functions/teleconsulta/index.ts';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const C1 = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222', MIN = 6e4;

function cenario({ chave = 'dk_x' } = {}){
  const S = { agora:Date.parse('2026-11-20T13:00:00Z'), linhas:[], salas:[], passes:[], updates:[], n:0,
    membros:[{ clinica_id:C1, user_id:'u1', perfil:'adm', nome:'Maicon', ativo:true }, { clinica_id:C1, user_id:'u2', perfil:'rec', nome:'Ana', ativo:true }] };
  const json = (status, j) => new Response(j === undefined ? null : JSON.stringify(j), { status });
  const eq = (u, k) => (u.searchParams.get(k) || '').replace(/^eq\./, '');
  const f = async (url, op = {}) => {
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : undefined;
    if (u.origin === 'https://sb.test') {
      if (u.pathname === '/auth/v1/user') { const t = op.headers.Authorization.replace('Bearer ', ''); return t === 'tk-u1' ? json(200, { id:'u1', email:'m@x.com' }) : t === 'tk-u2' ? json(200, { id:'u2', email:'a@x.com' }) : t === 'tk-u9' ? json(200, { id:'u9', email:'outro@x.com' }) : json(401, {}); }
      if (u.pathname === '/rest/v1/membros') return json(200, S.membros.filter(m => m.clinica_id === eq(u, 'clinica_id') && m.user_id === eq(u, 'user_id')));
      if (u.pathname === '/rest/v1/teleconsultas' && op.method === 'POST') {
        let l = S.linhas.find(x => x.clinica_id === corpo.clinica_id && x.consulta_id === corpo.consulta_id);
        if (l) Object.assign(l, corpo); else { l = { id:`aaaaaaaa-0000-4000-8000-00000000000${++S.n}`, sala:null, sala_url:null, aceite_em:null, ...corpo }; S.linhas.push(l); }
        return json(201, [l]);
      }
      if (u.pathname === '/rest/v1/teleconsultas' && op.method === 'PATCH') { const l = S.linhas.find(x => x.id === eq(u, 'id')); Object.assign(l, corpo); return json(204); }
      if (u.pathname === '/rest/v1/teleconsultas' && u.searchParams.get('sala_em')) { const de = u.searchParams.get('sala_em').slice(4); return json(200, S.linhas.filter(x => x.clinica_id === eq(u, 'clinica_id') && x.sala_em && x.sala_em >= de)); }
      if (u.pathname === '/rest/v1/teleconsultas') return json(200, S.linhas.filter(x => x.id === eq(u, 'id')));
      if (u.pathname === '/rest/v1/assinaturas') return json(200, S.plano ? [{ plano:S.plano }] : []);
    }
    if (u.origin === 'https://api.daily.co') {
      if (op.headers.Authorization !== `Bearer ${chave}`) ok(false, 'Daily chamado sem a chave');
      if (u.pathname === '/v1/rooms') { S.salas.push(corpo); return json(200, { name:corpo.name, url:`https://musubi.daily.co/${corpo.name}` }); }
      if (u.pathname.startsWith('/v1/rooms/')) { S.updates.push({ sala:u.pathname.slice(10), ...corpo }); return json(200, {}); }
      if (u.pathname === '/v1/meeting-tokens') { S.passes.push(corpo.properties); return json(200, { token:`tok${S.passes.length}` }); }
    }
    throw new Error('rede inesperada: ' + url);
  };
  const env = k => ({ SUPABASE_URL:'https://sb.test', SUPABASE_SERVICE_ROLE_KEY:'service', DAILY_CHAVE:chave })[k];
  const h = criarTeleconsulta({ env, f, agora:() => S.agora, sorteio:() => 'abc123' });
  const pedir = async (corpo, tk, cab = {}) => { const r = await h(new Request('https://sb.test/functions/v1/teleconsulta', { method:'POST', headers:{ ...(tk ? { Authorization:'Bearer ' + tk } : {}), 'x-forwarded-for':'200.1.2.3, 10.0.0.1', 'user-agent':'Celular/1', ...cab }, body:JSON.stringify(corpo) })); return { status:r.status, j:await r.json() }; };
  return { S, pedir };
}
const INI = '2026-11-20T14:00:00.000Z';
const salvar = (pedir, tk = 'tk-u1', extra = {}) => pedir({ acao:'salvar', clinica:C1, consulta:'h1', inicio:INI, duracao:60, primeiro:'Joana', clinica_nome:'Spazio Stabilità', ...extra }, tk);

// Janela da sala
{ const t = { inicio:INI, fim:'2026-11-20T15:00:00.000Z' }, T = Date.parse(INI);
  ok(situacaoSala(t, T - 31 * MIN) === 'cedo' && situacaoSala(t, T - 30 * MIN) === 'aberta' && situacaoSala(t, T + 120 * MIN) === 'aberta' && situacaoSala(t, T + 121 * MIN) === 'encerrada', 'sala abre 30 min antes e fecha 1 hora depois do fim');
  ok(situacaoSala({ ...t, cancelada:true }, T) === 'cancelada' && situacaoSala(t, T - 50 * MIN, JANELA.profissional) === 'aberta', 'desmarcado fecha a sala; o profissional entra até 1 hora antes');
}
// Salvar
{ const { S, pedir } = cenario();
  let r = await salvar(pedir, null);
  ok(r.status === 401 && !S.linhas.length, 'sem login não cria consulta online');
  r = await salvar(pedir, 'tk-u9');
  ok(r.status === 403 && !S.linhas.length, 'quem não é da clínica não cria');
  r = await pedir({ acao:'salvar', clinica:C1, consulta:'h1', inicio:'ontem', duracao:60 }, 'tk-u1');
  ok(r.status === 400, 'dia e horário inválidos são recusados');
  r = await salvar(pedir, 'tk-u2', { primeiro:'<b>Joana</b>' });
  const l = S.linhas[0];
  ok(r.status === 200 && r.j.id === l.id && l.fim === '2026-11-20T15:00:00.000Z' && l.primeiro === 'bJoana/b' && l.criado_por === 'u2' && !S.salas.length, 'a recepção também cria; guarda início, fim e primeiro nome; a sala só é criada na entrada');
  r = await salvar(pedir, 'tk-u1', { inicio:'2026-11-21T14:00:00.000Z' });
  ok(r.j.id === l.id && S.linhas.length === 1 && l.inicio === '2026-11-21T14:00:00.000Z', 'remarcar atualiza a mesma consulta (o link do paciente não muda)');
}
// Paciente e profissional
{ const { S, pedir } = cenario();
  const { j:{ id } } = await salvar(pedir);
  let r = await pedir({ acao:'paciente', id:'nao-e-id' });
  ok(r.status === 404 && r.j.erro === 'nao_encontrada', 'link inválido: consulta não encontrada');
  S.agora = Date.parse(INI) - 2 * 60 * MIN;
  r = await pedir({ acao:'paciente', id, aceito:true });
  ok(r.j.situacao === 'cedo' && !r.j.url && !S.salas.length && r.j.clinica === 'Spazio Stabilità' && r.j.primeiro === 'Joana', 'antes da hora: mostra a clínica e o horário, sem abrir a sala');
  r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u1');
  ok(r.status === 409 && r.j.erro === 'cedo', 'profissional também espera a sala abrir');
  S.agora = Date.parse(INI) - 10 * MIN;
  r = await pedir({ acao:'paciente', id });
  ok(r.j.situacao === 'aberta' && !r.j.url && !S.linhas[0].aceite_em, 'sem aceitar o termo, o paciente não recebe a entrada');
  r = await pedir({ acao:'paciente', id, aceito:true });
  const L = S.linhas[0], sala = S.salas[0];
  ok(r.status === 200 && r.j.url === 'https://musubi.daily.co/musubi-abc123?t=tok1' && L.aceite_ip === '200.1.2.3' && L.aceite_agente === 'Celular/1' && L.aceite_em, 'paciente aceita: registra hora, IP e navegador e recebe a entrada');
  ok(sala.privacy === 'private' && sala.properties.exp === Date.parse('2026-11-20T17:00:00Z') / 1000 && S.passes[0].is_owner === false && S.passes[0].user_name === 'Joana' && !('enable_recording' in sala.properties), 'sala privada que fecha 2 horas depois do fim; passe do paciente sem poder de dono; sem gravação');
  r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u9');
  ok(r.status === 403, 'outra pessoa não entra como profissional');
  r = await pedir({ acao:'entrar', clinica:C2, id }, 'tk-u1');
  ok(r.status === 403 || r.status === 404, 'não entra pela consulta de outra clínica');
  r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u1');
  ok(r.status === 200 && r.j.url.endsWith('?t=tok2') && S.salas.length === 1 && S.passes[1].is_owner === true && S.passes[1].user_name === 'Maicon', 'profissional entra na mesma sala, como dono, com o nome');
  await salvar(pedir, 'tk-u1', { inicio:'2026-11-20T14:30:00.000Z' });
  ok(S.updates[0]?.sala === 'musubi-abc123' && S.updates[0].properties.exp === Date.parse('2026-11-20T17:30:00Z') / 1000, 'remarcar com a sala criada muda quando ela fecha');
  await salvar(pedir, 'tk-u1', { cancelada:true });
  r = await pedir({ acao:'paciente', id, aceito:true });
  ok(r.j.situacao === 'cancelada' && !r.j.url, 'horário desmarcado: o link não abre mais');
  S.agora = Date.parse(INI) + 5 * 60 * MIN; await salvar(pedir, 'tk-u1', { cancelada:false });
  r = await pedir({ acao:'paciente', id, aceito:true });
  ok(r.j.situacao === 'encerrada' && !r.j.url, 'depois do horário a sala não abre');
}
{ const { S, pedir } = cenario({ chave:'' });
  const { j:{ id } } = await salvar(pedir);
  S.agora = Date.parse(INI);
  let r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u1');
  ok(r.status === 503 && r.j.erro === 'sem_video' && r.j.msg.includes('DAILY_CHAVE'), 'sem a chave do Daily: avisa o que falta');
  r = await pedir({ acao:'paciente', id, aceito:true });
  ok(r.status === 503 && r.j.msg.includes('Avise a clínica'), 'paciente vê um aviso simples');
}

// Limite de consultas online por mês do pacote
{ ok(LIMITE_ONLINE.essencial === 10 && LIMITE_ONLINE.profissional === 40 && LIMITE_ONLINE.clinica === 100, 'limites: Essencial 10, Profissional 40, Clínica 100 por mês');
  ok(inicioDoMes(Date.parse('2026-12-01T02:00:00Z')) === '2026-11-01T03:00:00.000Z' && inicioDoMes(Date.parse('2026-12-01T03:00:00Z')) === '2026-12-01T03:00:00.000Z', 'o mês vira à meia-noite de Brasília');
  const { S, pedir } = cenario(); S.plano = 'essencial'; S.agora = Date.parse(INI);
  for (let i = 0; i < 10; i++) S.linhas.push({ id:`bbbbbbbb-0000-4000-8000-00000000000${i}`, clinica_id:C1, consulta_id:'x' + i, sala:'s' + i, sala_url:'u', sala_em:'2026-11-05T12:00:00.000Z' });
  S.linhas.push({ id:'bbbbbbbb-0000-4000-8000-0000000000aa', clinica_id:C1, consulta_id:'velha', sala:'sv', sala_url:'u', sala_em:'2026-10-20T12:00:00.000Z' });
  const { j:{ id } } = await salvar(pedir);
  let r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u1');
  ok(r.status === 403 && r.j.erro === 'limite_online' && r.j.msg.includes('até 10 consultas online') && !S.salas.length, 'Essencial com 10 consultas no mês: a 11ª não abre e explica como ter mais');
  r = await pedir({ acao:'paciente', id, aceito:true });
  ok(r.status === 403 && r.j.msg.includes('Avise a clínica'), 'o paciente vê um aviso simples');
  r = await pedir({ acao:'entrar', clinica:C1, id:'bbbbbbbb-0000-4000-8000-000000000003' }, 'tk-u1');
  ok(r.status !== 403, 'entrar de novo numa sala já aberta não conta no limite');
  S.plano = 'profissional';
  r = await pedir({ acao:'entrar', clinica:C1, id }, 'tk-u1');
  ok(r.status === 200 && S.linhas.find(x => x.id === id).sala_em === new Date(S.agora).toISOString(), 'no Profissional abre e conta a sala no mês');
}

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA consulta online (servidor) passou.');
process.exit(falhas ? 1 : 0);
