// Conhecimento clínico enviado pelo Maicon em 18/11/2026 ("Módulo avançado: protocolos terapêuticos e diagnóstico
// diferencial na MTC"; cópia em /mnt/project-files/spazio/conhecimento/). Ele escolheu usar tudo ("Completo"):
// - PROTOCOLOS: para cada síndrome, fisiopatologia, princípio, técnica e pontos com a ação de cada um. Vale para as
//   hipóteses (sugestões no Plano) e para a lista clínica da aba Zang-Fu.
// - PADROES_MAIS: três hipóteses novas. Só aparecem com um sinal próprio delas (chave), para não mudar as hipóteses
//   do protótipo v1 (tests/comparar.mjs).
// - DIFERENCIAIS: como diferenciar síndromes parecidas quando aparecem juntas.
// - SUBSTANCIAS: objetivos com os pontos base, nas abas Qi e Xue, Jin Ye e Jing e Shen.
// Tudo é apoio ao raciocínio clínico: o profissional aceita, descarta e escolhe os pontos.
import { SIGN, SIGNS } from './sinais.js';

// Sinais novos, usados pelas hipóteses novas. Ficam fora de SIGNS (referência do v1) e entram nas listas da tela.
export const SINAIS_MAIS = [['aversao_frio','Aversão ao frio ou ao vento'],['espirros_coriza','Espirros e coriza clara'],['dor_nuca','Dor ou rigidez na nuca'],['sem_suor','Sem suor'],
  ['sede_fria','Sede de água gelada'],['dor_epigastrica','Dor epigástrica ou azia'],['gengivas','Gengivas inflamadas ou mau hálito'],['frio_abdome','Frio no abdome, melhora com calor'],['urina_clara','Urina clara e abundante']];
export const PULSOS_MAIS = [['pulso_superficial','Superficial'],['pulso_tenso','Tenso']];
[...SINAIS_MAIS, ...PULSOS_MAIS].forEach(([k, v]) => { SIGN[k] = v; });
// Listas mostradas na tela: as do v1 mais as novas, no fim de cada grupo.
export const SIGNS_TELA = { ...SIGNS, 'Pulso':[...SIGNS['Pulso'], ...PULSOS_MAIS], 'Sinais e sintomas':[...SIGNS['Sinais e sintomas'], ...SINAIS_MAIS] };

export const PADROES_MAIS = [
  {id:'bp_umid_frio',nome:'Umidade-Frio invadindo o Baço',el:'terra',tipo:'exc',chave:['frio_abdome'],
   sinais:['frio_abdome','saburra_branca','lingua_inchada','pulso_escorregadio','pulso_lento','peso_corpo','fezes_amolecidas','distensao_pos']},
  {id:'e_fogo',nome:'Fogo no Estômago',el:'terra',tipo:'exc',chave:['sede_fria','dor_epigastrica','gengivas'],
   sinais:['sede_fria','dor_epigastrica','gengivas','saburra_amarela','lingua_vermelha','pulso_rapido','boca_seca']},
  {id:'p_vento_frio',nome:'Invasão de Vento-Frio no Pulmão',el:'metal',tipo:'exc',chave:['aversao_frio','espirros_coriza','dor_nuca','sem_suor','pulso_superficial','pulso_tenso'],
   sinais:['aversao_frio','espirros_coriza','dor_nuca','sem_suor','pulso_superficial','pulso_tenso','saburra_branca']}
];

