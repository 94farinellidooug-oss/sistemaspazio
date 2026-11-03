// Padrões de desarmonia e sinais dos oito princípios (Ba Gang).

export const PATTERNS = [
  {id:'bp_qi',nome:'Deficiência de Qi do Baço',el:'terra',tipo:'def',sinais:['lingua_palida','marcas_dentes','pulso_fraco','cansaco','fezes_amolecidas','distensao_pos','preocupacao'],
   pontos:[['E36','Tonifica o Qi do Baço e do Estômago'],['BP3','Ponto fonte (Yuan) do Baço'],['VC12','Ponto Mu do Estômago, fortalece o Aquecedor Médio'],['BP6','Apoia a função de transformação']]},
  {id:'f_estag',nome:'Estagnação do Qi do Fígado',el:'madeira',tipo:'exc',sinais:['pulso_corda','irritabilidade','distensao_hipo','tpm','suspiros'],
   pontos:[['F3','Ponto fonte, promove o livre fluxo do Qi'],['IG4','Com F3 forma os Quatro Portões, move o Qi'],['VB34','Regula o Qi do Fígado e da Vesícula'],['CS6','Abre o tórax e harmoniza o Qi']]},
  {id:'f_yang',nome:'Ascensão do Yang do Fígado',el:'madeira',tipo:'exc',sinais:['bordas_vermelhas','pulso_corda','cefaleia_temporal','irritabilidade','zumbido'],
   pontos:[['F3','Acalma o Yang do Fígado'],['VB20','Indicado para cefaleia e vertigem'],['VG20','Acalma o Shen e a cabeça'],['R3','Nutre o Yin do Rim para ancorar o Yang']]},
  {id:'r_yin',nome:'Deficiência de Yin do Rim',el:'agua',tipo:'def',sinais:['lingua_vermelha','sem_saburra','pulso_fino','pulso_rapido','sudorese_noturna','calor_tarde','boca_seca','zumbido','lombalgia'],
   pontos:[['R3','Ponto fonte, tonifica o Rim'],['R6','Nutre o Yin e favorece o sono'],['BP6','Nutre Yin e Xue'],['VC4','Fortalece o Rim e o Yuan Qi']]},
  {id:'r_yang',nome:'Deficiência de Yang do Rim',el:'agua',tipo:'def',sinais:['lingua_palida','lingua_inchada','pulso_profundo','pulso_lento','frio_extremidades','lombalgia','mic_frequente'],
   pontos:[['B23','Ponto Shu do Rim'],['VG4','Mingmen, aquece o Yang do Rim (moxa)'],['VC4','Tonifica o Yuan Qi (moxa)'],['R7','Tonifica o Yang do Rim']]},
  {id:'c_xue',nome:'Deficiência de Xue do Coração',el:'fogo',tipo:'def',sinais:['lingua_palida','pulso_fino','palpitacoes','insonia','ansiedade','memoria'],
   pontos:[['C7','Ponto fonte, acalma o Shen'],['CS6','Acalma o Shen e regula o Coração'],['BP6','Nutre o Xue'],['B15','Ponto Shu do Coração']]},
  {id:'c_fogo',nome:'Fogo no Coração',el:'fogo',tipo:'exc',sinais:['ponta_vermelha','saburra_amarela','pulso_rapido','insonia','aftas','ansiedade'],
   pontos:[['C8','Ponto fogo, elimina calor do Coração'],['CS7','Acalma o Shen e elimina calor'],['C7','Acalma o Shen'],['R6','Nutre Yin para conter o Fogo']]},
  {id:'p_qi',nome:'Deficiência de Qi do Pulmão',el:'metal',tipo:'def',sinais:['pulso_fraco','falta_ar','voz_fraca','resfriados','tristeza','cansaco'],
   pontos:[['P9','Ponto fonte, tonifica o Qi do Pulmão'],['E36','Fortalece a Terra, mãe do Metal'],['B13','Ponto Shu do Pulmão'],['VC17','Ponto de reunião do Qi']]},
  {id:'umid_calor',nome:'Umidade-Calor no Aquecedor Médio',el:'terra',tipo:'exc',sinais:['saburra_amarela','pulso_escorregadio','pulso_rapido','peso_corpo','fezes_amolecidas','boca_seca'],
   pontos:[['BP9','Resolve umidade'],['IG11','Elimina calor'],['E40','Transforma fleuma e umidade'],['VC12','Harmoniza o Aquecedor Médio']]},
  {id:'estase_xue',nome:'Estase de Xue',el:'madeira',tipo:'exc',sinais:['lingua_purpura','dor_fixa','tpm','pulso_corda'],
   pontos:[['BP10','Move o Xue'],['B17','Ponto de reunião do Xue'],['F3','Move o Qi para mover o Xue'],['BP6','Regula o Xue no baixo ventre']]}
];
export const BAGANG = {
  calor:['lingua_vermelha','ponta_vermelha','bordas_vermelhas','saburra_amarela','pulso_rapido','aftas','calor_tarde','boca_seca','sudorese_noturna'],
  frio:['lingua_palida','pulso_lento','frio_extremidades','mic_frequente','saburra_branca'],
  def:['pulso_fraco','pulso_fino','cansaco','voz_fraca','falta_ar','memoria','sem_saburra','marcas_dentes','resfriados'],
  exc:['pulso_corda','pulso_escorregadio','saburra_amarela','dor_fixa','distensao_hipo','irritabilidade','cefaleia_temporal','peso_corpo']
};
