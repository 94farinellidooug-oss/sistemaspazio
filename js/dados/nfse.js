// Nota fiscal de serviço (NFS-e) pelo Padrão Nacional (etapa 10, decisão do Maicon em 07/11/2026: API oficial
// da Receita com o certificado A1 da própria clínica, sem intermediário pago). Quem emite é a função nfse do
// servidor (supabase/functions/nfse); aqui ficam a configuração fiscal da clínica e as notas emitidas.
//
// db.config.nfse = { ambiente:'homologacao'|'producao', regime:'1'|'2'|'3', codigo (6 números), pTotTribSN,
//   fed, est, mun (percentuais aproximados de tributos), aliquota (ISS %, opcional), serie, proximo }
// db.financeiro.notas = [{ id (no servidor), rec (recebimento), situacao:'emitida'|'enviando'|'rejeitada',
//   numero, chave, ndps, serie, ambiente, valor, tomador, cpf, descricao, data, emitidaEm, consulta, msg, em, por }]
// Municípios: tabela do IBGE (js/conhecimento/municipios.txt, código, nome e UF), para o código da cidade da nota.
import { fmt } from '../util.js';

// Códigos de tributação nacional (item, subitem e desdobro da LC 116/2003) mais usados em saúde e bem-estar.
export const CODIGOS_SERVICO = [
  ['040501', 'Acupuntura'],
  ['040901', 'Terapias de qualquer espécie para tratamento físico, orgânico e mental'],
  ['040101', 'Medicina e biomedicina'],
  ['040801', 'Terapia ocupacional, fisioterapia e fonoaudiologia'],
  ['041001', 'Nutrição'],
  ['041601', 'Psicologia'],
  ['060201', 'Esteticistas, tratamento de pele, depilação e congêneres']
];
export const REGIMES_NOTA = [['2', 'MEI'], ['3', 'Simples Nacional (ME ou EPP)'], ['1', 'Fora do Simples Nacional']];
export const AMBIENTES = { homologacao:'Homologação (teste, sem valor fiscal)', producao:'Produção (nota com valor fiscal)' };
const PADRAO = { ambiente:'homologacao', regime:'', codigo:'040501', pTotTribSN:'', fed:'', est:'', mun:'', aliquota:'', serie:'1', proximo:'' };

export const codigoTxt = c => String(c || '').replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3');
export const nomeCodigo = c => CODIGOS_SERVICO.find(x => x[0] === c)?.[1] || '';
export const configNota = db => ({ ...PADRAO, ...(db.config?.nfse || {}) });
const num = v => String(v ?? '').trim().replace(',', '.');
const pctOk = v => v !== '' && Number(v) >= 0 && Number(v) <= 100;

// Salva a configuração fiscal. Devolve a mensagem de erro, ou ''.
export function salvarConfigNota(db, D){
  const N = { ...configNota(db) };
  for (const k of ['ambiente', 'regime', 'codigo', 'serie', 'proximo']) if (D[k] !== undefined) N[k] = String(D[k]).trim();
  for (const k of ['pTotTribSN', 'fed', 'est', 'mun', 'aliquota']) if (D[k] !== undefined) N[k] = num(D[k]);
  N.codigo = N.codigo.replace(/\D/g, '');
  if (!AMBIENTES[N.ambiente]) return 'Escolha homologação ou produção.';
  if (!REGIMES_NOTA.some(r => r[0] === N.regime)) return 'Escolha o regime tributário da clínica.';
  if (N.codigo.length !== 6) return 'O código do serviço tem 6 números (por exemplo 04.05.01).';
  if (N.regime === '3' && !pctOk(N.pTotTribSN)) return 'Informe o percentual aproximado de tributos do Simples (de 0 a 100).';
  if (N.regime === '1' && !['fed', 'est', 'mun'].every(k => pctOk(N[k]))) return 'Informe os três percentuais aproximados de tributos (de 0 a 100).';
  if (N.aliquota !== '' && !(Number(N.aliquota) > 0 && Number(N.aliquota) <= 5)) return 'A alíquota do ISS fica entre 0,01% e 5% (ou deixe em branco).';
  if (!/^\d{1,5}$/.test(N.serie) || Number(N.serie) < 1) return 'A série é um número de 1 a 49999.';
  if (N.proximo !== '' && !/^[1-9]\d{0,14}$/.test(N.proximo)) return 'O número inicial precisa ser um número inteiro.';
  (db.config ||= {}).nfse = N; return '';
}

