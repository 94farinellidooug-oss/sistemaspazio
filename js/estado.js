// Estado da interface (tela, paciente selecionado, filtros, menu, camadas abertas).
// ov: camada aberta (busca, notif, perfil, atalhos); q/bi: texto e item escolhido na busca global;
// lidas: notificações já vistas nesta sessão; dia: dia escolhido no calendário do Painel; crumbs: migalhas.
export const ui = { pid:'p1', editPid:null, atId:null, etapa:0, avAba:0, atCmp:false, tab:'resumo', assess:null, el:null, sheng:true, ke:true, ptQ:'', ptMer:'', week:0, pq:'', menuMini:false, menuAberto:false,
  ov:null, q:'', bi:0, lidas:new Set(), dia:null, crumbs:[],
  // Mapa corporal do atendimento (etapa 4A): vista, face, ampliação, ferramenta, marcação selecionada e camadas de comparação.
  mapa:{ vista:'anterior', face:{ maos:'palmar', pes:'dorsal' }, zoom:1, ferr:'sel', sel:null, rm:false, rad:null, ant:true, hist:'', plano:true, pt:null } };
