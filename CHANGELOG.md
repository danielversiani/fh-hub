# Changelog

Mudanças relevantes do projeto (código, schema de dados, decisões). Mudanças de **dados** das fontes não entram aqui; ficam no histórico do Git e no changelog gerado pelo site.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- 2026-11-10: **Modo pista** ([ADR-0019](docs/adr/0019-mundo-animado-e-modo-pista.md)):
  - mundo animado de blocos (paddock, circuito, pessoas, carros com pit stop) atrás de todo o site;
  - página inicial com logo 3D, manifesto fixo e uma volta completa no circuito ao rolar;
  - novidades e playlist numa torre de cronometragem fixa;
  - a câmera voa entre páginas;
  - **modo normal** no menu: mesmo site sobre uma imagem parada, sem animação.
- 2026-11-10: **Visual em blocos:** cantos retos, sombras duras, menu fixo translúcido, filtros fixos e a foto do carro esmaecida atrás do nome.
- 2026-11-09: **Novidades da página inicial com o mesmo visual para todas as fontes** (`SourceNews.astro`): card grande com foto para o maior destaque e cards menores com foto, com as mesmas regras de ordem para todas. Toda atualização aparece, para melhor ou para pior (quedas e saídas incluídas), sem limite de cards por fonte. Mudanças anteriores do mesmo carro ficam num histórico em linhas finas.
- 2026-11-09: **T0.5 de Noa Miyako conta como voto de Meta** no ranking do Forza Paddock (dono): 34 carros passam de Off-meta para Meta (ex.: S1 asfalto: Viper ACR, Centenario, AG 961, Aventador SVJ, Huracán STO, R8 LMS). As escolhas do Forza Paddock aparecem nos Destaques qualquer que seja o tier.
- 2026-11-09: **Foco em alternativas ao meta** ([ADR-0017](docs/adr/0017-ranking-proprio-e-alternativas.md)).
  - **Fontes novas:** `fhstats` (lista de meta online e estatísticas de Rivais), `logikj` (escolhas online) e `attax-johnson` (lista por classe). Os nomes abreviados dessas fontes ficam em `data/manual/car-aliases.yaml`.
  - **Ranking do Forza Paddock** (Meta+, Meta, Off-meta, Nicho, Outros), calculado a partir de todas as fontes em `data/generated/roles.json`. Ele substitui o tier de Noa Miyako como ranking principal na lista de tunes, na página do carro e nas sugestões da playlist. Cada carro mostra as evidências.
  - **"Alternativas competitivas ao meta atual"** na aba Tunes: a lista completa, da mais forte para a menos forte. Em cima, a caixa **Destaques**: escolha do Forza Paddock (`data/manual/featured-picks.yaml`), achados recentes (o site agora guarda quando viu cada carro pela primeira vez) e sleepers.
  - **Etiquetas:** Rivais, Achado recente, Sleeper e Escolha do Forza Paddock. **Nicho** e correções de tier à mão (`data/manual/tier-overrides.yaml`).
  - **Datas** nas tunes e nas sugestões da playlist.
- 2026-11-09: **"Cérebro desligado"** ([ADR-0018](docs/adr/0018-cerebro-desligado.md)): selo automático para a tune fácil e recomendada de carros Meta+, e marcação manual em `data/manual/brain-afk.yaml`.
- 2026-11-09: **Página inicial:**
  - manifesto no topo, com botão para as alternativas;
  - novidades separadas por fonte (tabela de Noa Miyako, listas e planilhas de tunes), só quando há atualização detectada, com as palavras da própria fonte;
  - o registro de mudanças ignora o que vem do nosso processamento.