// Tabela de municípios: "código\tnome\tUF" por linha.
const semAcentoMun = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const lerMunicipios = txt => String(txt).split('\n').map(l => l.split('\t')).filter(x => x.length === 3 && /^\d{7}$/.test(x[0])).map(([c, n, uf]) => ({ c, n, uf:uf.trim(), k:semAcentoMun(n) }));
export const codigoMunicipio = (L, cidade, uf) => (L || []).find(m => m.uf === uf && m.k === semAcentoMun(cidade))?.c || '';

// O que ainda falta para emitir (lista de textos; vazia = pronto).
export function faltaParaNota(cfgClinica, nota, certificado, ibge){
  const F = [], doc = String(cfgClinica.doc || '').replace(/\D/g, '');
  if (!certificado) F.push('enviar o certificado digital A1');
  else if (new Date(certificado.validade) <= new Date()) F.push('enviar um certificado dentro da validade');
  if (doc.length !== 11 && doc.length !== 14) F.push('informar o CNPJ (ou CPF) da clínica');
  if (!nota.regime) F.push('escolher o regime tributário');
  if (ibge === '') F.push(`conferir a cidade da clínica (${cfgClinica.cidade} - ${cfgClinica.uf} não foi encontrada no IBGE)`);
  return F;
}

export const notasDe = (db, recId) => (db.financeiro?.notas || []).filter(n => n.rec === recId);
// A nota que vale para o recebimento: a emitida, ou a que ficou sem resposta.
export const notaDe = (db, recId) => { const L = notasDe(db, recId); return L.find(n => n.situacao === 'emitida') || L.find(n => n.situacao === 'enviando') || null; };
export function guardarNota(db, n){
  const F = db.financeiro ||= {}, L = F.notas ||= [], i = L.findIndex(x => x.id === n.id);
  if (i >= 0) L[i] = { ...L[i], ...n }; else L.push(n);
  return L[i >= 0 ? i : L.length - 1];
}
export const descricaoNota = (tipo, data) => `${tipo || 'Atendimento'} realizado em ${fmt(data)}`;
export const cpfDe = p => String(p?.cadastro?.cpf || '').replace(/\D/g, '');
export function cpfConfere(v){
  const c = String(v || '').replace(/\D/g, ''); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

// Pedido para a função nfse a partir do recebimento, da configuração e do que foi conferido na janela.
export function pedidoNota({ clinica, nota, ibge, valor, data, descricao, paciente, comCpf }){
  const T = nota.regime === '3' ? { pTotTribSN:nota.pTotTribSN } : nota.regime === '1' ? { fed:nota.fed, est:nota.est, mun:nota.mun } : {};
  const cpf = cpfDe(paciente);
  return {
    ambiente:nota.ambiente,
    nota:{ serie:nota.serie, proximo:nota.proximo ? Number(nota.proximo) : undefined, cLocEmi:ibge, dCompet:data,
      prestador:{ doc:String(clinica.doc || '').replace(/\D/g, ''), regime:nota.regime },
      tomador:comCpf && cpfConfere(cpf) ? { doc:cpf, nome:paciente.name, email:paciente.cadastro?.email || '' } : undefined,
      servico:{ cTribNac:nota.codigo, descricao }, valor:Math.round(valor * 100), tributos:T, aliquota:nota.aliquota }
  };
}
