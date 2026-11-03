// Cinco elementos (Wu Xing): correspondências e ciclos Sheng e Ke.

export const EL = {
  madeira:{nome:'Madeira',han:'木',cor:'var(--wood)',ang:198,zang:'Fígado',fu:'Vesícula Biliar',emocao:'Raiva',estacao:'Primavera',clima:'Vento',sentido:'Olhos',tecido:'Tendões',sabor:'Ácido',som:'Grito',espirito:'Hun',funcoes:['Armazena o Xue','Garante o livre fluxo do Qi','Nutre tendões e olhos']},
  fogo:{nome:'Fogo',han:'火',cor:'var(--fire)',ang:-90,zang:'Coração · Pericárdio',fu:'Intestino Delgado · Triplo Aquecedor',emocao:'Alegria (em excesso, agitação)',estacao:'Verão',clima:'Calor',sentido:'Língua',tecido:'Vasos',sabor:'Amargo',som:'Riso',espirito:'Shen',funcoes:['Governa o Xue e os vasos','Abriga o Shen','Manifesta-se na face']},
  terra:{nome:'Terra',han:'土',cor:'var(--earth)',ang:-18,zang:'Baço',fu:'Estômago',emocao:'Preocupação',estacao:'Fim do verão',clima:'Umidade',sentido:'Boca',tecido:'Músculos',sabor:'Doce',som:'Canto',espirito:'Yi',funcoes:['Transforma e transporta','Produz Qi e Xue a partir dos alimentos','Mantém o Xue nos vasos']},
  metal:{nome:'Metal',han:'金',cor:'var(--metal)',ang:54,zang:'Pulmão',fu:'Intestino Grosso',emocao:'Tristeza',estacao:'Outono',clima:'Secura',sentido:'Nariz',tecido:'Pele e pelos',sabor:'Picante',som:'Choro',espirito:'Po',funcoes:['Governa o Qi e a respiração','Difunde o Wei Qi','Regula as vias das águas']},
  agua:{nome:'Água',han:'水',cor:'var(--water)',ang:126,zang:'Rim',fu:'Bexiga',emocao:'Medo',estacao:'Inverno',clima:'Frio',sentido:'Ouvidos',tecido:'Ossos',sabor:'Salgado',som:'Gemido',espirito:'Zhi',funcoes:['Armazena o Jing','Governa a água','Raiz do Yin e do Yang do corpo']}
};
export const ORDER = ['fogo','terra','metal','agua','madeira'];
export const SHENG = {madeira:'fogo',fogo:'terra',terra:'metal',metal:'agua',agua:'madeira'};
export const KE = {madeira:'terra',terra:'agua',agua:'fogo',fogo:'metal',metal:'madeira'};
export const mae = e => Object.keys(SHENG).find(k=>SHENG[k]===e);
export const controlador = e => Object.keys(KE).find(k=>KE[k]===e);
