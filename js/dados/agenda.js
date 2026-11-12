// Etapa 6A: agenda (aprovada pelo Maicon em 05/11/2026, proposta/etapa-6).
//
// O agendamento continua no formato do protótipo: {id, pid, date, time, tipo, valor, done}. done é
// "atendido". Os campos novos só aparecem quando usados:
//   st: 'confirmado' | 'faltou' | 'desmarcado' (sem st e sem done = agendado)
//   hist: ['remarcado de 05/11/2026 16:00', 'desmarcado em 05/11/2026', ...] (mais recente primeiro)
//   online: true (consulta online por vídeo); video: código da consulta no servidor (vai no link do paciente)
// Desmarcado não é apagado: some das contagens e da agenda do dia, e fica na lista de desmarcados.
// Duração e valor de cada serviço são padrões da clínica (mudam em Configurações, etapa 10).
import { addDays, fmt } from '../util.js';

// [serviço, minutos, valor]
export const SERVICOS = [['Acupuntura', 60, 180], ['Acupuntura e moxabustão', 60, 200], ['Auriculoterapia', 30, 90], ['Ventosaterapia', 45, 150], ['Massoterapia', 60, 160], ['Avaliação inicial', 90, 220]];
// Todos os serviços, inclusive os fora de uso (para os horários antigos continuarem com duração e valor).
// SERVICOS fica só com os em uso. As duas listas mudam no lugar quando a clínica salva em Configurações.
export const TODOS_SERVICOS = SERVICOS.slice();
export const servicoDe = tipo => TODOS_SERVICOS.find(s => s[0] === tipo) || [tipo, 60, 0];
export const SITUACOES_HORARIO = [['agendado', 'Agendado', 'relogio'], ['confirmado', 'Confirmado', 'check'], ['atendido', 'Atendido', 'okc'], ['faltou', 'Faltou', 'x']];
export const INICIO_DIA = 8 * 60, FIM_DIA = 19 * 60;
// Horário de atendimento (Configurações). dias: segunda a domingo, {aberto, ini, fim}; pausa: {tem, ini, fim}.
// O padrão é o de antes das Configurações: todos os dias das 8h às 19h, sem intervalo.
export const HORARIO = { dias:Array.from({ length:7 }, () => ({ aberto:true, ini:'08:00', fim:'19:00' })), pausa:{ tem:false, ini:'12:00', fim:'13:00' } };

export const ativo = a => a.st !== 'desmarcado';
export const situacaoHorario = a => a.done ? 'atendido' : a.st || 'agendado';
const minutosAg = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };
const hhmmAg = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const fimHorario = a => hhmmAg(minutosAg(a.time) + servicoDe(a.tipo)[1]);
export const horariosDoDia = (L, d) => L.filter(a => a.date === d && ativo(a)).sort((a, b) => a.time.localeCompare(b.time));
export const inicioSemana = d => addDays(-((new Date(d + 'T12:00:00').getDay() + 6) % 7), d);

// Mesmos campos e na mesma ordem do protótipo, para a exportação v1 continuar idêntica.
export const novoHorario = (id, pid, date, time, tipo) => ({ id, pid, date, time, tipo, valor: servicoDe(tipo)[2], done: false });

// Muda a situação (agendado, confirmado, atendido ou faltou). Agendado e atendido não guardam st.
export function marcarHorario(a, st){
  if (!SITUACOES_HORARIO.some(s => s[0] === st)) return null;
  a.done = st === 'atendido';
  if (st === 'confirmado' || st === 'faltou') a.st = st; else delete a.st;
  return situacaoHorario(a);
}
export function desmarcar(a, hoje){
  a.done = false; a.st = 'desmarcado';
  (a.hist ||= []).unshift(`desmarcado em ${fmt(hoje)}`);
}
// Novo dia e horário; o anterior fica no histórico e o horário volta a agendado.
export function remarcar(a, date, time, tipo){
  if (a.st !== 'desmarcado' && a.date === date && a.time === time && a.tipo === tipo) return false;
  (a.hist ||= []).unshift(`remarcado de ${fmt(a.date)} ${a.time}`);
  a.date = date; a.time = time; if (tipo && tipo !== a.tipo) { a.tipo = tipo; a.valor = servicoDe(tipo)[2]; }
  a.done = false; delete a.st;
  return true;
}
// Horários livres do dia, de hora em hora, onde cabe o serviço sem encostar em outro.
export function horariosLivres(L, d, tipo, ignorar){
  const dur = servicoDe(tipo)[1], oc = horariosDoDia(L, d).filter(a => a.id !== ignorar).map(a => [minutosAg(a.time), minutosAg(a.time) + servicoDe(a.tipo)[1]]), R = [];
  const H = HORARIO.dias[(new Date(d + 'T12:00:00').getDay() + 6) % 7];
  if (!H?.aberto) return R;
  if (HORARIO.pausa.tem) oc.push([minutosAg(HORARIO.pausa.ini), minutosAg(HORARIO.pausa.fim)]);
  for (let m = minutosAg(H.ini); m + dur <= minutosAg(H.fim); m += 60) if (!oc.some(([i, f]) => m < f && m + dur > i)) R.push(hhmmAg(m));
  return R;
}
// Horário que encosta em outro já marcado no mesmo dia (para avisar, sem impedir).
export function conflito(L, d, time, tipo, ignorar){
  const i = minutosAg(time), f = i + servicoDe(tipo)[1];
  return horariosDoDia(L, d).find(a => a.id !== ignorar && i < minutosAg(a.time) + servicoDe(a.tipo)[1] && f > minutosAg(a.time)) || null;
}
// Ao finalizar um atendimento, o horário do paciente naquele dia fica como atendido.
export function concluirHorario(L, pid, d){
  const a = horariosDoDia(L, d).find(x => x.pid === pid && !x.done && x.st !== 'faltou');
  if (a) marcarHorario(a, 'atendido');
  return a || null;
}

// Consulta online: link que o paciente recebe (página consulta/ do site, com o termo e a entrada no vídeo).
export const linkConsulta = (id, base) => id ? `${String(base || '').replace(/\/$/, '')}/consulta/?c=${id}` : '';
// Dados que o servidor guarda de um horário online (o início no fuso do aparelho, em ISO).
export const dadosTeleconsulta = (a, primeiro, clinica) => ({ consulta:a.id, inicio:new Date(`${a.date}T${a.time}:00`).toISOString(), duracao:servicoDe(a.tipo)[1], primeiro, clinica_nome:clinica, cancelada:a.st === 'desmarcado' });
