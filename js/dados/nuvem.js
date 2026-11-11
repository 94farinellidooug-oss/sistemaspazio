// Etapa 10: ligação com o servidor (Supabase), sem biblioteca externa: login pela API de autenticação e
// dados pela API REST, com as regras de acesso do banco (supabase/001_inicio.sql) decidindo o que cada
// conta enxerga. A chave abaixo é a pública (publishable): pode ficar no código do site.
// Nesta primeira parte cada clínica guarda o documento inteiro do sistema, com versão (salvar_dados).

import { eventosEntre } from './historico.js';

export const NUVEM = { url:'https://lmucimqjrzjewfyhcfoh.supabase.co', chave:'sb_publishable_kRmZNwp0_Xq4jPPMgTzKKA_SyLsreZS' };
export const KEY_SESSAO = 'musubi-sessao';

// Mensagens do servidor em português, para mostrar direto na tela.
const MSG_NUVEM = {
  invalid_credentials:'E-mail ou senha incorretos.',
  email_not_confirmed:'Falta confirmar o e-mail. Abra o link que mandamos para a sua caixa de entrada.',
  user_already_exists:'Já existe uma conta com esse e-mail. Use "Entrar".',
  email_exists:'Já existe uma conta com esse e-mail. Use "Entrar".',
  weak_password:'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  over_email_send_rate_limit:'Muitos e-mails em pouco tempo. Espere alguns minutos e tente de novo.',
  over_request_rate_limit:'Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.',
  validation_failed:'Confira o e-mail e a senha.',
  sem_acesso:'Sua conta não tem acesso a esta clínica.',
  limite_pacote:'O pacote da clínica não comporta mais uma pessoa com esse perfil. No pacote Clínica a equipe não tem limite.',
  ja_na_equipe:'Essa pessoa já está na equipe.',
  ja_convidado:'Esse e-mail já foi convidado.',
  email_invalido:'Confira o e-mail.',
  nao_a_si_mesmo:'Você não pode mudar o seu próprio perfil.',
  sem_login:'Entre de novo para continuar.'
};
export const ErroNuvem = class extends Error { constructor(msg, codigo, status){ super(msg); this.codigo = codigo; this.status = status; } };
const erroDe = (status, corpo) => {
  const cod = corpo?.error_code || corpo?.code || corpo?.error || '', txt = String(corpo?.message || corpo?.msg || corpo?.error_description || '');
  if (corpo?.erro && corpo?.msg) return Object.assign(new ErroNuvem(String(corpo.msg), String(corpo.erro), status), { corpo });   // funções cobranca e nfse
  const chave = Object.keys(MSG_NUVEM).find(k => cod === k || txt.includes(k));
  return new ErroNuvem(chave ? MSG_NUVEM[chave] : status === 401 ? MSG_NUVEM.sem_login : 'O servidor não respondeu como esperado. Tente de novo.', chave || cod || String(status), status);
};

