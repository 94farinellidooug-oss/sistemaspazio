// Nota fiscal (NFS-e) na tela: aba "Nota fiscal" das Configurações (certificado A1 e dados fiscais), botão
// "Emitir nota" em cada recebimento do Financeiro, janela de conferência antes de emitir, "Conferir" para a
// nota que ficou sem resposta e a folha da nota para imprimir. Quem emite é a função nfse do servidor.
import { ic } from '../componentes/icones.js';
import { db, patient } from '../dados/repositorio.js';
import { configDe } from '../dados/config.js';
import { AMBIENTES, CODIGOS_SERVICO, REGIMES_NOTA, codigoMunicipio, codigoTxt, configNota, cpfDe, cpfConfere, descricaoNota, faltaParaNota, guardarNota, lerMunicipios, nomeCodigo, notaDe, pedidoNota, salvarConfigNota } from '../dados/nfse.js';
import { cobrancaLigada, nfseConta, souAdm } from './conta.js';
import { PROF } from './menu.js';
import { planoDe } from '../dados/planos.js';
import { brl, esc, fmt } from '../util.js';

// cert: undefined (ainda não perguntado), null (sem certificado) ou { titular, documento, validade }
const nf = { codRes:null, codBusca:false, cert:undefined, buscando:false, ocupado:false, rasc:null, tirar:false, janela:null, erro:'', municipios:null, carregandoM:false };
let app = { save:() => {}, render:() => {}, toast:() => {} };
const dataBr = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
const docTxt = d => { const x = String(d || '').replace(/\D/g, ''); return x.length === 14 ? x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : x.length === 11 ? x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : x; };

// Municípios do IBGE: carregam na primeira vez que a nota precisa do código da cidade.
async function carregarMunicipios(){
  if (nf.municipios || nf.carregandoM) return; nf.carregandoM = true;
  const U = ['js/conhecimento/municipios.txt', '../js/conhecimento/municipios.txt']; if (location.pathname.includes('/dist/')) U.reverse();
  for (const u of U) { try { const r = await fetch(u); if (r.ok) { const L = lerMunicipios(await r.text()); if (L.length) { nf.municipios = L; break; } } } catch (e) {} }
  nf.carregandoM = false; app.render(true);
}
// Código IBGE da cidade da clínica: null enquanto carrega, '' quando não achou.
const ibgeDaClinica = () => { if (!nf.municipios) { carregarMunicipios(); return null; } const C = configDe(db).clinica; return codigoMunicipio(nf.municipios, C.cidade, C.uf); };
async function buscarCertificado(){
  if (nf.buscando || nf.cert !== undefined || !cobrancaLigada()) return; nf.buscando = true;
  const r = await nfseConta('situacao'); nf.buscando = false;
  nf.cert = r.erro ? null : r.certificado; nf.uso = r.uso || null; nf.erroServ = r.erro || ''; app.render(true);
}

