// Cálculos dos revendedores (js/dados/revenda.js): código do link, link guardado no aparelho e números por revendedor.
// Uso: node tests/revenda.mjs
import { codigoDaUrl, codigoDoNome, linkRevenda, metricasRevenda, normalizarCodigo, revendaGuardada, situacaoComissao } from '../js/dados/revenda.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const agora = Date.parse('2026-12-01T12:00:00Z'), iso = d => new Date(agora + d * 864e5).toISOString();

ok(normalizarCodigo('  João Pé-de-Ouro! ') === 'joao-pe-de-ouro', 'código sem acento, espaço nem símbolo');
ok(codigoDoNome('Ana Maria Souza') === 'ana-maria' && codigoDoNome('Ana Maria', ['ana-maria', 'ana-maria2']) === 'ana-maria3', 'código pelos dois primeiros nomes; repetido ganha número');
ok(codigoDoNome('') === 'revenda' && codigoDoNome('X') === 'x1', 'nome vazio ou curto ainda dá um código válido');
ok(linkRevenda('ana') === 'https://musubisistema.com.br/inicio/?r=ana', 'link do revendedor');
ok(codigoDaUrl('?r=ANA') === 'ana' && codigoDaUrl('?r=a') === '' && codigoDaUrl('?x=1') === '' && codigoDaUrl('?r=<script>') === 'script', 'código lido do endereço, sempre limpo');
ok(revendaGuardada(JSON.stringify({ c:'ana', em:iso(-59) }), agora) === 'ana' && revendaGuardada(JSON.stringify({ c:'ana', em:iso(-61) }), agora) === '' && revendaGuardada('lixo', agora) === '', 'a indicação vale por 60 dias');

const K = (id, d, extra = {}) => ({ id, revendedor_id:'r1', clinica_id:'c1', comissao:2980, libera_em:iso(d), paga_em:null, cancelada_em:null, ...extra });
ok(situacaoComissao(K('a', -1), agora) === 'liberada' && situacaoComissao(K('b', 2), agora) === 'aguardando' && situacaoComissao(K('c', -1, { paga_em:iso(0) }), agora) === 'paga' && situacaoComissao(K('d', -1, { cancelada_em:iso(0) }), agora) === 'cancelada', 'situação de cada comissão');

const M = metricasRevenda({ agora,
  revendedores:[{ id:'r1', codigo:'ana', nome:'Ana', ativo:true }, { id:'r2', codigo:'beto', nome:'Beto', ativo:true }],
  visitas:[{ codigo:'ana', dia:'2026-11-29', visitas:3 }, { codigo:'ana', dia:'2026-09-01', visitas:5 }],
  clinicasRev:[{ clinica_id:'c1', revendedor_id:'r1' }, { clinica_id:'c2', revendedor_id:'r1' }, { clinica_id:'c3', revendedor_id:'r1' }],
  clinicas:[{ id:'c1', teste_ate:iso(-20) }, { id:'c2', teste_ate:iso(3) }, { id:'c3', teste_ate:iso(-1) }],
  comissoes:[K('a', -1), K('b', 2), K('c', -5, { paga_em:iso(-2) }), K('x', -5, { clinica_id:'c9', cancelada_em:iso(-1) })] });
const a = M[0];
ok(a.nome === 'Ana' && a.visitas === 8 && a.visitas30 === 3, 'visitas no total e nos últimos 30 dias');
ok(a.contas === 4 && a.emTeste === 1 && a.pagantes === 1 && a.conversao === 25, 'contas (inclui a excluída que gerou comissão), em teste, pagantes e conversão');
ok(a.aPagar === 2980 && a.aguardando === 2980 && a.pago === 2980, 'a pagar, aguardando e já pago (cancelada não conta)');
ok(M[1].contas === 0 && M[1].conversao === 0, 'revendedor sem vendas fica zerado');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nCálculos dos revendedores passaram.');
process.exit(falhas ? 1 : 0);