- 2026-11-09: **Navegação:** menu fixo e translúcido ao rolar; filtros da aba Tunes e atalhos da página Meta fixos abaixo dele. **Página do carro** com a foto atrás do nome, em degradê.
- 2026-11-09: **Limpeza:** saíram textos, estilos e funções que sobraram de versões anteriores das páginas (cerca de 50 chaves de tradução sem uso, selos de papel antigos e a ordem pelo tier de Noa Miyako). As amostras de teste do fhstats foram reduzidas ao corte padrão.
- 2026-11-08: **Nova regra de fontes** ([ADR-0016](docs/adr/0016-fontes-publicas-com-opcao-de-saida.md)): fontes públicas da comunidade entram com crédito (`permission: public`, no lugar de `prelaunch`), e quem pede para sair vai para `data/manual/opt-out.yaml` (tunador) ou `denied` (planilha inteira). Página "Uso de dados" e aviso do topo atualizados.
- 2026-11-08: **Rivais** (fonte `rivals-meta`): o 1º e o 2º carro mais usados no topo de cada ranking de Rivais, por pista, classe e piso, em `data/generated/rivals.json` (uso no site em discussão). **Raridade manual** (`data/manual/car-rarity.yaml`): os 25 carros de tesouro/celeiro como Lendário e o BRZ Forza Edition, confirmados no jogo pelo dono.
- 2026-11-08: **Página "Uso de dados"** (`/legal/`, link no rodapé): não reivindicamos a posse de nada, o site compila informações públicas, como pedir remoção ou correção, e a situação da autorização de cada fonte. **GBR Ozzy saiu do projeto a pedido do autor**; kleis passou a `granted` (autorização expressa).
- 2026-11-08: **Pré-lançamento** ([ADR-0015](docs/adr/0015-pre-lancamento-com-todas-as-fontes.md)): o site público passa a mostrar as fontes dos tunadores (`permission: prelaunch`) enquanto as autorizações são pedidas, com aviso em todas as páginas, link para pedir remoção e sem indexação em buscadores. Nome do site: **Forza Paddock**.
- 2026-11-08: **Fase 1 (parte 4): terceira revisão do dono.**
  - **Observações traduzidas** ([ADR-0014](docs/adr/0014-traducao-dos-textos-das-fontes.md)): as 170 observações em chinês de Noa Miyako com texto (as outras 119 eram só tempos) e 10 nomes de tune, em português e inglês, sem o link "Traduzir". Texto novo sem tradução fica escondido e listado em `data/review/untranslated-texts.json`.
  - **Português em todo o site:** tipos de evento ("Acrobacia de RP · Radar"), tipos de carro ("Hot hatch retrô"), recompensas ("Superroleta", "Buzina"), pneus, "Playlist do Festival", metas em km/h e metros, e os desafios da série ao vivo (`data/manual/playlist-texts.yaml`).
  - **Fotos dos carros** (fonte `fandom-images`, [ADR-0013](docs/adr/0013-miniaturas-dos-carros.md) aceita): 666 de 667 carros, com o aviso da Microsoft no rodapé.
  - **Bloco de doação** ("Projeto feito por fãs") no início e "♥ Apoie" no menu.
  - **Celular:** menu com linha própria de seções e linhas da lista de tunes em duas linhas; nenhuma página rola para o lado em 375 px.
  - **Noa Miyako** com o nome completo e no masculino/neutro em todos os textos.
  - **Piso das tunes:** pneu de rali indica terra; especialidade de tunador (`data/manual/tuner-surfaces.yaml`, SR1 Rain = terra) para tunes sem nenhuma pista de piso.
- 2026-11-08: **Fase 1 (parte 3): segunda revisão do dono.**
  - **Tração de fábrica** (fonte `fandom-drivetrain`, Forza Wiki): 666 de 667 carros. Provas "Total FWD/RWD/AWD" passam a ter sugestões.
  - **Indicações de Noa Miyako viram tunes**: tunador recomendado sem código aparece como tune ("busque o gamertag no jogo"), em vez de "ainda não há tune". Corrige a contradição do Peel P50.
  - **Colunas da tabela de Noa Miyako na tune**: tração, pneu, estilo, dificuldade, observações (com link para traduzir) e tempos citados nas observações, com o nome da pista em inglês (`data/manual/track-aliases.yaml`).
  - **Sugestões da playlist**: até 4 Meta, 3 Off-meta, 2 Purista e 2 Meme por evento; Meme só em campeonatos; dificuldade e estilo em cada sugestão; eventos agrupados por tipo, com linha divisória.
  - **Lista de tunes**: como obter o carro em português (com aviso de Leilão), tunes separadas por piso, tunador em destaque, classe/PI de fábrica no rodapé, sem filtro Meme.
  - **Página do tunador** no mesmo formato da lista de tunes (a "Nota" saiu de vez).
  - **Visual** inspirado no forza.net (preto, grafite e verde-limão), com títulos menores.
  - Proposta de miniaturas dos carros ([ADR-0013](docs/adr/0013-miniaturas-dos-carros.md)).
- 2026-11-08: **Raridade dos carros** (fonte `fandom-rarity`, Forza Wiki, CC BY-SA): 641 de 667 carros. Provas com restrição de raridade passam a ter sugestões, só com carros de raridade conhecida. Selo de raridade nas listas e na página do carro; crédito à wiki no rodapé. Correção: um número no fim do nome ("Peugeot 207 Super 2000") não é mais confundido com o ano.
- 2026-11-08: **Fase 1 (parte 2): revisão visual e regras do dono.**
  - Tier de Noa Miyako em tudo (T3 para quem não está na tabela); Meta/Off-meta só pelo tier; Meme por lista de carros; nenhuma sugestão quando a elegibilidade não pode ser verificada; nota numérica fora do site.
  - Novidades na página inicial (abas de atualização e de carros novos de Noa Miyako + mudanças de tier detectadas pelo sync).
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
