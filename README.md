# MUSUBI (antes Sistema Spazio)

Plataforma de gestão clínica para acupuntura, Medicina Tradicional Chinesa e terapias integrativas.

O sistema funciona como apoio ao raciocínio do profissional. Não faz diagnósticos nem prescrições automáticas: toda hipótese mostra a justificativa e depende da validação do profissional.

## Como abrir

- **Sem instalar nada:** abra `dist/spazio.html` no navegador.
- **Versão modular (desenvolvimento):** com o Node.js 18 ou superior, rode `npm run dev` e abra http://localhost:5173. Módulos JavaScript não abrem com duplo clique no arquivo.

## Estrutura

```
index.html            página principal (carrega css/ e js/app.js)
css/
  tokens.css          cores, fontes, temas claro e escuro
  componentes.css     layout e componentes
js/
  app.js              rotas, renderização e eventos
  estado.js           estado da interface
  util.js             datas, formatação, texto
  dados/              camada de dados e exemplos (grava no navegador, chave spazio-v1)
  conhecimento/       elementos, sinais, padrões, pontos e meridianos
  raciocinio/         hipóteses de padrão, Ba Gang, estado dos elementos, alertas de segurança
  componentes/        pentagrama, gráfico de EVA, campos
  telas/              uma tela por arquivo (menu.js: menu recolhível; em-breve.js: módulos planejados)
tests/                testes de equivalência com o protótipo original
tools/                build do arquivo único e servidor local
legacy/               protótipo v1 original, preservado sem alterações (branch backup/v1.0-prototipo)
dist/spazio.html      arquivo único gerado por npm run build
```

## Testes

### Preparar o ambiente (uma vez)

Requer Node.js 18 ou superior.

```
npm ci                                   # instala o Playwright declarado no package.json
npx playwright install --with-deps chromium   # baixa o Chromium usado nos testes de navegador
```

No Windows e no macOS, `--with-deps` pode ser omitido.

### Comandos

| Comando | O que verifica |
| --- | --- |
| `npm test` | 51 casos de hipóteses, Ba Gang, cinco elementos, alertas, pentagrama e EVA, idênticos ao gravado a partir do protótipo original, e os testes da migração v1 → v2 (`tests/migracao.mjs`). |
| `npm run test:navegador` | Roda `tests/navegador.mjs`, que executa o mesmo roteiro de uso (cadastro, sessão, avaliação, pentagrama, pontos, agenda) no original, na versão modular e no arquivo único e compara, a cada passo, o resultado funcional da tela (pacientes, sinais, hipóteses, avisos, pentagrama, pontos, agenda, anamnese, sessões) e, no fim, os dados salvos, que precisam ser idênticos byte a byte. Roda também `tests/compatibilidade.mjs`, que confirma que `dist/spazio.html` abre direto do disco e que os dados da chave `spazio-v1` gravados pelo original continuam acessíveis, nos dois sentidos. |
| (incluído em `test:navegador`) `tests/interface.mjs` | Verifica a interface do MUSUBI: menu com 8 módulos, modo recolhido, migalhas, busca global (Ctrl K), notificações, perfil, atalhos de teclado, Painel, acompanhamento que leva à avaliação, atalhos do prontuário, telas "em breve", tema claro e gaveta no celular. |
| (incluído em `test:navegador`) `tests/pacientes.mjs` | Etapa 2C: busca e estado vazio da lista, cadastro completo (novo e edição, CPF validado), várias queixas com a evolução de cada uma, queixa resolvida e reativada, prontuário em linha do tempo e comparação entre avaliação basal e atual. |
| (incluído em `test:navegador`) `tests/layout.mjs sistema` | Abre cada tela em 6 larguras e 5 horários e confirma que nada sai do cartão, nada fixo cobre o conteúdo, não há rolagem horizontal nem erros. `npm run test:layout` roda também no arquivo único e `npm run test:proposta` na proposta aprovada. |
| `npm run test:tudo` | Tudo acima, na ordem: cálculos, build e navegador. |
| `npm run referencia` | Regrava a referência a partir de `legacy/`. Só deve ser usado se o próprio original mudar, o que não deve acontecer. |

Depois de qualquer mudança em `css/` ou `js/`, rode `npm run build` para atualizar `dist/spazio.html`.

### No GitHub

O workflow `.github/workflows/testes.yml` roda todos os testes em cada pull request e em cada envio para `main`. Ele também falha se `dist/spazio.html` não corresponder aos módulos.

## Dados salvos no navegador

Os dados ficam no `localStorage` do navegador, na chave `musubi-v2` (modelo v2, descrito em `js/dados/migracao.js`). O navegador separa os dados por endereço de origem.

- **Migração automática:** na primeira abertura, se houver dados do protótipo (chave `spazio-v1`), eles são convertidos para o v2 e gravados em `musubi-v2`. Cada sessão vira um atendimento finalizado, cada avaliação fica ligada ao atendimento do mesmo dia (ou fica como reavaliação avulsa), a queixa em texto vira a queixa principal e campos desconhecidos são guardados como estão. Cada item migrado registra a origem e a data (rastreabilidade).
- **A chave `spazio-v1` nunca é alterada nem apagada.** Ela continua como cópia de segurança. Depois da migração, o MUSUBI passa a usar só a `musubi-v2`; o que for digitado no protótipo antigo depois disso não aparece no MUSUBI (use Importar).
- **Dados v2 ilegíveis** não são descartados: são guardados em `musubi-v2-ilegivel` antes de qualquer outra ação.
- **Administração → Dados e cópia de segurança:** exportar tudo (arquivo v2), exportar no formato do protótipo (para voltar a ele) e importar um arquivo exportado (v2 ou v1), com confirmação antes de substituir.
- Arquivos abertos direto do disco (`file://`) compartilham os dados entre si no Chrome. Um endereço diferente começa sem dados.
- `tests/migracao.mjs` confere que o v2 convertido de volta é idêntico ao v1, inclusive com dados incompletos, corrompidos ou com campos desconhecidos.

## Versão oficial e ambiente de demonstração (Vercel)

A `main` é a única versão oficial do MUSUBI. Ela contém:

- o sistema (`index.html`, `css/`, `js/`, gerado em `dist/spazio.html`), com o tema claro aprovado;
- a proposta visual aprovada do MUSUBI em `proposta/`, que é a referência de design para as próximas etapas. Ela usa os módulos clínicos sem alterá-los e só dados fictícios em memória;
- o protótipo original intacto em `legacy/` (também preservado na branch `backup/v1.0-prototipo`).

Publicação na Vercel (projeto `spazio3/sistemaspazio`), só para demonstração com dados fictícios. Não é ambiente de produção clínica e não deve receber dados reais de pacientes.

- Cada envio para a `main` atualiza o domínio principal do projeto. Outras branches e pull requests geram links de preview próprios.
- O build roda `npm run build` e monta a pasta `site/`: `/` abre o sistema (`/spazio.html`) e `/proposta/` abre a proposta aprovada, como referência.
- O ambiente não aparece em buscadores (cabeçalho `X-Robots-Tag: noindex`) e não usa cache.
- Os dados digitados ficam só no navegador de quem está testando (`localStorage`). Nada é enviado à Vercel.
- Para voltar a uma versão anterior: na Vercel, use "Instant Rollback" num deploy antigo; no Git, reverta o merge correspondente na `main`.
