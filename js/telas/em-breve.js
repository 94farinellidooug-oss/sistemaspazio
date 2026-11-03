// Telas dos módulos planejados, que ainda não foram implementados.
import { LABEL } from './menu.js';

const MODULOS = {
  crm:{etapa:6,texto:'Acompanhamento do relacionamento, do primeiro contato à reativação de pacientes.',itens:['Interessados e origem dos contatos','Negociações e observações','Lembretes e tarefas','Reativação de pacientes antigos','Continuidade de tratamentos','WhatsApp: confirmações e lembretes (etapa 7)']},
  financeiro:{etapa:8,texto:'Gestão financeira da clínica, separando o valor contratado do valor efetivamente recebido.',itens:['Contas a pagar e a receber','Fluxo de caixa','Pagamentos parciais e recorrentes','Pacotes terapêuticos e comissões','Inadimplência','Emissão de NFS-e por provedor integrador']},
  documentos:{etapa:6,texto:'Documentos gerados com os dados do paciente e da profissional, prontos para assinatura eletrônica.',itens:['Ficha de anamnese','Termos de consentimento','Autorizações específicas','Orientações e planos terapêuticos','Registros de atendimento','Assinatura eletrônica por provedor externo']},
  relatorios:{etapa:9,texto:'Indicadores clínicos, comerciais e financeiros.',itens:['Desempenho clínico','Conversão comercial','Agenda e ocupação','Financeiro','Desempenho por profissional','Desempenho por serviço']},
  equipe:{etapa:10,texto:'Profissionais, especialidades e permissões de acesso por clínica.',itens:['Perfil único por profissional','Especialidades e modalidades','Permissões por perfil','Várias clínicas','Pacientes compartilhados conforme permissão','Registro de atividades']},
  configuracoes:{etapa:10,texto:'Dados da clínica, serviços, modalidades e modelos.',itens:['Dados da clínica e local de atendimento','Serviços, duração e valores','Modalidades terapêuticas','Modelos de documento','Preferências de agenda','Privacidade e LGPD']}
};
export const EM_BREVE = Object.keys(MODULOS);

export function vEmBreve(k){
  const m = MODULOS[k];
  return `<div class="head"><div class="soon-hero"><span class="pill acc" style="justify-self:start">Planejado para a etapa ${m.etapa}</span><h1>${LABEL[k]}</h1><p>${m.texto}</p></div></div>
  <div class="soon-list">${m.itens.map(i=>`<div>${i}</div>`).join('')}</div>
  <p class="muted" style="margin-top:16px;font-size:.86rem">Este módulo aparece no menu para mostrar a organização final do sistema. As telas dele serão apresentadas para aprovação antes da implementação.</p>`;
}