export const TECNICAS_PROTOCOLO = { ton:'Tonificação', disp:'Dispersão / sedação', harm:'Harmonização' };
// [código, ação, técnica do ponto (opcional: quando difere da técnica geral)]
export const PROTOCOLOS = {
  c_xue:{sistema:'Coração (Xin) e Mente (Shen)',fisio:'O Sangue insuficiente não nutre o Coração e não ancora o Shen durante a noite.',principio:'Nutrir o Xue, tonificar o Coração e acalmar o Shen.',tecnica:'ton',moxa:'',
    pontos:[['C7','Ponto fonte; nutre o Sangue do Coração e acalma a mente'],['CS6','Abre o tórax, regula o ritmo cardíaco e tranquiliza o Shen'],['B15','Xinshu; tonifica o Coração'],['B17','Geshu, ponto de influência do Sangue; com B15 leva Xue ao Coração'],['BP6','Fortalece Baço e Estômago, fonte do Sangue'],['E36','Fortalece Baço e Estômago, fonte do Sangue']]},
  c_fogo:{sistema:'Coração (Xin) e Mente (Shen)',nome:'Fogo do Coração em excesso',fisio:'Estagnação emocional prolongada gera Calor que sobe para a língua e perturba a mente.',principio:'Drenar o Fogo do Coração, limpar o Calor e acalmar o Shen.',tecnica:'disp',moxa:'',
    pontos:[['C8','Ponto manancial (Fogo); drena o Fogo do meridiano do Coração'],['C7','Em sedação, acalma a agitação mental e a insônia severa'],['IG11','Drena o Calor sistêmico e limpa o Fogo'],['R6','Nutre o Yin do Rim para conter o Fogo do Coração (eixo Água-Fogo)','ton']]},
  bp_qi:{sistema:'Baço (Pi) e Estômago (Wei)',fisio:'Falha no transporte e transformação (Yun Hua): falta de energia e retenção leve de líquidos.',principio:'Tonificar o Qi do Baço e fortalecer o Aquecedor Médio.',tecnica:'ton',moxa:'opcional',
    pontos:[['BP3','Ponto fonte; tonifica o Baço'],['E36','Ponto Terra e Mar; tonifica o Qi pós-celestial e a digestão'],['VC12','Mo do Estômago e influência das vísceras Fu; harmoniza o centro'],['B20','Pishu, Shu dorsal do Baço'],['B21','Weishu, Shu dorsal do Estômago']]},
  bp_umid_frio:{sistema:'Baço (Pi) e Estômago (Wei)',fisio:'A Umidade pesada e fria bloqueia o Yang do Baço e impede a ascensão do Qi puro.',principio:'Aquecer o centro, transformar a Umidade e fortalecer o Baço.',tecnica:'harm',moxa:'indicada',
    pontos:[['BP9','Ponto Mar (Água); mestre para drenar Umidade'],['E40','Transforma a Umidade e a Fleuma'],['VC9','Shuifen; regula a passagem das águas'],['E25','Tianshu; com VC9 cessa diarreia e fezes soltas'],['VC12','Com moxa, aquece o frio interno'],['E36','Com moxa, reativa o Baço']]},
  e_fogo:{sistema:'Baço (Pi) e Estômago (Wei)',fisio:'Alimentos quentes ou picantes, ou estagnação alimentar, geram Calor intenso no Estômago.',principio:'Limpar o Calor do Estômago e promover a descida do Qi.',tecnica:'disp',moxa:'',
    pontos:[['E44','Ponto manancial (Água); drena Calor e Fogo do Estômago (gengivas e face)'],['E34','Ponto Xi; acalma dor epigástrica aguda e acidez'],['VC13','Shangwan; promove a descida do Qi rebelde'],['VC10','Xiawan; promove a descida do Qi rebelde'],['IG4','Limpa o Calor no trajeto Yang Ming (boca e estômago)']]},
  p_qi:{sistema:'Pulmão (Fei)',fisio:'O Pulmão falha em governar o Qi e difundir o Wei Qi para a pele.',principio:'Tonificar o Qi do Pulmão e consolidar o exterior.',tecnica:'ton',moxa:'',
    pontos:[['P9','Ponto fonte e de influência dos vasos; tonifica Qi e Yin do Pulmão'],['P7','Estimula a difusão e a descida do Pulmão'],['VC6','Qihai; tonifica o Qi original (ou VC17)'],['VC17','Danzhong, mar do Qi no tórax (ou VC6)'],['B13','Feishu; tonifica o Pulmão'],['E36','Nutre a mãe (Terra) para fortalecer o filho (Metal)']]},
  p_vento_frio:{sistema:'Pulmão (Fei)',fisio:'Fator patogênico externo bloqueia os poros e impede a descida do Qi do Pulmão.',principio:'Liberar o exterior, dispersar o Vento-Frio e restaurar a descida do Pulmão.',tecnica:'disp',moxa:'suave',extra:'Ventosa ou moxa suave.',
    pontos:[['P7','Com IG4 abre os poros, sudorese leve, expulsa o patógeno'],['IG4','Com P7, dupla clássica para liberar o exterior'],['VB20','Expulsa o Vento da região cervical'],['B12','Fengmen; expulsa o Vento da região dorsal alta'],['VG16','Fengfu; dispersa o Vento da cabeça e da nuca']]},
  r_yin:{sistema:'Rim (Shen)',fisio:'Esgotamento dos fluidos profundos e do Jing gera Calor vazio.',principio:'Nutrir o Yin do Rim, preservar o Jing e limpar o Calor vazio.',tecnica:'ton',moxa:'evitar',
    pontos:[['R3','Ponto fonte; nutre a raiz Yin e Yang do Rim'],['R6','Nutre o Yin do Rim, umedece a garganta e acalma o Calor vazio'],['BP6','Reunião dos três Yin do pé; nutre Yin e Xue'],['VC4','Nutre o Yin e ancora o Jing no Aquecedor Inferior']]},
  r_yang:{sistema:'Rim (Shen)',fisio:'Declínio do Fogo do Ming Men: frio interno e falha na transformação das águas.',principio:'Tonificar e aquecer o Yang do Rim.',tecnica:'ton',moxa:'essencial',
    pontos:[['R3','Ponto fonte do Rim'],['R7','Fuliu; tonifica o Yang do Rim e regula o metabolismo hídrico'],['VG4','Mingmen; com moxa aquece a raiz do Fogo'],['B23','Shenshu; com moxa aquece a região lombar'],['VC4','Com moxa restaura o Yuan Qi (ou VC6)'],['VC6','Com moxa aquece o Aquecedor Inferior (ou VC4)']]},
  f_estag:{sistema:'Fígado (Gan)',fisio:'Tensão emocional bloqueia o livre fluxo (Shu Xie) do Fígado.',principio:'Circular o Qi do Fígado, liberar a estagnação e harmonizar as emoções.',tecnica:'harm',moxa:'',
    pontos:[['F3','Com IG4 forma os Quatro Portões (Si Guan); move Qi e Xue'],['IG4','Com F3, Quatro Portões'],['VB34','Ponto Mar e influência dos tendões; relaxa a tensão'],['CS6','Libera a opressão torácica e o nó na garganta (Mei He Qi)'],['F14','Qimen, Mo do Fígado; alivia a distensão nos hipocôndrios']]},
  f_yang:{sistema:'Fígado (Gan)',fisio:'Deficiência de Yin do Rim e do Fígado deixa o Yang do Fígado sem âncora; ele sobe para a cabeça.',principio:'Acalmar o Fígado, ancorar o Yang e nutrir o Yin.',tecnica:'disp',extra:'Dispersão no topo e tonificação na base.',moxa:'',
    pontos:[['F3','Ancora e drena o excesso de Yang','disp'],['F2','Xingjian; drena o Calor que sobe pelo Fígado','disp'],['VB20','Alivia cefaleia latejante, tontura e pressão nos olhos','disp'],['Taiyang','Ponto extra; cefaleia e pressão nos olhos','disp'],['R3','Nutre a Água (Yin) para conter a Madeira','ton'],['BP6','Nutre o Yin','ton']]}
};
export const MOXA_TXT = { opcional:'moxa opcional', indicada:'moxa fortemente indicada', essencial:'moxa essencial', evitar:'evitar moxa', suave:'ventosa ou moxa suave' };
export const SISTEMAS_ZF = ['Coração (Xin) e Mente (Shen)','Baço (Pi) e Estômago (Wei)','Pulmão (Fei)','Rim (Shen)','Fígado (Gan)'];

