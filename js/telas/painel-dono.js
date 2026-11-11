// Etapa 10: Painel do MUSUBI, só para a conta dona do MUSUBI (tabela donos no servidor).
// Mostra todas as clínicas com o pacote, a situação (teste, grátis, pago, vencido), quem usa e números gerais
// (nunca os dados dos pacientes), permite dar ou tirar acesso grátis, trocar o pacote e dar mais dias de teste,
// lista os interessados da página de apresentação e os pagamentos feitos pela InfinitePay.
// Excluir clínica (009_excluir_clinica.sql): para quem desistiu; cancela o cartão antes e guarda só o resumo comercial.
import { ic } from '../componentes/icones.js';
import { PLANOS, planoDe, precoTxt, rotuloSituacao, situacaoAssinatura } from '../dados/planos.js';
import { conta, pagarConta, situacaoConta } from './conta.js';
import { esc } from '../util.js';
import { DICAS_VENDA, contatosVenda, linkWhats, mensagemVenda, numerosGestao, tarefasDoDia } from '../dados/vendas.js';

const pd = { aba:'hoje', rel:null, filtro:'todos', buscaR:'', anotar:null, salvando:false, lista:null, inter:null, pags:[], erro:'', carregando:false, gratis:null, busca:'', excluir:null, excl:null, excluindo:false, forn:undefined };
const CARTAO_VIVO = ['ativa', 'pausada', 'pendente'];
let pdApp = { render:() => {}, toast:() => {} };
const SITU_INT = [['novo', 'Novo'], ['chamei', 'Já chamei'], ['cliente', 'Virou cliente'], ['nao', 'Não quis']];
const PRAZOS = [['30', '30 dias'], ['90', '90 dias'], ['365', '1 ano'], ['sempre', 'Sem prazo']];
const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
const quando = iso => { if (!iso) return 'nunca'; const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };

export const ehDono = () => conta.modo === 'nuvem' && conta.dono;

async function carregarPd(){
  if (pd.carregando) return; pd.carregando = true; pd.erro = ''; pdApp.render(true);
  try { const [L, I, G, X, R, F] = await Promise.all([conta.nuvem.painelDono(), conta.nuvem.interessados(), conta.nuvem.pagamentos().catch(() => []), conta.nuvem.clinicasExcluidas().catch(() => null), conta.nuvem.relacionamento().catch(() => null), conta.nuvem.fornecedor().catch(() => null)]);
    pd.lista = L; pd.inter = I; pd.pags = G; pd.excl = X; pd.rel = R ? Object.fromEntries(R.map(r => [r.ref, r])) : null; pd.forn = F; }
  catch (e) { pd.erro = e.message; }
  pd.carregando = false; pdApp.render(true);
}

export function vPainelDono(){
  if (!ehDono()) return `<div class="head"><div><h1>Painel do MUSUBI</h1><p>Só a conta dona do MUSUBI abre esta página.</p></div></div>`;
  if (!pd.lista && !pd.carregando && !pd.erro) setTimeout(carregarPd);
  const L = pd.lista || [], I = pd.inter || [], S = L.map(c => situacaoAssinatura(c));
  const n = t => S.filter(s => s.tipo === t).length, novos = I.filter(i => i.situacao === 'novo').length;
  const T = tarefasDoDia({ clinicas:L, interessados:I, excluidas:pd.excl || [], acompanhamento:pd.rel || {} });
  const cab = `<div class="head"><div><h1>Painel do MUSUBI</h1><p>Tarefas de venda, gestão, clínicas e relacionamento</p></div><button class="btn" data-pd="atualizar" ${pd.carregando ? 'disabled' : ''}>${ic('retorno')}${pd.carregando ? 'Atualizando…' : 'Atualizar'}</button></div>`;
  if (pd.erro) return cab + `<div class="notice">${ic('alerta')}<span>${esc(pd.erro)}</span></div>`;
  if (!pd.lista) return cab + `<p class="muted">${ic('carregando')} Carregando…</p>`;
  return cab + `<div class="pd-n">
      <div class="card"><small>Clínicas</small><b>${L.length}</b></div>
      <div class="card"><small>Em teste</small><b>${n('teste')}</b></div>
      <div class="card"><small>Grátis ou pagas</small><b>${n('gratis') + n('pago')}</b></div>
      <div class="card"><small>Teste terminou</small><b>${n('vencido')}</b></div>
      <div class="card"><small>Interessados novos</small><b>${novos}</b></div></div>
    <div class="tabs pd-tabs" role="tablist">${[['hoje', `Hoje${T.length ? ` (${T.length})` : ''}`, 'check'], ['gestao', 'Gestão', 'relatorios'], ['clinicas', 'Clínicas', 'admin'], ['relacionamento', `Relacionamento${novos ? ` (${novos})` : ''}`, 'mensagem'], ['pagamentos', 'Pagamentos', 'dinheiro']].map(([k, l, i]) => `<button role="tab" data-pd="aba" data-k="${k}" class="${pd.aba === k ? 'on' : ''}" aria-selected="${pd.aba === k}">${ic(i)}${l}</button>`).join('')}</div>
    ${pd.aba === 'hoje' ? pdHoje(T) : pd.aba === 'gestao' ? pdGestao(L) : pd.aba === 'clinicas' ? pdClinicas(L) : pd.aba === 'relacionamento' ? pdRelacionamento(L, I) : pdPagamentos(L, pd.pags)}`;
}

