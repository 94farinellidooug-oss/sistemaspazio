// Meridianos, pontos de acupuntura e cautelas.

export const MER = {P:['Pulmão','metal'],IG:['Intestino Grosso','metal'],E:['Estômago','terra'],BP:['Baço-Pâncreas','terra'],C:['Coração','fogo'],ID:['Intestino Delgado','fogo'],B:['Bexiga','agua'],R:['Rim','agua'],CS:['Circulação-Sexo','fogo'],TA:['Triplo Aquecedor','fogo'],VB:['Vesícula Biliar','madeira'],F:['Fígado','madeira'],VC:['Vaso Concepção',null],VG:['Vaso Governador',null]};
export const POINTS = [
  ['E36','Zusanli','3 cun abaixo do E35, um dedo lateral à crista anterior da tíbia','Tonifica Qi e Xue, fortalece Baço e Estômago',''],
  ['E40','Fenglong','8 cun acima do maléolo lateral, dois dedos laterais à tíbia','Transforma fleuma e umidade',''],
  ['BP3','Taibai','Borda medial do pé, proximal à 1ª articulação metatarsofalângica','Ponto fonte, tonifica o Baço e resolve umidade',''],
  ['BP6','Sanyinjiao','3 cun acima do maléolo medial, borda posterior da tíbia','Cruzamento dos três Yin do pé, nutre Yin e Xue','gestacao'],
  ['BP9','Yinlingquan','Depressão abaixo do côndilo medial da tíbia','Resolve umidade, favorece a micção',''],
  ['BP10','Xuehai','2 cun acima da borda superomedial da patela','Move e esfria o Xue','gestacao'],
  ['VC4','Guanyuan','Linha média, 3 cun abaixo do umbigo','Tonifica o Rim, o Jing e o Yuan Qi','gestacao'],
  ['VC12','Zhongwan','Linha média, 4 cun acima do umbigo','Ponto Mu do Estômago, harmoniza o Aquecedor Médio',''],
  ['VC17','Danzhong','Linha média, na altura do 4º espaço intercostal','Ponto de reunião do Qi, regula o tórax',''],
  ['F3','Taichong','Dorso do pé, entre o 1º e o 2º metatarsos','Ponto fonte, promove o livre fluxo do Qi, acalma o Yang',''],
  ['IG4','Hegu','Dorso da mão, entre o 1º e o 2º metacarpos','Move o Qi, alivia dor, atua na face','gestacao'],
  ['IG11','Quchi','Extremidade lateral da prega do cotovelo','Elimina calor e umidade',''],
  ['VB20','Fengchi','Abaixo do occipital, entre o esternocleidomastoideo e o trapézio','Elimina vento, alivia cefaleia','profundidade'],
  ['VB34','Yanglingquan','Depressão anterior e inferior à cabeça da fíbula','Ponto de reunião dos tendões, regula o Fígado',''],
  ['VG4','Mingmen','Abaixo do processo espinhoso de L2','Aquece o Yang do Rim',''],
  ['VG20','Baihui','Vértice da cabeça, na linha média','Eleva o Yang, acalma o Shen',''],
  ['R3','Taixi','Entre o maléolo medial e o tendão calcâneo','Ponto fonte, tonifica Yin e Yang do Rim',''],
  ['R6','Zhaohai','1 cun abaixo do maléolo medial','Nutre o Yin, beneficia garganta e sono',''],
  ['R7','Fuliu','2 cun acima do R3','Tonifica o Yang do Rim, regula a sudorese',''],
  ['B13','Feishu','1,5 cun lateral à borda inferior de T3','Ponto Shu do Pulmão','torax'],
  ['B15','Xinshu','1,5 cun lateral à borda inferior de T5','Ponto Shu do Coração','torax'],
  ['B17','Geshu','1,5 cun lateral à borda inferior de T7','Ponto de reunião do Xue','torax'],
  ['B23','Shenshu','1,5 cun lateral à borda inferior de L2','Ponto Shu do Rim',''],
  ['C7','Shenmen','Prega do punho, lado radial do tendão do flexor ulnar do carpo','Ponto fonte, acalma o Shen',''],
  ['C8','Shaofu','Palma, entre o 4º e o 5º metacarpos','Ponto fogo, elimina calor do Coração',''],
  ['CS6','Neiguan','2 cun acima da prega do punho, entre os tendões','Abre o tórax, acalma o Shen, alivia náusea',''],
  ['CS7','Daling','Centro da prega do punho','Ponto fonte, acalma o Shen e elimina calor',''],
  ['P9','Taiyuan','Prega do punho, lado radial da artéria radial','Ponto fonte, tonifica o Qi do Pulmão','']
].map(([c,n,l,a,cau])=>({code:c,pinyin:n,loc:l,acoes:a,cautela:cau,mer:c.replace(/\d+/,'')}));
export const PT = {};
POINTS.forEach(p=>PT[p.code]=p);
export const CAUT = {gestacao:'Evitar na gestação',torax:'Agulhamento oblíquo; risco de pneumotórax',profundidade:'Atenção à direção e profundidade'};