export const DIFERENCIAIS = [
  {titulo:'Fadiga e cansaço',ids:['bp_qi','r_yang'],comum:'Cansaço físico, fezes amolecidas, falta de ânimo, língua pálida e pulso fraco.',
   criterio:{bp_qi:'Foco digestivo e muscular: distensão abdominal após comer, falta de apetite, peso nos membros e marcas de dentes na língua, sem frio intenso.',
     r_yang:'Foco térmico, lombar e urinário: frio intenso (mãos, pés e lombar gelados), dor surda em joelhos ou lombar, urina clara e abundante (acorda para urinar) e libido baixa.'}},
  {titulo:'Insônia e agitação',ids:['c_xue','c_fogo','r_yin'],comum:'Sono perturbado, sonhos excessivos e palpitações.',
   criterio:{c_xue:'Dificuldade para pegar no sono (início da noite), palpitações leves em repouso, memória fraca, tontura, rosto e língua pálidos.',
     c_fogo:'Sono agitado com pesadelos, aftas, sede de água gelada, rosto vermelho, urina escura, língua muito vermelha com saburra amarela.',
     r_yin:'Acorda várias vezes de madrugada, suor noturno, calor nas palmas e plantas, boca seca à noite, zumbido, língua vermelha sem saburra (desarmonia Coração-Rim).'}},
  {titulo:'Dor de cabeça e irritabilidade',ids:['f_estag','f_yang'],comum:'Tensão emocional, irritabilidade e pulso em corda.',
   criterio:{f_estag:'Dor errática, em peso ou distensão, ligada ao estresse, melhora com suspiros ou exercício; sem sinais de calor nem tontura intensa; língua de cor normal.',
     f_yang:'Dor latejante e intensa (têmporas, atrás dos olhos ou topo), com tontura, zumbido, rosto vermelho e irritabilidade explosiva; bordas da língua vermelhas.'}},
  {titulo:'Falta de ar e tosse',ids:['p_qi','p_vento_frio'],comum:'Sintomas respiratórios e alteração na voz.',
   criterio:{p_qi:'Interior e deficiência: quadro crônico, falta de ar que piora ao falar ou caminhar, voz baixa, tosse sem força, suor espontâneo de dia, pulso vazio ou fraco.',
     p_vento_frio:'Exterior e excesso: quadro agudo (começou hoje ou ontem), aversão ao frio ou vento, espirros, coriza clara, dor na nuca, sem suor, pulso superficial e tenso.'}}
];
// Diferenciais que valem para as hipóteses presentes (pelo menos duas do mesmo grupo).
export const diferenciaisDe = ids => { const s = new Set(ids); return DIFERENCIAIS.filter(d => d.ids.filter(i => s.has(i)).length >= 2); };

