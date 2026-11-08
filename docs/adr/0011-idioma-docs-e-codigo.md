# 0011. Documentação em PT-BR, código em inglês

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

O dono do produto é brasileiro e precisa ler e aprovar a documentação. Um programador que herde o projeto pode ser brasileiro ou não.

## Decisão

| Artefato | Idioma |
|---|---|
| `docs/` (produto, arquitetura, ADRs, runbook) | PT-BR |
| Identificadores, nomes de arquivos, comentários no código | Inglês |
| Mensagens de commit e títulos de PR | Inglês (Conventional Commits) |
| Glossário | PT-BR, com o termo original do jogo em inglês |

## Alternativas consideradas

- **Tudo em inglês:** maximiza quem pode herdar, mas o dono teria mais dificuldade de revisar as decisões.
- **Tudo em PT-BR, inclusive o código:** foge da convenção do ecossistema e mistura idiomas com as bibliotecas.

## Consequências

- **+** O dono revisa as decisões no próprio idioma; o código segue a convenção global.
- **−** Um herdeiro que não fale português precisará traduzir `docs/` (viável com ferramentas automáticas; o glossário ajuda).
