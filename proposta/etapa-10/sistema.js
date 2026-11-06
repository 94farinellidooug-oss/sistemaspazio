// Proposta navegável da etapa 10 (contas no servidor Supabase): primeiro acesso da clínica levando os dados
// que já estão no aparelho, equipe com três perfis prontos, configurações (clínica, serviços, horário,
// conta e segurança), troca de clínica no topo e a lista de interessados da página de apresentação.
// Dados fictícios, só na memória da página; nada é enviado.
import { LOGO, ic } from '../../js/componentes/icones.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const ini = n => n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();

// Perfis prontos: [chave, nome, resumo]
const PERFIS = [['adm', 'Administrador', 'Tudo, inclusive equipe, configurações e o financeiro completo.'],
  ['prof', 'Profissional', 'Agenda, pacientes, atendimentos, documentos e recebimentos.'],
  ['rec', 'Recepção', 'Agenda, cadastro e recebimentos. Não abre o prontuário.']];
// [o que, adm, prof, rec]
const PERM = [['Agenda', 1, 1, 1], ['Cadastro de pacientes', 1, 1, 1], ['Prontuário e atendimentos', 1, 1, 0], ['Documentos e assinatura', 1, 1, 0],
  ['Receber pagamentos', 1, 1, 1], ['Despesas e resumo do mês', 1, 0, 0], ['Relatórios', 1, 0, 0], ['Equipe e configurações', 1, 0, 0]];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const SITU = [['novo', 'Novo', 'acc'], ['chamei', 'Já chamei', 'warn'], ['cliente', 'Virou cliente', 'ok'], ['nao', 'Não quis', '']];

const S = {
  aberto:false, conta:false, pa:{}, perm:PERM.map(r => r.slice(1)), aba:'clinica', convite:false, filtro:'todos', passo:1, levar:true,
  clinica:'spazio',
  clinicas:[{ id:'spazio', nome:'Spazio Stabilità', perfil:'adm' }, { id:'equilibrio', nome:'Clínica Equilíbrio', perfil:'prof' }],
  dados:{ nome:'Spazio Stabilità', cidade:'Caxias do Sul', uf:'RS', whats:'(54) 99999-0000', end:'', doc:'' },
  equipe:[
    { id:'u1', nome:'Maicon Farinelli', email:'maicon@spaziostabilita.com.br', perfil:'adm', esp:'Biomédico acupunturista', st:'ativo', voce:true },
    { id:'u2', nome:'Ana Ribeiro', email:'ana.ribeiro@email.com', perfil:'prof', esp:'Fisioterapeuta', st:'ativo' },
    { id:'u3', nome:'Júlia Martins', email:'julia.martins@email.com', perfil:'rec', esp:'', st:'convite' }
  ],
  serv:[['Acupuntura', 60, 180, true], ['Acupuntura e moxabustão', 60, 200, true], ['Auriculoterapia', 30, 90, true], ['Ventosaterapia', 45, 150, true], ['Massoterapia', 60, 160, false]]
    .map(([nome, dur, valor, ativo], i) => ({ id:'s' + i, nome, dur, valor, ativo })),
  hor:DIAS.map((d, i) => ({ d, aberto:i < 5 || i === 5, ini:'08:00', fim:i === 5 ? '12:00' : '19:00' })),
  pausa:{ tem:true, ini:'12:00', fim:'13:00' },
  inter:[
    { id:'i1', nome:'Carla Mendes', whats:'(51) 98888-1234', em:'06/11/2026 09:14', st:'novo' },
    { id:'i2', nome:'Rodrigo Alves', whats:'(11) 97777-4321', em:'05/11/2026 18:40', st:'novo' },
    { id:'i3', nome:'Patrícia Lima', whats:'(48) 96666-5555', em:'04/11/2026 11:02', st:'chamei' },
    { id:'i4', nome:'Fernanda Costa', whats:'(54) 95555-2020', em:'01/11/2026 16:25', st:'cliente' }
  ]
};
const nId = (() => { let n = 10; return p => p + (++n); })();
const clin = () => S.clinicas.find(c => c.id === S.clinica);
const eu = () => S.equipe.find(u => u.voce);
const mudouPerm = () => S.perm.some((r, i) => r.some((x, j) => x !== PERM[i][j + 1]));
const perfilDe = k => PERFIS.find(p => p[0] === k);

