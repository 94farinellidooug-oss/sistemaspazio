// @ts-nocheck
// MUSUBI · função "teleconsulta" do Supabase (Edge Function): consulta online por vídeo (Daily), pedido do Maicon em 12/11/2026.
// Como publicar: no Supabase, Edge Functions > Deploy a new function > Via Editor, nome "teleconsulta", cole este
// arquivo inteiro e clique em Deploy. Depois, em Details, desligue "Enforce JWT verification" (o paciente entra sem
// login; a função confere o login sozinha onde precisa). Segredo (Edge Functions > Secrets): DAILY_CHAVE = API key do
// Daily (dashboard.daily.co > Developers). Tabela: supabase/015_teleconsulta.sql.
//
// Pedidos (POST, JSON):
//   { acao:'salvar', clinica, consulta, inicio, duracao, primeiro, clinica_nome, cancelada }  alguém da equipe: cria ou
//     atualiza a consulta online de um horário da agenda e devolve { id } (o código que vai no link do paciente)
//   { acao:'entrar', clinica, id }  alguém da equipe: abre a sala (cria na primeira vez) e devolve { url } como dono da sala
//   { acao:'paciente', id, aceito }  o paciente, sem login: sem aceito devolve a situação (cedo, aberta, encerrada,
//     cancelada) para mostrar o termo; com aceito:true registra o aceite (hora, IP, navegador) e devolve { url }
// Cada pacote tem um limite de consultas online por mês (LIMITE_ONLINE); entrar de novo na mesma sala não conta.
// A sala só abre de 30 minutos antes até 1 hora depois do fim do horário (o profissional pode entrar 1 hora antes).
// A chamada não é gravada. Escrito em JavaScript simples (sem tipos) para rodar igual no Supabase e nos testes (node).

const DAILY = 'https://api.daily.co/v1';
// Consultas online por mês em cada pacote (decisão do Maicon em 12/11/2026). Conta cada sala aberta no mês
// (a primeira entrada de cada horário). js/dados/planos.js tem a mesma tabela para mostrar no sistema e no site.
export const LIMITE_ONLINE = { essencial:10, profissional:40, clinica:100 };
// Início do mês no horário de Brasília (UTC-3), em ISO.
export const inicioDoMes = ms => { const d = new Date(ms - 3 * 36e5); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 3)).toISOString(); };
const MIN = 6e4;
export const JANELA = { paciente:30 * MIN, profissional:60 * MIN, depois:60 * MIN };
const ID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers:{ ...CORS, 'Content-Type':'application/json' } });
const erro = (status, codigo, msg) => resp(status, { erro:codigo, msg });
const texto = (v, n) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);

// Situação da sala para o paciente num instante: cedo, aberta, encerrada ou cancelada.
export function situacaoSala(t, agora, antes = JANELA.paciente){
  if (t.cancelada) return 'cancelada';
  if (agora < new Date(t.inicio).getTime() - antes) return 'cedo';
  if (agora > new Date(t.fim).getTime() + JANELA.depois) return 'encerrada';
  return 'aberta';
}

