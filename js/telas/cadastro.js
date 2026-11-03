// Tela Cadastro do paciente: novo paciente ou edição dos dados de um paciente existente.
// Identificação e contato, local de atendimento (para o contexto sazonal), queixa principal,
// alertas de segurança e consentimento LGPD. Os campos do protótipo mantêm os mesmos ids (np-*).
import { ic } from '../componentes/icones.js';
import { patient } from '../dados/repositorio.js';
import { ALERTA_NOME } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { esc, fmt, initials } from '../util.js';

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
  const p = ui.editPid ? patient(ui.editPid) : null, c = p?.cadastro || {};
  const titulo = p ? 'Editar cadastro' : 'Novo paciente';
  ui.crumbs = p ? [['#pacientes','Pacientes'],[`data-act="open" data-pid="${p.id}"`,p.name],[null,'Cadastro']] : [['#pacientes','Pacientes'],[null,'Novo paciente']];
  const campo = (id,l,val='',t='text',ph='',extra='',cls='') => `<div class="field ${cls}"><label class="lbl" for="${id}">${l}</label><input id="${id}" type="${t}" placeholder="${ph}" value="${esc(val)}" ${extra}></div>`;
  const hem = c.hemisferio || 'Sul';
  return `<div class="head"><div><h1>${titulo}</h1><p>Os campos com * são obrigatórios.</p></div></div>
  <form id="f-patient" class="cad">
    <div class="grid" style="align-content:start">
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('doc_id')}</span><div><h3>Identificação</h3><small class="muted">Dados pessoais e contato</small></div></div>
        <div class="form">${campo('np-name','Nome completo *',p?.name,'text','Ex.: Marina Costa','required autocomplete="off"','full')}${campo('np-birth','Data de nascimento *',p?.birth,'date','','required')}${campo('np-cpf','CPF',c.cpf,'text','000.000.000-00','inputmode="numeric"')}
          ${campo('np-phone','Telefone (WhatsApp)',p?.phone,'tel','(11) 90000-0000')}${campo('np-email','E-mail',c.email,'email','nome@email.com')}
          ${campo('np-emerg','Contato de emergência',c.contatoEmergencia,'text','Nome e telefone','','full')}</div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('local')}</span><div><h3>Endereço e local de atendimento</h3><small class="muted">A cidade e o hemisfério são usados no contexto sazonal, só como complemento</small></div></div>
        <div class="form">${campo('np-end','Endereço',c.endereco,'text','Rua, número, bairro','','full')}${campo('np-cid','Cidade',c.cidade,'text','São Paulo')}
          <div class="field"><label class="lbl" for="np-hem">Hemisfério</label><select id="np-hem">${['Sul','Norte'].map(h=>`<option ${h===hem?'selected':''}>${h}</option>`).join('')}</select></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('pulso')}</span><div><h3>Queixa principal</h3><small class="muted">${p?'Outras queixas são adicionadas no perfil do paciente':'A intensidade é medida no primeiro atendimento, que gera a avaliação basal'}</small></div></div>
        <div class="form"><div class="field full"><label class="lbl" for="np-q">Queixa *</label><input id="np-q" required placeholder="Ex.: dor cervical e tensão nos ombros" value="${esc(p?.queixa)}"></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico crit">${ic('escudo')}</span><div><h3>Alertas de segurança</h3><small class="muted">Avisam sobre pontos e técnicas contraindicados ao registrar o atendimento</small></div></div>
        <div class="tgs">${Object.entries(ALERTA_NOME).map(([k,l])=>`<label class="tg"><input type="checkbox" id="np-al-${k}" ${p?.alerts[k]?'checked':''}><span class="sw"></span><span><b>${l}</b><small>${ALERTA_DICA[k]||''}</small></span></label>`).join('')}</div></section>
      <section class="card fs">${p?.consentimento?`<p class="lgpd">${ic('check')}<span>Consentimento LGPD registrado em ${fmt(p.consentimento)}.</span></p>`
        :`<label class="lgpd"><input type="checkbox" id="np-lgpd" ${p?'':'required'}> <span>O paciente autorizou o tratamento dos dados de saúde para fins de atendimento (consentimento LGPD).${p?'':' *'}</span></label>`}</section>
      <div class="at-f" style="margin-top:0">${p?`<button type="button" class="btn" data-act="open" data-pid="${p.id}">Cancelar</button>`:'<a class="btn" href="#pacientes">Cancelar</a>'}<button class="btn pri">${ic('check')}${p?'Salvar alterações':'Cadastrar e abrir prontuário'}</button></div>
    </div>
    <aside class="card cad-p"><div class="lbl">Pré-visualização</div><div class="cad-pv"><span class="avatar xl" id="pv-av">${p?initials(p.name):'?'}</span><b id="pv-n">${p?esc(p.name):'Nome do paciente'}</b><small class="muted" id="pv-q">${p?esc(p.queixa):'Queixa principal'}</small></div>
      <div class="lbl" style="margin-top:16px">Próximo passo</div><p class="sm muted" style="margin-top:6px">${p?'As alterações aparecem no perfil e no prontuário. Sessões, avaliações e anamnese não são alteradas.':'Depois de cadastrar, o perfil abre na anamnese. O botão <b>Novo atendimento</b> registra a primeira consulta.'}</p></aside>
  </form>`;
}
// Atualiza a pré-visualização enquanto o formulário é preenchido.
export function previaCadastro(){
  const n=document.getElementById('np-name')?.value.trim(), q=document.getElementById('np-q')?.value.trim();
  const av=document.getElementById('pv-av'); if(!av) return;
  av.textContent=n?initials(n):'?'; document.getElementById('pv-n').textContent=n||'Nome do paciente'; document.getElementById('pv-q').textContent=q||'Queixa principal';
}