/* ---------- Administração ---------- */
function vAdmin(){
  const adm = clin().perfil === 'adm', novos = S.inter.filter(i => i.st === 'novo').length;
  const C = [['equipe', 'pacientes', 'Equipe e permissões', 'Quem usa o sistema nesta clínica e o que cada um pode abrir.', adm],
    ['configuracoes', 'admin', 'Configurações', 'Dados da clínica, serviços e preços, horário de atendimento, sua conta e segurança.', true],
    ['interessados', 'sino', 'Interessados no MUSUBI', 'Quem pediu para conhecer na página de apresentação. Só aparece para a conta dona do MUSUBI.', adm && S.clinica === 'spazio', novos],
    ['crm', 'tel', 'Relacionamento', 'Pacientes para retomar e aniversários (já existe).', true],
    ['mensagens', 'mensagem', 'Modelos de mensagens', 'Textos do WhatsApp (já existe).', true]];
  return cab('admin', 'Administração', 'Equipe, configurações e relacionamento') + `<div class="adm">${C.filter(c => c[4]).map(([k, i, t, d, , n]) =>
    `<a class="adm-c" href="#/${k}" data-c="${k}" ${['crm', 'mensagens'].includes(k) ? 'data-a="fora"' : ''}><span class="tico acc">${ic(i)}</span><span class="grow"><b>${t}</b><small>${d}</small></span>${n ? `<span class="pill acc">${n} novo${n > 1 ? 's' : ''}</span>` : ''}</a>`).join('')}</div>
    ${adm ? '' : `<div class="notice p10-n">${ic('info')}<span>Em ${esc(clin().nome)} você entra como <b>Profissional</b>. Equipe e permissões ficam com o administrador da clínica.</span></div>`}`;
}

