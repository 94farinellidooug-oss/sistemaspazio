// Casos de teste do raciocínio clínico de apoio. Cada caso roda com uma "api"
// (o protótipo original ou os módulos novos) e devolve um resultado serializável.

const evalSerial = hs => hs.map(h => ({ padrao: h.p.id, sinais: h.m, faltando: h.falta, score: h.score }));
const pac = alerts => ({ alerts: { gestante: false, anticoagulante: false, marcapasso: false, ...alerts } });

export function casos(api) {
  const { PATTERNS, SIGNS } = api;
  const todos = Object.values(SIGNS).flat().map(([k]) => k);
  const helena = ['bordas_vermelhas','pulso_corda','cefaleia_temporal','irritabilidade','tpm','distensao_hipo','suspiros'];
  const rafael = ['lingua_palida','lingua_inchada','pulso_profundo','pulso_lento','frio_extremidades','lombalgia','mic_frequente','cansaco','fezes_amolecidas'];
  const lucia = ['lingua_vermelha','sem_saburra','pulso_fino','pulso_rapido','insonia','palpitacoes','sudorese_noturna','calor_tarde','ansiedade'];
  const tiago = ['marcas_dentes','pulso_fraco','distensao_pos','ansiedade','cansaco','fezes_amolecidas','preocupacao'];
  const C = [];
  const av = (nome, sinais, status) => C.push([nome, {
    hipoteses: evalSerial(api.evaluate(sinais)),
    bagang: api.bagang(sinais),
    elementos: api.elemState(sinais, status),
  }]);

  // 1. Cada padrão com todos os seus sinais
  PATTERNS.forEach(p => av(`padrão completo: ${p.id}`, [...p.sinais], {}));
  // 2. Cada padrão só com os dois primeiros sinais (limiar mínimo)
  PATTERNS.forEach(p => av(`padrão mínimo: ${p.id}`, p.sinais.slice(0, 2), {}));
  // 3. Pacientes de exemplo, com os status salvos
  av('exemplo Helena', helena, { f_estag: 'aceito', f_yang: 'aceito' });
  av('exemplo Rafael', rafael, { r_yang: 'aceito' });
  av('exemplo Lúcia', lucia, { r_yin: 'aceito' });
  av('exemplo Tiago', tiago, { bp_qi: 'aceito' });
  // 4. Extremos
  av('nenhum sinal', [], {});
  av('um sinal só', ['pulso_corda'], {});
  av('todos os sinais', todos, {});
  av('sinais contraditórios', ['lingua_palida','lingua_vermelha','pulso_rapido','pulso_lento','frio_extremidades','calor_tarde'], {});
  // 5. Status aceito / descartado
  av('Helena tudo descartado', helena, { f_estag: 'descartado', f_yang: 'descartado', estase_xue: 'descartado' });
  av('Helena misto', helena, { f_estag: 'aceito', f_yang: 'descartado' });
  av('Lúcia sem status', lucia, {});
  // 6. Eixos do Ba Gang isolados
  av('só calor', ['lingua_vermelha','aftas','boca_seca'], {});
  av('só frio', ['pulso_lento','frio_extremidades'], {});
  av('só deficiência', ['pulso_fraco','cansaco','voz_fraca'], {});
  av('só excesso', ['pulso_corda','dor_fixa','peso_corpo'], {});

  // 7. Alertas de segurança
  const pw = (nome, codigos, p, tec) => C.push([nome, { avisos: api.pointWarnings(codigos, p, tec) }]);
  pw('gestante com IG4 e BP6', ['IG4','BP6','E36'], pac({ gestante: true }), []);
  pw('não gestante com IG4', ['IG4'], pac({}), []);
  pw('anticoagulante e ventosa', ['E36'], pac({ anticoagulante: true }), ['Ventosa']);
  pw('marcapasso e eletroacupuntura', [], pac({ marcapasso: true }), ['Eletroacupuntura']);
  pw('ponto inexistente', ['XX99'], pac({}), []);
  pw('ponto torácico e profundidade', ['B13','VB20'], pac({}), []);
  pw('sem pontos nem técnicas', [], pac({}), []);

  // 8. Desenho do pentagrama
  const est = api.elemState(helena, { f_estag: 'aceito' });
  const vazio = api.elemState([], {});
  C.push(['pentagrama sem avaliação', { svg: api.pentagram(vazio, null) }]);
  C.push(['pentagrama Helena', { svg: api.pentagram(est, null) }]);
  C.push(['pentagrama com Madeira selecionada', { svg: api.pentagram(est, 'madeira') }]);
  C.push(['pentagrama sem ciclo Sheng', { svg: api.pentagram(est, 'agua', { sheng: false, ke: true }) }]);
  C.push(['pentagrama sem ciclo Ke', { svg: api.pentagram(est, null, { sheng: true, ke: false }) }]);
  C.push(['pentagrama Rafael', { svg: api.pentagram(api.elemState(rafael, { r_yang: 'aceito' }), 'agua') }]);

  // 9. Minigráfico de evolução (EVA)
  C.push(['gráfico EVA 7-6-4', { svg: api.spark([7, 6, 4]) }]);
  C.push(['gráfico EVA um valor', { svg: api.spark([5]) }]);
  C.push(['gráfico EVA vazio', { svg: api.spark([]) }]);
  return C;
}
