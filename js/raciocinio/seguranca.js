// Alertas de contraindicação de pontos e técnicas.
import { CAUT, PT } from '../conhecimento/pontos.js';

export function pointWarnings(codes, p, tec){
  const w=[];
  codes.forEach(c=>{
    const pt=PT[c];
    if(!pt){ w.push(['warn',`${c}: ponto não encontrado na biblioteca`]); return; }
    if(pt.cautela==='gestacao' && p.alerts.gestante) w.push(['crit',`${c} (${pt.pinyin}): ${CAUT.gestacao}. Paciente gestante.`]);
    else if(pt.cautela && pt.cautela!=='gestacao') w.push(['warn',`${c} (${pt.pinyin}): ${CAUT[pt.cautela]}`]);
  });
  if(p.alerts.anticoagulante && tec.some(t=>/Ventosa|Sangria/.test(t))) w.push(['crit','Paciente em uso de anticoagulante: avaliar ventosa e sangria.']);
  if(p.alerts.marcapasso && tec.includes('Eletroacupuntura')) w.push(['crit','Portador de marcapasso: eletroacupuntura contraindicada.']);
  return w;
}
