# Changelog

Mudanças relevantes do projeto (código, schema de dados, decisões). Mudanças de **dados** das fontes não entram aqui; ficam no histórico do Git e no changelog gerado pelo site.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- 2026-11-08: **Fase 0 (fundação).**
  - Pipeline de dados em TypeScript (`pnpm sync`): fetchers `google-csv`, `google-xlsx` e `forza-net`, mais adaptadores para forza-cars (roster oficial, lista mestre), gbr-ozzy, kleis, k1z-gray, letzelu-shirakawa e whd-url.
  - Normalização (classe, piso, tração, pneus, tags de build, share code) e identificação de carros em cascata: alias → exato → marca+modelo → subconjunto → fuzzy.
  - Saídas separadas: `data/` (público, só fontes autorizadas) e `.cache/preview/` (todas), além de snapshots de "último dado bom" e freio contra queda de linhas.
  - Testes (Vitest) sobre amostras reais das fontes; `pnpm validate`; workflows `ci.yml` e `sync.yml` (de hora em hora, `--public-only`).
  - Site base Astro em PT-BR (raiz) e EN (`/en/`): início com números de cobertura e página de status das fontes.
- 2026-11-08: documentação inicial: produto, arquitetura, 12 ADRs, fontes de dados, modelo de dados, curadoria, runbook, glossário, guia de contribuição e instruções para agentes de IA.
