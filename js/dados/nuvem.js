// Etapa 10: ligação com o servidor (Supabase), sem biblioteca externa: login pela API de autenticação e
// dados pela API REST, com as regras de acesso do banco (supabase/001_inicio.sql) decidindo o que cada
// conta enxerga. A chave abaixo é a pública (publishable): pode ficar no código do site.
// Nesta primeira parte cada clínica guarda o documento inteiro do sistema, com versão (salvar_dados).

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
  sem_login:'Entre de novo para continuar.'
};
export const ErroNuvem = class extends Error { constructor(msg, codigo, status){ super(msg); this.codigo = codigo; this.status = status; } };
const erroDe = (status, corpo) => {
  const cod = corpo?.error_code || corpo?.code || corpo?.error || '', txt = String(corpo?.message || corpo?.msg || corpo?.error_description || '');
  const chave = Object.keys(MSG_NUVEM).find(k => cod === k || txt.includes(k));
  return new ErroNuvem(chave ? MSG_NUVEM[chave] : status === 401 ? MSG_NUVEM.sem_login : 'O servidor não respondeu como esperado. Tente de novo.', chave || cod || String(status), status);
};

// f = fetch, mem = armazenamento (localStorage), agora = relógio em ms. Tudo injetável para os testes.
export function criarNuvem({ url = NUVEM.url, chave = NUVEM.chave, f = (...a) => fetch(...a), mem = localStorage, agora = () => Date.now() } = {}){
  const lerSessao = () => { try { return JSON.parse(mem.getItem(KEY_SESSAO)) || null; } catch (e) { return null; } };
  const gravarSessao = s => { try { s ? mem.setItem(KEY_SESSAO, JSON.stringify(s)) : mem.removeItem(KEY_SESSAO); } catch (e) {} };
  let sessao = lerSessao();

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
    minhasClinicas:async () => (await rest(`membros?select=perfil,nome,clinicas(id,nome,cidade,uf)&user_id=eq.${sessao.user.id}&ativo=is.true`) || [])
      .filter(m => m.clinicas).map(m => ({ id:m.clinicas.id, nome:m.clinicas.nome, cidade:m.clinicas.cidade, uf:m.clinicas.uf, perfil:m.perfil })),
    criarClinica:async ({ nome, cidade, uf, nomePessoa }, doc) => rest('rpc/criar_clinica', { metodo:'POST', corpo:{ p_nome:nome, p_cidade:cidade, p_uf:uf, p_nome_pessoa:nomePessoa, p_doc:doc } }),
    baixar:async clinica => { const L = await rest(`dados?select=doc,versao&clinica_id=eq.${clinica}`); return L?.[0] || null; },
    // Nome, cidade e estado da clínica (só o administrador consegue: regra clinicas_mudar).
    mudarClinica:async (clinica, { nome, cidade, uf, whats }) => { await rest(`clinicas?id=eq.${clinica}`, { metodo:'PATCH', corpo:{ nome, cidade, uf, whats }, cab:{ Prefer:'return=minimal' } }); return true; },
    souDono:async () => ((await rest(`donos?select=user_id&user_id=eq.${sessao.user.id}`)) || []).length > 0,
    salvar:async (clinica, doc, versao) => rest('rpc/salvar_dados', { metodo:'POST', corpo:{ p_clinica:clinica, p_doc:doc, p_versao:versao } }),
    // Página de apresentação: pedido de contato sem login (a lista só o dono do MUSUBI lê).
    pedirContato:async (nome, whats) => { await chamar('/rest/v1/interessados', { metodo:'POST', corpo:{ nome:nome.trim(), whats:whats.trim() }, cab:{ Prefer:'return=minimal' } }); return true; }
  };
}

// Mantém o documento da clínica igual no aparelho e no servidor. marcar() depois de cada mudança:
// espera um pouco e envia. Se outro aparelho salvou antes, guarda uma cópia do que estava aqui,
// traz a versão do servidor e avisa. Sem internet, fica pendente e tenta de novo depois.
export function criarSincronia({ nuvem, clinica, obter, aplicar, aoMudar = () => {}, mem = localStorage, espera = 1500, relogio = { definir:(fn, ms) => setTimeout(fn, ms), limpar:h => clearTimeout(h) }, agora = () => new Date().toISOString() }){
  let versao = 0, pendente = false, enviando = false, h = null, estado = 'carregando';
  const mudar = (e, extra) => { estado = e; aoMudar(e, extra); };
  const enviar = async () => {
    h = null; if (enviando) { pendente = true; return; }
    enviando = true; pendente = false; mudar('salvando');
    try {
      const v = await nuvem.salvar(clinica, obter(), versao);
      if (v > 0) { versao = v; mudar('salvo'); }
      else {
        const copia = 'musubi-v2-conflito-' + agora();
        try { mem.setItem(copia, JSON.stringify(obter())); } catch (e) {}
        const r = await nuvem.baixar(clinica); versao = r.versao; aplicar(r.doc);
        mudar('conflito', { copia });
      }
    } catch (e) { pendente = true; mudar(e.codigo === 'offline' ? 'offline' : 'erro', { msg:e.message }); }
    finally { enviando = false; if (pendente && estado !== 'offline' && estado !== 'erro') marcar(); }
  };
  const marcar = () => { pendente = true; if (h) relogio.limpar(h); h = relogio.definir(enviar, espera); };
  return {
    estado:() => estado, versao:() => versao, pendente:() => pendente,
    iniciar:async () => { const r = await nuvem.baixar(clinica); if (!r) throw new Error('Clínica sem dados no servidor.'); versao = r.versao; aplicar(r.doc); mudar('salvo'); return r; },
    marcar, agora:enviar,
    tentarDeNovo:() => { if (pendente) marcar(); }
  };
}
