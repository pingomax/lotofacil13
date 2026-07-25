# Dashboard Lotofácil

Dashboard web para visualizar as análises estatísticas dos 300 concursos mais recentes
da Lotofácil e gerar jogos a partir dessas análises.

## Como rodar

**Opção 1 — duplo clique (mais simples):**
Abra o arquivo `index.html` no navegador. Como os dados ficam embutidos em `dados.js`,
funciona sem servidor e offline.

**Opção 2 — servidor local (recomendado):**
```bash
cd dashboard
python3 -m http.server 8000
```
Depois acesse http://localhost:8000 no navegador.

## Estrutura de arquivos

```
dashboard/
├── index.html   # estrutura da página (sidebar, header, footer)
├── styles.css   # design system, tema claro/escuro, responsividade
├── app.js       # SPA: roteamento + todas as seções + gerador/backtest/conferência
├── dados.js     # dados embutidos (window.DADOS), gerado a partir do Excel
└── README.md
```

## Como os dados são carregados

O dashboard NÃO faz `fetch`: os dados vêm de `dados.js`, que define `window.DADOS`.
Isso permite abrir o `index.html` com duplo clique, sem CORS e sem servidor.

Bibliotecas via CDN (precisam de internet no primeiro acesso; depois o navegador faz cache):
- Chart.js (gráficos)
- Lucide (ícones)
- Fonte Inter (Google Fonts)

## Como regenerar os dados (quando o Excel for atualizado)

A partir da pasta do projeto (um nível acima de `dashboard/`):
```bash
python3 analise.py               # lê Lotofácil.xlsx  -> resultados.json
python3 gera_dados_dashboard.py  # resultados.json    -> dashboard/dados.js
```

## Como buscar concursos novos automaticamente (API oficial da Caixa)

Um comando baixa os concursos que faltam, faz backup do Excel, anexa os novos
resultados, refaz a análise e regenera os dados do dashboard:
```bash
python3 atualizar.py --tudo
```
Depois recarregue o dashboard no navegador. Sem `--tudo`, o script apenas baixa e
anexa ao Excel (aí você roda `analise.py` e `gera_dados_dashboard.py` manualmente).

Fonte: `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil`
(a mesma da página de resultados da Caixa). A seção **Atualizar resultados** no
dashboard também mostra, ao vivo, se há concurso novo publicado.

## Seções implementadas

| Seção | O que mostra |
|---|---|
| Visão geral | KPIs, temperatura das dezenas, padrões comuns, mini mapa de calor, atalhos |
| Validação dos dados | Metadados e checagens de integridade (duplicatas, fora de faixa, etc.) |
| Frequência | Tabela ordenável 01–25, busca, gráfico por janela (300/100/50/20/10) |
| Quentes e frias | Blocos de temperatura, tendências, atrasadas, retornos recentes |
| Pares e ímpares | Distribuição + comparativo por janela |
| Moldura e centro | Distribuição, por janela e diagrama 5×5 |
| Linhas / Colunas | Frequência, ocupação (0–5), distribuições mais comuns |
| Sequências | Média de blocos, dezenas em sequência, frequência por tamanho |
| Repetição | Distribuição de repetidas + permanência por dezena |
| Soma | Faixas + evolução na amostra |
| Baixas e altas | Distribuição das composições |
| Primos e múltiplos | Primos por concurso, finais, médias de múltiplos |
| Pares de dezenas | Pares/trincas mais e menos frequentes; janelas 50/20/10 |
| Mapas de calor | 5 mapas 5×5 (300/100/50/20/10) com valores e legenda |
| Último concurso | Dezenas, atributos e taxas históricas de repetição |
| Atualizar resultados | Verifica a API da Caixa ao vivo e mostra o comando para baixar concursos novos |
| Gerador de jogos | Controles configuráveis, cards com métricas e IEE, validações, cópia TXT |
| Teste retrospectivo | Backtest honesto (sem vazamento), médias e faixas de acerto |
| Conferência | Insere resultado e calcula acertos, faixa de premiação e melhor jogo |

## Aviso

Esta análise utiliza apenas padrões históricos e critérios de equilíbrio.
Ela não prevê resultados e não altera a probabilidade matemática de uma aposta da Lotofácil.
O "Índice de equilíbrio estatístico" mede apenas aderência aos padrões históricos —
não é probabilidade de ganhar. Todos os jogos possíveis têm a mesma chance.
