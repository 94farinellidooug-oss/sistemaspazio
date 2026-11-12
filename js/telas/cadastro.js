// Tela Cadastro do paciente: novo paciente ou edição dos dados de um paciente existente.
// Identificação e contato, local de atendimento (para o contexto sazonal), queixa principal,
// alertas de segurança e consentimento LGPD. Os campos do protótipo mantêm os mesmos ids (np-*).
import { ANOS_GUARDA, MOTIVOS_EXCLUSAO, guardarAte, temProntuario } from '../dados/excluir.js';
import { ic } from '../componentes/icones.js';
import { patient } from '../dados/repositorio.js';
import { ALERTA_NOME } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { TODAY, esc, fmt, initials } from '../util.js';
import { buscarCep, cepFormatado, soDigitosCep } from '../dados/endereco.js';
import { UFS } from '../dados/config.js';

const ALERTA_DICA = { gestante:'Pontos com cautela na gestação', anticoagulante:'Ventosa e sangria', marcapasso:'Eletroacupuntura' };

// CPF: vazio é aceito (campo opcional); preenchido, precisa ter 11 dígitos e dígitos verificadores corretos.
export function cpfValido(v){
  const d = String(v||'').replace(/\D/g,'');
  if(!d) return true;
  if(d.length!==11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s=0; for(let i=0;i<n;i++) s+=Number(d[i])*(n+1-i); const r=s*10%11; return r===10?0:r; };
  return dv(9)===Number(d[9]) && dv(10)===Number(d[10]);
}
export const cpfFormatado = v => { const d=String(v||'').replace(/\D/g,'').slice(0,11); return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:v; };