// f = fetch, mem = armazenamento (localStorage), agora = relógio em ms. Tudo injetável para os testes.
export function criarNuvem({ url = NUVEM.url, chave = NUVEM.chave, f = (...a) => fetch(...a), mem = localStorage, agora = () => Date.now() } = {}){
  const lerSessao = () => { try { return JSON.parse(mem.getItem(KEY_SESSAO)) || null; } catch (e) { return null; } };
  const gravarSessao = s => { try { s ? mem.setItem(KEY_SESSAO, JSON.stringify(s)) : mem.removeItem(KEY_SESSAO); } catch (e) {} };
  let sessao = lerSessao(), semHistorico = false;

  const chamar = async (caminho, { metodo = 'GET', corpo, token, cab = {} } = {}) => {
    let r;
    try { r = await f(url + caminho, { method:metodo, headers:{ apikey:chave, 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}), ...cab }, body:corpo === undefined ? undefined : JSON.stringify(corpo) }); }
    catch (e) { throw new ErroNuvem('Sem conexão com o servidor. Confira a internet; o que você fizer fica guardado neste aparelho.', 'offline', 0); }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) throw erroDe(r.status, j);
    return j;
  };
  const guardar = j => {
    sessao = { access_token:j.access_token, refresh_token:j.refresh_token, expira:agora() + (Number(j.expires_in) || 3600) * 1000, user:{ id:j.user?.id, email:j.user?.email, nome:j.user?.user_metadata?.nome || '' } };
    gravarSessao(sessao); return sessao;
  };
  // Token válido, renovando um minuto antes de vencer. Sem sessão, ou renovação recusada: sai.
  const token = async () => {
    if (!sessao) throw new ErroNuvem(MSG_NUVEM.sem_login, 'sem_login', 401);
    if (sessao.expira - agora() > 60000) return sessao.access_token;
    try { return guardar(await chamar('/auth/v1/token?grant_type=refresh_token', { metodo:'POST', corpo:{ refresh_token:sessao.refresh_token } })).access_token; }
    catch (e) { if (e.codigo !== 'offline') { sessao = null; gravarSessao(null); } throw e; }
  };
  const rest = async (caminho, op = {}) => chamar('/rest/v1/' + caminho, { ...op, token:await token() });

  return {
    sessao:() => sessao,
    entrar:async (email, senha) => guardar(await chamar('/auth/v1/token?grant_type=password', { metodo:'POST', corpo:{ email:email.trim(), password:senha } })),
    // Devolve a sessão, ou {confirmar:true} quando o servidor pede para confirmar o e-mail antes.
    criarConta:async (email, senha, nome, voltarPara) => {
      const j = await chamar('/auth/v1/signup' + (voltarPara ? '?redirect_to=' + encodeURIComponent(voltarPara) : ''), { metodo:'POST', corpo:{ email:email.trim(), password:senha, data:{ nome:nome.trim() } } });
      return j?.access_token ? guardar(j) : { confirmar:true };
    },
    esqueci:async (email, voltarPara) => { await chamar('/auth/v1/recover' + (voltarPara ? '?redirect_to=' + encodeURIComponent(voltarPara) : ''), { metodo:'POST', corpo:{ email:email.trim() } }); return true; },
    // Sessão que chega no endereço depois de confirmar o e-mail ou pedir nova senha (#access_token=...).
    sessaoDoLink:hash => {
      const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
      if (!p.get('access_token')) return null;
      const s = guardar({ access_token:p.get('access_token'), refresh_token:p.get('refresh_token'), expires_in:p.get('expires_in'), user:{} });
      return { sessao:s, tipo:p.get('type') || '' };
    },
    completarUsuario:async () => { const u = await chamar('/auth/v1/user', { token:await token() }); sessao.user = { id:u.id, email:u.email, nome:u.user_metadata?.nome || '' }; gravarSessao(sessao); return sessao.user; },
    trocarSenha:async senha => { await chamar('/auth/v1/user', { metodo:'PUT', corpo:{ password:senha }, token:await token() }); return true; },
    // Nome que sai nos registros e documentos (fica na conta, vale para todas as clínicas).
    mudarNome:async nome => { await chamar('/auth/v1/user', { metodo:'PUT', corpo:{ data:{ nome:nome.trim() } }, token:await token() }); sessao.user.nome = nome.trim(); gravarSessao(sessao); return sessao.user; },
    // O servidor manda um link para o e-mail novo; só muda depois que a pessoa abrir o link.
    mudarEmail:async (email, voltarPara) => { await chamar('/auth/v1/user' + (voltarPara ? '?redirect_to=' + encodeURIComponent(voltarPara) : ''), { metodo:'PUT', corpo:{ email:email.trim() }, token:await token() }); return true; },
    sairDosOutros:async () => { await chamar('/auth/v1/logout?scope=others', { metodo:'POST', token:await token() }); return true; },
    sair:async () => { const t = sessao?.access_token; sessao = null; gravarSessao(null); if (t) { try { await chamar('/auth/v1/logout', { metodo:'POST', token:t }); } catch (e) {} } },
    minhasClinicas:async () => (await rest(`membros?select=perfil,nome,clinicas(id,nome,cidade,uf,permissoes)&user_id=eq.${sessao.user.id}&ativo=is.true`) || [])
      .filter(m => m.clinicas).map(m => ({ id:m.clinicas.id, nome:m.clinicas.nome, cidade:m.clinicas.cidade, uf:m.clinicas.uf, perfil:m.perfil, permissoes:m.clinicas.permissoes || {} })),
    // Equipe (supabase/004_equipe.sql). aceitarConvites: ao entrar, entra nas clínicas que convidaram este e-mail.
    aceitarConvites:async () => { try { return await rest('rpc/aceitar_convites', { metodo:'POST', corpo:{} }); } catch (e) { if (e.status === 404 || e.codigo === 'PGRST202') return 0; throw e; } },
    equipe:async clinica => (await rest(`membros?select=user_id,nome,email,perfil,ativo,criado_em&clinica_id=eq.${clinica}&order=criado_em.asc`)) || [],
    convites:async clinica => { try { return (await rest(`convites?select=id,nome,email,perfil,criado_em&clinica_id=eq.${clinica}&aceito_em=is.null&order=criado_em.asc`)) || []; } catch (e) { if (e.status === 404 || e.codigo === '42P01' || e.codigo === 'PGRST205') return null; throw e; } },
    convidar:async (clinica, nome, email, perfil) => rest('rpc/convidar', { metodo:'POST', corpo:{ p_clinica:clinica, p_nome:nome.trim(), p_email:email.trim(), p_perfil:perfil } }),
    cancelarConvite:async id => rest('rpc/cancelar_convite', { metodo:'POST', corpo:{ p_id:id } }),
    mudarMembro:async (clinica, user, perfil, ativo) => rest('rpc/mudar_membro', { metodo:'POST', corpo:{ p_clinica:clinica, p_user:user, p_perfil:perfil, p_ativo:ativo } }),
    salvarPermissoes:async (clinica, permissoes) => { await rest(`clinicas?id=eq.${clinica}`, { metodo:'PATCH', corpo:{ permissoes }, cab:{ Prefer:'return=minimal' } }); return true; },
    criarClinica:async ({ nome, cidade, uf, nomePessoa, plano }, doc) => {
      const corpo = { p_nome:nome, p_cidade:cidade, p_uf:uf, p_nome_pessoa:nomePessoa, p_doc:doc };
      if (!plano) return rest('rpc/criar_clinica', { metodo:'POST', corpo });
      // Servidor ainda sem 002_planos.sql: a função não aceita o pacote; cria sem ele.
      try { return await rest('rpc/criar_clinica', { metodo:'POST', corpo:{ ...corpo, p_plano:plano } }); }
      catch (e) { if (e.codigo === 'PGRST202' || e.status === 404) return rest('rpc/criar_clinica', { metodo:'POST', corpo }); throw e; }
    },
    // Pacote e prazos da clínica (supabase/002_planos.sql). null quando o servidor ainda não tem a tabela.
    assinatura:async clinica => { try { return (await rest(`assinaturas?select=plano,teste_ate,gratis_ate,gratis_sempre,gratis_motivo,pago_ate&clinica_id=eq.${clinica}`))?.[0] || null; } catch (e) { if (e.status === 404 || e.codigo === '42P01' || e.codigo === 'PGRST205') return null; throw e; } },
    // Painel do MUSUBI (só para quem está na tabela donos; o servidor recusa os outros).
    painelDono:async () => (await rest('rpc/painel_dono', { metodo:'POST', corpo:{} })) || [],
    darGratis:async (clinica, ate, motivo = '', tirar = false) => rest('rpc/dar_gratis', { metodo:'POST', corpo:{ p_clinica:clinica, p_ate:ate, p_motivo:motivo, p_tirar:tirar } }),
    mudarPlano:async (clinica, plano) => rest('rpc/mudar_plano', { metodo:'POST', corpo:{ p_clinica:clinica, p_plano:plano } }),
    estenderTeste:async (clinica, dias) => rest('rpc/estender_teste', { metodo:'POST', corpo:{ p_clinica:clinica, p_dias:dias } }),
    interessados:async () => (await rest('interessados?select=id,nome,whats,situacao,criado_em&order=criado_em.desc')) || [],
    mudarInteressado:async (id, situacao) => rest(`interessados?id=eq.${id}`, { metodo:'PATCH', corpo:{ situacao }, cab:{ Prefer:'return=minimal' } }),
    baixar:async clinica => { const L = await rest(`dados?select=doc,versao&clinica_id=eq.${clinica}`); return L?.[0] || null; },
    // Nome, cidade e estado da clínica (só o administrador consegue: regra clinicas_mudar).
    mudarClinica:async (clinica, { nome, cidade, uf, whats }) => { await rest(`clinicas?id=eq.${clinica}`, { metodo:'PATCH', corpo:{ nome, cidade, uf, whats }, cab:{ Prefer:'return=minimal' } }); return true; },
    souDono:async () => ((await rest(`donos?select=user_id&user_id=eq.${sessao.user.id}`)) || []).length > 0,
    // Salva o documento e, junto, os eventos do histórico (supabase/006_historico.sql). Servidor sem o 006: salva
    // só os dados (e avisa em semHistorico, para a tela do histórico dizer o que falta).
    salvar:async (clinica, doc, versao, eventos = []) => {
      if (!semHistorico) {
        try { return await rest('rpc/salvar_dados', { metodo:'POST', corpo:{ p_clinica:clinica, p_doc:doc, p_versao:versao, p_eventos:eventos } }); }
        catch (e) { if (!(e.status === 404 || e.codigo === 'PGRST202')) throw e; semHistorico = true; }
      }
      return rest('rpc/salvar_dados', { metodo:'POST', corpo:{ p_clinica:clinica, p_doc:doc, p_versao:versao } });
    },
    semHistorico:() => semHistorico,
    // Histórico de alterações (só o administrador lê). F = { paciente, antes (iso), limite }.
    historico:async (clinica, F = {}) => rest(`historico?select=id,em,pessoa,email,tipo,acao,alvo,paciente_id,titulo,campos&clinica_id=eq.${clinica}${F.paciente ? `&paciente_id=eq.${encodeURIComponent(F.paciente)}` : ''}${F.antes ? `&em=lt.${encodeURIComponent(F.antes)}` : ''}&order=em.desc&limit=${F.limite || 100}`),
    // Pagamento do MUSUBI pela InfinitePay (função cobranca, supabase/functions/cobranca). Devolve { url } do link.
    pagar:async (clinica, plano, periodo, teste = false) => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'criar', clinica, plano, periodo, ...(teste ? { teste:true } : {}) }, token:await token() }),
    // Assinatura no cartão pelo Mercado Pago (mesma função cobranca, supabase/007_mercadopago.sql).
    assinarCartao:async (clinica, plano, periodo, email) => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'assinar', clinica, plano, periodo, email }, token:await token() }),
    cartao:async clinica => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'cartao', clinica }, token:await token() }),
    cancelarCartao:async clinica => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'cancelar_cartao', clinica }, token:await token() }),
    cobrarLink:async (clinica, tag, valor, descricao) => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'link', clinica, tag, valor, descricao }, token:await token() }),
    // Nota fiscal (função nfse, supabase/functions/nfse): { acao, clinica, ... }.
    nfse:async corpo => chamar('/functions/v1/nfse', { metodo:'POST', corpo, token:await token() }),
    conferirPagamento:async ({ order_nsu, transaction_nsu, slug, receipt_url }) => chamar('/functions/v1/cobranca', { metodo:'POST', corpo:{ acao:'conferir', order_nsu, transaction_nsu, slug, receipt_url }, token:await token() }),
    // Pagamentos (supabase/003_pagamentos.sql): da clínica, ou todos para o dono. [] quando o servidor ainda não tem a tabela.
    pagamentos:async clinica => { try { return (await rest(`pagamentos?select=id,clinica_id,plano,periodo,valor,valor_pago,situacao,forma,recibo,link,criado_em,pago_em&order=criado_em.desc${clinica ? '&clinica_id=eq.' + clinica : ''}`)) || []; } catch (e) { if (e.status === 404 || e.codigo === '42P01' || e.codigo === 'PGRST205') return []; throw e; } },
    // Página de apresentação: pedido de contato sem login (a lista só o dono do MUSUBI lê).
    pedirContato:async (nome, whats) => { await chamar('/rest/v1/interessados', { metodo:'POST', corpo:{ nome:nome.trim(), whats:whats.trim() }, cab:{ Prefer:'return=minimal' } }); return true; }
  };
}

