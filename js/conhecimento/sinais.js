// Sinais de língua, pulso e manifestações usados na avaliação.

export const SIGNS = {
  'Língua':[['lingua_palida','Pálida'],['lingua_vermelha','Vermelha'],['ponta_vermelha','Ponta vermelha'],['bordas_vermelhas','Bordas vermelhas'],['lingua_purpura','Arroxeada'],['lingua_inchada','Inchada'],['marcas_dentes','Marcas de dentes'],['sem_saburra','Sem saburra'],['saburra_amarela','Saburra amarela pegajosa'],['saburra_branca','Saburra branca espessa']],
  'Pulso':[['pulso_fraco','Fraco / vazio'],['pulso_corda','Em corda'],['pulso_fino','Fino'],['pulso_rapido','Rápido'],['pulso_lento','Lento'],['pulso_profundo','Profundo'],['pulso_escorregadio','Escorregadio']],
  'Sinais e sintomas':[['cansaco','Cansaço'],['fezes_amolecidas','Fezes amolecidas'],['distensao_pos','Distensão após comer'],['preocupacao','Pensamento excessivo'],['irritabilidade','Irritabilidade'],['distensao_hipo','Distensão no hipocôndrio'],['tpm','Tensão pré-menstrual'],['suspiros','Suspiros frequentes'],['cefaleia_temporal','Cefaleia temporal'],['sudorese_noturna','Sudorese noturna'],['calor_tarde','Calor ao fim da tarde'],['boca_seca','Boca seca'],['zumbido','Zumbido'],['lombalgia','Lombalgia'],['frio_extremidades','Frio nas extremidades'],['mic_frequente','Micção frequente e clara'],['palpitacoes','Palpitações'],['insonia','Insônia'],['ansiedade','Ansiedade'],['memoria','Memória fraca'],['aftas','Aftas'],['falta_ar','Falta de ar ao esforço'],['voz_fraca','Voz fraca'],['resfriados','Resfriados frequentes'],['tristeza','Tristeza persistente'],['peso_corpo','Sensação de peso'],['dor_fixa','Dor fixa e em pontada']]
};
export const SIGN = {};
Object.values(SIGNS).flat().forEach(([k,v])=>SIGN[k]=v);