export function vCadastro(){
  const p = ui.editPid ? patient(ui.editPid) : null, c = p?.cadastro || {}, pre = p || ui.cadPrevio;
  const titulo = p ? 'Editar cadastro' : 'Novo paciente';
  ui.crumbs = p ? [['#pacientes','Pacientes'],[`data-act="open" data-pid="${p.id}"`,p.name],[null,'Cadastro']] : [['#pacientes','Pacientes'],[null,'Novo paciente']];
  const campo = (id,l,val='',t='text',ph='',extra='',cls='') => `<div class="field ${cls}"><label class="lbl" for="${id}">${l}</label><input id="${id}" type="${t}" placeholder="${ph}" value="${esc(val)}" ${extra}></div>`;
  const hem = c.hemisferio || 'Sul';
  return `<div class="head"><div><h1>${titulo}</h1><p>Os campos com * são obrigatórios.</p></div></div>
  <form id="f-patient" class="cad">
    <div class="grid" style="align-content:start">
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('doc_id')}</span><div><h3>Identificação</h3><small class="muted">Dados pessoais e contato</small></div></div>
        <div class="form">${campo('np-name','Nome completo *',pre?.name,'text','Ex.: Marina Costa','required autocomplete="off"','full')}${campo('np-birth','Data de nascimento *',p?.birth,'date','','required')}${campo('np-cpf','CPF',c.cpf,'text','000.000.000-00','inputmode="numeric"')}
          ${campo('np-phone','Telefone (WhatsApp)',pre?.phone,'tel','(11) 90000-0000')}${campo('np-email','E-mail',c.email,'email','nome@email.com')}
          ${campo('np-emerg','Contato de emergência',c.contatoEmergencia,'text','Nome e telefone','','full')}</div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('local')}</span><div><h3>Endereço e local de atendimento</h3><small class="muted">A cidade e o hemisfério são usados no contexto sazonal, só como complemento</small></div></div>
        <div class="form">${campo('np-cep','CEP',cepFormatado(c.cep||''),'text','00000-000','inputmode="numeric" autocomplete="postal-code" maxlength="9" aria-describedby="np-cep-s"')}<div class="field cep-s"><span class="muted sm" id="np-cep-s" role="status">${c.cep?'':'Digite o CEP para preencher o endereço'}</span></div>
          ${campo('np-end','Rua',c.endereco,'text','Rua, avenida…','autocomplete="address-line1"','full')}${campo('np-num','Número',c.numero,'text','123','autocomplete="off"')}${campo('np-comp','Complemento',c.complemento,'text','Apto, bloco, casa…')}
          ${campo('np-bai','Bairro',c.bairro)}${campo('np-cid','Cidade',c.cidade,'text','São Paulo')}
          <div class="field"><label class="lbl" for="np-uf">Estado</label><select id="np-uf"><option value=""></option>${UFS.map(u=>`<option ${u===c.uf?'selected':''}>${u}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl" for="np-hem">Hemisfério</label><select id="np-hem">${['Sul','Norte'].map(h=>`<option ${h===hem?'selected':''}>${h}</option>`).join('')}</select></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('pulso')}</span><div><h3>Queixa principal</h3><small class="muted">${p?'Outras queixas são adicionadas no perfil do paciente':'A intensidade é medida no primeiro atendimento, que gera a avaliação basal'}</small></div></div>
        <div class="form"><div class="field full"><label class="lbl" for="np-q">Queixa *</label><input id="np-q" required placeholder="Ex.: dor cervical e tensão nos ombros" value="${esc(p?.queixa)}"></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico crit">${ic('escudo')}</span><div><h3>Alertas de segurança</h3><small class="muted">Avisam sobre pontos e técnicas contraindicados ao registrar o atendimento</small></div></div>
        <div class="tgs">${Object.entries(ALERTA_NOME).map(([k,l])=>`<label class="tg"><input type="checkbox" id="np-al-${k}" ${p?.alerts[k]?'checked':''}><span class="sw"></span><span><b>${l}</b><small>${ALERTA_DICA[k]||''}</small></span></label>`).join('')}</div></section>
      <section class="card fs">${p?.consentimento?`<p class="lgpd">${ic('check')}<span>Consentimento LGPD registrado em ${fmt(p.consentimento)}.</span></p>`
        :`<label class="lgpd"><input type="checkbox" id="np-lgpd" ${p?'':'required'}> <span>O paciente autorizou o tratamento dos dados de saúde para fins de atendimento (consentimento LGPD).${p?'':' *'}</span></label>`}</section>
      <div class="at-f" style="margin-top:0">${p?`<button type="button" class="btn" data-act="open" data-pid="${p.id}">Cancelar</button>`:'<a class="btn" href="#pacientes">Cancelar</a>'}<button class="btn pri">${ic('check')}${p?'Salvar alterações':'Cadastrar e abrir prontuário'}</button></div>
    </div>
    <div class="cad-lado"><aside class="card cad-p"><div class="lbl">Pré-visualização</div><div class="cad-pv"><span class="avatar xl" id="pv-av">${p?initials(p.name):'?'}</span><b id="pv-n">${p?esc(p.name):'Nome do paciente'}</b><small class="muted" id="pv-q">${p?esc(p.queixa):'Queixa principal'}</small></div>
      <div class="lbl" style="margin-top:16px">Próximo passo</div><p class="sm muted" style="margin-top:6px">${p?'As alterações aparecem no perfil e no prontuário. Sessões, avaliações e anamnese não são alteradas.':'Depois de cadastrar, o perfil abre na anamnese. O botão <b>Novo atendimento</b> registra a primeira consulta.'}</p></aside>
      ${p?excluirHtml(p):''}</div>
  </form>`;
}
// CEP: ao completar os 8 números, busca e preenche rua, bairro, cidade e estado; o foco vai para o número.
let cepBuscado = '';
export const aoDigitarCep = async el => {
  const d = soDigitosCep(el.value), s = document.getElementById('np-cep-s');
  el.value = cepFormatado(el.value);
  if (d.length !== 8) { cepBuscado = ''; if (s) s.textContent = d ? 'O CEP tem 8 números' : 'Digite o CEP para preencher o endereço'; return; }
  if (d === cepBuscado) return; cepBuscado = d;
  if (s) s.textContent = 'Buscando o endereço…';
  let r = null;
  try { r = await buscarCep(d); } catch (e) { if (s) s.textContent = 'Sem conexão para buscar o CEP. Preencha o endereço à mão.'; return; }
  if (soDigitosCep(el.value) !== d) return;
  if (!r) { if (s) s.textContent = 'CEP não encontrado. Confira os números ou preencha à mão.'; return; }
  const por = (id, v) => { const x = document.getElementById(id); if (x && v) x.value = v; };
  por('np-end', r.rua); por('np-bai', r.bairro); por('np-cid', r.cidade); por('np-uf', r.uf);
  if (s) s.textContent = r.rua ? 'Endereço preenchido. Falta o número e o complemento.' : 'CEP geral da cidade: preencha a rua e o bairro.';
  document.getElementById(r.rua ? 'np-num' : 'np-end')?.focus();
};
// Atualiza a pré-visualização enquanto o formulário é preenchido.
export function previaCadastro(){
  const n=document.getElementById('np-name')?.value.trim(), q=document.getElementById('np-q')?.value.trim();
  const av=document.getElementById('pv-av'); if(!av) return;
  av.textContent=n?initials(n):'?'; document.getElementById('pv-n').textContent=n||'Nome do paciente'; document.getElementById('pv-q').textContent=q||'Queixa principal';
}

// Excluir cadastro: aviso da guarda do prontuário, motivo e o que vai acontecer.
function excluirHtml(p){
  const E = ui.excluir?.pid === p.id ? ui.excluir : null, guarda = temProntuario(p);
  if (!E) return `<section class="card cad-exc" id="cad-exc"><div class="card-h"><h2>Excluir cadastro</h2></div><p class="muted sm">Para pacientes de exemplo, cadastros feitos por engano ou duplicados.</p><div class="at-f"><button type="button" class="btn cad-exc-b" data-act="pac-excluir" data-pid="${p.id}">${ic('x')}Excluir paciente</button></div></section>`;
  return `<section class="card cad-exc on" id="cad-exc"><div class="card-h"><h2>Excluir ${esc(p.name)}</h2></div>
    <div class="notice warn">${ic('alerta')}<span>O prontuário de saúde tem guarda obrigatória: em geral, <b>${ANOS_GUARDA} anos depois do último registro</b>. Por isso, paciente com atendimento, avaliação ou documento não é apagado.</span></div>
    <p class="sm cad-exc-o">${guarda ? `<b>${esc(p.name)} tem prontuário.</b> O cadastro fica <b>desativado</b> até ${fmt(guardarAte(p, TODAY))}: sai das listas, da agenda e da busca, e aparece só em Administração, Pacientes desativados, de onde dá para reativar.` : `<b>${esc(p.name)} não tem prontuário.</b> O cadastro e os horários da agenda saem de vez. Não dá para desfazer.`} O que já foi recebido continua no financeiro.</p>
    <div class="form"><div class="field full"><label class="lbl" for="exc-m">Motivo *</label><select id="exc-m" data-exc="motivo"><option value="">Escolha o motivo</option>${MOTIVOS_EXCLUSAO.map(m => `<option ${E.motivo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      ${E.motivo === 'Outro motivo' ? `<div class="field full"><label class="lbl" for="exc-o">Qual motivo? *</label><input id="exc-o" data-exc="outro" value="${esc(E.outro || '')}" autocomplete="off"></div>` : ''}</div>
    <div class="at-f"><button type="button" class="btn" data-act="pac-excluir-nao">Cancelar</button><button type="button" class="btn crit" data-act="pac-excluir-sim" data-pid="${p.id}">${ic('x')}${guarda ? 'Desativar cadastro' : 'Excluir de vez'}</button></div></section>`;
}
