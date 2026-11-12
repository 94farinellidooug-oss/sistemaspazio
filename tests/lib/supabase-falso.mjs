// Servidor falso que responde como o Supabase (auth e REST), na memória, para os testes.
import { cabeNaEquipe } from '../../js/dados/equipe.js';
const resp = (status, corpo) => ({ ok:status < 300, status, text:async () => corpo === undefined ? '' : JSON.stringify(corpo) });

export function servidor({ confirmar = false, chave = 'pub' } = {}){
  const S = { usuarios:{ 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } }, tokens:{}, clinicas:[], dados:{}, interessados:[], chamadas:[], offline:false, n:0 };
  const novoToken = u => { const t = 'at' + (++S.n); S.tokens[t] = u; return { access_token:t, refresh_token:'rt-' + u.id + '-' + S.n, expires_in:3600, user:{ id:u.id, email:u.email, user_metadata:{ nome:u.nome } } }; };
  S.fetch = async (url, op) => {
    if (S.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : null, auth = (op.headers.Authorization || '').replace('Bearer ', ''), eu = S.tokens[auth];
    S.chamadas.push({ caminho:u.pathname + u.search, op });
    if (op.headers.apikey !== chave) return resp(401, { message:'Invalid API key' });
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
    if (u.pathname === '/auth/v1/logout' && u.searchParams.get('scope') === 'others') { S.saiuOutros = true; return resp(204); }
    if (u.pathname === '/auth/v1/logout') { delete S.tokens[auth]; return resp(204); }
    if (u.pathname === '/auth/v1/user') { if (!eu) return resp(401, { code:'PGRST301' }); if (op.method === 'PUT') { const x = S.usuarios[eu.email]; if (corpo.password) x.senha = corpo.password; if (corpo.data?.nome) x.nome = eu.nome = corpo.data.nome; if (corpo.email) S.emailPedido = corpo.email; } return resp(200, { id:eu.id, email:eu.email, user_metadata:{ nome:eu.nome } }); }
    if (u.pathname === '/rest/v1/interessados' && op.method === 'POST') { if (op.headers.Prefer !== 'return=minimal') return resp(401, { code:'42501', message:'new row violates row-level security' }); S.interessados.push(corpo); return resp(201); }
    // Revendedores (015_revendedores.sql). S.semRev = servidor sem o 015.
    const R = S.revenda ||= { revendedores:[], visitas:[], clinicasRev:[], comissoes:[], regras:{ pct_mensal:20, meses_mensal:3, pct_anual:50, dias_liberar:7 } };
    if (u.pathname === '/rest/v1/rpc/registrar_visita_revenda') {
      if (S.semRev) return resp(404, { code:'PGRST202', message:'Could not find the function' });
      const k = String(corpo.p_codigo || '').trim().toLowerCase(), dia = new Date().toISOString().slice(0, 10);
      if (R.revendedores.some(r => r.codigo === k && r.ativo)) { const v = R.visitas.find(x => x.codigo === k && x.dia === dia); if (v) v.visitas++; else R.visitas.push({ codigo:k, dia, visitas:1 }); }
      return resp(204);
    }
    // Função teleconsulta (consulta online): salvar e entrar com login; paciente sem login. S.teleSit muda a situação.
    if (u.pathname === '/functions/v1/teleconsulta') {
      S.teles ||= [];
      if (corpo.acao === 'paciente') {
        const t = S.teles.find(x => x.id === corpo.id);
        if (!t) return resp(404, { erro:'nao_encontrada', msg:'Consulta não encontrada. Confira o link que você recebeu.' });
        const base = { situacao:t.cancelada ? 'cancelada' : S.teleSit || 'aberta', clinica:t.clinica_nome, primeiro:t.primeiro, inicio:t.inicio };
        if (base.situacao !== 'aberta' || corpo.aceito !== true) return resp(200, base);
        t.aceite = (t.aceite || 0) + 1; return resp(200, { ...base, url:'about:blank#paciente-' + t.id });
      }
      if (!eu) return resp(401, { erro:'sem_login', msg:'Entre de novo para continuar.' });
      if (!S.clinicas.find(x => x.id === corpo.clinica)?.membros.some(m => m.user === eu.id && m.ativo !== false)) return resp(403, { erro:'sem_acesso', msg:'Sua conta não tem acesso a esta clínica.' });
      if (corpo.acao === 'salvar') {
        let t = S.teles.find(x => x.clinica_id === corpo.clinica && x.consulta_id === corpo.consulta);
        if (!t) { t = { id:`aaaaaaaa-0000-4000-8000-${String(S.teles.length + 1).padStart(12, '0')}`, clinica_id:corpo.clinica, consulta_id:corpo.consulta }; S.teles.push(t); }
        Object.assign(t, { inicio:corpo.inicio, duracao:corpo.duracao, primeiro:corpo.primeiro, clinica_nome:corpo.clinica_nome, cancelada:corpo.cancelada === true });
        return resp(200, { id:t.id });
      }
      if (corpo.acao === 'entrar') { const t = S.teles.find(x => x.id === corpo.id); if (!t) return resp(404, { erro:'nao_encontrada', msg:'Consulta online não encontrada.' }); t.entradas = (t.entradas || 0) + 1; return resp(200, { url:'about:blank#sala-' + t.id }); }
    }
    if (!eu) return resp(401, { code:'PGRST301', message:'JWT expired' });
    if (u.pathname === '/rest/v1/rpc/criar_clinica') { const id = 'c' + (++S.n); S.clinicas.push({ id, nome:corpo.p_nome, cidade:corpo.p_cidade, uf:corpo.p_uf, criado_por:eu.email, membros:[{ user:eu.id, perfil:'adm', ativo:true, email:eu.email, nome:eu.nome || '' }], assin:{ plano:corpo.p_plano || 'profissional', teste_ate:new Date(Date.now() + 7 * 864e5).toISOString(), gratis_ate:null, gratis_sempre:false, gratis_motivo:'', pago_ate:null } }); S.dados[id] = { doc:corpo.p_doc, versao:1 }; return resp(200, id); }
    const dono = () => (S.donos || []).includes(eu.id);
    if (u.pathname === '/rest/v1/assinaturas') { const c = S.clinicas.find(x => x.id === u.searchParams.get('clinica_id').replace('eq.', '')); return resp(200, c && (c.membros.some(m => m.user === eu.id) || dono()) ? [c.assin] : []); }
    if (u.pathname.startsWith('/rest/v1/rpc/') && ['painel_dono', 'dar_gratis', 'mudar_plano', 'estender_teste'].includes(u.pathname.slice(13))) {
      if (!dono()) return resp(400, { code:'P0001', message:'sem_acesso' });
      const f = u.pathname.slice(13), c = S.clinicas.find(x => x.id === corpo.p_clinica);
      if (f === 'painel_dono') return resp(200, S.clinicas.map(c => ({ id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf, criado_em:'2026-11-06T12:00:00Z', email_dono:c.criado_por || '', ...c.assin, pessoas:c.membros.length, pessoas_ativas:c.membros.length, pacientes:(S.dados[c.id]?.doc.patients || []).length, ultimo_uso:c.ultimo_uso || new Date().toISOString(), whats:c.whats || '' })));
      if (f === 'dar_gratis') Object.assign(c.assin, { gratis_sempre:!corpo.p_tirar && !corpo.p_ate, gratis_ate:corpo.p_tirar ? null : corpo.p_ate, gratis_motivo:corpo.p_tirar ? '' : corpo.p_motivo });
      if (f === 'mudar_plano') c.assin.plano = corpo.p_plano;
      if (f === 'estender_teste') c.assin.teste_ate = new Date(Math.max(Date.now(), new Date(c.assin.teste_ate).getTime()) + corpo.p_dias * 864e5).toISOString();
      return resp(204);
    }
    // Excluir clínica (009_excluir_clinica.sql): S.semExcluir = servidor sem o 009.
    if (u.pathname === '/rest/v1/rpc/excluir_clinica') {
      if (S.semExcluir) return resp(404, { code:'PGRST202', message:'Could not find the function' });
      if (!dono()) return resp(400, { code:'P0001', message:'sem_acesso' });
      const c = S.clinicas.find(x => x.id === corpo.p_clinica); if (!c) return resp(400, { code:'P0001', message:'nao_encontrada' });
      if (String(corpo.p_nome).trim().toLowerCase() !== c.nome.trim().toLowerCase()) return resp(400, { code:'P0001', message:'nome_diferente' });
      if (c.membros.some(m => m.user === eu.id)) return resp(400, { code:'P0001', message:'propria_clinica' });
      if (['ativa', 'pausada', 'pendente'].includes(c.assin?.cartao_situacao)) return resp(400, { code:'P0001', message:'cartao_ativo' });
      (S.excluidas ||= []).unshift({ id:S.excluidas.length + 1, clinica_id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf, email_dono:c.criado_por || '', plano:c.assin?.plano || '', pago_total:(S.pagamentos || []).filter(g => g.clinica_id === c.id && g.situacao === 'pago').reduce((t, g) => t + g.valor, 0), motivo:corpo.p_motivo || '', excluida_em:new Date().toISOString() });
      S.clinicas.splice(S.clinicas.indexOf(c), 1); delete S.dados[c.id]; return resp(204);
    }
    // Relacionamento do Painel do MUSUBI (010): S.semRel = servidor sem o 010.
    if (u.pathname === '/rest/v1/relacionamento_musubi') {
      if (S.semRel) return resp(404, { code:'PGRST205', message:'Could not find the table' });
      S.rel ||= {}; if (!dono()) return op.method === 'GET' ? resp(200, []) : resp(403, { code:'42501', message:'permission denied' });
      if (op.method === 'POST') { S.rel[corpo.ref] = { ...corpo }; return resp(201); }
      return resp(200, Object.values(S.rel));
    }
    // Quem vende o MUSUBI (013): todos leem, só o dono grava. S.semForn = servidor sem o 013.
    if (u.pathname === '/rest/v1/musubi_fornecedor') {
      if (S.semForn) return resp(404, { code:'PGRST205', message:'Could not find the table' });
      if (op.method === 'POST') { if (!dono()) return resp(403, { code:'42501', message:'permission denied' }); S.forn = { nome:corpo.nome, documento:corpo.documento, endereco:corpo.endereco }; return resp(201); }
      return resp(200, S.forn ? [S.forn] : []);
    }
    if (u.pathname === '/rest/v1/clinicas_excluidas') return S.semExcluir ? resp(404, { code:'PGRST205', message:'Could not find the table' }) : resp(200, dono() ? S.excluidas || [] : []);
    if (u.pathname === '/rest/v1/interessados' && op.method === 'GET') return resp(200, dono() ? S.interessados.map((x, i) => ({ id:x.id || 'i' + i, situacao:'novo', criado_em:'2026-11-06T12:00:00Z', ...x })) : []);
    if (u.pathname === '/rest/v1/interessados' && op.method === 'PATCH') { const id = u.searchParams.get('id').replace('eq.', ''); S.interessados.forEach((x, i) => { if ((x.id || 'i' + i) === id && dono()) x.situacao = corpo.situacao; }); return resp(204); }
    const eu_m = c => S.clinicas.find(x => x.id === c)?.membros.find(m => m.user === eu.id && m.ativo !== false);
    const membro = c => !!eu_m(c), adm = c => eu_m(c)?.perfil === 'adm';
    const tabRev = { '/rest/v1/revendedores':'revendedores', '/rest/v1/revenda_visitas':'visitas', '/rest/v1/revenda_clinicas':'clinicasRev', '/rest/v1/revenda_comissoes':'comissoes', '/rest/v1/revenda_regras':'regras' }[u.pathname];
    if (tabRev || u.pathname === '/rest/v1/rpc/marcar_revendedor') {
      if (S.semRev) return resp(404, { code:tabRev ? 'PGRST205' : 'PGRST202', message:'Could not find' });
      if (!tabRev) { const r = R.revendedores.find(x => x.codigo === corpo.p_codigo && x.ativo);
        if (!adm(corpo.p_clinica) || !r || R.clinicasRev.some(x => x.clinica_id === corpo.p_clinica)) return resp(200, false);
        R.clinicasRev.push({ clinica_id:corpo.p_clinica, revendedor_id:r.id, em:new Date().toISOString() }); return resp(200, true); }
      if (op.method === 'GET') return resp(200, !dono() ? [] : tabRev === 'regras' ? [R.regras] : R[tabRev]);
      if (!dono()) return resp(403, { code:'42501', message:'permission denied' });
      if (tabRev === 'regras') { Object.assign(R.regras, corpo); return resp(204); }
      if (tabRev === 'revendedores' && op.method === 'POST') { if (R.revendedores.some(x => x.codigo === corpo.codigo)) return resp(409, { code:'23505', message:'duplicate key' });
        R.revendedores.push({ id:'rv' + (++S.n), ativo:true, criado_em:new Date().toISOString(), whats:'', pix:'', obs:'', ...corpo }); return resp(201); }
      const x = R[tabRev].find(y => y.id === (u.searchParams.get('id') || '').replace('eq.', '')); if (x) Object.assign(x, corpo); return resp(204);
    }
    // Equipe (004_equipe.sql)
    S.convites ||= [];
    if (u.pathname === '/rest/v1/membros' && u.searchParams.get('clinica_id')) { const c = S.clinicas.find(x => x.id === u.searchParams.get('clinica_id').replace('eq.', ''));
      return resp(200, c && membro(c.id) ? c.membros.map(m => ({ user_id:m.user, nome:m.nome || '', email:m.email || '', perfil:m.perfil, ativo:m.ativo !== false, criado_em:'2026-11-06T12:00:00Z' })) : []); }
    if (u.pathname === '/rest/v1/membros') return resp(200, S.clinicas.filter(c => membro(c.id)).map(c => ({ perfil:eu_m(c.id).perfil, nome:'', clinicas:{ id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf, permissoes:c.permissoes || {} } })));
    if (u.pathname === '/rest/v1/convites') { if (S.semEquipe) return resp(404, { code:'PGRST205', message:'Could not find the table' }); const c = u.searchParams.get('clinica_id').replace('eq.', ''); return resp(200, adm(c) ? S.convites.filter(x => x.clinica_id === c && !x.aceito) : []); }
    if (u.pathname === '/rest/v1/rpc/registrar_acesso') { (S.acessos ||= []).push({ user:eu.id, evento:corpo.p_evento }); return resp(200, true); }
    if (u.pathname === '/rest/v1/rpc/aceitar_convites') { if (S.semEquipe) return resp(404, { code:'PGRST202', message:'Could not find the function' }); let n = 0;
      S.convites.filter(x => !x.aceito && x.email === eu.email.toLowerCase()).forEach(x => { const c = S.clinicas.find(k => k.id === x.clinica_id), m = c.membros.find(k => k.user === eu.id);
        if (m) Object.assign(m, { perfil:x.perfil, ativo:true }); else c.membros.push({ user:eu.id, perfil:x.perfil, ativo:true, email:eu.email, nome:eu.nome || x.nome }); x.aceito = true; n++; });
      return resp(200, n); }
    if (u.pathname === '/rest/v1/rpc/convidar') { const c = S.clinicas.find(x => x.id === corpo.p_clinica), e = corpo.p_email.trim().toLowerCase();
      if (!adm(corpo.p_clinica)) return resp(400, { code:'P0001', message:'sem_acesso' });
      if (c.membros.some(m => m.email === e && m.ativo !== false)) return resp(400, { code:'P0001', message:'ja_na_equipe' });
      if (S.convites.some(x => x.clinica_id === c.id && x.email === e && !x.aceito)) return resp(400, { code:'P0001', message:'ja_convidado' });
      if (!cabeNaEquipe(c.assin.plano, c.membros.map(m => ({ ...m, ativo:m.ativo !== false })), S.convites.filter(x => x.clinica_id === c.id && !x.aceito), corpo.p_perfil)) return resp(400, { code:'P0001', message:'limite_pacote' });
      const id = 'cv' + (++S.n); S.convites.push({ id, clinica_id:c.id, nome:corpo.p_nome, email:e, perfil:corpo.p_perfil, criado_em:'2026-11-06T12:00:00Z' }); return resp(200, id); }
    if (u.pathname === '/rest/v1/rpc/cancelar_convite') { const x = S.convites.find(k => k.id === corpo.p_id); if (!x || !adm(x.clinica_id)) return resp(400, { code:'P0001', message:'sem_acesso' }); S.convites = S.convites.filter(k => k !== x); return resp(204); }
    if (u.pathname === '/rest/v1/rpc/mudar_membro') { const c = S.clinicas.find(x => x.id === corpo.p_clinica), m = c?.membros.find(k => k.user === corpo.p_user);
      if (!adm(corpo.p_clinica)) return resp(400, { code:'P0001', message:'sem_acesso' }); if (corpo.p_user === eu.id) return resp(400, { code:'P0001', message:'nao_a_si_mesmo' });
      const grupo = p => p === 'rec' ? 'rec' : 'prof';
      if (corpo.p_ativo && (m.ativo === false || grupo(m.perfil) !== grupo(corpo.p_perfil)) && !cabeNaEquipe(c.assin.plano, c.membros.filter(k => k !== m).map(k => ({ ...k, ativo:k.ativo !== false })), S.convites.filter(x => x.clinica_id === c.id && !x.aceito), corpo.p_perfil)) return resp(400, { code:'P0001', message:'limite_pacote' });
      Object.assign(m, { perfil:corpo.p_perfil, ativo:corpo.p_ativo }); return resp(204); }
    if (u.pathname === '/rest/v1/dados') { const c = u.searchParams.get('clinica_id').replace('eq.', ''); return resp(200, membro(c) ? [S.dados[c]] : []); }
    if (u.pathname === '/rest/v1/rpc/salvar_dados') {
      if (!membro(corpo.p_clinica)) return resp(400, { code:'P0001', message:'sem_acesso' });
      // Histórico (006_historico.sql): S.semHistorico = true imita o servidor que ainda não rodou o 006.
      if ('p_eventos' in corpo && S.semHistorico) return resp(404, { code:'PGRST202', message:'Could not find the function public.salvar_dados(p_clinica, p_doc, p_eventos, p_versao)' });
      const d = S.dados[corpo.p_clinica]; if (d.versao !== corpo.p_versao) return resp(200, -1);
      d.doc = corpo.p_doc; d.versao++;
      const m = eu_m(corpo.p_clinica);
      (corpo.p_eventos || []).forEach(e => (S.historico ||= []).unshift({ id:++S.n, clinica_id:corpo.p_clinica, em:new Date(Date.now() + S.n).toISOString(), pessoa:m?.nome || '', email:m?.email || eu.email, tipo:e.tipo, acao:e.acao, alvo:e.alvo || '', paciente_id:e.paciente_id || '', titulo:e.titulo || '', campos:e.campos || [] }));
      return resp(200, d.versao);
    }
    if (u.pathname === '/rest/v1/clinicas' && op.method === 'PATCH') { const c = S.clinicas.find(x => x.id === u.searchParams.get('id').replace('eq.', '')); if (!c?.membros.some(m => m.user === eu.id && m.perfil === 'adm')) return resp(200); Object.assign(c, corpo); return resp(204); }
    // Função cobranca (pagamento pela InfinitePay): S.cobranca = true liga; sem ela, responde como o servidor sem a InfiniteTag.
    if (u.pathname === '/functions/v1/cobranca') {
      S.pagamentos ||= [];
      if (corpo.acao === 'criar') {
        if (!S.cobranca) return resp(503, { erro:'sem_cobranca', msg:'O pagamento online ainda não está ligado.' });
        if (!S.clinicas.find(x => x.id === corpo.clinica)?.membros.some(m => m.user === eu.id && m.perfil === 'adm')) return resp(403, { erro:'sem_acesso', msg:'Só o administrador da clínica faz o pagamento.' });
        if (corpo.teste && !dono()) return resp(403, { erro:'sem_acesso', msg:'Só o dono do MUSUBI faz o pagamento de teste.' });
        if (!corpo.teste && corpo.aceite !== '2026-11-11') return resp(400, { erro:'aceite', msg:'Para pagar, leia e aceite o Contrato de assinatura.' });
        if (corpo.periodo === 'anual12') return resp(400, { erro:'periodo', msg:'O anual com pagamento mensal é feito pela assinatura no cartão.' });
        (S.aceites ||= []).push({ ...corpo, meio:'infinitepay' });
        const n = ++S.n, periodo = corpo.teste ? 'mensal' : corpo.periodo, valor = corpo.teste ? 100 : { essencial:7900, profissional:14900, clinica:29900 }[corpo.plano] * (periodo === 'anual' ? 10 : 1);
        S.pagamentos.unshift({ id:'g' + n, clinica_id:corpo.clinica, plano:corpo.plano, periodo, valor, order_nsu:'MSB' + n, situacao:'aberto', forma:'', recibo:'', criado_em:new Date().toISOString(), pago_em:null });
        return resp(200, { url:'https://checkout.infinitepay.io/teste/' + n, order_nsu:'MSB' + n, valor });
      }
      if (corpo.acao === 'link') {   // Cobrar por link: qualquer pessoa ativa da clínica, na InfiniteTag da clínica
        if (S.semLink) return resp(400, { erro:'acao', msg:'Pedido inválido.' });
        if (!S.clinicas.find(x => x.id === corpo.clinica)?.membros.some(m => m.user === eu.id && m.ativo !== false)) return resp(403, { erro:'sem_acesso', msg:'Você não faz parte desta clínica.' });
        if (!/^[a-z0-9][a-z0-9_.-]{1,39}$/.test(corpo.tag || '')) return resp(400, { erro:'tag', msg:'Confira a InfiniteTag da clínica.' });
        (S.links ||= []).push(corpo); return resp(200, { url:`https://checkout.infinitepay.io/${corpo.tag}/l${S.links.length}`, valor:corpo.valor });
      }
      // Assinatura no cartão (Mercado Pago): S.mp = { estado:{situacao,...}, assinados:[] } liga; sem ela, responde como a função antiga.
      if (corpo.acao === 'encerrar_cartao') {
        if (!S.mp) return resp(400, { erro:'acao', msg:'Pedido inválido.' });
        if (!dono()) return resp(403, { erro:'sem_acesso', msg:'Só o dono do MUSUBI encerra a assinatura de outra clínica.' });
        const c = S.clinicas.find(x => x.id === corpo.clinica); if (c?.assin) c.assin.cartao_situacao = 'cancelada'; (S.encerrados ||= []).push(corpo.clinica); return resp(200, { encerrado:true });
      }
      if (['assinar', 'cartao', 'cancelar_cartao'].includes(corpo.acao)) {
        if (!S.mp) return resp(400, { erro:'acao', msg:'Pedido inválido.' });
        const m = S.clinicas.find(x => x.id === corpo.clinica)?.membros.find(x => x.user === eu.id); if (!m) return resp(403, { erro:'sem_acesso', msg:'Você não faz parte desta clínica.' });
        if (corpo.acao !== 'cartao' && m.perfil !== 'adm') return resp(403, { erro:'sem_acesso', msg:'Só o administrador da clínica faz a assinatura.' });
        if (corpo.acao === 'assinar' && corpo.aceite !== '2026-11-11') return resp(400, { erro:'aceite', msg:'Para assinar, leia e aceite o Contrato de assinatura.' });
        // S.mp.multa = { multa, meses, compromisso }: anual com pagamento mensal antes dos 12 meses pede confirmação.
        if (corpo.acao === 'cancelar_cartao' && S.mp.multa && corpo.confirmarMulta !== true) return resp(200, { ...(S.mp.estado || {}), confirmar:true, ...S.mp.multa });
        if (corpo.acao === 'assinar') { (S.mp.assinados ||= []).push(corpo); S.mp.estado = { situacao:'pendente', plano:corpo.plano, periodo:corpo.periodo, valor:14900, email:corpo.email, proxima:null }; return resp(200, { url:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre' + S.mp.assinados.length }); }
        if (corpo.acao === 'cancelar_cartao') S.mp.estado = { ...(S.mp.estado || {}), situacao:'cancelada', proxima:null, multa:S.mp.multa?.multa || 0 };
        return resp(200, { situacao:'', ...(S.mp.estado || {}), novos:0 });
      }
      if (corpo.acao === 'conferir') {
        const g = S.pagamentos.find(x => x.order_nsu === corpo.order_nsu); if (!g || corpo.transaction_nsu === 'falhou') return resp(200, { pago:false });
        if (g.situacao !== 'pago') { const c = S.clinicas.find(x => x.id === g.clinica_id); Object.assign(g, { situacao:'pago', forma:'pix', pago_em:new Date().toISOString(), recibo:corpo.receipt_url || '' });
          c.assin.plano = g.plano; c.assin.pago_ate = new Date(Math.max(Date.now(), new Date(c.assin.pago_ate || 0).getTime()) + (g.periodo === 'anual' ? 365 : 30) * 864e5).toISOString(); }
        return resp(200, { pago:true });
      }
      return resp(400, { erro:'acao', msg:'Pedido inválido.' });
    }
    // Função nfse (nota fiscal): S.nfse = { cert, notas, modo:'ok'|'recusa'|'cair', pedidos }. Sem S.nfse, responde como sem a função (404).
    if (u.pathname === '/functions/v1/nfse') {
      const N = S.nfse; if (!N) return resp(404, { code:'NOT_FOUND', message:'Requested function was not found' });
      const m = eu_m(corpo.clinica); if (!m) return resp(403, { erro:'sem_acesso', msg:'Você não faz parte desta clínica.' });
      (N.pedidos ||= []).push(corpo); N.notas ||= [];
      if (corpo.acao === 'situacao') return resp(200, { certificado:N.cert || null, uso:{ plano:'profissional', limite:100, usadas:N.notas.filter(x => x.ambiente === 'producao').length } });
      if (corpo.acao === 'certificado') { if (m.perfil !== 'adm') return resp(403, { erro:'sem_acesso', msg:'Só o administrador da clínica envia o certificado.' });
        if (corpo.senha !== 'certo') return resp(400, { erro:'senha', msg:'A senha do certificado não confere.' });
        N.cert = { titular:'SPAZIO STABILITA LTDA', documento:'11222333000181', validade:new Date(Date.now() + 300 * 864e5).toISOString(), enviadoEm:new Date().toISOString() }; return resp(200, { certificado:N.cert }); }
      if (corpo.acao === 'tirar_certificado') { N.cert = null; return resp(200, { certificado:null }); }
      if (corpo.acao === 'emitir') {
        if (!N.cert) return resp(400, { erro:'sem_certificado', msg:'Envie o certificado digital A1 da clínica em Configurações > Nota fiscal.' });
        const id = 'n' + (++S.n), ndps = N.notas.length + 1;
        if (N.modo === 'recusa') { N.notas.push({ id, situacao:'rejeitada' }); return resp(422, { erro:'rejeitada', msg:'A Receita recusou: E0312 Código de tributação nacional não administrado pelo município', id, situacao:'rejeitada' }); }
        const numero = String(N.notas.filter(x => x.situacao === 'emitida').length + 1), chave = '43051082211222333000181' + numero.padStart(13, '0') + '26110000000010';
        const nota = { id, situacao:N.modo === 'cair' ? 'enviando' : 'emitida', numero, chave, ndps, serie:'1', ambiente:corpo.ambiente, emitidaEm:new Date().toISOString(), consulta:'https://www.nfse.gov.br/consultapublica?tpc=1&chave=' + chave };
        N.notas.push(nota);
        if (N.modo === 'cair') return resp(504, { erro:'sem_resposta', msg:'A Receita não respondeu. Em instantes, toque em "Conferir" para saber se a nota saiu.', id, situacao:'enviando' });
        return resp(200, nota);
      }
      if (corpo.acao === 'conferir_codigo') return resp(200, { ambiente:corpo.ambiente, municipio:corpo.municipio, convenio:{ ativo:true, mensagem:'' }, achados:N.complemento ? [{ complemento:N.complemento, codigo:corpo.codigo.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') + '.' + N.complemento, aliquota:2, incidencia:'SIM' }] : [], mensagem:'' });
      if (corpo.acao === 'cancelar') { const n = N.notas.find(x => x.id === corpo.id);
        if (m.perfil !== 'adm') return resp(403, { erro:'sem_acesso', msg:'Só o administrador da clínica cancela notas.' });
        if (!n || n.situacao !== 'emitida') return resp(400, { erro:'situacao', msg:'Só dá para cancelar uma nota já emitida.' });
        if (String(corpo.descricao || '').length < 15) return resp(400, { erro:'dados', msg:'Explique o motivo do cancelamento com 15 a 255 letras.' });
        if (N.modo === 'prazo') return resp(422, { erro:'recusado', msg:'A Receita não cancelou: E0840 Prazo para cancelamento excedido. Se o prazo para cancelar já passou, o pedido precisa ser analisado pela prefeitura: faça pelo Emissor Nacional (nfse.gov.br).' });
        Object.assign(n, { situacao:'cancelada', cancelamento:{ motivo:corpo.motivo, descricao:corpo.descricao } }); return resp(200, { id:n.id, situacao:'cancelada', canceladaEm:new Date().toISOString(), numero:n.numero }); }
      if (corpo.acao === 'conferir') { const n = N.notas.find(x => x.id === corpo.id); if (!n) return resp(404, { erro:'nao_achei', msg:'Nota não encontrada.' }); n.situacao = 'emitida'; return resp(200, n); }
      return resp(400, { erro:'acao', msg:'Pedido inválido.' });
    }
    if (u.pathname === '/rest/v1/historico') {
      if (S.semHistorico) return resp(404, { code:'42P01', message:'relation "public.historico" does not exist' });
      const q = k => (u.searchParams.get(k) || '').replace(/^(eq|lt)\./, ''), c = q('clinica_id'), m = eu_m(c);
      if (!m || m.perfil !== 'adm') return resp(200, []);
      return resp(200, (S.historico || []).filter(h => h.clinica_id === c && (!q('paciente_id') || h.paciente_id === q('paciente_id')) && (!q('em') || h.em < q('em'))).slice(0, Number(u.searchParams.get('limit')) || 100));
    }
    if (u.pathname === '/rest/v1/pagamentos') { const c = (u.searchParams.get('clinica_id') || '').replace('eq.', ''); return resp(200, (S.pagamentos || []).filter(g => (dono() && !c) || (g.clinica_id === c && (membro(c) || dono())))); }
    if (u.pathname === '/rest/v1/donos') return resp(200, (S.donos || []).includes(eu.id) ? [{ user_id:eu.id }] : []);
    return resp(404, { message:'não encontrado' });
  };
  return S;
}

