// Telas dos módulos planejados, que ainda não foram implementados, e a tela Administração,
// que reúne os módulos administrativos.
import { ic } from '../componentes/icones.js';
import { LABEL } from './menu.js';

const MODULOS = {
  crm:{etapa:6,i:'tel',texto:'Acompanhamento do relacionamento, do primeiro contato à reativação de pacientes.',itens:['Interessados e origem dos contatos','Negociações e observações','Lembretes e tarefas','Reativação de pacientes antigos','Continuidade de tratamentos','WhatsApp: confirmações e lembretes (etapa 7)']},
  financeiro:{etapa:8,i:'financeiro',texto:'Gestão financeira da clínica, separando o valor contratado do valor efetivamente recebido.',itens:['Contas a pagar e a receber','Fluxo de caixa','Pagamentos parciais e recorrentes','Pacotes terapêuticos e comissões','Inadimplência','Emissão de NFS-e por provedor integrador']},
  documentos:{etapa:6,i:'doc',texto:'Documentos gerados com os dados do paciente e da profissional, prontos para assinatura eletrônica.',itens:['Ficha de anamnese','Termos de consentimento','Autorizações específicas','Orientações e planos terapêuticos','Registros de atendimento','Assinatura eletrônica por provedor externo']},
  relatorios:{etapa:9,i:'relatorios',texto:'Indicadores clínicos, comerciais e financeiros.',itens:['Desempenho clínico','Conversão comercial','Agenda e ocupação','Financeiro','Desempenho por profissional','Desempenho por serviço']},
  equipe:{etapa:10,i:'pacientes',texto:'Profissionais, especialidades e permissões de acesso por clínica.',itens:['Perfil único por profissional','Especialidades e modalidades','Permissões por perfil','Várias clínicas','Pacientes compartilhados conforme permissão','Registro de atividades']},
  configuracoes:{etapa:10,i:'admin',texto:'Dados da clínica, serviços, modalidades e modelos.',itens:['Dados da clínica e local de atendimento','Serviços, duração e valores','Modalidades terapêuticas','Modelos de documento','Preferências de agenda','Privacidade e LGPD']}
};
export const EM_BREVE = Object.keys(MODULOS);

export function vEmBreve(k){
  const m = MODULOS[k];
  return `<div class="head"><div><h1>${LABEL[k]}</h1><p>${m.texto}</p></div><span class="pill acc">Planejado para a etapa ${m.etapa}</span></div>
  <div class="card soon-card"><div class="soon-top"><span class="tico acc">${ic(m.i)}</span><div><b>O que este módulo vai reunir</b><small class="muted">Planejado para a etapa ${m.etapa}. As telas serão apresentadas para aprovação antes da implementação.</small></div></div>
    <div class="soon-list">${m.itens.map(i=>`<div>${ic('check')}<span>${i}</span></div>`).join('')}</div></div>`;
}

export function vAdministracao(){
  return `<div class="head"><div><h1>Administração</h1><p>Equipe, configurações da clínica e relacionamento com pacientes</p></div></div>
  <div class="adm">${['equipe','configuracoes','crm'].map(k=>{const m=MODULOS[k]; return `<a class="adm-c" href="#${k}"><span class="tico acc">${ic(m.i)}</span><span class="grow"><b>${LABEL[k]}</b><small>${m.texto}</small></span><span class="pill">etapa ${m.etapa}</span></a>`;}).join('')}</div>
  <div class="card" style="margin-top:20px"><div class="card-h"><h2>Dados de exemplo</h2></div>
    <p class="muted sm" style="margin-bottom:12px">Os dados ficam só neste navegador. Restaurar apaga o que foi digitado e volta aos pacientes de exemplo.</p>
    <button class="btn" data-act="reset">${ic('retorno')}Restaurar exemplos</button></div>`;
}