// Mantém o documento da clínica igual no aparelho e no servidor. marcar() depois de cada mudança:
// espera um pouco e envia. Se outro aparelho salvou antes, guarda uma cópia do que estava aqui,
// traz a versão do servidor e avisa. Sem internet, fica pendente e tenta de novo depois.
// Junta o trabalho de duas pessoas (ou dois aparelhos) que mexeram ao mesmo tempo: compara cada uma com a
// última versão em comum (base). O que só um lado mudou entra; listas com id (pacientes, horários, sessões…)
// juntam item por item; item apagado de um lado sai, a não ser que o outro lado tenha mexido nele.
// Se os dois mudaram o mesmo campo, vale o deste aparelho.
const igualJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const objJ = v => !!v && typeof v === 'object' && !Array.isArray(v);
const listaComId = v => Array.isArray(v) && v.every(x => objJ(x) && x.id != null);
export function juntarDocs(base, meu, deles){
  if (igualJ(meu, base) || igualJ(meu, deles)) return deles;
  if (igualJ(deles, base)) return meu;
  if (objJ(meu) && objJ(deles)) {
    const B = objJ(base) ? base : {}, r = {};
    for (const k of new Set([...Object.keys(deles), ...Object.keys(meu)])) {
      const tinha = k in B;
      if (!(k in meu) && tinha) { if (!igualJ(deles[k], B[k])) r[k] = deles[k]; continue; }
      if (!(k in deles) && tinha) { if (!igualJ(meu[k], B[k])) r[k] = meu[k]; continue; }
      if (!(k in meu)) { r[k] = deles[k]; continue; }
      if (!(k in deles)) { r[k] = meu[k]; continue; }
      r[k] = juntarDocs(B[k], meu[k], deles[k]);
    }
    return r;
  }
  if (listaComId(meu) && listaComId(deles) && (meu.length || deles.length)) {
    const B = new Map((listaComId(base) ? base : []).map(x => [x.id, x])), M = new Map(meu.map(x => [x.id, x])), D = new Map(deles.map(x => [x.id, x])), r = [];
    for (const id of [...D.keys(), ...[...M.keys()].filter(i => !D.has(i))]) {
      const b = B.get(id), m = M.get(id), d = D.get(id);
      if (m && d) r.push(juntarDocs(b, m, d));
      else if (m) { if (!b || !igualJ(m, b)) r.push(m); }
      else if (!b || !igualJ(d, b)) r.push(d);
    }
    return r;
  }
  return meu;
}

