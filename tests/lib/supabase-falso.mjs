// Servidor falso que responde como o Supabase (auth e REST), na memória, para os testes.
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
    if (!eu) return resp(401, { code:'PGRST301', message:'JWT expired' });
    if (u.pathname === '/rest/v1/rpc/criar_clinica') { const id = 'c' + (++S.n); S.clinicas.push({ id, nome:corpo.p_nome, cidade:corpo.p_cidade, uf:corpo.p_uf, criado_por:eu.email, membros:[{ user:eu.id, perfil:'adm' }], assin:{ plano:corpo.p_plano || 'profissional', teste_ate:new Date(Date.now() + 7 * 864e5).toISOString(), gratis_ate:null, gratis_sempre:false, gratis_motivo:'', pago_ate:null } }); S.dados[id] = { doc:corpo.p_doc, versao:1 }; return resp(200, id); }
    const dono = () => (S.donos || []).includes(eu.id);
    if (u.pathname === '/rest/v1/assinaturas') { const c = S.clinicas.find(x => x.id === u.searchParams.get('clinica_id').replace('eq.', '')); return resp(200, c && (c.membros.some(m => m.user === eu.id) || dono()) ? [c.assin] : []); }
    if (u.pathname.startsWith('/rest/v1/rpc/') && ['painel_dono', 'dar_gratis', 'mudar_plano', 'estender_teste'].includes(u.pathname.slice(13))) {
      if (!dono()) return resp(400, { code:'P0001', message:'sem_acesso' });
      const f = u.pathname.slice(13), c = S.clinicas.find(x => x.id === corpo.p_clinica);
      if (f === 'painel_dono') return resp(200, S.clinicas.map(c => ({ id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf, criado_em:'2026-11-06T12:00:00Z', email_dono:c.criado_por || '', ...c.assin, pessoas:c.membros.length, pessoas_ativas:c.membros.length, pacientes:(S.dados[c.id]?.doc.patients || []).length, ultimo_uso:'2026-11-06T12:00:00Z' })));
      if (f === 'dar_gratis') Object.assign(c.assin, { gratis_sempre:!corpo.p_tirar && !corpo.p_ate, gratis_ate:corpo.p_tirar ? null : corpo.p_ate, gratis_motivo:corpo.p_tirar ? '' : corpo.p_motivo });
      if (f === 'mudar_plano') c.assin.plano = corpo.p_plano;
      if (f === 'estender_teste') c.assin.teste_ate = new Date(Math.max(Date.now(), new Date(c.assin.teste_ate).getTime()) + corpo.p_dias * 864e5).toISOString();
      return resp(204);
    }
    if (u.pathname === '/rest/v1/interessados' && op.method === 'GET') return resp(200, dono() ? S.interessados.map((x, i) => ({ id:x.id || 'i' + i, situacao:'novo', criado_em:'2026-11-06T12:00:00Z', ...x })) : []);
    if (u.pathname === '/rest/v1/interessados' && op.method === 'PATCH') { const id = u.searchParams.get('id').replace('eq.', ''); S.interessados.forEach((x, i) => { if ((x.id || 'i' + i) === id && dono()) x.situacao = corpo.situacao; }); return resp(204); }
    const membro = c => S.clinicas.find(x => x.id === c)?.membros.some(m => m.user === eu.id);
    if (u.pathname === '/rest/v1/membros') return resp(200, S.clinicas.filter(c => c.membros.some(m => m.user === eu.id)).map(c => ({ perfil:'adm', nome:'', clinicas:{ id:c.id, nome:c.nome, cidade:c.cidade, uf:c.uf } })));
    if (u.pathname === '/rest/v1/dados') { const c = u.searchParams.get('clinica_id').replace('eq.', ''); return resp(200, membro(c) ? [S.dados[c]] : []); }
    if (u.pathname === '/rest/v1/rpc/salvar_dados') {
      if (!membro(corpo.p_clinica)) return resp(400, { code:'P0001', message:'sem_acesso' });
      const d = S.dados[corpo.p_clinica]; if (d.versao !== corpo.p_versao) return resp(200, -1);
      d.doc = corpo.p_doc; d.versao++; return resp(200, d.versao);
    }
    if (u.pathname === '/rest/v1/clinicas' && op.method === 'PATCH') { const c = S.clinicas.find(x => x.id === u.searchParams.get('id').replace('eq.', '')); if (!c?.membros.some(m => m.user === eu.id && m.perfil === 'adm')) return resp(200); Object.assign(c, corpo); return resp(204); }
    // Função cobranca (pagamento pela InfinitePay): S.cobranca = true liga; sem ela, responde como o servidor sem a InfiniteTag.
    if (u.pathname === '/functions/v1/cobranca') {
      S.pagamentos ||= [];
      if (corpo.acao === 'criar') {
        if (!S.cobranca) return resp(503, { erro:'sem_cobranca', msg:'O pagamento online ainda não está ligado.' });
        if (!S.clinicas.find(x => x.id === corpo.clinica)?.membros.some(m => m.user === eu.id && m.perfil === 'adm')) return resp(403, { erro:'sem_acesso', msg:'Só o administrador da clínica faz o pagamento.' });
        if (corpo.teste && !dono()) return resp(403, { erro:'sem_acesso', msg:'Só o dono do MUSUBI faz o pagamento de teste.' });
        const n = ++S.n, periodo = corpo.teste ? 'mensal' : corpo.periodo, valor = corpo.teste ? 100 : { essencial:7900, profissional:14900, clinica:29900 }[corpo.plano] * (periodo === 'anual' ? 10 : 1);
        S.pagamentos.unshift({ id:'g' + n, clinica_id:corpo.clinica, plano:corpo.plano, periodo, valor, order_nsu:'MSB' + n, situacao:'aberto', forma:'', recibo:'', criado_em:new Date().toISOString(), pago_em:null });
        return resp(200, { url:'https://checkout.infinitepay.io/teste/' + n, order_nsu:'MSB' + n, valor });
      }
      if (corpo.acao === 'conferir') {
        const g = S.pagamentos.find(x => x.order_nsu === corpo.order_nsu); if (!g || corpo.transaction_nsu === 'falhou') return resp(200, { pago:false });
        if (g.situacao !== 'pago') { const c = S.clinicas.find(x => x.id === g.clinica_id); Object.assign(g, { situacao:'pago', forma:'pix', pago_em:new Date().toISOString(), recibo:corpo.receipt_url || '' });
          c.assin.plano = g.plano; c.assin.pago_ate = new Date(Math.max(Date.now(), new Date(c.assin.pago_ate || 0).getTime()) + (g.periodo === 'anual' ? 365 : 30) * 864e5).toISOString(); }
        return resp(200, { pago:true });
      }
      return resp(400, { erro:'acao', msg:'Pedido inválido.' });
    }
    if (u.pathname === '/rest/v1/pagamentos') { const c = (u.searchParams.get('clinica_id') || '').replace('eq.', ''); return resp(200, (S.pagamentos || []).filter(g => (dono() && !c) || (g.clinica_id === c && (membro(c) || dono())))); }
    if (u.pathname === '/rest/v1/donos') return resp(200, (S.donos || []).includes(eu.id) ? [{ user_id:eu.id }] : []);
    return resp(404, { message:'não encontrado' });
  };
  return S;
}