function pdClinicas(L){
  const q = pd.busca.trim().toLowerCase(), F = L.filter(c => !q || [c.nome, c.cidade, c.email_dono].join(' ').toLowerCase().includes(q));
  return `<div class="card" id="pd-cl"><div class="card-h"><h2>Clínicas<small>${L.length} no total · a mais nova primeiro</small></h2><input class="pd-busca" data-pd="busca" type="search" placeholder="Buscar por nome, cidade ou e-mail" value="${esc(pd.busca)}" aria-label="Buscar clínica"></div>
    <div class="list">${F.map(c => { const s = situacaoAssinatura(c), aberto = pd.gratis === c.id;
      return `<div class="row pd-c" data-c="${c.id}"><span class="tico sm acc">${ic('local')}</span>
        <div class="grow"><b>${esc(c.nome)}</b><small class="muted">${esc([c.cidade, c.uf].filter(Boolean).join(' - '))}${c.email_dono ? ' · ' + esc(c.email_dono) : ''}</small>
          <small class="muted">${c.pessoas_ativas} pessoa${c.pessoas_ativas === 1 ? '' : 's'} com acesso${c.pessoas > c.pessoas_ativas ? ` (${c.pessoas - c.pessoas_ativas} sem acesso)` : ''} · ${c.pacientes} paciente${c.pacientes === 1 ? '' : 's'} · usou ${quando(c.ultimo_uso)} · desde ${dataBR(c.criado_em)}</small>
          ${s.tipo === 'gratis' && s.motivo ? `<small class="muted">Grátis: ${esc(s.motivo)}</small>` : ''}</div>
        <div class="pd-ctl"><span class="pill ${s.tipo === 'vencido' ? 'warn' : s.tipo === 'teste' ? '' : 'ok'}">${rotuloSituacao(s)}</span>
          <label><span class="so-leitor">Pacote de ${esc(c.nome)}</span><select data-pd="plano" data-c="${c.id}">${PLANOS.map(p => `<option value="${p.k}" ${p.k === (c.plano || 'profissional') ? 'selected' : ''}>${p.nome}</option>`).join('')}</select></label>
          ${s.tipo === 'gratis' ? `<button class="btn sm ghost" data-pd="tirar" data-c="${c.id}">Tirar acesso grátis</button>` : `<button class="btn sm" data-pd="gratis" data-c="${c.id}">${ic('mais')}Dar acesso grátis</button>`}
          ${s.tipo === 'teste' || s.tipo === 'vencido' ? `<button class="btn sm ghost" data-pd="mais7" data-c="${c.id}">+7 dias de teste</button>` : ''}
          ${c.id !== conta.clinica?.id ? `<button class="btn sm ghost" data-pd="excluir" data-c="${c.id}">${ic('x')}Excluir</button>` : ''}</div>
        ${pd.excluir === c.id ? pdExcluir(c) : ''}
        ${aberto ? `<form class="pd-g" id="pd-g" novalidate><div class="form">
            <label class="field"><span class="lbl">Por quanto tempo</span><select name="prazo">${PRAZOS.map(([k, l]) => `<option value="${k}" ${k === '90' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field"><span class="lbl">Motivo (só você vê)</span><input name="motivo" placeholder="Ex.: testar o sistema" autocomplete="off"></label></div>
          <div class="cf-acoes"><button class="btn pri" type="submit">${ic('check')}Dar acesso grátis</button><button class="btn ghost" type="button" data-pd="gratis-fechar">Cancelar</button></div></form>` : ''}</div>`; }).join('') || '<p class="muted sm">Nenhuma clínica encontrada.</p>'}</div>
    <p class="muted sm cf-obs">Os dados dos pacientes de cada clínica não aparecem aqui: só os números gerais.</p>
    ${pd.excl?.length ? `<details class="pd-ex" id="pd-ex"><summary>Clínicas excluídas (${pd.excl.length})</summary><div class="list">${pd.excl.map(x => `<div class="row"><div class="grow"><b>${esc(x.nome)}</b>
        <small class="muted">${esc([x.cidade, x.uf].filter(Boolean).join(' - '))}${x.email_dono ? ' · ' + esc(x.email_dono) : ''} · ${esc(planoDe(x.plano || 'profissional').nome)} · excluída em ${dataBR(x.excluida_em)}</small>
        ${x.motivo ? `<small class="muted">Motivo: ${esc(x.motivo)}</small>` : ''}</div><b>${reaisPd(x.pago_total || 0)}</b></div>`).join('')}</div>
      <p class="muted sm cf-obs">Fica só o resumo comercial e os pagamentos feitos ao MUSUBI. Nenhum dado de paciente.</p></details>` : ''}</div>`;
}
// Confirmação de exclusão: digita o nome da clínica; mostra o que será apagado e se o cartão será cancelado.
function pdExcluir(c){
  const cartao = CARTAO_VIVO.includes(c.cartao_situacao);
  return `<form class="pd-g pd-x" id="pd-x" novalidate><p class="notice crit sm">${ic('alerta')}<span><b>Excluir apaga a clínica e todos os dados dela</b> (equipe, pacientes, prontuários, agenda, financeiro e notas) e não dá para desfazer. Antes, combine com a clínica a exportação dos dados: o contrato garante 30 dias para isso.${cartao ? ' A assinatura no cartão (Mercado Pago) será cancelada antes, e não haverá mais cobranças.' : ''}</span></p>
    <div class="form"><label class="field"><span class="lbl">Motivo (só você vê)</span><input name="motivo" placeholder="Ex.: desistiu, achou caro" autocomplete="off"></label>
      <label class="field"><span class="lbl">Digite o nome da clínica para confirmar: <b>${esc(c.nome)}</b></span><input name="nome" autocomplete="off"></label></div>
    <p class="erro-a" id="pd-x-erro" role="alert" hidden></p>
    <div class="cf-acoes"><button class="btn crit" type="submit" ${pd.excluindo ? 'disabled' : ''}>${ic('x')}${pd.excluindo ? 'Excluindo…' : 'Excluir definitivamente'}</button><button class="btn ghost" type="button" data-pd="excluir-fechar">Cancelar</button></div></form>`;
}
async function excluirPd(f){
  const c = pd.lista?.find(x => x.id === pd.excluir); if (!c || pd.excluindo) return;
  const nome = f.elements.nome.value, motivo = f.elements.motivo.value.trim(), erro = m => { const e = document.getElementById('pd-x-erro'); if (e) { e.textContent = m; e.hidden = false; } };
  if (nome.trim().toLowerCase() !== c.nome.trim().toLowerCase()) { erro('O nome digitado não confere com o nome da clínica.'); return; }
  pd.excluindo = true; pdApp.render(true);
  const volta = m => { pd.excluindo = false; pdApp.render(true); const g = document.getElementById('pd-x'); if (g) { g.elements.nome.value = nome; g.elements.motivo.value = motivo; } erro(m); };
  try { if (CARTAO_VIVO.includes(c.cartao_situacao)) await conta.nuvem.encerrarCartao(c.id); }
  catch (e) { volta(e.codigo === 'acao' || (e.status === 404 && !e.corpo) ? 'Para cancelar o cartão desta clínica, falta atualizar a função cobranca no Supabase.' : e.message); return; }
  try { await conta.nuvem.excluirClinica(c.id, nome, motivo); }
  catch (e) { volta(e.status === 404 || e.codigo === 'PGRST202' ? 'Falta rodar o 009_excluir_clinica.sql no Supabase.' : e.message); return; }
  pd.excluindo = false; pd.excluir = null; pdApp.toast(`${c.nome} foi excluída. As cobranças pararam.`); await carregarPd();
}

// Hoje: tarefas tiradas dos dados (retornos marcados, interessados novos, testes acabando, clientes parados,
// ex-clientes) e dicas fixas de venda.
function pdHoje(T){
  return `<div class="card" id="pd-hoje"><div class="card-h"><h2>Tarefas de hoje<small>da mais urgente para a menos</small></h2></div>
    <div class="list">${T.map(t => `<div class="row pd-t n${t.nivel}" data-ref="${esc(t.ref)}"><span class="tico sm ${t.nivel === 1 ? 'acc' : ''}">${ic(t.nivel === 1 ? 'sino' : 'relogio')}</span>
      <div class="grow"><b>${esc(t.titulo)}</b><small class="muted">${esc(t.detalhe)}</small></div>
      <div class="pd-ctl">${botoesContato(t)}<button class="btn sm ghost" data-pd="anotar" data-ref="${esc(t.ref)}" data-ir="1">${ic('editar')}Anotar</button></div></div>`).join('') || '<p class="muted sm">Nada pendente hoje. Bom momento para divulgar o MUSUBI.</p>'}</div></div>
  <div class="card" id="pd-dicas"><div class="card-h"><h2>Dicas para vender melhor</h2></div>
    <ul class="pd-dicas">${DICAS_VENDA.map(([t, d]) => `<li><b>${esc(t)}</b><span class="muted">${esc(d)}</span></li>`).join('')}</ul></div>`;
}
const botoesContato = k => { const w = linkWhats(k.whats, mensagemVenda(k.msg, k.nome));
  return `${w ? `<a class="btn sm wa" href="${w}" target="_blank" rel="noopener">${ic('mensagem')}WhatsApp</a>` : ''}${k.email ? `<a class="btn sm ghost" href="mailto:${esc(k.email)}">${ic('mail')}E-mail</a>` : ''}`; };

// Gestão: receita, conversão, desistências, uso.
function pdGestao(L){
  const N = numerosGestao({ clinicas:L, pagamentos:pd.pags, excluidas:pd.excl || [] }), ano = new Date().getFullYear();
  const nomeMes = m => new Date(m + '-15T12:00:00').toLocaleDateString('pt-BR', { month:'short', year:'numeric' });
  const caixa = (t, v, d = '') => `<div class="card"><small>${t}</small><b>${v}</b>${d ? `<small>${d}</small>` : ''}</div>`;
  return `<div class="card" id="pd-gest"><div class="card-h"><h2>Gestão do MUSUBI<small>números de hoje, sem dados de pacientes</small></h2></div>
    <div class="pd-n pd-n4">
      ${caixa('Receita por mês (estimada)', reaisPd(N.mrr), 'assinaturas em dia')}${caixa('Ticket médio', reaisPd(N.ticket), 'por clínica pagante')}
      ${caixa('Recebido em 30 dias', reaisPd(N.recebido30))}${caixa(`Recebido em ${ano}`, reaisPd(N.recebidoAno))}
      ${caixa('Clínicas pagantes', N.pagantes, `${N.cartao} no cartão`)}${caixa('Conversão do teste', N.conversao + '%', 'clínicas que já pagaram')}
      ${caixa('Novas em 30 dias', N.novas30)}${caixa('Usaram em 7 dias', N.ativas7, `de ${L.length} clínicas`)}
      ${caixa('Em teste', N.emTeste)}${caixa('Teste terminou', N.vencidas, 'sem pagamento em dia')}${caixa('Grátis', N.gratis)}${caixa('Desistências em 90 dias', N.desistencias90)}</div>
    <div class="pd-g2"><div><h3>Recebido por mês</h3><div class="list">${N.porMes.map(m => `<div class="row"><span class="grow">${nomeMes(m.mes)}</span><b>${reaisPd(m.valor)}</b></div>`).join('')}</div></div>
      <div><h3>Pagantes por pacote</h3><div class="list">${N.porPacote.map(p => `<div class="row"><span class="grow">${p.nome}</span><b>${p.n}</b></div>`).join('')}</div></div></div>
    <p class="muted sm cf-obs">Receita por mês: cartão pelo valor da assinatura (anual dividido por 12) e Pix pelo preço mensal do pacote. Não conta testes, acesso grátis nem o pagamento de teste de R$ 1,00.</p></div>`;
}

// Relacionamento: todos os contatos (interessados, clínicas, ex-clientes) com WhatsApp, anotações e retorno.
const GRUPOS_V = [['todos', 'Todos'], ['interessado', 'Interessados'], ['teste', 'Em teste'], ['vencido', 'Teste terminou'], ['cliente', 'Clientes'], ['ex', 'Ex-clientes']];
const NOME_GRUPO = { interessado:'Interessado', teste:'Em teste', vencido:'Teste terminou', cliente:'Cliente', ex:'Ex-cliente' };
function pdRelacionamento(L, I){
  const C = contatosVenda({ clinicas:L, interessados:I, excluidas:pd.excl || [], acompanhamento:pd.rel || {} });
  const q = pd.buscaR.trim().toLowerCase(), hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  const F = C.filter(k => (pd.filtro === 'todos' || k.grupo === pd.filtro) && (!q || [k.nome, k.cidade, k.email, k.whats].join(' ').toLowerCase().includes(q)));
  return `<div class="card" id="pd-rel"><div class="card-h"><h2>Relacionamento<small>interessados, clínicas e ex-clientes</small></h2><input class="pd-busca" data-pd="busca-r" type="search" placeholder="Buscar contato" value="${esc(pd.buscaR)}" aria-label="Buscar contato"></div>
    <div class="chips pd-chips">${GRUPOS_V.map(([k, l]) => `<button class="chip ${pd.filtro === k ? 'on' : ''}" data-pd="filtro" data-k="${k}">${l} <small>${k === 'todos' ? C.length : C.filter(x => x.grupo === k).length}</small></button>`).join('')}</div>
    ${pd.rel === null ? `<p class="notice sm">${ic('info')}<span>Para anotar conversas e marcar retornos, falta rodar o <b>010_relacionamento.sql</b> no Supabase.</span></p>` : ''}
    <div class="list">${F.map(k => { const ult = (k.notas || [])[0], atras = k.retornar_em && k.retornar_em <= hoje;
      return `<div class="row pd-r" data-ref="${esc(k.ref)}"><span class="avatar">${esc(String(k.nome).trim()[0] || '?').toUpperCase()}</span>
        <div class="grow"><b>${esc(k.nome)} <span class="pill">${NOME_GRUPO[k.grupo]}</span>${k.retornar_em ? ` <span class="pill ${atras ? 'warn' : ''}">Retornar ${new Date(k.retornar_em + 'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}</b>
          <small class="muted">${esc([k.cidade, k.whats, k.email].filter(Boolean).join(' · '))}${k.desde ? ` · ${k.grupo === 'ex' ? 'saiu' : 'desde'} ${dataBR(k.desde)}` : ''}</small>
          ${ult ? `<small class="pd-nota">${ic('editar')}${esc(ult.texto)} <span class="muted">(${dataBR(ult.em)})</span></small>` : ''}${k.motivo ? `<small class="muted">Motivo da saída: ${esc(k.motivo)}</small>` : ''}</div>
        <div class="pd-ctl">${botoesContato(k)}${k.grupo === 'interessado' ? `<label><span class="so-leitor">Situação de ${esc(k.nome)}</span><select data-pd="situ" data-i="${k.id}">${SITU_INT.map(([s, l]) => `<option value="${s}" ${k.situacao === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
          ${pd.rel !== null ? `<button class="btn sm ghost" data-pd="anotar" data-ref="${esc(k.ref)}">${ic('editar')}Anotar</button>` : ''}</div>
        ${pd.anotar === k.ref ? pdAnotar(k) : ''}</div>`; }).join('') || '<p class="muted sm">Nenhum contato aqui.</p>'}</div></div>`;
}
function pdAnotar(k){
  return `<form class="pd-g pd-anot" id="pd-anot" novalidate><div class="form">
      <label class="field"><span class="lbl">O que conversaram</span><textarea name="texto" rows="2" placeholder="Ex.: pediu para retornar depois do feriado"></textarea></label>
      <label class="field"><span class="lbl">Retornar o contato em</span><input type="date" name="retornar" value="${esc(k.retornar_em || '')}"></label></div>
    ${(k.notas || []).length ? `<ul class="pd-notas">${k.notas.slice(0, 5).map(n => `<li><small class="muted">${dataBR(n.em)}</small> ${esc(n.texto)}</li>`).join('')}</ul>` : ''}
    <div class="cf-acoes"><button class="btn pri" type="submit" ${pd.salvando ? 'disabled' : ''}>${ic('check')}${pd.salvando ? 'Salvando…' : 'Salvar'}</button><button class="btn ghost" type="button" data-pd="anotar-fechar">Cancelar</button></div></form>`;
}
// Quem vende o MUSUBI (013_fornecedor.sql): aparece só no contrato da tela de assinatura, nunca na página pública.
function pdFornecedor(){
  const f = pd.forn || {}, falta = !f.documento;
  return `<details class="pd-forn" ${falta ? 'open' : ''}><summary><b>Seus dados no contrato</b> <span class="pill ${falta ? 'warn' : 'ok'}">${falta ? 'Falta preencher' : 'Preenchido'}</span></summary>
    <form class="pd-g" id="pd-forn" novalidate><p class="muted sm cf-obs">A lei pede a identificação de quem vende. Estes dados aparecem só no contrato que a pessoa vê ao assinar (com botão para baixar), não na página pública.</p>
      <div class="form"><label class="field"><span class="lbl">Nome completo</span><input name="nome" maxlength="160" value="${esc(f.nome || '')}" autocomplete="name"></label>
      <label class="field"><span class="lbl">CPF ou CNPJ</span><input name="documento" maxlength="30" inputmode="numeric" value="${esc(f.documento || '')}"></label>
      <label class="field"><span class="lbl">Endereço completo</span><input name="endereco" maxlength="300" value="${esc(f.endereco || '')}" placeholder="Rua, número, bairro, cidade - UF, CEP"></label></div>
      ${pd.forn === null ? '<p class="muted sm cf-obs">Falta rodar o 013_fornecedor.sql no Supabase.</p>' : ''}
      <div class="cf-acoes"><button class="btn pri" type="submit" ${pd.salvando || pd.forn === null ? 'disabled' : ''}>${ic('check')}Salvar</button><a class="btn ghost" href="inicio/contrato.html" target="_blank" rel="noopener" data-contrato>Ver o contrato</a></div></form></details>`;
}
async function salvarFornecedorPd(f){
  const d = { nome:f.elements.nome.value, documento:f.elements.documento.value, endereco:f.elements.endereco.value };
  const n = d.documento.replace(/\D/g, '');
  if (!d.nome.trim() || (n.length !== 11 && n.length !== 14) || d.endereco.trim().length < 10) { pdApp.toast('Preencha o nome, um CPF (11 números) ou CNPJ (14) e o endereço completo.', 'info'); return; }
  pd.salvando = true;
  try { await conta.nuvem.salvarFornecedor(d); pd.forn = { ...d }; pdApp.toast('Dados do contrato salvos'); }
  catch (e) { pdApp.toast(e.status === 404 || e.codigo === '42P01' || e.codigo === 'PGRST205' ? 'Falta rodar o 013_fornecedor.sql no Supabase.' : e.message, 'info'); }
  pd.salvando = false; pdApp.render(true);
}
async function salvarAnotacao(f){
  const ref = pd.anotar, atual = pd.rel?.[ref] || {}, texto = f.elements.texto.value.trim(), retornar = f.elements.retornar.value;
  if (!texto && retornar === (atual.retornar_em || '')) { pd.anotar = null; pdApp.render(true); return; }
  const notas = texto ? [{ em:new Date().toISOString(), texto:texto.slice(0, 500) }, ...(atual.notas || [])].slice(0, 200) : (atual.notas || []);
  pd.salvando = true; pdApp.render(true);
  try { await conta.nuvem.salvarRelacionamento(ref, { notas, retornar_em:retornar || null }); pd.rel = { ...(pd.rel || {}), [ref]:{ ref, notas, retornar_em:retornar || null } }; pd.anotar = null; pdApp.toast(retornar ? `Anotado. Retorno em ${new Date(retornar + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Anotado'); }
  catch (e) { pdApp.toast(e.message, 'info'); }
  pd.salvando = false; pdApp.render(true);
}

const FORMA_PD = { pix:'Pix', credit_card:'Cartão' };
const reaisPd = c => (c / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
function pdPagamentos(L, G){
  const pagos = G.filter(g => g.situacao === 'pago'), mes = new Date().toISOString().slice(0, 7);
  const doMes = pagos.filter(g => String(g.pago_em || '').slice(0, 7) === mes), nomeC = id => L.find(c => c.id === id)?.nome || 'Clínica';
  return `<div class="card" id="pd-pag"><div class="card-h"><h2>Pagamentos<small>pela InfinitePay: Pix ou cartão, mensal ou anual (2 meses grátis)</small></h2><button class="btn sm" data-pd="teste" ${pd.testando ? 'disabled' : ''}>${ic('dinheiro')}${pd.testando ? 'Abrindo…' : 'Testar pagamento (R$ 1,00)'}</button></div>
    <p class="muted sm cf-obs" id="pd-teste-obs">O teste abre um pagamento real de R$ 1,00 para a sua própria clínica, que vai para a sua conta InfinitePay. Serve para conferir que o pagamento é confirmado e libera o acesso sozinho (soma 1 mês ao pacote da sua clínica).</p>
    <div class="pd-n pd-n3"><div class="card"><small>Recebido este mês</small><b>${reaisPd(doMes.reduce((t, g) => t + (g.valor_pago || g.valor), 0))}</b></div>
      <div class="card"><small>Pagamentos confirmados</small><b>${pagos.length}</b></div>
      <div class="card"><small>Não concluídos</small><b>${G.length - pagos.length}</b></div></div>
    <div class="list">${G.map(g => `<div class="row pd-g-l"><span class="tico sm ${g.situacao === 'pago' ? 'acc' : ''}">${ic('dinheiro')}</span>
      <div class="grow"><b>${esc(nomeC(g.clinica_id))}</b><small class="muted">${g.valor === 100 ? 'Teste de pagamento' : `${esc(planoDe(g.plano).nome)} · ${g.periodo === 'anual' ? 'anual' : 'mensal'}`} · ${dataBR(g.pago_em || g.criado_em)}${g.forma ? ' · ' + (FORMA_PD[g.forma] || esc(g.forma)) : ''}</small></div>
      <b>${reaisPd(g.valor)}</b><span class="pill ${g.situacao === 'pago' ? 'ok' : ''}">${g.situacao === 'pago' ? 'Pago' : 'Não concluído'}</span>${g.recibo ? `<a class="btn sm ghost" href="${esc(g.recibo)}" target="_blank" rel="noopener">Recibo</a>` : ''}</div>`).join('') || '<p class="muted sm">Nenhum pagamento ainda.</p>'}</div>
    ${pdFornecedor()}
    <p class="muted sm cf-obs">Pacotes: ${PLANOS.map(p => `<b>${p.nome}</b> (${precoTxt(p)})`).join(', ')}. O pagamento confirmado pela InfinitePay libera o acesso da clínica sozinho. "Não concluído" é quem abriu o pagamento e não terminou.</p></div>`;
}

const pdFaz = async (fn, ok) => { try { await fn(); pdApp.toast(ok); await carregarPd(); } catch (e) { pdApp.toast(e.message, 'info'); } };

export function ligarPainelDono(r, t){
  pdApp = { render:r, toast:t };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pd]'); if (!b || b.matches('input, select')) return; const a = b.dataset.pd, c = b.dataset.c;
    const nome = () => pd.lista?.find(x => x.id === c)?.nome || '';
    if (a === 'atualizar') carregarPd();
    else if (a === 'aba') { pd.aba = b.dataset.k; pdApp.render(true); }
    else if (a === 'gratis') { pd.gratis = c; pdApp.render(true); document.querySelector('#pd-g [name=motivo]')?.focus(); }
    else if (a === 'gratis-fechar') { pd.gratis = null; pdApp.render(true); }
    else if (a === 'excluir') { pd.excluir = c; pd.gratis = null; pdApp.render(true); document.querySelector('#pd-x [name=motivo]')?.focus(); }
    else if (a === 'excluir-fechar') { pd.excluir = null; pdApp.render(true); }
    else if (a === 'filtro') { pd.filtro = b.dataset.k; pdApp.render(true); }
    else if (a === 'anotar') { pd.anotar = b.dataset.ref; if (b.dataset.ir) { pd.aba = 'relacionamento'; pd.filtro = 'todos'; pd.buscaR = ''; } pdApp.render(true);
      const f = document.getElementById('pd-anot'); f?.scrollIntoView({ block:'center' }); f?.elements.texto.focus(); }
    else if (a === 'anotar-fechar') { pd.anotar = null; pdApp.render(true); }
    else if (a === 'tirar') pdFaz(() => conta.nuvem.darGratis(c, null, '', true), `Acesso grátis de ${nome()} retirado`);
    else if (a === 'teste') { pd.testando = true; pdApp.render(true); pagarConta(situacaoConta()?.plano.k || 'profissional', 'mensal', true).then(e => { if (e) { pd.testando = false; pdApp.render(true); pdApp.toast(e, 'info'); } }); }
    else if (a === 'mais7') pdFaz(() => conta.nuvem.estenderTeste(c, 7), `${nome()} ganhou mais 7 dias de teste`);
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (!t.dataset?.pd) return;
    if (t.dataset.pd === 'plano') pdFaz(() => conta.nuvem.mudarPlano(t.dataset.c, t.value), `Pacote trocado para ${planoDe(t.value).nome}`);
    if (t.dataset.pd === 'situ') pdFaz(() => conta.nuvem.mudarInteressado(t.dataset.i, t.value), 'Situação salva');
  });
  document.addEventListener('input', ev => { const k = ev.target.dataset?.pd; if (k !== 'busca' && k !== 'busca-r') return;
    if (k === 'busca') pd.busca = ev.target.value; else pd.buscaR = ev.target.value;
    pdApp.render(true); const i = document.querySelector(`[data-pd="${k}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  document.addEventListener('submit', ev => {
    if (ev.target.id === 'pd-x') { ev.preventDefault(); excluirPd(ev.target); return; }
    if (ev.target.id === 'pd-forn') { ev.preventDefault(); if (!pd.salvando) salvarFornecedorPd(ev.target); return; }
    if (ev.target.id === 'pd-anot') { ev.preventDefault(); if (!pd.salvando) salvarAnotacao(ev.target); return; }
    if (ev.target.id !== 'pd-g') return; ev.preventDefault();
    const f = ev.target, prazo = f.elements.prazo.value, c = pd.gratis, nome = pd.lista?.find(x => x.id === c)?.nome || '';
    const ate = prazo === 'sempre' ? null : new Date(Date.now() + Number(prazo) * 864e5).toISOString();
    pd.gratis = null;
    pdFaz(() => conta.nuvem.darGratis(c, ate, f.elements.motivo.value.trim()), `${nome} com acesso grátis ${prazo === 'sempre' ? 'sem prazo' : 'por ' + PRAZOS.find(p => p[0] === prazo)[1]}`);
  });
}
