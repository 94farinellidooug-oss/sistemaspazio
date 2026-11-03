# Sistema Spazio

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
| `npm test` | 51 casos de hipóteses, Ba Gang, cinco elementos, alertas, pentagrama e EVA. O resultado precisa ser idêntico ao gravado a partir do protótipo original. |
| `npm run test:navegador` | Roda `tests/navegador.mjs`, que executa o mesmo roteiro de uso (cadastro, sessão, avaliação, pentagrama, pontos, agenda) no original, na versão modular e no arquivo único e compara telas e dados salvos. Roda também `tests/compatibilidade.mjs`, que confirma que `dist/spazio.html` abre direto do disco e que os dados da chave `spazio-v1` gravados pelo original continuam acessíveis, nos dois sentidos. |
| (incluído em `test:navegador`) `tests/interface.mjs` | Verifica a interface da etapa 1B: menu em 4 grupos, modo recolhido com nomes acessíveis, gaveta no celular, telas "em breve", Painel misto, atalhos do prontuário, tema escuro e ausência de rolagem horizontal. |
| `npm run test:tudo` | Tudo acima, na ordem: cálculos, build e navegador. |
| `npm run referencia` | Regrava a referência a partir de `legacy/`. Só deve ser usado se o próprio original mudar, o que não deve acontecer. |

Depois de qualquer mudança em `css/` ou `js/`, rode `npm run build` para atualizar `dist/spazio.html`.

### No GitHub

O workflow `.github/workflows/testes.yml` roda todos os testes em cada pull request e em cada envio para `main`. Ele também falha se `dist/spazio.html` não corresponder aos módulos.

## Dados salvos no navegador

Os dados ficam no `localStorage` do navegador, na chave `spazio-v1`, no mesmo formato do protótipo v1. O navegador separa os dados por endereço de origem. Por isso:

- Quem abrir o novo `dist/spazio.html` no mesmo endereço onde usava o protótipo antigo continua vendo os mesmos dados.
- Arquivos abertos direto do disco (`file://`) compartilham os dados entre si no Chrome.
- Um endereço diferente (outro site, `localhost` ou o disco) começa sem dados, como acontecia com o próprio v1.


## Ambiente de demonstração (preview)

O sistema é publicado na Vercel apenas para demonstração, com dados fictícios. Não é ambiente de produção e não deve receber dados reais de pacientes.

- A Vercel publica automaticamente **cada branch e cada pull request** num link próprio, sem precisar de merge na `main`.
- O link da branch `main` mostra a versão aprovada.
- `vercel.json` define a publicação: `tools/preview.mjs` monta a pasta `site/` só com os arquivos da aplicação. O arquivo único fica em `/arquivo-unico.html`.
- O ambiente não aparece em buscadores (`robots.txt` e cabeçalho `X-Robots-Tag`).
- Os dados digitados ficam só no navegador de quem está testando (`localStorage`). Nada é enviado à Vercel.