export function criarTeleconsulta({ env, f = (...a) => fetch(...a), agora = () => Date.now(), sorteio = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16) }){
  const SB = env('SUPABASE_URL'), SR = env('SUPABASE_SERVICE_ROLE_KEY'), CH = env('DAILY_CHAVE') || '';
  const banco = async (caminho, { metodo = 'GET', corpo, cab = {} } = {}) => {
    const r = await f(`${SB}/rest/v1/${caminho}`, { method:metodo, headers:{ apikey:SR, Authorization:`Bearer ${SR}`, 'Content-Type':'application/json', ...cab }, body:corpo === undefined ? undefined : JSON.stringify(corpo) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new Error(`banco ${r.status}: ${t.slice(0, 200)}`);
    return j;
  };
  const daily = async (caminho, corpo) => {
    const r = await f(`${DAILY}${caminho}`, { method:'POST', headers:{ Authorization:`Bearer ${CH}`, 'Content-Type':'application/json' }, body:JSON.stringify(corpo) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(`daily ${r.status}`), { daily:j });
    return j;
  };
  const usuario = async req => {
    const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk || tk === SR) return null;
    const r = await f(`${SB}/auth/v1/user`, { headers:{ apikey:SR, Authorization:`Bearer ${tk}` } });
    if (!r.ok) return null;
    const u = await r.json(); return u?.id ? u : null;
  };
  const membro = async (clinica, u) => ((await banco(`membros?select=perfil,nome&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [])[0] || null;
  const consultaPorId = async id => ((await banco(`teleconsultas?select=*&id=eq.${id}`)) || [])[0] || null;
  const segundos = ms => Math.floor(ms / 1000);
  // A sala do Daily é privada (só entra com o passe que a função dá) e fecha sozinha 2 horas depois do fim.
  const uso = async clinica => {
    const A = (await banco(`assinaturas?select=plano&clinica_id=eq.${clinica}`)) || [];
    const plano = LIMITE_ONLINE[A[0]?.plano] ? A[0].plano : 'profissional';
    const L = (await banco(`teleconsultas?select=id&clinica_id=eq.${clinica}&sala_em=gte.${encodeURIComponent(inicioDoMes(agora()))}`)) || [];
    return { plano, limite:LIMITE_ONLINE[plano], usadas:L.length };
  };
  const garantirSala = async t => {
    if (t.sala && t.sala_url) return t;
    const U = await uso(t.clinica_id);
    if (U.usadas >= U.limite) throw Object.assign(new Error('limite'), { limite:U });
    const s = await daily('/rooms', { name:`musubi-${sorteio()}`, privacy:'private', properties:{ exp:segundos(new Date(t.fim).getTime() + 2 * 60 * MIN), eject_at_room_exp:true, enable_prejoin_ui:true, enable_chat:true, lang:'user' } });
    await banco(`teleconsultas?id=eq.${t.id}`, { metodo:'PATCH', corpo:{ sala:s.name, sala_url:s.url, sala_em:new Date(agora()).toISOString() }, cab:{ Prefer:'return=minimal' } });
    return { ...t, sala:s.name, sala_url:s.url };
  };
  const passe = async (t, dono, nome) => (await daily('/meeting-tokens', { properties:{ room_name:t.sala, is_owner:dono, user_name:nome || (dono ? 'Profissional' : 'Paciente'), exp:segundos(new Date(t.fim).getTime() + 2 * 60 * MIN) } })).token;
  const entrada = (t, tk) => `${t.sala_url}?t=${encodeURIComponent(tk)}`;

  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
    if (req.method !== 'POST') return erro(405, 'metodo', 'Use POST.');
    let corpo = {}; try { corpo = await req.json(); } catch (e) { return erro(400, 'corpo', 'Pedido inválido.'); }
    try {
      if (corpo.acao === 'paciente') {
        if (!ID_OK.test(String(corpo.id || ''))) return erro(404, 'nao_encontrada', 'Consulta não encontrada. Confira o link que você recebeu.');
        const t = await consultaPorId(corpo.id);
        if (!t) return erro(404, 'nao_encontrada', 'Consulta não encontrada. Confira o link que você recebeu.');
        const situacao = situacaoSala(t, agora()), base = { situacao, clinica:t.clinica_nome, primeiro:t.primeiro, inicio:t.inicio, fim:t.fim };
        if (situacao !== 'aberta' || corpo.aceito !== true) return resp(200, base);
        if (!CH) return erro(503, 'sem_video', 'A consulta online ainda não está ligada. Avise a clínica.');
        const ip = String(req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim().slice(0, 64), agente = String(req.headers.get('user-agent') || '').slice(0, 300);
        await banco(`teleconsultas?id=eq.${t.id}`, { metodo:'PATCH', corpo:{ aceite_em:new Date(agora()).toISOString(), aceite_ip:ip, aceite_agente:agente }, cab:{ Prefer:'return=minimal' } });
        const s = await garantirSala(t);
        return resp(200, { ...base, url:entrada(s, await passe(s, false, t.primeiro)) });
      }
      const u = await usuario(req);
      if (!u) return erro(401, 'sem_login', 'Entre de novo para continuar.');
      const clinica = String(corpo.clinica || '');
      if (!ID_OK.test(clinica)) return erro(400, 'dados', 'Clínica inválida.');
      const m = await membro(clinica, u);
      if (!m) return erro(403, 'sem_acesso', 'Sua conta não tem acesso a esta clínica.');
      if (corpo.acao === 'salvar') {
        const consulta = texto(corpo.consulta, 80), ini = new Date(corpo.inicio), dur = Number(corpo.duracao);
        if (!consulta || isNaN(ini.getTime()) || !(dur >= 10 && dur <= 480)) return erro(400, 'dados', 'Confira o dia, o horário e o serviço.');
        const linha = { clinica_id:clinica, consulta_id:consulta, inicio:ini.toISOString(), fim:new Date(ini.getTime() + dur * MIN).toISOString(),
          primeiro:texto(corpo.primeiro, 40), clinica_nome:texto(corpo.clinica_nome, 120), cancelada:corpo.cancelada === true };
        const R = await banco('teleconsultas?on_conflict=clinica_id,consulta_id', { metodo:'POST', corpo:{ ...linha, criado_por:u.id }, cab:{ Prefer:'resolution=merge-duplicates,return=representation' } });
        const t = (R || [])[0];
        // Remarcou: a sala já criada passa a fechar no novo horário.
        if (t?.sala && CH) await daily(`/rooms/${encodeURIComponent(t.sala)}`, { properties:{ exp:segundos(new Date(t.fim).getTime() + 2 * 60 * MIN) } }).catch(e => console.error(e));
        return resp(200, { id:t?.id });
      }
      if (corpo.acao === 'entrar') {
        if (!ID_OK.test(String(corpo.id || ''))) return erro(400, 'dados', 'Consulta inválida.');
        const t = await consultaPorId(corpo.id);
        if (!t || t.clinica_id !== clinica) return erro(404, 'nao_encontrada', 'Consulta online não encontrada.');
        const sit = situacaoSala(t, agora(), JANELA.profissional);
        if (sit === 'cancelada') return erro(410, 'cancelada', 'Este horário foi desmarcado.');
        if (sit === 'cedo') return erro(409, 'cedo', 'A sala abre 1 hora antes do horário.');
        if (sit === 'encerrada') return erro(410, 'encerrada', 'O horário desta consulta já passou. Para atender de novo, remarque o horário.');
        if (!CH) return erro(503, 'sem_video', 'A consulta online ainda não está ligada: falta a chave do Daily (DAILY_CHAVE) no Supabase.');
        const s = await garantirSala(t);
        return resp(200, { url:entrada(s, await passe(s, true, m.nome || u.email)), sala:s.sala });
      }
      return erro(400, 'acao', 'Pedido inválido.');
    } catch (e) {
      if (e.limite) return erro(403, 'limite_online', corpo.acao === 'paciente' ? 'A clínica atingiu o limite de consultas online deste mês. Avise a clínica.'
        : `O pacote da clínica inclui até ${e.limite.limite} consultas online por mês, e esse limite já foi usado neste mês. Para fazer mais, troque de pacote em Configurações > Sua conta.`);
      console.error(e, e.daily || '');
      return erro(e.daily ? 502 : 500, e.daily ? 'daily' : 'erro', e.daily ? `O serviço de vídeo não respondeu.${e.daily?.info ? ` (Motivo: ${String(e.daily.info).slice(0, 160)})` : ''}` : 'Não deu certo agora. Tente de novo em instantes.');
    }
  };
}

// No Supabase (Deno): atende os pedidos. Nos testes (node) só as funções acima são usadas.
const D = globalThis.Deno;
if (D?.serve) D.serve(criarTeleconsulta({ env:k => D.env.get(k) }));
