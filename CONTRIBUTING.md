# Como contribuir

> Vale para humanos e para agentes de IA.

## Antes de mudar qualquer coisa

1. Leia [docs/PRODUCT.md](docs/PRODUCT.md) e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. Confira se a mudança contraria algum [ADR](docs/adr/README.md). Se contrariar, escreva um ADR novo **antes** de codar.
3. Se a mudança afeta uma fonte de dados, leia a ficha dela em [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Ambiente

| Comando | O que faz |
|---|---|
| `pnpm install` | Instala as dependências (Node.js fixado em `.nvmrc`) |
| `pnpm dev` | Site local com os dados públicos de `data/generated/` |
| `pnpm dev:preview` | Site local com os dados de prévia (`.cache/preview/`), inclusive fontes que aguardam autorização |
| `pnpm sync` | Roda o pipeline. Opções: `--source=a,b`, `--offline` (reusa `.cache/raw`), `--fixtures` (roda nas amostras, sem gravar), `--dry-run`, `--accept-drop`, `--public-only` |
| `pnpm fixtures:update [--source=a,b]` | Baixa amostras novas das fontes para os testes |
| `pnpm test` | Testes (Vitest): parsers, identificação de carros, adaptadores sobre fixtures, montagem do dataset, i18n |
| `pnpm validate` | Valida `sources.yaml`, dados manuais, dados gerados e chaves de i18n |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Qualidade, tipos e formatação |
| `pnpm build` | Gera o site estático em `dist/` |

**Windows:** o caminho do projeto precisa ser curto (ex.: `C:\Projetos\fh-hub`). Caminhos acima de 260 caracteres impedem o esbuild de rodar.

## Branches e commits

- `main` é protegida: só recebe merge via PR com a CI verde. Exceção: os commits de dados do bot de sync.
- Nomes de branch: `feat/…`, `fix/…`, `docs/…`, `data/…` (aliases, eventos manuais), `chore/…`.
- Commits em inglês, no padrão [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(playlist): show reward points per event`
  - `fix(adapter-kleis): read class from cell color`
  - `chore(data): sync gbr-ozzy, k1z-gray` (bot)
  - `feat(curation): weekly suggestions s07-summer` (rotina da IA)

## Checklist do Pull Request

- [ ] Testes adicionados ou atualizados (adaptador novo ⇒ fixture + teste).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm validate` passando.
- [ ] Documentação atualizada **no mesmo PR** (ficha da fonte, modelo de dados, runbook…).
- [ ] ADR novo, se houver decisão de arquitetura.
- [ ] Textos de interface em `src/i18n/pt-BR.json` **e** `src/i18n/en.json` (nada de texto fixo em componente).
- [ ] Prints antes/depois para mudanças visuais.

## Regras de código

- TypeScript `strict`; nada de `any`. Use `unknown` + validação.
- **zod em toda fronteira:** resposta de rede, YAML manual, JSON gerado, saída da IA.
- Etapas do pipeline são funções puras; rede e disco ficam nas bordas (`fetchers/`, `cli.ts`).
- **Testes nunca acessam a rede.** Use as fixtures de `pipeline/__fixtures__/`.
- Saídas determinísticas (ver [DATA_MODEL §5](docs/DATA_MODEL.md#5-regras-de-determinismo)).
- Identificadores, nomes de arquivo e comentários em inglês; documentação em PT-BR ([ADR-0011](docs/adr/0011-idioma-docs-e-codigo.md)).
- Comentários explicam o *porquê*, não o *o quê*.

## Regras de dados

- **Nunca edite `data/generated/` à mão.** É saída do pipeline.
- Dados manuais (`data/manual/`) entram por PR e são validados pela CI.
- Arquivos de alias ficam em ordem alfabética.
- Fonte nova só vai ao ar com `permission: granted` ([ADR-0010](docs/adr/0010-politica-de-fontes.md)).

## Regras de conteúdo (guias)

- Escreva em PT-BR, em `src/content/<coleção>/pt-BR/`.
- Frontmatter obrigatório: `title`, `description`, `category`, `lastVerified` (data em que foi conferido no jogo), `sources` (links consultados) e `translation`.
- Nada de copiar texto, imagem ou mapa de outros sites: use fatos verificados, com suas palavras, e cite a fonte.
- Guias de acessórios (SimHub, OBS…) indicam a versão da ferramenta e do jogo em que foram testados.
- A versão em inglês é gerada pelo script de tradução com o [glossário](docs/GLOSSARY.md) e marcada como `translation: machine` até ser revisada.
