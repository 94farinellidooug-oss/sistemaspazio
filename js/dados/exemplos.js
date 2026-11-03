// Pacientes e agendamentos de exemplo.
import { TODAY, addDays, uid } from '../util.js';

export function seed(){
  const P = (id,name,birth,phone,queixa,anam,alerts,sessions,assess)=>({id,name,birth,phone,exemplo:true,queixa,anam,alerts,sessions,assess});
  const S = (d,eva,pontos,tec,nota)=>({id:uid(),date:addDays(d),eva,pontos,tec,nota});
  return {
    patients:[
      P('p1','Helena Prado','1980-04-12','(11) 98712-3344','Cefaleia temporal e irritabilidade no período pré-menstrual',
        {historia:'Cefaleias há 3 anos, pioram com estresse no trabalho.',sono:'Demora a adormecer, acorda às 2h.',alimentacao:'Pula refeições, muito café.',evacuacao:'Regular.',emocoes:'Irritação fácil, sensação de "nó na garganta".',medicamentos:'Analgésico eventual.'},
        {gestante:false,anticoagulante:false,marcapasso:false},
        [S(-42,7,['F3','IG4','VB20'],['Acupuntura'],'Primeira sessão. Tensão cervical importante.'),S(-28,6,['F3','VB34','VG20'],['Acupuntura','Ventosa'],'Relata duas crises na semana, menos intensas.'),S(-14,4,['F3','R3','VB20'],['Acupuntura'],'Melhora do sono. Crise leve no ciclo.')],
        [{id:uid(),date:addDays(-42),signs:['bordas_vermelhas','pulso_corda','cefaleia_temporal','irritabilidade','tpm','distensao_hipo','suspiros'],status:{f_estag:'aceito',f_yang:'aceito'},nota:''}]),
      P('p2','Rafael Monteiro','1987-09-03','(11) 99820-1177','Lombalgia crônica e cansaço',
        {historia:'Dor lombar há 5 anos, piora no frio.',sono:'Bom, mas acorda cansado.',alimentacao:'Regular.',evacuacao:'Fezes amolecidas pela manhã.',emocoes:'Desânimo.',medicamentos:'Nenhum.'},
        {gestante:false,anticoagulante:true,marcapasso:false},
        [S(-50,8,['B23','R3','VG4'],['Acupuntura','Moxabustão'],'Muito frio nas pernas.'),S(-36,7,['B23','R7','VC4'],['Acupuntura','Moxabustão'],''),S(-22,6,['B23','R3','E36'],['Acupuntura','Moxabustão'],'Mais disposição.'),S(-8,5,['B23','VG4','E36'],['Acupuntura','Moxabustão'],'Caminhou 30 min sem dor.')],
        [{id:uid(),date:addDays(-50),signs:['lingua_palida','lingua_inchada','pulso_profundo','pulso_lento','frio_extremidades','lombalgia','mic_frequente','cansaco','fezes_amolecidas'],status:{r_yang:'aceito'},nota:'Avaliar Baço na próxima sessão.'}]),
      P('p3','Lúcia Andrade','1964-01-28','(21) 97733-0290','Insônia e palpitações',
        {historia:'Menopausa aos 51. Insônia piorou no último ano.',sono:'Acorda várias vezes, calor à noite.',alimentacao:'Leve, pouca água.',evacuacao:'Ressecada.',emocoes:'Ansiedade.',medicamentos:'Fitoterápico para sono.'},
        {gestante:false,anticoagulante:false,marcapasso:false},
        [S(-60,7,['C7','R6','BP6'],['Acupuntura','Auriculoterapia'],''),S(-45,6,['C7','R3','CS6'],['Auriculoterapia'],'Dormiu melhor 3 noites.')],
        [{id:uid(),date:addDays(-60),signs:['lingua_vermelha','sem_saburra','pulso_fino','pulso_rapido','insonia','palpitacoes','sudorese_noturna','calor_tarde','ansiedade'],status:{r_yin:'aceito'},nota:''}]),
      P('p4','Tiago Sato','1997-06-19','(11) 96655-4021','Ansiedade e digestão lenta',
        {historia:'Distensão abdominal após refeições há 1 ano.',sono:'Sono leve.',alimentacao:'Come rápido, muitos doces.',evacuacao:'Amolecida.',emocoes:'Preocupação constante com trabalho.',medicamentos:'Nenhum.'},
        {gestante:false,anticoagulante:false,marcapasso:false},
        [S(-7,5,['E36','BP3','CS6'],['Acupuntura'],'Avaliação inicial.')],
        [{id:uid(),date:addDays(-7),signs:['marcas_dentes','pulso_fraco','distensao_pos','ansiedade','cansaco','fezes_amolecidas','preocupacao'],status:{bp_qi:'aceito'},nota:''}])
    ],
    appts:[
      {id:uid(),pid:'p1',date:TODAY,time:'09:00',tipo:'Acupuntura',valor:180,done:false},
      {id:uid(),pid:'p2',date:TODAY,time:'10:30',tipo:'Acupuntura e moxabustão',valor:200,done:false},
      {id:uid(),pid:'p4',date:TODAY,time:'16:00',tipo:'Acupuntura',valor:180,done:false},
      {id:uid(),pid:'p1',date:addDays(2),time:'09:00',tipo:'Acupuntura',valor:180,done:false},
      {id:uid(),pid:'p4',date:addDays(3),time:'18:00',tipo:'Ventosaterapia',valor:150,done:false},
      {id:uid(),pid:'p2',date:addDays(-2),time:'11:00',tipo:'Acupuntura e moxabustão',valor:200,done:true}
    ]
  };
}
