# Changelog

Mudanças relevantes do projeto (código, schema de dados, decisões). Mudanças de **dados** das fontes não entram aqui; ficam no histórico do Git e no changelog gerado pelo site.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- 2026-11-08: **Raridade dos carros** (fonte `fandom-rarity`, Forza Wiki, CC BY-SA): 641 de 667 carros. Provas com restrição de raridade passam a ter sugestões, só com carros de raridade conhecida. Selo de raridade nas listas e na página do carro; crédito à wiki no rodapé. Correção: um número no fim do nome ("Peugeot 207 Super 2000") não é mais confundido com o ano.
- 2026-11-08: **Fase 1 (parte 2): revisão visual e regras do dono.**
  - Tier da Noa em tudo (T3 para quem não está na tabela); Meta/Off-meta só pelo tier; Meme por lista de carros; nenhuma sugestão quando a elegibilidade não pode ser verificada; nota numérica fora do site.
  - Novidades na página inicial (abas de atualização e de carros novos da Noa + mudanças de tier detectadas pelo sync).
  - Aba única "Tunes" com carros que se expandem em cartões por classe × piso; ordem do meta ao filtrar por classe.
  - Playlist em blocos no estilo do jogo, com abas por estação, contagem regressiva e sugestões ao tocar no bloco.
  - Visual novo: fontes Barlow/Barlow Condensed e cor de detalhe que muda com a estação ao vivo.
- 2026-11-08: **Fase 1 (parte 1).**
  - Fonte `forza-playlist` (Festival Playlist oficial) e interpretador de restrições: 597 de 604 linhas entendidas.
  - Fonte `noa-miyako`: leitura da API interna do QQ Docs (protobuf, sem login), com 684 posições de meta por classe × piso.
  - Curadoria por regras (`pipeline/curate/`, `data/curation/config.yaml`): nota, confiança e categorias (Meta, Off-meta, Purista, Meme) por tune, e sugestões por evento da playlist.
  - Changelog de dados entre sincronizações (`changelog/<AAAA-MM>.json`).
  - Páginas em PT-BR e EN: playlist por temporada, página de cada carro, lista de carros com filtros, tunadores, busca de tunes (island Preact) e meta por classe × piso; o início mostra a playlist da semana e as mudanças recentes.
  - Testes: interpretador de restrições, temporadas, curadoria e adaptadores novos (89 no total).
- 2026-11-08: **Fase 0 (fundação).**
  - Pipeline de dados em TypeScript (`pnpm sync`): fetchers `google-csv`, `google-xlsx` e `forza-net`, mais adaptadores para forza-cars (roster oficial, lista mestre), gbr-ozzy, kleis, k1z-gray, letzelu-shirakawa e whd-url.
  - Normalização (classe, piso, tração, pneus, tags de build, share code) e identificação de carros em cascata: alias → exato → marca+modelo → subconjunto → fuzzy.
  - Saídas separadas: `data/` (público, só fontes autorizadas) e `.cache/preview/` (todas), além de snapshots de "último dado bom" e freio contra queda de linhas.
  - Testes (Vitest) sobre amostras reais das fontes; `pnpm validate`; workflows `ci.yml` e `sync.yml` (de hora em hora, `--public-only`).
  - Site base Astro em PT-BR (raiz) e EN (`/en/`): início com números de cobertura e página de status das fontes.
- 2026-11-08: documentação inicial: produto, arquitetura, 12 ADRs, fontes de dados, modelo de dados, curadoria, runbook, glossário, guia de contribuição e instruções para agentes de IA.
