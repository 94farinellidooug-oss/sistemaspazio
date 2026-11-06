// Telas dos módulos planejados, que ainda não foram implementados, e a tela Administração,
// que reúne os módulos administrativos.
import { ic } from '../componentes/icones.js';
import { db } from '../dados/repositorio.js';
import { LABEL } from './menu.js';
import { fmt } from '../util.js';
import { conta } from './conta.js';

const MODULOS = {
  crm:{etapa:6,i:'tel',feito:true,texto:'Quem retomar contato e quem procurou e ainda não é paciente.'},
  mensagens:{etapa:7,i:'mensagem',feito:true,texto:'Os textos do WhatsApp: lembrete de horário, retomar contato e orientações.'},
  financeiro:{etapa:8,i:'financeiro',feito:true,texto:'Gestão financeira da clínica, separando o valor contratado do valor efetivamente recebido.',itens:['Contas a pagar e a receber','Fluxo de caixa','Pagamentos parciais e recorrentes','Pacotes terapêuticos e comissões','Inadimplência','Emissão de NFS-e por provedor integrador']},
  relatorios:{etapa:9,i:'relatorios',feito:true,texto:'Indicadores clínicos, comerciais e financeiros.',itens:['Desempenho clínico','Conversão comercial','Agenda e ocupação','Financeiro','Desempenho por profissional','Desempenho por serviço']},
  equipe:{etapa:10,i:'pacientes',texto:'Profissionais, especialidades e permissões de acesso por clínica.',itens:['Perfil único por profissional','Especialidades e modalidades','Permissões por perfil','Várias clínicas','Pacientes compartilhados conforme permissão','Registro de atividades']},
  configuracoes:{etapa:10,i:'admin',feito:true,texto:'Dados da clínica, serviços e preços, horário de atendimento, sua conta e segurança.',itens:['Dados da clínica e local de atendimento','Serviços, duração e valores','Modalidades terapêuticas','Modelos de documento','Preferências de agenda','Privacidade e LGPD']}
};
export const EM_BREVE = Object.keys(MODULOS).filter(k => !MODULOS[k].feito);

export function vEmBreve(k){
  const m = MODULOS[k];
  return `<div class="head"><div><h1>${LABEL[k]}</h1><p>${m.texto}</p></div><span class="pill acc">Planejado para a etapa ${m.etapa}</span></div>
  <div class="card soon-card"><div class="soon-top"><span class="tico acc">${ic(m.i)}</span><div><b>O que este módulo vai reunir</b><small class="muted">Planejado para a etapa ${m.etapa}. As telas serão apresentadas para aprovação antes da implementação.</small></div></div>
    <div class="soon-list">${m.itens.map(i=>`<div>${ic('check')}<span>${i}</span></div>`).join('')}</div></div>`;
}

export function vAdministracao(){
  return `<div class="head"><div><h1>Administração</h1><p>Equipe, configurações da clínica e relacionamento com pacientes</p></div></div>
  <div class="adm">${['equipe','configuracoes','crm','mensagens'].map(k=>{const m=MODULOS[k]; return `<a class="adm-c" href="#${k}"><span class="tico acc">${ic(m.i)}</span><span class="grow"><b>${LABEL[k]}</b><small>${m.texto}</small></span>${m.feito?'<span class="pill ok">disponível</span>':`<span class="pill">etapa ${m.etapa}</span>`}</a>`;}).join('')}</div>
  <div class="grid g2" style="margin-top:20px">
    <div class="card" id="dados"><div class="card-h"><h2>Dados e cópia de segurança</h2><span class="tico sm acc">${ic('escudo')}</span></div>
      <div class="ac-s" style="margin-bottom:14px"><div><small>Pacientes</small><b>${db.patients.length}</b></div><div><small>Atendimentos</small><b>${db.patients.reduce((n,p)=>n+p.atendimentos.length,0)}</b></div><div><small>Agendamentos</small><b>${db.appts.length}</b></div></div>
      <p class="muted sm" style="margin-bottom:12px">${conta.modo==='nuvem'?'Os dados ficam guardados no servidor e neste aparelho.':'Os dados ficam só neste navegador (modelo v2).'}${db.origem==='spazio-v1'?` Convertidos do protótipo em ${fmt(db.migradoEm.slice(0,10))}; os dados originais do protótipo continuam guardados sem alteração.`:''} Exporte uma cópia com frequência.</p>
      <div class="chips"><button class="btn" data-act="exportar" data-f="v2">${ic('baixar')}Exportar dados</button><button class="btn ghost" data-act="exportar" data-f="v1">${ic('baixar')}Exportar no formato do protótipo</button>
        <label class="btn ghost">${ic('sobe')}Importar arquivo<input type="file" id="imp-arq" accept="application/json,.json" hidden></label></div></div>
    ${conta.modo==='nuvem'?'':`<div class="card"><div class="card-h"><h2>Dados de exemplo</h2></div>
      <p class="muted sm" style="margin-bottom:12px">Restaurar apaga o que foi digitado neste navegador e volta aos pacientes de exemplo. Exporte antes se quiser guardar.</p>
      <button class="btn" data-act="reset">${ic('retorno')}Restaurar exemplos</button></div>`}
  </div>`;
}
