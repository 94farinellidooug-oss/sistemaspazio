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
  telas/              uma tela por arquivo
tests/                testes de equivalência com o protótipo original
tools/                build do arquivo único e servidor local
legacy/               protótipo v1 original, preservado sem alterações (branch backup/v1.0-prototipo)
dist/spazio.html      arquivo único gerado por npm run build
```

## Testes

| Comando | O que verifica |
| --- | --- |
| `npm test` | 51 casos de hipóteses, Ba Gang, cinco elementos, alertas, pentagrama e EVA. O resultado precisa ser idêntico ao gravado a partir do protótipo original. |
| `node tests/navegador.mjs` | Executa o mesmo roteiro de uso (cadastro, sessão, avaliação, pentagrama, pontos, agenda) no original, na versão modular e no arquivo único, e compara as telas e os dados salvos. Requer Playwright. |
| `npm run referencia` | Regrava a referência a partir de `legacy/`. Só deve ser usado se o próprio original mudar, o que não deve acontecer. |

Depois de qualquer mudança em `css/` ou `js/`, rode `npm run build` para atualizar `dist/spazio.html`.
