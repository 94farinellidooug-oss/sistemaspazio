// Regras das Configurações da clínica (etapa 10): padrões iguais aos de antes, dados da clínica,
// serviços (fora de uso some da Agenda, mas o horário antigo segue com duração e valor) e horário
// de atendimento (dia fechado e intervalo tiram horários livres).
// Uso: node tests/config.mjs
import { SERVICOS, horariosLivres, novoHorario, servicoDe } from '../js/dados/agenda.js';
import { CLINICA } from '../js/dados/documentos.js';
import { aplicarConfig, configDe, resumoHorario, salvarClinica, salvarHorario, salvarServicos } from '../js/dados/config.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const J = x => JSON.stringify(x);
const db = { patients:[], appts:[] };
const antes = J(SERVICOS), livresAntes = horariosLivres([], '2026-11-08', 'Acupuntura');

aplicarConfig(db);
ok(J(SERVICOS) === antes && CLINICA === 'Spazio Stabilità' && !('config' in db), 'sem configuração salva: tudo como antes e nada gravado no documento');
ok(J(horariosLivres([], '2026-11-08', 'Acupuntura')) === J(livresAntes) && livresAntes[0] === '08:00' && livresAntes.at(-1) === '18:00', 'horário padrão: todos os dias das 8h às 19h');

ok(salvarClinica(db, { nome:' ', cidade:'X', uf:'RS' }) === 'Escreva o nome da clínica.', 'clínica sem nome não salva');
ok(salvarClinica(db, { nome:'Clínica Sol', cidade:'Porto Alegre', uf:'RS', doc:'12.345.678/0001-90' }) === '' && CLINICA === 'Clínica Sol' && db.config.clinica.doc === '12345678000190', 'nome da clínica vai para os documentos; CNPJ só com números');

const S = configDe(db).servicos; S.find(s => s.nome === 'Massoterapia').ativo = false; S[0].valor = 190;
ok(salvarServicos(db, S) === '' && !SERVICOS.some(s => s[0] === 'Massoterapia') && J(servicoDe('Massoterapia')) === J(['Massoterapia', 60, 160]), 'serviço fora de uso sai da Agenda e o horário antigo segue com duração e valor');
ok(novoHorario('a', 'p', '2026-11-09', '09:00', 'Acupuntura').valor === 190, 'preço novo vale para os próximos horários');
ok(salvarServicos(db, [...S, { nome:'acupuntura', dur:60, valor:1 }]) === 'Há dois serviços com o mesmo nome.' && salvarServicos(db, S.map(s => ({ ...s, ativo:false }))) === 'Deixe pelo menos um serviço em uso.', 'nome repetido e nenhum em uso não salvam');

const H = configDe(db).horario; H.dias[6].aberto = false; H.dias[5] = { aberto:true, ini:'08:00', fim:'12:00' }; H.pausa = { tem:true, ini:'12:00', fim:'13:00' };
ok(salvarHorario(db, H) === '', 'horário salvo');
const seg = horariosLivres([], '2026-11-09', 'Acupuntura');
ok(J(horariosLivres([], '2026-11-08', 'Acupuntura')) === '[]' && J(horariosLivres([], '2026-11-07', 'Acupuntura')) === J(['08:00', '09:00', '10:00', '11:00']), 'domingo fechado; sábado só de manhã');
ok(!seg.includes('12:00') && seg.includes('11:00') && seg.includes('13:00'), 'intervalo do almoço fica sem horário livre');
ok(resumoHorario(configDe(db).horario) === '6 dias abertos · 54 horas de atendimento por semana', 'resumo do horário: 5 dias de 11h menos 1h de intervalo, mais 4h no sábado');
H.dias[0] = { aberto:true, ini:'19:00', fim:'08:00' };
ok(salvarHorario(db, H) === 'Segunda: o horário de fechar precisa ser depois do de abrir.', 'fechar antes de abrir não salva');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as regras das Configurações passaram.');
process.exit(falhas ? 1 : 0);