// Objetivos das substâncias vitais: [chave, nome, pontos base, técnica, aba]
export const SUBSTANCIAS = [
  ['ton_qi','Tonificar o Qi geral',['E36','VC6','P9'],'Tonificação + moxa suave','qixue'],
  ['mov_qi','Mover o Qi estagnado',['F3','IG4','VC17'],'Harmonização / dispersão','qixue'],
  ['nut_xue','Produzir e nutrir Xue',['B17','B20','BP6','E36'],'Tonificação','qixue'],
  ['mov_xue','Mover Xue estagnado',['BP10','B17','F3'],'Dispersão','qixue'],
  ['nut_jinye','Nutrir Jin Ye (líquidos)',['R6','BP6','VC4'],'Tonificação, sem moxa','jinye'],
  ['dren_umid','Drenar Umidade / Fleuma',['BP9','E40','VC9'],'Dispersão + moxa se houver Frio','jinye'],
  ['nut_jing','Preservar e nutrir Jing',['R3','VC4','B23','VB39'],'Tonificação profunda','jingshen'],
  ['acalma_shen','Acalmar e ancorar Shen',['C7','CS6','Yintang','VG20'],'Harmonização suave','jingshen']
];
// Item marcado a partir das listas clínicas: ref "zf:<id da síndrome>" ou "sub:<chave do objetivo>".
export const pontosDaRef = ref => {
  const [t, k] = String(ref || '').split(':');
  if (t === 'zf' && PROTOCOLOS[k]) return { pontos:PROTOCOLOS[k].pontos, tecnica:PROTOCOLOS[k].tecnica, moxa:PROTOCOLOS[k].moxa };
  const s = t === 'sub' && SUBSTANCIAS.find(x => x[0] === k);
  return s ? { pontos:s[2].map(c => [c, '']), tecnicaTxt:s[3] } : null;
};
// Pontos sugeridos de uma hipótese: os do protocolo, quando há; senão os do v1.
export const pontosPadrao = p => PROTOCOLOS[p?.id]?.pontos || p?.pontos || [];