export function criarSincronia({ nuvem, clinica, obter, aplicar, aoMudar = () => {}, mem = localStorage, espera = 1500, relogio = { definir:(fn, ms) => setTimeout(fn, ms), limpar:h => clearTimeout(h) }, agora = () => new Date().toISOString() }){
  let versao = 0, pendente = false, enviando = false, h = null, estado = 'carregando', base = null;
  const copiar = d => JSON.parse(JSON.stringify(d));
  const mudar = (e, extra) => { estado = e; aoMudar(e, extra); };
  const enviar = async () => {
    h = null; if (enviando) { pendente = true; return; }
    enviando = true; pendente = false; mudar('salvando');
    try {
      const enviado = copiar(obter()), v = await nuvem.salvar(clinica, enviado, versao, base ? eventosEntre(base, enviado) : []);
      if (v > 0) { versao = v; base = enviado; mudar(pendente ? 'salvando' : 'salvo'); }
      else {
        // Outra pessoa salvou antes: junta as duas versões e manda de novo (nada se perde).
        const copia = 'musubi-v2-conflito-' + agora();
        try { mem.setItem(copia, JSON.stringify(obter())); } catch (e) {}
        const r = await nuvem.baixar(clinica), junto = base ? juntarDocs(base, obter(), r.doc) : r.doc;
        versao = r.versao; base = copiar(r.doc); aplicar(junto);
        if (!igualJ(junto, r.doc)) pendente = true;
        mudar('juntado', { copia });
      }
    } catch (e) { pendente = true; mudar(e.codigo === 'offline' ? 'offline' : 'erro', { msg:e.message }); }
    finally { enviando = false; if (pendente && estado !== 'offline' && estado !== 'erro') marcar(); }
  };
  const marcar = () => { pendente = true; if (h) relogio.limpar(h); h = relogio.definir(enviar, espera); };
  return {
    estado:() => estado, versao:() => versao, pendente:() => pendente,
    iniciar:async () => { const r = await nuvem.baixar(clinica); if (!r) throw new Error('Clínica sem dados no servidor.'); versao = r.versao; base = copiar(r.doc); aplicar(r.doc); mudar('salvo'); return r; },
    // Traz o que outra pessoa salvou (ao voltar para a aba e de tempos em tempos), juntando com o que há aqui.
    atualizar:async () => {
      if (enviando || h || estado === 'carregando') return false;
      let r; try { r = await nuvem.baixar(clinica); } catch (e) { return false; }
      if (!r || r.versao <= versao || enviando || h) return false;
      const junto = base ? juntarDocs(base, obter(), r.doc) : r.doc;
      versao = r.versao; base = copiar(r.doc); aplicar(junto);
      if (!igualJ(junto, r.doc)) marcar();
      mudar('atualizado'); return true;
    },
    marcar, agora:enviar,
    tentarDeNovo:() => { if (pendente) marcar(); }
  };
}
