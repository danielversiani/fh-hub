# Registros de Decisão de Arquitetura (ADRs)

Um ADR registra **uma** decisão importante: o contexto, o que foi decidido, as alternativas descartadas e as consequências.
Eles explicam o *porquê* do projeto ser como é. Ver [ADR-0001](0001-registrar-decisoes-com-adrs.md).

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-registrar-decisoes-com-adrs.md) | Registrar decisões de arquitetura com ADRs | Aceita |
| [0002](0002-site-estatico-sem-banco.md) | Site estático, sem banco de dados na v1 | Aceita |
| [0003](0003-astro-typescript.md) | Astro + TypeScript como stack | Aceita |
| [0004](0004-github-como-fonte-da-verdade.md) | GitHub como fonte da verdade de código e dados | Aceita (público vs. privado pendente) |
| [0005](0005-pipeline-adaptadores.md) | Pipeline com adaptadores por fonte e "último dado bom" | Aceita |
| [0006](0006-identidade-canonica.md) | Identidade canônica de carros, tunadores e tunes | Aceita |
| [0007](0007-i18n.md) | PT-BR + EN com rotas por idioma | Aceita |
| [0008](0008-curadoria-regras-e-ia.md) | Curadoria por regras + camada de IA via Pull Request | Aceita |
| [0009](0009-playlist-fonte-oficial.md) | Festival Playlist a partir da fonte oficial, com curadoria própria | Aceita |
| [0010](0010-politica-de-fontes.md) | Política de fontes: crédito, autorização e remoção | Substituída em parte por 0016 |
| [0011](0011-idioma-docs-e-codigo.md) | Documentação em PT-BR, código em inglês | Aceita |
| [0012](0012-hospedagem-cloudflare-pages.md) | Hospedagem no Cloudflare Pages com deploy limitado | Aceita |
| [0013](0013-miniaturas-dos-carros.md) | Miniaturas dos carros a partir da Forza Wiki, sob as regras de conteúdo da Microsoft | Aceita |
| [0014](0014-traducao-dos-textos-das-fontes.md) | Traduzir os textos das fontes com uma memória de tradução revisada por PR | Aceita |
| [0015](0015-pre-lancamento-com-todas-as-fontes.md) | Pré-lançamento público com todas as fontes, enquanto as autorizações são pedidas | Substituída por 0016 |
| [0016](0016-fontes-publicas-com-opcao-de-saida.md) | Publicar fontes públicas com crédito, e tirar quem pedir para sair | Aceita |
| [0017](0017-ranking-proprio-e-alternativas.md) | Ranking próprio a partir de todas as fontes, com destaque para as alternativas ao meta | Aceita |
| [0018](0018-cerebro-desligado.md) | Marcar tunes fortes demais e fáceis demais como "Cérebro desligado" | Aceita |
| [0019](0019-mundo-animado-e-modo-pista.md) | Mundo animado de blocos (modo pista) com um modo normal | Aceita |
| [0020](0020-recomendacoes-do-forza-paddock.md) | Recomendações do Forza Paddock, escala de dificuldade de 6 níveis e recomendações por evento | Aceita |

## Como escrever um novo ADR

1. Copie o modelo abaixo para `NNNN-titulo-curto.md` (próximo número livre).
2. Status inicial: **Proposta**. Vira **Aceita** quando o dono do produto aprova.
3. ADRs não são reescritos. Se uma decisão mudar, crie um ADR novo e marque o antigo como **Substituída por NNNN**.
   Fatos de implementação que **não mudam** a decisão (ex.: uma investigação prevista no próprio ADR foi concluída) podem ser acrescentados numa seção final **Atualizações**, com data.
4. Atualize o índice acima.

```markdown
# NNNN. Título no imperativo

- **Status:** Proposta | Aceita | Substituída por NNNN | Rejeitada
- **Data:** AAAA-MM-DD

## Contexto
Qual problema ou força motivou a decisão? Que fatos são relevantes?

## Decisão
O que foi decidido, de forma direta.

## Alternativas consideradas
- **Alternativa A:** por que não.

## Consequências
O que fica mais fácil, o que fica mais difícil, que riscos assumimos.
```