/* ---------- Equipe ---------- */
function vEquipe(){
  const L = S.equipe;
  return cab('pacientes', 'Equipe e permissões', `${L.length} pessoas em ${esc(clin().nome)}`, `<button class="btn pri" data-a="convidar">${ic('mais')}Convidar pessoa</button>`) +
  `<div class="grid p10-g">
    <div class="card" id="eq-l"><div class="card-h"><h2>Quem usa o sistema<small>cada pessoa entra com o próprio e-mail e senha</small></h2></div>
      ${S.convite ? `<form class="p10-conv" id="f-conv" novalidate><div class="form">
        <label class="field"><span class="lbl">Nome</span><input name="nome" required autocomplete="off"></label>
        <label class="field"><span class="lbl">E-mail</span><input name="email" type="email" required autocomplete="off"></label>
        <label class="field"><span class="lbl">Perfil</span><select name="perfil">${PERFIS.map(([k, n]) => `<option value="${k}" ${k === 'prof' ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <p class="erro-c" id="conv-erro" hidden></p>
        <div class="p10-acoes"><button class="btn pri" type="submit">${ic('mail')}Enviar convite</button><button class="btn ghost" type="button" data-a="conv-fechar">Cancelar</button></div>
        <small class="muted">A pessoa recebe um e-mail para criar a senha. O convite vale por 7 dias.</small></form>` : ''}
      <div class="list">${L.map(u => `<div class="row p10-u" data-u="${u.id}"><span class="avatar">${ini(u.nome)}</span>
        <div class="grow"><b>${esc(u.nome)}${u.voce ? ' <span class="muted sm">(você)</span>' : ''}</b><small class="muted trunc">${esc(u.email)}${u.esp ? ' · ' + esc(u.esp) : ''}</small></div>
        <div class="p10-ctl">${u.st === 'convite' ? `<span class="pill warn">convite enviado</span><button class="btn sm ghost" data-a="reenviar" data-u="${u.id}">Reenviar</button>` : u.st === 'off' ? '<span class="pill">sem acesso</span>' : ''}
        <label class="p10-perfil"><span class="sr">Perfil de ${esc(u.nome)}</span><select data-a="perfil" data-u="${u.id}" ${u.voce ? 'disabled title="Você é o administrador desta clínica"' : ''}>${PERFIS.map(([k, n]) => `<option value="${k}" ${u.perfil === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${u.voce ? '' : `<button class="btn sm ghost" data-a="${u.st === 'off' ? 'reativar' : 'tirar'}" data-u="${u.id}">${u.st === 'off' ? 'Devolver acesso' : 'Tirar acesso'}</button>`}</div></div>`).join('')}</div>
      <p class="muted sm p10-obs">Tirar o acesso não apaga nada: os atendimentos e registros continuam com o nome de quem fez.</p></div>
    <div class="card" id="eq-p"><div class="card-h"><h2>O que cada perfil abre<small>começa no padrão; marque o que cada perfil abre nesta clínica</small></h2>${mudouPerm() ? `<button class="btn sm" data-a="perm-padrao">${ic('retorno')}Voltar ao padrão</button>` : ''}</div>
      <div class="p10-tab" role="table" aria-label="Permissões por perfil"><div class="p10-tr p10-th" role="row"><span role="columnheader"></span>${PERFIS.map(([, n]) => `<span role="columnheader"><span class="p10-lg">${n}</span><span class="p10-ct" aria-hidden="true">${{ Administrador:'Admin.', Profissional:'Prof.', 'Recepção':'Recep.' }[n]}</span></span>`).join('')}</div>
      ${PERM.map(([o], r) => `<div class="p10-tr" role="row"><span role="rowheader">${o}</span>${S.perm[r].map((x, i) => i === 0
        ? `<span role="cell" class="sim fixo" title="O administrador sempre abre tudo" aria-label="Administrador: sempre">${ic('check')}</span>`
        : `<span role="cell"><label class="p10-ck ${x ? 'sim' : 'nao'}"><input type="checkbox" data-a="perm" data-r="${r}" data-i="${i}" ${x ? 'checked' : ''} aria-label="${PERFIS[i][1]} abre ${o}">${ic(x ? 'check' : 'x')}</label></span>`).join('')}</div>`).join('')}</div>
      <p class="muted sm p10-obs">O administrador sempre abre tudo, para a clínica nunca ficar sem quem cuide da equipe. Vale para todas as pessoas com o mesmo perfil nesta clínica.</p>
      <div class="p10-perfis"><small class="lbl">No padrão</small>${PERFIS.map(([k, n, d]) => `<p><b>${n}:</b> ${d}</p>`).join('')}</div></div>
  </div>`;
}

/* ---------- Configurações ---------- */
const ABAS = [['clinica', 'Clínica', 'local'], ['servicos', 'Serviços e preços', 'dinheiro'], ['horario', 'Horário de atendimento', 'relogio'], ['conta', 'Sua conta e segurança', 'escudo']];
function vConfig(){
  const adm = clin().perfil === 'adm', abas = adm ? ABAS : ABAS.filter(a => a[0] === 'conta');
  if (!abas.some(a => a[0] === S.aba)) S.aba = abas[0][0];
  return cab('admin', 'Configurações', esc(clin().nome)) + `<div class="tabs" role="tablist">${abas.map(([k, l, i]) => `<button role="tab" data-a="aba" data-k="${k}" class="${S.aba === k ? 'on' : ''}" aria-selected="${S.aba === k}">${ic(i)}${l}</button>`).join('')}</div>` +
    ({ clinica:cfgClinica, servicos:cfgServicos, horario:cfgHorario, conta:cfgConta })[S.aba]();
}
function cfgClinica(){
  const D = S.dados;
  return `<form class="card p10-max" id="f-clinica" novalidate><div class="card-h"><h2>Dados da clínica<small>aparecem nos documentos impressos e no cabeçalho</small></h2></div>
    <div class="form">
      <label class="field full"><span class="lbl">Nome da clínica</span><input name="nome" value="${esc(D.nome)}" required></label>
      <label class="field"><span class="lbl">Cidade</span><input name="cidade" value="${esc(D.cidade)}" required></label>
      <label class="field"><span class="lbl">Estado</span><select name="uf">${UFS.map(u => `<option ${u === D.uf ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">WhatsApp da clínica</span><input name="whats" type="tel" value="${esc(D.whats)}"></label>
    </div>
    <details class="p10-mais"><summary>Mais dados (opcional)</summary><div class="form">
      <label class="field full"><span class="lbl">Endereço</span><input name="end" value="${esc(D.end)}" placeholder="Rua, número, bairro"></label>
      <label class="field"><span class="lbl">CNPJ ou CPF</span><input name="doc" value="${esc(D.doc)}" inputmode="numeric" placeholder="Usado na nota fiscal, mais tarde"></label></div></details>
    <p class="muted sm">A cidade e o estado definem a estação do ano nas dicas do plano e, mais tarde, a prefeitura da nota fiscal.</p>
    <p class="erro-c" id="cl-erro" hidden></p>
    <div class="p10-acoes"><button class="btn pri" type="submit">${ic('check')}Salvar</button></div></form>`;
}
function cfgServicos(){
  return `<div class="card p10-max" id="cfg-serv"><div class="card-h"><h2>Serviços e preços<small>aparecem na Agenda, no Financeiro e nos Relatórios</small></h2></div>
    <div class="p10-serv"><div class="p10-s p10-sh" aria-hidden="true"><span>Serviço</span><span>Duração</span><span>Valor (R$)</span><span></span></div>${S.serv.map(s => `<div class="p10-s ${s.ativo ? '' : 'off'}" data-s="${s.id}">
      <label class="field p10-sn"><span class="lbl">Serviço</span><input data-a="serv-campo" data-k="nome" data-s="${s.id}" value="${esc(s.nome)}"></label>
      <label class="field p10-sd"><span class="lbl">Duração</span><select data-a="serv-campo" data-k="dur" data-s="${s.id}">${[30, 45, 60, 90, 120].map(m => `<option value="${m}" ${s.dur === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
      <label class="field p10-sv"><span class="lbl">Valor (R$)</span><input data-a="serv-campo" data-k="valor" data-s="${s.id}" inputmode="decimal" value="${String(s.valor).replace('.', ',')}"></label>
      <label class="p10-sw"><input type="checkbox" data-a="serv-ativo" data-s="${s.id}" ${s.ativo ? 'checked' : ''}> Em uso</label></div>`).join('')}</div>
    <div class="p10-acoes"><button class="btn" data-a="serv-novo">${ic('mais')}Novo serviço</button></div>
    <p class="muted sm">Serviço fora de uso some da Agenda, mas continua nos atendimentos que já foram feitos. Mudar o preço não muda o que já foi combinado.</p></div>`;
}
function cfgHorario(){
  const P = S.pausa;
  return `<div class="card p10-max" id="cfg-hor"><div class="card-h"><h2>Horário de atendimento<small>a Agenda e as dicas dos Relatórios mostram os horários livres dentro dele</small></h2></div>
    <div class="p10-hor">${S.hor.map((h, i) => `<div class="p10-h ${h.aberto ? '' : 'off'}" data-d="${i}"><label class="p10-sw"><input type="checkbox" data-a="dia" data-d="${i}" ${h.aberto ? 'checked' : ''}> ${h.d}</label>
      ${h.aberto ? `<span class="p10-hh"><input type="time" data-a="hora" data-d="${i}" data-k="ini" value="${h.ini}" aria-label="${h.d}: abre"><span class="muted">às</span><input type="time" data-a="hora" data-d="${i}" data-k="fim" value="${h.fim}" aria-label="${h.d}: fecha"></span>` : '<span class="muted sm">fechado</span>'}</div>`).join('')}</div>
    <div class="p10-h p10-pausa"><label class="p10-sw"><input type="checkbox" data-a="pausa" ${P.tem ? 'checked' : ''}> Intervalo</label>
      ${P.tem ? `<span class="p10-hh"><input type="time" data-a="pausa-h" data-k="ini" value="${P.ini}" aria-label="Intervalo começa"><span class="muted">às</span><input type="time" data-a="pausa-h" data-k="fim" value="${P.fim}" aria-label="Intervalo termina"></span>` : '<span class="muted sm">sem intervalo</span>'}</div>
    <p class="muted sm" id="hor-resumo">${resumoHorario()}</p></div>`;
}
function resumoHorario(){
  const min = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const pausa = S.pausa.tem ? Math.max(0, min(S.pausa.fim) - min(S.pausa.ini)) : 0;
  const tot = S.hor.filter(h => h.aberto).reduce((n, h) => n + Math.max(0, min(h.fim) - min(h.ini) - (min(h.fim) - min(h.ini) > 300 ? pausa : 0)), 0);
  return `${S.hor.filter(h => h.aberto).length} dias abertos · ${Math.round(tot / 60)} horas de atendimento por semana`;
}
function cfgConta(){
  const u = eu();
  return `<div class="grid p10-g">
    <form class="card" id="f-conta" novalidate><div class="card-h"><h2>Sua conta<small>vale para todas as clínicas em que você atende</small></h2></div>
      <div class="form"><label class="field full"><span class="lbl">Seu nome (sai nos documentos)</span><input name="nome" value="${esc(u.nome)}"></label>
      <label class="field full"><span class="lbl">E-mail para entrar</span><input name="email" type="email" value="${esc(u.email)}"></label></div>
      <div class="p10-acoes"><button class="btn pri" type="submit">${ic('check')}Salvar</button><button class="btn" type="button" data-a="senha">${ic('escudo')}Trocar senha</button></div></form>
    <div class="card" id="seg"><div class="card-h"><h2>Segurança e dados</h2></div>
      <div class="list">
        <div class="row"><span class="tico sm acc">${ic('escudo')}</span><div class="grow"><b>Dados guardados no servidor</b><small class="muted">Cada clínica só enxerga os próprios dados. Cópia de segurança todo dia.</small></div></div>
        <div class="row"><span class="tico sm acc">${ic('historico')}</span><div class="grow"><b>Aparelhos conectados</b><small class="muted">Este computador e 1 celular</small></div><button class="btn sm" data-a="sair-todos">Sair dos outros</button></div>
        <div class="row"><span class="tico sm acc">${ic('baixar')}</span><div class="grow"><b>Baixar todos os dados</b><small class="muted">Pacientes, atendimentos e financeiro em um arquivo, quando quiser.</small></div><button class="btn sm" data-a="baixar">Baixar</button></div>
      </div></div></div>`;
}

/* ---------- Interessados ---------- */
function vInteressados(){
  const F = S.filtro, L = S.inter.filter(i => F === 'todos' || i.st === F), cont = k => S.inter.filter(i => i.st === k).length;
  return cab('sino', 'Interessados no MUSUBI', 'Quem pediu para conhecer na página de apresentação') +
  `<div class="chips p10-f" role="group" aria-label="Filtrar">${[['todos', 'Todos', S.inter.length], ...SITU.map(([k, l]) => [k, l, cont(k)])].map(([k, l, n]) => `<button class="chip ${F === k ? 'on' : ''}" data-a="filtro" data-k="${k}" aria-pressed="${F === k}">${l} <span class="muted">${n}</span></button>`).join('')}</div>
  <div class="card" id="int-l"><div class="list">${L.map(i => {
    return `<div class="row p10-i st-${i.st}" data-i="${i.id}"><span class="avatar">${ini(i.nome)}</span><div class="grow"><b>${esc(i.nome)}</b><small class="muted">${esc(i.whats)} · pediu em ${i.em}</small></div>
      <div class="p10-ctl">
      <a class="btn sm" data-a="chamar" data-i="${i.id}" href="https://wa.me/55${i.whats.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${i.nome.split(' ')[0]}! Aqui é o Maicon, do MUSUBI. Vi que você quer conhecer o sistema. Quando fica bom para eu te mostrar?`)}" target="_blank" rel="noopener">${ic('tel')}Chamar</a>
      <label class="p10-perfil p10-situ"><span class="sr">Situação de ${esc(i.nome)}</span><select data-a="situ" data-i="${i.id}">${SITU.map(([k, l]) => `<option value="${k}" ${i.st === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></div>`; }).join('') || '<p class="muted sm" style="padding:12px 6px">Ninguém nesta situação.</p>'}</div></div>
  <p class="muted sm p10-obs">Cada pedido feito na página chega aqui na hora, e você recebe um aviso no sino. "Chamar" abre o WhatsApp com a mensagem pronta.</p>`;
}

/* ---------- Primeiro acesso (tela cheia) ---------- */
function vPrimeiro(){
  const P = S.passo, passos = ['Sua conta', 'Sua clínica', 'Seus dados'];
  const corpo = P === 1 ? `<div class="form p10-1c">
      <label class="field"><span class="lbl">Seu nome</span><input name="nome" autocomplete="name" required value="${esc(S.pa.nome || '')}"></label>
      <label class="field"><span class="lbl">E-mail</span><input name="email" type="email" autocomplete="email" required value="${esc(S.pa.email || '')}"></label>
      <label class="field"><span class="lbl">Crie uma senha</span><input name="senha" type="password" autocomplete="new-password" required minlength="8"><small class="muted">Pelo menos 8 caracteres.</small></label></div>`
    : P === 2 ? `<div class="form">
      <label class="field full"><span class="lbl">Nome da clínica</span><input name="clinica" required value="${esc(S.pa.clinica || '')}"></label>
      <label class="field"><span class="lbl">Cidade</span><input name="cidade" required value="${esc(S.pa.cidade || '')}"></label>
      <label class="field"><span class="lbl">Estado</span><select name="uf">${UFS.map(u => `<option ${u === (S.pa.uf || 'RS') ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
      <p class="muted sm">Atende sozinho? Use o seu nome. O resto (serviços, horário, equipe) dá para ajustar depois em Configurações.</p>`
    : `<div class="p10-acha"><span class="tico acc">${ic('okc')}</span><div><b>Encontramos dados do MUSUBI neste navegador</b><small class="muted">12 pacientes · 48 atendimentos · 9 documentos · financeiro de novembro</small></div></div>
      <div class="p10-opc" role="radiogroup" aria-label="O que fazer com os dados">
        <label class="${S.levar ? 'on' : ''}"><input type="radio" name="levar" value="1" data-a="levar" ${S.levar ? 'checked' : ''}><span><b>Levar para a minha conta</b><small>Tudo passa a ficar no servidor e aparece em qualquer aparelho em que você entrar. Recomendado.</small></span></label>
        <label class="${S.levar ? '' : 'on'}"><input type="radio" name="levar" value="0" data-a="levar" ${S.levar ? '' : 'checked'}><span><b>Começar do zero</b><small>A conta começa vazia. Os dados deste navegador não são apagados.</small></span></label></div>`;
  return `<div class="p10-cheia"><form class="p10-pa card" id="f-primeiro" novalidate>
    <div class="p10-pa-h">${LOGO}<b>Musubi</b><span class="pill acc">Proposta · etapa 10</span></div>
    <ol class="p10-steps">${passos.map((t, i) => `<li class="${i + 1 < P ? 'feito' : i + 1 === P ? 'on' : ''}" ${i + 1 === P ? 'aria-current="step"' : ''}><span>${i + 1 < P ? ic('check') : i + 1}</span>${t}</li>`).join('')}</ol>
    <h1>${['Crie a sua conta', 'Conte sobre a clínica', 'E os dados que você já tem?'][P - 1]}</h1>
    ${corpo}
    <p class="erro-c" id="pa-erro" hidden></p>
    <div class="p10-acoes">${P > 1 ? `<button class="btn" type="button" data-a="voltar">${ic('esq')}Voltar</button>` : `<a class="btn ghost" href="index.html">Já tenho conta</a>`}<button class="btn pri" type="submit" id="pa-ok">${P < 3 ? 'Continuar' : 'Entrar no MUSUBI'}${ic('dir')}</button></div>
  </form></div>`;
}

/* ---------- Estrutura ---------- */
const TELAS = { administracao:vAdmin, equipe:vEquipe, configuracoes:vConfig, interessados:vInteressados };
const rota = () => { const r = location.hash.replace(/^#\/?/, '').split('/')[0]; return r === 'primeiro-acesso' || TELAS[r] ? r : 'administracao'; };
function cab(i, t, sub, acao = ''){
  const voltar = rota() !== 'administracao' ? `<a class="btn ghost sm p10-volta" href="#/administracao">${ic('esq')}Administração</a>` : '';
  return `${voltar}<div class="et-h"><span class="tico acc">${ic(i)}</span><div class="grow"><h2>${t}</h2><small class="muted">${sub}</small></div>${acao}</div>`;
}
function render(manter){
  const y = scrollY, r = rota(), cheia = r === 'primeiro-acesso';
  document.getElementById('app').hidden = cheia; const ch = document.getElementById('cheia'); ch.hidden = !cheia;
  if (cheia) { ch.innerHTML = vPrimeiro(); if (!manter) ch.querySelector('input')?.focus(); return; }
  ch.innerHTML = '';
  if (r === 'equipe' && clin().perfil !== 'adm') { location.hash = '#/administracao'; return; }
  const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>${esc(clin().nome)}</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/administracao" ${k === 'administracao' ? '' : 'data-a="fora"'} aria-label="${l}" class="${k === 'administracao' ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  const u = eu(), migalha = { administracao:'Administração', equipe:'Equipe e permissões', configuracoes:'Configurações', interessados:'Interessados' }[r];
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/administracao">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho">${r === 'administracao' ? '<span>Administração</span>' : `<a href="#/administracao">Administração</a>${ic('dir')}<span>${migalha}</span>`}</nav>
    <div class="tb-r"><div class="p10-conta"><button class="p10-cb" data-a="conta" aria-expanded="${S.conta}" aria-haspopup="true"><span class="avatar">${ini(u.nome)}</span><span class="p10-cn"><b>${esc(u.nome.split(' ')[0])}</b><small>${esc(clin().nome)}</small></span>${ic('baixo')}</button>
      ${S.conta ? `<div class="p10-menu" role="menu"><small class="lbl">Suas clínicas</small>${S.clinicas.map(c => `<button role="menuitemradio" aria-checked="${c.id === S.clinica}" data-a="clinica" data-k="${c.id}" class="${c.id === S.clinica ? 'on' : ''}"><span class="grow"><b>${esc(c.nome)}</b><small>${perfilDe(c.perfil)[1]}</small></span>${c.id === S.clinica ? ic('check') : ''}</button>`).join('')}
        <hr><a role="menuitem" href="#/configuracoes" data-a="minha-conta">${ic('admin')}Sua conta</a><a role="menuitem" href="index.html">${ic('sair')}Sair</a></div>` : ''}</div></div>`;
  document.getElementById('view').innerHTML = TELAS[r]();
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const erro = (id, m, campo) => { const e = document.getElementById(id); e.textContent = m; e.hidden = !m; if (m && campo) campo.focus(); return !!m; };
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]');
  if (S.conta && !ev.target.closest('.p10-conta')) { S.conta = false; render(true); }
  if (!t) return; const a = t.dataset.a, u = S.equipe.find(x => x.id === t.dataset.u);
  if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só a Administração é navegável', 'info'); }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'menu-fechar') { S.aberto = false; render(true); }
  else if (a === 'conta') { S.conta = !S.conta; render(true); }
  else if (a === 'clinica') { S.clinica = t.dataset.k; S.conta = false; S.aba = 'clinica'; location.hash = '#/administracao'; render(); toast(`Agora em ${clin().nome}`); }
  else if (a === 'minha-conta') { S.aba = 'conta'; S.conta = false; }
  else if (a === 'convidar') { S.convite = true; render(true); document.querySelector('#f-conv [name=nome]').focus(); }
  else if (a === 'conv-fechar') { S.convite = false; render(true); }
  else if (a === 'reenviar') toast(`Convite reenviado para ${u.email}`);
  else if (a === 'tirar') { u.st = 'off'; render(true); toast(`${u.nome} não entra mais. Os registros continuam.`); }
  else if (a === 'reativar') { u.st = 'ativo'; render(true); toast(`${u.nome} voltou a ter acesso`); }
  else if (a === 'aba') { S.aba = t.dataset.k; render(true); }
  else if (a === 'serv-novo') { S.serv.push({ id:nId('s'), nome:'', dur:60, valor:0, ativo:true }); render(true); document.querySelector('#cfg-serv .p10-s:last-child input').focus(); }
  else if (a === 'senha') toast('Mandamos um link para o seu e-mail para criar a nova senha');
  else if (a === 'sair-todos') toast('Os outros aparelhos vão pedir a senha de novo');
  else if (a === 'baixar') toast('Na versão final, o arquivo é baixado aqui', 'info');
  else if (a === 'perm-padrao') { S.perm = PERM.map(r => r.slice(1)); render(true); toast('Permissões de volta ao padrão'); }
  else if (a === 'filtro') { S.filtro = t.dataset.k; render(true); }
  else if (a === 'chamar') { ev.preventDefault(); const i = S.inter.find(x => x.id === t.dataset.i); if (i.st === 'novo') i.st = 'chamei'; render(true); toast(`No sistema, abre o WhatsApp com ${i.nome}`, 'info'); }
  else if (a === 'voltar') { const f = document.getElementById('f-primeiro'); ['clinica', 'cidade', 'uf'].forEach(k => { if (f[k]) S.pa[k] = f[k].value; }); S.passo--; render(); }
});
document.addEventListener('change', ev => {
  const t = ev.target, a = t.dataset.a;
  if (a === 'perfil') { const u = S.equipe.find(x => x.id === t.dataset.u); u.perfil = t.value; toast(`${u.nome} agora é ${perfilDe(t.value)[1]}`); }
  else if (a === 'serv-campo') { const s = S.serv.find(x => x.id === t.dataset.s), k = t.dataset.k;
    s[k] = k === 'dur' ? Number(t.value) : k === 'valor' ? Math.max(0, Number(t.value.replace(/\./g, '').replace(',', '.')) || 0) : t.value.trim();
    if (k === 'valor') t.value = s.valor.toFixed(2).replace('.', ','); toast(s.nome ? `${s.nome} salvo${k === 'valor' ? ': ' + brl(s.valor) : ''}` : 'Dê um nome ao serviço', s.nome ? 'ok' : 'info'); }
  else if (a === 'serv-ativo') { const s = S.serv.find(x => x.id === t.dataset.s); s.ativo = t.checked; render(true); }
  else if (a === 'dia') { S.hor[t.dataset.d].aberto = t.checked; render(true); }
  else if (a === 'hora') { const h = S.hor[t.dataset.d]; h[t.dataset.k] = t.value; if (h.fim <= h.ini) { toast('O fim precisa ser depois do início', 'info'); } document.getElementById('hor-resumo').textContent = resumoHorario(); }
  else if (a === 'pausa') { S.pausa.tem = t.checked; render(true); }
  else if (a === 'pausa-h') { S.pausa[t.dataset.k] = t.value; document.getElementById('hor-resumo').textContent = resumoHorario(); }
  else if (a === 'perm') { const r = +t.dataset.r, i = +t.dataset.i; S.perm[r][i] = t.checked ? 1 : 0; render(true); toast(`${PERFIS[i][1]} ${t.checked ? 'agora abre' : 'não abre mais'}: ${PERM[r][0]}`); }
  else if (a === 'situ') { S.inter.find(x => x.id === t.dataset.i).st = t.value; render(true); }
  else if (a === 'levar') { S.levar = t.value === '1'; render(true); }
});
document.addEventListener('submit', ev => {
  ev.preventDefault(); const f = ev.target;
  if (f.id === 'f-conv') {
    if (erro('conv-erro', !f.nome.value.trim() ? 'Escreva o nome.' : !emailOk(f.email.value) ? 'Confira o e-mail.' : S.equipe.some(u => u.email === f.email.value.trim()) ? 'Esse e-mail já está na equipe.' : '', !f.nome.value.trim() ? f.nome : f.email)) return;
    S.equipe.push({ id:nId('u'), nome:f.nome.value.trim(), email:f.email.value.trim(), perfil:f.perfil.value, esp:'', st:'convite' }); S.convite = false; render(true); toast(`Convite enviado para ${f.email.value.trim()}`);
  } else if (f.id === 'f-clinica') {
    if (erro('cl-erro', !f.nome.value.trim() ? 'Escreva o nome da clínica.' : !f.cidade.value.trim() ? 'Escreva a cidade.' : '', !f.nome.value.trim() ? f.nome : f.cidade)) return;
    Object.assign(S.dados, { nome:f.nome.value.trim(), cidade:f.cidade.value.trim(), uf:f.uf.value, whats:f.whats.value, end:f.end.value, doc:f.doc.value });
    clin().nome = S.dados.nome; render(true); toast('Dados da clínica salvos');
  } else if (f.id === 'f-conta') { eu().nome = f.nome.value.trim() || eu().nome; render(true); toast('Sua conta foi salva'); }
  else if (f.id === 'f-primeiro') {
    const P = S.passo;
    if (P === 1 && erro('pa-erro', !f.nome.value.trim() ? 'Escreva o seu nome.' : !emailOk(f.email.value) ? 'Confira o e-mail.' : f.senha.value.length < 8 ? 'A senha precisa de pelo menos 8 caracteres.' : '', !f.nome.value.trim() ? f.nome : !emailOk(f.email.value) ? f.email : f.senha)) return;
    if (P === 2 && erro('pa-erro', !f.clinica.value.trim() ? 'Escreva o nome da clínica.' : !f.cidade.value.trim() ? 'Escreva a cidade.' : '', !f.clinica.value.trim() ? f.clinica : f.cidade)) return;
    ['nome', 'email', 'clinica', 'cidade', 'uf'].forEach(k => { if (f[k]) S.pa[k] = f[k].value; });
    if (P < 3) { S.passo++; render(); return; }
    S.passo = 1; location.hash = '#/administracao'; toast(S.levar ? 'Pronto! Seus dados agora estão na sua conta' : 'Pronto! Sua conta começou vazia');
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && S.conta) { S.conta = false; render(true); document.querySelector('.p10-cb')?.focus(); } });
addEventListener('hashchange', () => { S.aberto = false; S.conta = false; S.convite = false; render(); scrollTo(0, 0); });
render();
