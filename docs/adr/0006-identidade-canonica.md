# 0006. Identidade canônica de carros, tunadores e tunes

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

Para juntar dados de fontes diferentes, precisamos saber que registros diferentes falam da **mesma coisa**. Exemplos reais:
- O mesmo carro aparece como `2017 Nissan GT-R`, `Nissan GTR R35 Black Edition` (Letz, sem ano) e `Nissan 日产` + `…` (Noa, com marca em chinês).
- O Ozzy separa fabricante e modelo, sem ano. A URL usa `Nissan Skyline R34 '00`.
- Erros de digitação: o fh6meta registrou `Volkswaggen Golf R` antes de a fonte corrigir.
- Tunadores com espaços extras (` LetzeLU`) e prefixos de equipe (`K1Z Gray`, `ESV Lawrence`).

Associar um tune ao carro errado é o pior tipo de erro do produto: é silencioso e destrói a confiança.

## Decisão

### Carros
- Existe uma **lista mestre** de carros (`data/generated/cars.json`) e **só ela cria carros**. Fontes de tunes nunca criam carros.
- A lista mestre vem de fontes de catálogo: aba "FH6 Car Collection" do GBR Ozzy e aba "Cars List" do LogikJ, conferidas entre si. **A investigar:** o roster oficial de carros em forza.net; se for estruturado, vira a fonte primária.
- **ID do carro:** slug estável de `ano-marca-modelo`, ex.: `1991-mazda-55-mazda-787b`. IDs nunca são reaproveitados; mudanças de ID exigem uma entrada em `data/manual/redirects.yaml` para não quebrar URLs.
- **Resolução de nomes, em cascata:**
  1. Correspondência exata do nome normalizado (minúsculas, sem acentos, sem pontuação, sem caracteres CJK).
  2. Tabela manual `data/manual/car-aliases.yaml`.
  3. *Fuzzy*: só aceita se a **marca coincidir**, o **ano coincidir** (ou a fonte não tiver ano) e a similaridade for ≥ 0,92. Caso contrário, vai para a revisão.
  4. Sem correspondência: o registro vai para `data/review/unmatched-cars.json` e **não é publicado**. A CI reporta a contagem.

### Tunadores
- **ID:** slug do gamertag (`k1z-gray`). Variações vão em `data/manual/tuner-aliases.yaml`.
- O prefixo de equipe é mantido no nome de exibição e extraído para o campo `team` quando reconhecido (K1Z, ESV, DRX, MSR, SR1…).

### Tunes
- **Com share code:** `sc-<9 dígitos>`. O código é a identidade; várias fontes listando o mesmo código geram um único tune com várias observações.
- **Sem share code** (kleis, Letz): `nc-<hash de carro|tunador|nome normalizado>`. Se aparecer um tune com código que case com essa tripla, os dois são ligados.

## Alternativas consideradas

- **Fuzzy livre (sem restrição de marca/ano):** ligaria `2010 Golf R` ao `2014 Golf R`; descartado.
- **Criar carros a partir das fontes de tunes:** geraria duplicatas a cada erro de digitação; descartado.
- **Revisão 100% manual:** inviável com milhares de linhas; a revisão fica só para o que a cascata não resolve.

## Consequências

- **+** Erros de associação viram itens de revisão em vez de dado errado publicado.
- **+** URLs estáveis para SEO e compartilhamento.
- **−** Exige manutenção contínua da tabela de aliases, principalmente no início e a cada pacote de carros novos. É a tarefa recorrente mais importante do mantenedor (ver [RUNBOOK](../RUNBOOK.md)).

## Atualizações

- **2026-11-08 (Fase 0):**
  - A investigação prevista foi concluída: o roster oficial (forza.net/fh6cars, 667 carros) é estruturado e passou a ser a **fonte única da lista mestre**. As abas de catálogo do Ozzy e do LogikJ ficam só como referência.
  - A cascata ganhou um passo **subconjunto** entre "marca + modelo" e "fuzzy": se todas as palavras do nome na fonte aparecem em **um único** carro da mesma marca (e do mesmo ano, quando conhecido), ele é aceito. Ex.: "2008 Honda Civic Type R" → "2008 Honda Civic Type R (FD2)".
  - Resultado da primeira sincronização: 96 associações por subconjunto/fuzzy, auditadas por amostragem sem erros encontrados, e 70 nomes (147 linhas) na fila de revisão.
