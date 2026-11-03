// Estado da interface (tela, paciente selecionado, filtros, menu, camadas abertas).
// ov: camada aberta (busca, notif, perfil, atalhos); q/bi: texto e item escolhido na busca global;
// lidas: notificações já vistas nesta sessão; dia: dia escolhido no calendário do Painel; crumbs: migalhas.
export const ui = { pid:'p1', editPid:null, tab:'resumo', assess:null, el:null, sheng:true, ke:true, ptQ:'', ptMer:'', week:0, pq:'', menuMini:false, menuAberto:false,
  ov:null, q:'', bi:0, lidas:new Set(), dia:null, crumbs:[] };
