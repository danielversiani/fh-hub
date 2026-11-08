# 0009. Festival Playlist a partir da fonte oficial, com curadoria própria

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

- O fh6meta monta a "This Week" a partir da aba semanal da planilha do LogikJ, que traz os eventos **e as escolhas dele** de carro e tune.
- O dono quer sugestões com **os próprios critérios**, não as de um tunador específico.
- A Playground publica a tabela oficial em [forza.net/fh6playlists](https://forza.net/fh6playlists). Em 2026-11-07 ela tinha 604 linhas, cobrindo todo o histórico desde a Series 1, com as colunas *Series / Season*, *Reward*, *Event Type*, *Event Name*, *Car / Requirement* e *Route*. A página carrega os dados de `https://forza.net/fh6playlists/_payload.json` (payload do Nuxt), acessível sem login.
- O dono pediu para reproduzir a disposição dos eventos "da melhor forma que não viole copyright".

## Decisão

1. **Fonte dos eventos:** a tabela oficial do forza.net (fetcher `forza-net`). A planilha do LogikJ **não** é usada para a playlist.
2. **Fonte das sugestões:** exclusivamente a nossa curadoria ([ADR-0008](0008-curadoria-regras-e-ia.md), [CURATION.md](../CURATION.md)) sobre o nosso banco de tunes.
3. **Direitos:** usamos apenas **fatos** (nome do evento, tipo, restrição, rota, recompensa, pontos, datas), apresentados em **diagramação própria**, com o crédito "Fonte dos eventos: forza.net" e link. Não usamos imagens, artes, logos ou textos descritivos oficiais.
4. **Interpretação da restrição** (`Car / Requirement`), por padrões reconhecidos:
   - `<Tipo de carro> - <Classe> Class` → ex.: `Retro Hot Hatch - C Class`
   - `Japan - <Classe> Class - <meta>` → PR Stunts e Time Attack (velocidade, distância, tempo)
   - `<Carro específico>; <atividades>` → Weekly Challenge com carro definido
   - Texto livre de desafio diário → sem sugestão de tune

   Restrições fora dos padrões são marcadas como `unparsed`. A IA tenta interpretá-las; se não conseguir, o evento aparece sem sugestão e entra na fila de revisão.
5. **Rotas → piso:** prefixos `Road:`, `Street:`, `Dirt:` e `Cross Country:` definem o piso e a modalidade.
6. **Plano B:** se o forza.net mudar o formato, dispara um alerta e a semana pode ser preenchida à mão em `data/manual/playlist-override/<season-id>.yaml`.

## Alternativas consideradas

- **Aba semanal do LogikJ:** traz escolhas de terceiros embutidas, e o dono rejeitou; descartada.
- **Sites que replicam a playlist (gamingroute, forzahorizonhub etc.):** fontes secundárias, com risco de atraso e de direitos; descartadas.

## Consequências

- **+** Dados oficiais, completos e com histórico (dá para mostrar temporadas passadas).
- **+** Independência total de tunadores específicos para a estrutura da playlist.
- **−** O payload do Nuxt não é uma API documentada e pode mudar sem aviso (mitigado pelo plano B e pelos alertas).

## Atualizações

- **2026-11-08 (Fase 1), implementação:**
  - Adaptador `forza-playlist` e interpretador `pipeline/normalize/requirement.ts`. Além dos padrões previstos acima, o interpretador cobre:
    - marca (`Ferrari - S1 Class`);
    - família de modelo (`Dodge Challenger - A Class`);
    - país (`Italy`, `United Kingdom`);
    - década (`1980s Retro Hot Hatch - D Class`, `2010s S2 Class - 205.0 mph`);
    - várias marcas ou tipos (`Honda & Acura`, `Evo vs Impreza`, `Total Buggies & Offroad`);
    - `Anything Goes`.
  - Raridade (`Rarity: Legendary`) e tração de fábrica (`Total FWD`) ficam **parciais**: o roster não traz esses dados, então a sugestão vem com "confira no jogo se o carro é elegível".
  - Cobertura: 597 de 604 linhas. As restantes vão para `data/review/unparsed-requirements.json`.
  - Só a temporada ao vivo tem data oficial; as demais são derivadas e marcadas `datesDerived`.