/* ---------- Configurações > Nota fiscal ---------- */
export function cfNota(){
  if (!cobrancaLigada()) return `<div class="card cf-max" id="cf-nota"><div class="card-h"><h2>Nota fiscal de serviço (NFS-e)</h2></div>
    <p class="muted sm">A nota fiscal sai direto do MUSUBI pelo padrão nacional da Receita, com o certificado digital da clínica. Para isso, entre na sua conta: o certificado e as notas ficam guardados no servidor.</p>
    <div class="cf-acoes"><button class="btn pri" data-act="conta-entrar">${ic('sair')}Entrar na sua conta</button></div></div>`;
  buscarCertificado(); const ibge = ibgeDaClinica();
  const N = nf.rasc || configNota(db), C = configDe(db).clinica, K = nf.cert, vencido = K && new Date(K.validade) <= new Date();
  const dias = K ? Math.ceil((new Date(K.validade) - Date.now()) / 864e5) : 0;
  const outro = !CODIGOS_SERVICO.some(c => c[0] === N.codigo);
  const falta = K === undefined || ibge === null ? [] : faltaParaNota(C, N, K, ibge);
  const certCard = `<div class="card" id="nf-cert"><div class="card-h"><h2>Certificado digital A1<small>o mesmo usado no e-CNPJ ou e-CPF da clínica</small></h2>${K ? `<span class="pill ${vencido ? 'crit' : dias <= 30 ? 'warn' : 'ok'}">${vencido ? 'vencido' : dias <= 30 ? `vence em ${dias} dia${dias === 1 ? '' : 's'}` : 'válido'}</span>` : ''}</div>
    ${K === undefined ? `<p class="muted sm">${ic('carregando')} Conferindo o certificado no servidor…</p>`
    : K ? `<div class="list"><div class="row"><span class="tico sm acc">${ic('escudo')}</span><div class="grow"><b>${esc(K.titular)}</b><small class="muted">${docTxt(K.documento)} · válido até ${dataBr(K.validade)}${K.enviadoEm ? ' · enviado em ' + dataBr(K.enviadoEm) : ''}</small></div></div></div>` : `<p class="muted sm">${nf.erroServ ? esc(nf.erroServ) : 'Nenhum certificado enviado ainda.'}</p>`}
    <form id="nf-f-cert" class="form" novalidate style="margin-top:12px">
      <label class="field full"><span class="lbl">${K ? 'Trocar pelo arquivo novo' : 'Arquivo do certificado'} (.pfx ou .p12)</span><input type="file" id="nf-arq" accept=".pfx,.p12,application/x-pkcs12"></label>
      <label class="field full"><span class="lbl">Senha do certificado</span><input type="password" id="nf-senha" autocomplete="off"></label>
      <p class="erro-c full" id="nf-cert-erro" hidden></p>
      <div class="cf-acoes full"><button class="btn pri" type="submit" ${nf.ocupado ? 'disabled' : ''}>${ic('escudo')}${nf.ocupado ? 'Enviando…' : 'Enviar certificado'}</button>
        ${K ? (nf.tirar ? `<button type="button" class="btn" data-nf="tirar-ok">Tirar mesmo</button><button type="button" class="btn ghost" data-nf="tirar-n">Manter</button>` : `<button type="button" class="btn ghost" data-nf="tirar">Tirar certificado</button>`) : ''}</div></form>
    <p class="muted sm cf-obs">O arquivo vai cifrado para o servidor e fica trancado lá; ninguém da equipe consegue baixá-lo. A senha serve só para abrir o arquivo agora e não é guardada.</p></div>`;
  const pctCampo = (k, l) => `<label class="field"><span class="lbl">${l}</span><input name="${k}" inputmode="decimal" value="${esc(String(N[k]).replace('.', ','))}" placeholder="0,00"></label>`;
  return `<div class="grid cf-g">${certCard}
    <form class="card" id="nf-f-dados" novalidate><div class="card-h"><h2>Dados da nota<small>confira com o seu contador</small></h2></div>
      ${N.ambiente === 'homologacao' ? `<p class="aviso-ip" id="nf-homolog">${ic('info')}<span>Em <b>homologação</b> as notas são de teste e não valem como nota fiscal. Emita algumas para conferir e depois troque para <b>produção</b>.</span></p>` : ''}
      <div class="form">
        <fieldset class="field full nf-amb"><legend class="lbl">Ambiente</legend><div class="chips">${Object.entries(AMBIENTES).map(([k, l]) => `<label class="chip ${N.ambiente === k ? 'on' : ''}"><input type="radio" name="ambiente" value="${k}" data-nf="campo" ${N.ambiente === k ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
        <label class="field"><span class="lbl">CNPJ ou CPF da clínica</span><input name="doc" inputmode="numeric" value="${esc(docTxt(N.doc ?? C.doc))}" placeholder="00.000.000/0000-00"></label>
        <label class="field"><span class="lbl">Inscrição municipal</span><input name="im" value="${esc(N.im || '')}" placeholder="a da prefeitura"></label>
        <label class="field"><span class="lbl">Regime tributário</span><select name="regime" data-nf="campo"><option value="">Escolha</option>${REGIMES_NOTA.map(([k, l]) => `<option value="${k}" ${N.regime === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field full"><span class="lbl">Serviço (código nacional)</span><select name="codigoSel" data-nf="campo">${CODIGOS_SERVICO.map(([k, l]) => `<option value="${k}" ${N.codigo === k ? 'selected' : ''}>${codigoTxt(k)} · ${l}</option>`).join('')}<option value="outro" ${outro ? 'selected' : ''}>Outro código</option></select></label>
        ${outro ? `<label class="field"><span class="lbl">Código do serviço</span><input name="codigo" inputmode="numeric" value="${esc(codigoTxt(N.codigo))}" placeholder="00.00.00"></label>` : ''}
        ${K && ibge ? `<div class="field full nf-cod"><button type="button" class="btn ghost sm" data-nf="conferir-codigo" ${nf.codBusca ? 'disabled' : ''}>${ic('busca')}${nf.codBusca ? 'Consultando a prefeitura…' : 'Conferir o código na prefeitura'}</button>${resultadoCodigo(N, C)}</div>` : ''}
        ${N.regime === '3' ? pctCampo('pTotTribSN', 'Tributos aproximados do Simples (%)') : ''}
        ${N.regime === '1' ? pctCampo('fed', 'Tributos federais (%)') + pctCampo('est', 'Tributos estaduais (%)') + pctCampo('mun', 'Tributos municipais (%)') : ''}
      </div>
      <details class="cf-mais" ${N.aliquota || N.proximo || N.serie !== '1' ? 'open' : ''}><summary>Mais (opcional)</summary><div class="form">
        ${N.regime === '3' ? `<label class="field"><span class="lbl">Alíquota do ISS (%)</span><input name="aliquota" inputmode="decimal" value="${esc(String(N.aliquota).replace('.', ','))}" placeholder="a da prefeitura"></label>` : ''}
        <label class="field"><span class="lbl">Complemento da prefeitura</span><input name="codigoMun" inputmode="numeric" value="${esc(N.codigoMun || '')}" placeholder="000"></label>
        <label class="field"><span class="lbl">Série</span><input name="serie" inputmode="numeric" value="${esc(N.serie)}"></label>
        <label class="field"><span class="lbl">Número inicial da DPS</span><input name="proximo" inputmode="numeric" value="${esc(N.proximo)}" placeholder="1"></label>
        <small class="muted full">Preencha o número inicial só se a clínica já emitiu notas por outro sistema com a mesma série.</small></div></details>
      <p class="muted sm cf-obs">Cidade da nota: <b>${esc(C.cidade)} - ${esc(C.uf)}</b>${ibge ? ` (IBGE ${ibge})` : ibge === '' ? ' · <span class="erro-a" style="display:inline">não encontrada no IBGE; confira em Dados da clínica</span>' : ''}.</p>
      <p class="erro-c" id="nf-dados-erro" hidden></p>
      <div class="cf-acoes"><button class="btn pri" type="submit">${ic('check')}Salvar</button></div>
      ${falta.length ? `<p class="muted sm cf-obs" id="nf-falta">Para emitir, falta ${falta.join(', ')}.</p>` : K ? `<p class="cf-obs nf-pronto" id="nf-pronto">${ic('okc')} Pronto para emitir em ${N.ambiente === 'producao' ? 'produção' : 'homologação'}. Use <b>Emitir nota</b> nos recebimentos do Financeiro.</p>` : ''}
      ${nf.uso ? `<p class="muted sm cf-obs" id="nf-uso">Notas fiscais de produção neste mês: <b>${nf.uso.usadas} de ${nf.uso.limite}</b> (pacote ${esc(planoDe(nf.uso.plano).nome)}). As de homologação não contam.</p>` : ''}</form></div>`;
}

// Resposta da consulta à prefeitura (convênio e código do serviço).
function resultadoCodigo(N, C){
  const R = nf.codRes; if (!R) return '';
  if (R.erro) return `<p class="erro-a" id="nf-cod-res">${esc(R.erro)}</p>`;
  const amb = R.ambiente === 'producao' ? 'produção' : 'homologação', cid = `${esc(C.cidade)}`;
  if (!R.convenio?.ativo) return `<p class="erro-a" id="nf-cod-res">A prefeitura de ${cid} não aparece ativa no sistema nacional em ${amb}${R.convenio?.mensagem ? ` (${esc(R.convenio.mensagem)})` : ''}. Enquanto ela não ativar, a nota não sai pelo padrão nacional.</p>`;
  if (!R.achados?.length) return `<p class="erro-a" id="nf-cod-res">A prefeitura de ${cid} não tem o código ${codigoTxt(R.codigo)} cadastrado em ${amb}. Confira com o seu contador ou com a prefeitura qual código ela usa para este serviço.</p>`;
  const A = R.achados[0], usar = A.complemento !== '000' && (N.codigoMun || '000') !== A.complemento;
  return `<p class="nf-pronto" id="nf-cod-res">${ic('okc')} A prefeitura de ${cid} aceita o código <b>${esc(A.codigo)}</b>${A.aliquota != null ? ` (ISS ${String(A.aliquota).replace('.', ',')}%)` : ''} em ${amb}.${usar ? ` A nota precisa levar o complemento <b>${esc(A.complemento)}</b>.` : ''}</p>
    ${usar ? `<button type="button" class="btn sm" data-nf="usar-comp" data-c="${esc(A.complemento)}">${ic('check')}Usar o complemento ${esc(A.complemento)}</button>` : ''}`;
}
async function conferirCodigo(){
  const N = nf.rasc || configNota(db), ibge = ibgeDaClinica(); if (!ibge || nf.codBusca) return;
  nf.codBusca = true; nf.codRes = null; app.render(true);
  const r = await nfseConta('conferir_codigo', { ambiente:N.ambiente, municipio:ibge, codigo:N.codigo });
  nf.codBusca = false; nf.codRes = { ...r, codigo:N.codigo }; app.render(true);
}

/* ---------- Financeiro ---------- */
export const notaLigada = () => cobrancaLigada();
// Botões da nota em cada recebimento.
export function botaoNota(r){
  if (!notaLigada()) return '';
  const n = notaDe(db, r.id);
  if (n?.situacao === 'emitida') return `<span class="pill ok sm nf-n">NFS-e ${esc(n.numero)}${n.ambiente === 'homologacao' ? ' · teste' : ''}</span><button class="btn sm ghost" data-nf="imprimir" data-r="${r.id}" aria-label="Imprimir a nota" data-tip="Imprimir a nota">${ic('baixar')}</button>`;
  if (n?.situacao === 'enviando') return `<button class="btn sm" data-nf="conferir" data-r="${r.id}" ${nf.ocupado ? 'disabled' : ''}>${ic('historico')}Conferir nota</button>`;
  return `<button class="btn sm" data-nf="abrir" data-r="${r.id}">${ic('recibo')}Emitir nota</button>`;
}
export function cartaoNota(){
  if (!notaLigada()) return `<div class="card" id="f-nota"><h2>Nota fiscal</h2><p class="muted sm">Com a conta no servidor, a nota fiscal de serviço (NFS-e) sai direto do MUSUBI pelo padrão nacional. Sem conta, em cada recebimento o botão <b>Dados da nota</b> copia paciente, CPF, serviço, valor e data, prontos para colar no emissor.</p></div>`;
  buscarCertificado();
  const N = configNota(db), K = nf.cert, M = (db.financeiro?.notas || []).filter(n => n.situacao === 'emitida');
  const mes = new Date().toISOString().slice(0, 7), doMes = M.filter(n => String(n.emitidaEm || n.em).slice(0, 7) === mes && n.ambiente === N.ambiente);
  return `<div class="card" id="f-nota"><div class="card-h"><h2>Nota fiscal<small>padrão nacional, com o certificado da clínica</small></h2><span class="pill ${N.ambiente === 'producao' ? 'ok' : 'warn'}">${N.ambiente === 'producao' ? 'produção' : 'homologação'}</span></div>
    ${K === undefined ? '<p class="muted sm">Conferindo…</p>' : !K || !N.regime ? `<p class="muted sm">Antes da primeira nota, ${souAdm() ? 'envie o certificado digital A1 e preencha os dados fiscais' : 'o administrador precisa enviar o certificado digital A1 e preencher os dados fiscais'}.</p>`
      : `<p class="muted sm">${doMes.length} nota${doMes.length === 1 ? '' : 's'} emitida${doMes.length === 1 ? '' : 's'} neste mês${N.ambiente === 'homologacao' ? ' (teste)' : ''}. Use <b>Emitir nota</b> em cada recebimento.</p>`}
    ${souAdm() ? `<a class="btn sm" href="#configuracoes" data-cf="ir" data-k="nota" style="margin-top:8px">${ic('editar')}Configurar a nota fiscal</a>` : ''}</div>`;
}

// Janela de conferência antes de emitir.
export function janelaNota(){
  const r = nf.janela && db.financeiro?.recebimentos.find(x => x.id === nf.janela.rec); if (!r) { nf.janela = null; return ''; }
  buscarCertificado();
  const a = db.appts.find(x => x.id === r.ap), p = a && patient(a.pid), J = nf.janela, N = configNota(db), C = configDe(db).clinica, ibge = ibgeDaClinica();
  const cpf = cpfDe(p), temCpf = cpfConfere(cpf);
  const falta = nf.cert === undefined || ibge === null ? null : faltaParaNota(C, N, nf.cert, ibge);
  return `<div class="modal-fundo" id="nf-fundo" data-nf="fechar"><form class="modal" id="f-nfse" role="dialog" aria-modal="true" aria-labelledby="nf-t" data-r="${r.id}" novalidate>
    <div class="modal-h"><div class="grow"><h2 id="nf-t">Emitir nota fiscal</h2><small class="muted">${esc(p?.name || r.nome || '')} · ${brl(r.valor)} · recebido em ${fmt(r.data)}</small></div><button type="button" class="btn ghost sm" data-nf="fechar" aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-c">
      ${N.ambiente === 'homologacao' ? `<p class="aviso-ip">${ic('info')}<span>Ambiente de <b>homologação</b>: a nota é de teste e não vale como nota fiscal.</span></p>` : ''}
      ${falta === null ? `<p class="muted sm">${ic('carregando')} Conferindo os dados da nota…</p>` : falta.length ? `<div class="notice" id="nf-falta-j">${ic('alerta')}<div>Antes de emitir, falta ${esc(falta.join(', '))}. ${souAdm() ? `<a href="#configuracoes" data-cf="ir" data-k="nota">Abrir Configurações > Nota fiscal</a>` : 'Peça ao administrador da clínica.'}</div></div>` : ''}
      <div class="nf-linhas"><div><span class="lbl">Paciente (tomador)</span><b>${esc(p?.name || r.nome || '')}</b></div><div><span class="lbl">Valor</span><b>${brl(r.valor)}</b></div>
        <div><span class="lbl">Data do atendimento</span><b>${fmt(a?.date || r.data)}</b></div><div><span class="lbl">Serviço</span><b>${codigoTxt(N.codigo)}${nomeCodigo(N.codigo) ? ' · ' + esc(nomeCodigo(N.codigo)) : ''}</b></div></div>
      ${temCpf ? `<label class="ck"><input type="checkbox" id="nf-cpf" ${J.comCpf !== false ? 'checked' : ''}> Identificar o paciente com o CPF ${docTxt(cpf)}</label>`
        : `<p class="muted sm">${cpf ? 'O CPF do cadastro do paciente está incorreto' : 'O paciente não tem CPF no cadastro'}: a nota sai sem identificar o paciente. Para incluir, corrija o cadastro antes.</p>`}
      <label class="rx-f full"><span class="lbl">Descrição do serviço (sai na nota)</span><textarea id="nf-desc" rows="2" maxlength="1000">${esc(J.descricao ?? descricaoNota(a?.tipo || r.tipo, a?.date || r.data))}</textarea></label>
      <p class="erro-a" id="nf-erro" role="alert" ${nf.erro ? '' : 'hidden'}>${esc(nf.erro)}</p>
    </div>
    <div class="modal-p"><button type="button" class="btn ghost" data-nf="fechar">Cancelar</button><button class="btn pri" ${nf.ocupado || !falta || falta.length ? 'disabled' : ''}>${ic('recibo')}${nf.ocupado ? 'Emitindo…' : 'Emitir nota'}</button></div>
  </form></div>`;
}

// Folha da nota para imprimir (resumo da NFS-e; a oficial fica na consulta pública pela chave de acesso).
function folhaNota(n){
  const C = configDe(db).clinica, N = configNota(db);
  return `<div class="folha nf-folha"><h1>Nota Fiscal de Serviço Eletrônica (NFS-e)</h1>
    ${n.ambiente === 'homologacao' ? '<p class="nf-teste"><b>SEM VALOR FISCAL</b> · emitida em homologação (teste)</p>' : ''}
    <table><tr><th>Número</th><td>${esc(n.numero)}</td><th>Emitida em</th><td>${n.emitidaEm ? new Date(n.emitidaEm).toLocaleString('pt-BR') : ''}</td></tr>
      <tr><th>Chave de acesso</th><td colspan="3" class="mono">${esc(n.chave)}</td></tr>
      <tr><th>Prestador</th><td colspan="3">${esc(C.nome)} · ${docTxt(C.doc)} · ${esc(C.cidade)} - ${esc(C.uf)}</td></tr>
      <tr><th>Tomador</th><td colspan="3">${esc(n.tomador || 'não identificado')}${n.cpf ? ' · CPF ' + docTxt(n.cpf) : ''}</td></tr>
      <tr><th>Serviço</th><td colspan="3">${codigoTxt(n.codigo || N.codigo)}${nomeCodigo(n.codigo || N.codigo) ? ' · ' + esc(nomeCodigo(n.codigo || N.codigo)) : ''}<br>${esc(n.descricao || '')}</td></tr>
      <tr><th>Data do serviço</th><td>${n.data ? fmt(n.data) : ''}</td><th>Valor</th><td><b>${brl(n.valor)}</b></td></tr></table>
    <p class="nf-cons">Consulte a nota oficial em nfse.gov.br/consultapublica com a chave de acesso acima.</p></div>`;
}

/* ---------- Eventos ---------- */
const erroEm = (id, m) => { const e = document.getElementById(id); if (e) { e.textContent = m; e.hidden = !m; } return !!m; };
const lerArquivo = f => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => falha(r.error); r.readAsDataURL(f); });
const campos = f => { const D = {}; for (const el of f.elements) if (el.name && (el.type !== 'radio' || el.checked)) D[el.name] = el.value; if (D.codigoSel && D.codigoSel !== 'outro') D.codigo = D.codigoSel; delete D.codigoSel; return D; };

async function enviarCertificado(){
  const arq = document.getElementById('nf-arq')?.files?.[0], senha = document.getElementById('nf-senha')?.value || '';
  if (!arq) { erroEm('nf-cert-erro', 'Escolha o arquivo do certificado (.pfx ou .p12).'); return; }
  if (arq.size > 30000) { erroEm('nf-cert-erro', 'Este arquivo é grande demais para um certificado A1. Confira se é o .pfx do certificado.'); return; }
  if (!senha) { erroEm('nf-cert-erro', 'Digite a senha do certificado.'); return; }
  nf.ocupado = true; app.render(true);
  const r = await nfseConta('certificado', { pfx:await lerArquivo(arq), senha });
  nf.ocupado = false;
  if (r.erro) { app.render(true); erroEm('nf-cert-erro', r.erro); return; }
  nf.cert = r.certificado; app.render(true); app.toast('Certificado guardado com segurança no servidor');
}
async function emitir(f){
  const r = db.financeiro?.recebimentos.find(x => x.id === f.dataset.r); if (!r || nf.ocupado) return;
  const a = db.appts.find(x => x.id === r.ap), p = a && patient(a.pid), N = configNota(db), C = configDe(db).clinica;
  const descricao = document.getElementById('nf-desc').value.trim(), comCpf = document.getElementById('nf-cpf')?.checked ?? false;
  nf.janela = { ...nf.janela, descricao, comCpf };
  if (!descricao) { nf.erro = 'Escreva a descrição do serviço.'; app.render(true); return; }
  const P = pedidoNota({ clinica:C, nota:N, ibge:ibgeDaClinica(), valor:r.valor, data:a?.date || r.data, descricao, paciente:p || { name:r.nome || '' }, comCpf });
  nf.ocupado = true; nf.erro = ''; app.render(true);
  const res = await nfseConta('emitir', { ...P, referencia:r.id });
  nf.ocupado = false;
  const base = { rec:r.id, valor:r.valor, tomador:P.nota.tomador ? p.name : '', cpf:P.nota.tomador?.doc || '', descricao, data:P.nota.dCompet, codigo:N.codigo, em:new Date().toISOString(), por:PROF.nome };
  if (res.situacao === 'emitida') {
    guardarNota(db, { ...base, id:res.id, situacao:'emitida', numero:res.numero, chave:res.chave, ndps:res.ndps, serie:res.serie, ambiente:res.ambiente, emitidaEm:res.emitidaEm, consulta:res.consulta });
    nf.janela = null; app.save(); app.render(true); app.toast(`Nota ${res.numero} emitida${res.ambiente === 'homologacao' ? ' (teste)' : ''}`); return;
  }
  if (res.situacao === 'enviando' && res.id) {
    guardarNota(db, { ...base, id:res.id, situacao:'enviando', ambiente:N.ambiente });
    nf.janela = null; app.save(); app.render(true); app.toast(res.erro, 'info'); return;
  }
  nf.erro = res.erro || 'Não deu certo agora. Tente de novo.'; app.render(true);
}
async function conferir(recId){
  const n = notaDe(db, recId); if (!n || nf.ocupado) return;
  nf.ocupado = true; app.render(true);
  const res = await nfseConta('conferir', { id:n.id }); nf.ocupado = false;
  if (res.situacao === 'emitida') { guardarNota(db, { id:n.id, situacao:'emitida', numero:res.numero, chave:res.chave, ndps:res.ndps, serie:res.serie, emitidaEm:res.emitidaEm, consulta:res.consulta }); app.save(); app.render(true); app.toast(`Nota ${res.numero} emitida`); return; }
  if (res.situacao === 'rejeitada') { guardarNota(db, { id:n.id, situacao:'rejeitada', msg:res.msg || '' }); app.save(); app.render(true); app.toast(res.msg || 'A nota não saiu. Pode emitir de novo.', 'info'); return; }
  app.render(true); app.toast(res.erro || 'A Receita ainda não respondeu. Tente de novo em instantes.', 'info');
}

// Liga os eventos (s, r, t = save, render e toast do sistema).
export function ligarNfse(s, r, t){
  app = { save:s, render:r, toast:t };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-nf]'); if (!b || b.matches('input, select')) return; const a = b.dataset.nf;
    if (a === 'fechar') { if (b.id === 'nf-fundo' && ev.target !== b) return; nf.janela = null; nf.erro = ''; app.render(true); }
    else if (a === 'abrir') { nf.janela = { rec:b.dataset.r }; nf.erro = ''; app.render(true); setTimeout(() => document.getElementById('nf-desc')?.focus(), 0); }
    else if (a === 'conferir') conferir(b.dataset.r);
    else if (a === 'imprimir') { const n = notaDe(db, b.dataset.r); if (!n) return; document.getElementById('imp').innerHTML = folhaNota(n); window.print(); }
    else if (a === 'tirar') { nf.tirar = true; app.render(true); }
    else if (a === 'conferir-codigo') conferirCodigo();
    else if (a === 'usar-comp') { const e = salvarConfigNota(db, { codigoMun:b.dataset.c }); if (e) { t(e, 'info'); return; } if (nf.rasc) nf.rasc.codigoMun = b.dataset.c; app.save(); app.render(true); t('Complemento da prefeitura salvo', 'ok'); }
    else if (a === 'tirar-n') { nf.tirar = false; app.render(true); }
    else if (a === 'tirar-ok') { nf.tirar = false; nf.ocupado = true; app.render(true);
      nfseConta('tirar_certificado').then(res => { nf.ocupado = false; if (!res.erro) nf.cert = null; app.render(true); t(res.erro || 'Certificado tirado do servidor', res.erro ? 'info' : 'ok'); }); }
  });
  document.addEventListener('change', ev => {
    if (ev.target.dataset?.nf !== 'campo') return;
    const f = ev.target.form; if (!f) return;
    const D = campos(f), N = { ...configNota(db), ...(nf.rasc || {}), ...D };
    if (D.codigo === undefined && ev.target.name === 'codigoSel' && ev.target.value === 'outro') N.codigo = '';
    nf.rasc = N; app.render(true);
  });
  document.addEventListener('submit', async ev => {
    const f = ev.target;
    if (f.id === 'nf-f-cert') { ev.preventDefault(); if (!nf.ocupado) enviarCertificado(); return; }
    if (f.id === 'f-nfse') { ev.preventDefault(); emitir(f); return; }
    if (f.id !== 'nf-f-dados') return;
    ev.preventDefault();
    const D = campos(f), doc = String(D.doc || '').replace(/\D/g, ''); delete D.doc;
    if (doc && doc.length !== 11 && doc.length !== 14) { erroEm('nf-dados-erro', 'O CNPJ tem 14 números e o CPF tem 11.'); return; }
    const e = salvarConfigNota(db, D); if (erroEm('nf-dados-erro', e)) return;
    (db.config ||= {}).clinica = { ...configDe(db).clinica, doc };
    nf.rasc = null; app.save(); app.render(true); app.toast('Dados da nota fiscal salvos');
  });
  addEventListener('hashchange', () => { nf.codRes = null; nf.janela = null; nf.erro = ''; nf.rasc = null; nf.tirar = false; });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && nf.janela) { nf.janela = null; nf.erro = ''; app.render(true); } });
}
export const notaAberta = () => !!nf.janela;
