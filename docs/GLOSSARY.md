# Glossário

> **Status:** v0.1 · **Atualizado em:** 2026-11-08
> Serve a três públicos: quem herdar o código, quem escrever guias e o **script de tradução** ([ADR-0007](adr/0007-i18n.md)), que usa a coluna "Na interface PT-BR" para não traduzir jargão de forma errada.
> Itens marcados com † vêm de guias de terceiros e ainda precisam ser confirmados no jogo.

## Termos do jogo

| Termo (jogo, EN) | Na interface PT-BR | Significado |
|---|---|---|
| Tune | tune | Ajuste fino do carro (pressão de pneu, marchas, suspensão, diferencial…). Compartilhável por share code |
| Share code | código (share code) | Código de 9 dígitos que permite baixar um tune ou uma pintura no jogo |
| Build / Upgrade | build / upgrades | Peças instaladas (motor, turbo, pneus, aero). Faz parte do tune compartilhado |
| Livery / Design | pintura | Visual do carro, também compartilhável por código |
| PI (Performance Index) | PI | Índice de desempenho de 100 a 999; define a classe |
| Class | classe | Faixa de PI: D ≤400, C ≤500, B ≤600, A ≤700, S1 ≤800, S2 ≤900, R ≤998, X 999 |
| Road | asfalto | Piso de asfalto (circuitos e sprints) |
| Dirt / Rally | terra | Piso de terra, provas de rali |
| Cross Country / Offroad | cross country | Fora de estrada, terreno misto |
| Street | rua | Corridas de rua no trânsito |
| Touge | touge | Corrida em estrada de montanha (cultura japonesa); também o modo online 1×1 "Touge Showdown" |
| Drag / Drift | arrancada / drift | Modalidades específicas |
| Car Type | tipo de carro | Categoria oficial do jogo usada nas restrições (ex.: "Retro Hot Hatch", "Modern Supercars") |
| Drivetrain (FWD/RWD/AWD) | tração | Dianteira, traseira ou integral |
| Engine swap / Drivetrain swap (AWD swap) | troca de motor / troca de tração | Upgrades que trocam o motor ou a tração original |
| Purist | purista | Build fiel ao carro original (sem trocas de motor ou tração) |
| Stock Look | visual original | Sem kit aerodinâmico ou rodas que mudem a aparência |
| Full Aero | aero completo | Com aerofólios e kits aerodinâmicos |
| Powerbuild | powerbuild | Build focada em potência máxima |
| Forza Edition | Forza Edition | Versões especiais de carros com bônus |
| WTAC | WTAC | Carros de World Time Attack Challenge, muito comuns no meta |
| Rivals | Rivals | Modo de tempo contra o relógio com ranking global; referência de desempenho |
| Festival Playlist | Festival Playlist | Conjunto semanal de eventos e desafios com recompensas; vira toda quinta-feira |
| Series / Season | série / estação | Uma série (ex.: S07 "City Life") tem quatro estações (primavera, verão, outono, inverno); cada estação dura uma semana |
| Seasonal Championship | campeonato sazonal | Campeonato da semana, com restrição de classe e tipo de carro |
| Weekly / Daily Challenge | desafio semanal / diário | Desafios da playlist |
| PR Stunt | PR Stunt | Speed Trap (radar de velocidade), Speed Zone (velocidade média), Danger Sign (salto), Trailblazer (atalho contra o tempo), Drift Zone |
| Time Attack | time attack | Volta cronometrada com meta de tempo |
| Treasure Hunt | caça ao tesouro | Desafio semanal de encontrar um local por pista fotográfica |
| Barn Find | carro de celeiro | Carro raro escondido no mapa e restaurado |
| Wristband † | pulseira | Progressão do festival que libera eventos: Yellow, Green, Blue, Pink, Orange, Purple, Gold |
| Legend Island † | Legend Island | Área de fim de jogo liberada no topo da progressão |
| The Goliath / The Colossus † | The Goliath / The Colossus | Corridas longas de fim de jogo |
| Horizon Play | Horizon Play | Modos online: Eliminator, Hide & Seek, Touge Showdown, Horizon Drift |
| Autoshow / Wheelspin | Autoshow / Wheelspin | Concessionária do jogo / roleta de prêmios |
| Team Wars | Team Wars | **A definir** (PRODUCT Q1) |

## Termos da comunidade e da curadoria

| Termo | Significado no projeto |
|---|---|
| Meta | Os carros e tunes mais competitivos numa classe × piso |
| Off-meta | Competitivo, mas fora do topo |
| Meme | Escolha divertida ou improvável, ainda jogável ([CURATION.md](CURATION.md)) |
| Tier (Meta+, Meta, T0.5, T1, T1.5, T2, T3) | Escala de força usada pela Noa Miyako |
| Tunador (tuner) | Quem cria e publica tunes |
| Hotlap | Volta rápida cronometrada (ex.: planilha do Letz em Shirakawa) |

## Termos do projeto

| Termo | Significado |
|---|---|
| Fonte (source) | Planilha ou página de onde o pipeline lê dados ([DATA_SOURCES.md](DATA_SOURCES.md)) |
| Fetcher | Código que **baixa** uma fonte de um tipo (Google, QQ, forza.net) |
| Adaptador | Código que **interpreta** uma fonte específica e a converte para o modelo comum |
| Observação | Registro de que uma fonte listou um tune, com proveniência (fonte, aba, linha, data) |
| Lista mestre | Lista canônica de carros; só ela cria carros ([ADR-0006](adr/0006-identidade-canonica.md)) |
| Alias | Nome alternativo de um carro ou tunador, mapeado para o ID canônico |
| Fila de revisão | Itens que o pipeline não resolveu sozinho (`data/review/`) |
| Último dado bom | Os dados da última sincronização válida de uma fonte, mantidos quando ela falha |
| Season ID | Identificador de uma estação da playlist, ex.: `s07-summer` |
| Confiança | Quanto dos sinais de curadoria estavam disponíveis para calcular uma nota |
