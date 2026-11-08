# FH6 Hub (nome provisório)

Portal da comunidade de **Forza Horizon 6** em PT-BR e EN, com:
- tunes de todos os carros agregados de várias planilhas de tunadores, atualizados automaticamente;
- meta por classe e piso;
- Festival Playlist da semana com sugestões próprias (Meta, Off-meta, Purista, Meme);
- guias de progressão, acessórios (SimHub, OBS) e eventos da comunidade.

> **Status:** Fase 1 em andamento ([PRODUCT §6](docs/PRODUCT.md#6-fases)). Já existem: playlist oficial com sugestões, meta de Noa Miyako, páginas de carro e de tunador, busca de tunes e changelog. Faltam: deploy (Cloudflare) e as seções de guias, acessórios e eventos da comunidade.
> Projeto independente de fãs, sem afiliação com Microsoft, Xbox Game Studios ou Playground Games.

## Começando

Requisitos: Node.js 22+ (o projeto usa a versão do `.nvmrc`) e pnpm.

```bash
pnpm install
pnpm sync          # lê todas as fontes e gera data/ (público) e .cache/preview/ (prévia)
pnpm dev:preview   # site local com TODAS as fontes, inclusive as que aguardam autorização
pnpm dev           # site local só com fontes publicáveis
pnpm test && pnpm validate
```

Em 2026-11-08, a prévia juntava:
- **4.355 tunes** de **223 tunadores**; **86%** dos 667 carros do roster oficial têm pelo menos um tune com share code, e 91% têm algum tune;
- **684 posições de meta** da tabela de Noa Miyako;
- a **Festival Playlist** completa (604 eventos em 28 temporadas), com cerca de 100 sugestões para as semanas recentes.

Os dados públicos (commitados) têm o roster e a playlist oficiais. Os dados dos tunadores entram à medida que as autorizações chegam ([ADR-0010](docs/adr/0010-politica-de-fontes.md)).

## Documentação

| Documento | Conteúdo | Status |
|---|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Visão, módulos, fases, requisitos, questões em aberto | ✅ v0.1 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Como o sistema funciona: pipeline, site, agendamentos, riscos | ✅ v0.1 |
| [docs/adr/](docs/adr/README.md) | Decisões de arquitetura e seus porquês (12 ADRs) | ✅ v0.1 |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Ficha de cada fonte: acesso, abas, colunas, peculiaridades | ✅ v0.1 |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Entidades, IDs, enums e arquivos gerados | ✅ v0.1 |
| [docs/CURATION.md](docs/CURATION.md) | Critérios e algoritmo de nota, categorias e sugestões | ✅ v0.1 (pesos a validar) |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operação semanal e o que fazer em cada tipo de incidente | ✅ v0.1 |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Termos do jogo, da comunidade e do projeto | ✅ v0.1 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Convenções de código, dados, conteúdo, commits e PRs | ✅ v0.1 |
| [CLAUDE.md](CLAUDE.md) | Regras para agentes de IA que trabalham no projeto | ✅ v0.1 |
| [CHANGELOG.md](CHANGELOG.md) | Mudanças relevantes do projeto | ✅ |

**Ordem de leitura para quem chega:** PRODUCT → ARCHITECTURE → ADRs → DATA_SOURCES → DATA_MODEL → CURATION → RUNBOOK. O glossário fica à mão o tempo todo.

## Stack (resumo)

Astro + TypeScript (estático) · Preact (islands) · Tailwind · zod · Vitest · GitHub Actions (sync de hora em hora) · Cloudflare Pages (deploy entra na Fase 1).
Detalhes e motivos em [ADR-0003](docs/adr/0003-astro-typescript.md).
