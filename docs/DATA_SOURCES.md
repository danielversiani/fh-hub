# Fontes de dados

> **Status:** v0.2 · **Levantamento feito em:** 2026-11-07 (testes reais de acesso) · **Atualizado em:** 2026-11-09
> Política de uso: [ADR-0016](adr/0016-fontes-publicas-com-opcao-de-saida.md). Arquitetura de ingestão: [ADR-0005](adr/0005-pipeline-adaptadores.md).
> Estrutura das colunas observada nesta data. Se uma fonte mudar, atualize esta ficha **no mesmo PR** do adaptador.

## Resumo

| ID | Fonte | Tipo | Conteúdo | Leitura automática | Autorização | No pipeline |
|---|---|---|---|---|---|---|
| `forza-cars` | forza.net/fh6cars | JSON oficial | **Roster oficial: 667 carros** (lista mestre) | ✅ `_payload.json` | not-required | ✅ Fase 0 |
| `fandom-rarity` | Forza Wiki (Fandom) | API MediaWiki | **Raridade** de 641 carros (Comum, Raro, Épico, Lendário, Forza Edition) | ✅ API pública | not-required (CC BY-SA, com crédito) | ✅ Fase 1 |
| `fandom-drivetrain` | Forza Wiki (Fandom) | API MediaWiki | **Tração de fábrica** (FWD, RWD, AWD) de 666 carros | ✅ API pública | not-required (CC BY-SA, com crédito) | ✅ Fase 1 |
| `rivals-meta` | FH6 Rivals Meta Sheet (comunidade) | Google Sheets (CSV) | Carro **mais usado (1º) e segundo (2º)** no topo de cada ranking de Rivais, por pista e classe, em asfalto, terra e cross country | ✅ CSV | public (autor a identificar) | ✅ entra no ranking do Forza Paddock |
| `fhstats` | fhstats.com | Site (Next.js) | **Lista de meta online** (S+/S/A/B, com código e data) e **estatísticas de Rivais** por carro (aparições no top 10/top 50, vitórias) | ✅ dados da própria página | public | ✅ ranking do Forza Paddock |
| `logikj` | LogikJ's FH6 Tune Sheet, aba "Online Racing Tune Picks" | Google Sheets (CSV) | ~27 escolhas para corridas online, com nível (Meta, Strong, Offmeta) e código | ✅ CSV | granted (2026-11-10) | ✅ ranking do Forza Paddock |
| `attax-johnson` | aTTaX Johnson's tune list (Horizon 6) | Google Sheets (CSV) | Carros recomendados por classe, para que a tune serve ("Allround", "Pure Handling", "Speed"…), criador e código | ✅ CSV | public | ✅ ranking do Forza Paddock |
| `fandom-images` | Forza Wiki (Fandom) | API MediaWiki | **Foto** de 666 carros (captura de tela do FH6) | ✅ API pública | not-required (regras de conteúdo da Microsoft, [ADR-0013](adr/0013-miniaturas-dos-carros.md)) | ✅ Fase 1 |
| `gbr-ozzy` (desligada: o autor pediu para ficar de fora, 2026-11-08) | GBR Ozzy's FH6 Spreadsheet | Google Sheets | ~2.660 tunes com código | ✅ gviz (exportação bloqueada pelo dono) | denied | desligada |
| `kleis` | Forza Tune & Design Sheet by kleis | `.xlsx` no Drive | ~3.000 tunes, 562 carros, 194 tunadores, **sem códigos** | ✅ xlsx | granted | ✅ Fase 0 |
| `k1z-gray` | My Fh6 Tunes (K1Z Gray) | Google Sheets | 78 tunes S2/S1 com código | ✅ exportação CSV | public | ✅ Fase 0 |
| `letzelu-shirakawa` | Letz' Shirakawa Tune & Hotlap Sheet | Google Sheets | Tempos de volta A/S1/S2 com tier | ✅ exportação CSV | public | ✅ Fase 0 |
| `whd-url` | Underground Racing League (Wrong Hand Drive) | Google Sheets | Série da comunidade: ~60 carros com tune e pintura, mais rotas de evento | ✅ exportação CSV | public | ✅ Fase 0 |
| `noa-miyako` | Noa Miyako, "地平线6线上车辆调校推荐" | QQ Docs | Tiers de meta por classe × piso (~800 carros) | ⚠️ API interna (protobuf) | public | ✅ Fase 1 |
| `forza-playlist` | forza.net/fh6playlists | JSON oficial | Festival Playlist completa (604 linhas) | ✅ `_payload.json` | not-required | ✅ Fase 1 |
| `base-events` | Levantamento próprio | YAML manual | Eventos-base do mapa | Manual | not-required | Fase 2 |

O registro executável dessas fontes é `data/sources.yaml`.

## Como as planilhas do Google são lidas

1. **Exportação CSV** (`/export?format=csv&gid=<aba>`): cópia fiel de cada aba. É o caminho padrão (fetcher `google-csv`).
2. **Endpoint gviz** (`/gviz/tq?tqx=out:csv&headers=0&gid=<aba>`): usado só quando o dono desativou a exportação (HTTP 401/403), como no GBR Ozzy.
   ⚠️ O gviz "adivinha" um tipo por coluna e **apaga as células que não combinam** com ele. Exemplos observados: o cabeçalho "Year" sobre uma coluna numérica e o nome do criador de rota numa coluna de PI. Por isso ele é só plano B.
3. **Workbook `.xlsx`** (`/export?format=xlsx`): quando a **formatação** carrega dado (cores do kleis).

## Amostras para testes (fixtures)

`pnpm fixtures:update` grava em `pipeline/__fixtures__/` **amostras**, não cópias: as 40 primeiras linhas, 1 a cada 40 depois disso e as 12 últimas. É o suficiente para testar os adaptadores sem republicar a planilha de ninguém ([ADR-0010](adr/0010-politica-de-fontes.md)). O payload oficial do forza.net é mantido inteiro.

**Candidatas** (fora da lista inicial, a avaliar): as planilhas ligadas à de LogikJ e as listadas no hub do Ozzy (ver [§ Candidatas](#candidatas)).

fhstats não é planilha: a amostra guarda os dados já extraídos da página (`*.data.json`), com o mesmo corte (40 primeiros itens, 1 a cada 40 e os 12 últimos).

---

## Fichas

### `forza-cars`: roster oficial de carros (lista mestre)
- **URL:** https://forza.net/fh6cars · dados em `https://forza.net/fh6cars/_payload.json` (Nuxt/devalue, ~88 KB).
- O conteúdo da página é uma **tabela em Markdown** dentro do CMS: *Make, Car Name, Car Type, Car Class, Country, Collection, Add-Ons*.
  - *Car Name* inclui o ano: `1968 Abarth 595 esseesse`.
  - *Car Class* junta PI e classe: `100 D`.
  - *Collection* lista as formas de obter: `Autoshow, Wheelspin`.
  - *Car Type* tem um erro de digitação num carro ("Electic Domestics"): o adaptador lê como "Eclectic Domestics" (2026-11-14), para o filtro de tipo da aba Tunes não mostrar o tipo duas vezes.
- Inclui carros anunciados que ainda vão sair (Car Pass e recompensas futuras).
- É a **única fonte que cria carros** ([ADR-0006](adr/0006-identidade-canonica.md)). ID do carro = slug do *Car Name*.

### `fandom-rarity`: raridade dos carros (Forza Wiki)
- **Por quê:** algumas provas da playlist restringem a raridade ("Rarity: Legendary - S2 Class"), e o roster oficial não traz essa informação. Sem ela, o site não saberia quais carros são elegíveis (regra do dono: só sugerir com certeza).
- **Fonte:** categorias `Category:Common (FH6)`, `Rare`, `Epic`, `Legendary` e `Forza Edition` da [Forza Wiki](https://forza.fandom.com), lidas pela API pública MediaWiki (`api.php?action=query&list=categorymembers`). Cada página da categoria é um carro, com o ano entre parênteses quando há mais de um.
- **Licença:** conteúdo da Fandom é CC BY-SA. Usamos só o fato (a raridade) e damos crédito no rodapé do site. Por isso a permissão é `not-required`.
- **Cobertura (2026-11-08):** 641 dos 667 carros. Os carros sem raridade conhecida **não** entram em provas com restrição de raridade.
- **Ignorados:** veículos de tráfego (`… Traffic`, `Playground …`) e variantes de evento (`'Touge Edition'`, `'Initial Drive'`, `'RakuRaku Express'`), que não estão no roster.
- **Por que não outras fontes:** codmunity/forzacity têm a raridade, mas são sites concorrentes, sem licença de reuso. A aba "Car Collection" do Ozzy só tem o logo da marca na coluna BADGE.
- **Lacunas conhecidas:** 26 carros não estão em nenhuma categoria de raridade da wiki (ex.: Mazda 787B, Porsche 959, Ford GT 2005). O dono confirmou no jogo: são carros de tesouro/celeiro, todos Lendários (e o BRZ Forza Edition é Forza Edition). Ficam em `data/manual/car-rarity.yaml`, que vale mais que a wiki.

### `rivals-meta`: carros do topo dos rankings de Rivais
- **Por quê:** Rivais (contra o relógio) é uma métrica importante para o dono: mostra quais carros a comunidade usa para os melhores tempos de cada pista. O fh6meta usa a mesma planilha.
- **Fonte:** [FH6 Rivals Meta Sheet](https://docs.google.com/spreadsheets/d/1mHbd09yLGEy3gAlplREnrIbk6xHcLieExw--CuYp0e8), abas "Road Race", "Dirt" e "Cross Country". Cada linha é uma pista; para cada classe há o 1º e o 2º carro ("R-Class", "R-Class 2nd Choice").
- **Por que não direto do jogo:** o Forza não tem API pública de rankings. Acessar os servidores com a conta de um jogador viola os termos da Microsoft e arrisca banir a conta (discutido com o dono em 2026-11-08).
- **Apelidos:** os carros vêm com apelidos ("MX-5 FE 1994", "Mit. Minicab TA"), traduzidos em `data/manual/car-aliases.yaml`. "Acura Integra" = 2001 Type R e "Ford Mustang 2024" = GT (dono, 2026-11-08); "Subaru BRZ" (2013 ou 2022) segue sem correspondência.
- **Atenção:** quando foi incluída (2026-11-08), as abas diziam "Last updated: June 9–12th 2026"; os dados podem estar desatualizados.
- **Uso:** os dados vão para `data/generated/rivals.json` e entram no ranking do Forza Paddock como fonte ([CURATION.md §10](CURATION.md#10-ranking-do-forza-paddock-e-alternativas)).

### `fhstats`: lista de meta online e estatísticas de Rivais
- **URL:** https://fhstats.com. O fetcher `pipeline/fetchers/fhstats.ts` lê os dados que a própria página entrega ao navegador (Next.js, `self.__next_f.push`). Não é API interna do jogo nem raspagem de ranking: são as páginas públicas do site.
- **Abas no `sources.yaml`:**
  - `online` (`metacars/horizon-racing`): lista de meta online, montada a partir da planilha de arpanjpr. Cada item tem disciplina, classe, tier, carro, código, tunador, tipo de build e as datas da tune e da última atualização. Os tiers S+/S/A/B viram os níveis Meta+/Meta/Strong/Offmeta.
  - `rivals` (`rivals/stats/cars`): por carro e ranking (disciplina × classe), as aparições no top 10, no top 50 e as vitórias. Asfalto e rua somam no piso asfalto.
- **Adaptador:** `pipeline/adapters/fhstats.ts`. A lista vira `ListEntry` e tunes com código; as estatísticas viram `RivalsStat`.
- **Nomes de carro:** vêm abreviados ("MX-5 FE '94"); os apelidos ficam em `data/manual/car-aliases.yaml`.
- **Uso:** fonte do ranking do Forza Paddock ([ADR-0017](adr/0017-ranking-proprio-e-alternativas.md)). As datas aparecem como "atualizada em" e nas novidades da página inicial.

### `logikj`: escolhas online de LogikJ
- **URL:** planilha `1ZDLQ1Jg6E6VWfMZUZX-GWflVRl75xSYPj4NHUYwZnLo`, aba "Online Racing Tune Picks" (gid 1457186910). As outras abas (tunes, lista de carros, aba semanal) não são lidas.
- **Conteúdo:** carro, classe, piso, nome da tune, código e uma nota que diz o nível ("Meta", "Strong", "Offmeta"), se a tune é grip e se é para online ou Rivais.
- **Adaptador:** `pipeline/adapters/logikj.ts`. Uma tune "grip" sem a palavra "online" conta como build de Rivais (handling puro).
- **Planilhas ligadas** (candidatas futuras): Johnson Racing, JSR Chronic, Dumbo's Garage, Fenrir, snosaes, World Records, ZVTCJAU, PTW Club.

### `attax-johnson`: lista de tunes de aTTaX Johnson
- **URL:** planilha `1F3xqy6yodUmnuua08YU-fet4KDDoIbaoNZRiZ9U8yxk`, aba "Horizon 6" (gid 1371665614).
- **Colunas:** *CLASS, CAR, MADE FOR, CREATOR, Share Code*. Uma célula pode ter várias tunes, uma por linha; as colunas se correspondem linha a linha.
- **Adaptador:** `pipeline/adapters/attax-johnson.ts`.
  - "MADE FOR" dá o piso ("Dirt …" = terra) e o estilo.
  - "Pure Handling" e "Speed" (sem "Allround") contam como build de Rivais.
  - Uma palavra repetida ("Allround Allround") vira uma só.
  - O sufixo `'84` no nome do carro vira o ano.
- **Sem tier:** cada linha é uma "escolha". Conta como fonte no ranking, mas fica fora da média ([CURATION.md §10.1](CURATION.md#101-opiniões-das-fontes-0-a-1)).

### `fandom-images`: fotos dos carros (Forza Wiki)
- **Por quê:** o dono quer a miniatura de cada carro na lista e na página do carro ([ADR-0013](adr/0013-miniaturas-dos-carros.md)).
- **Fonte:** a imagem principal de cada página em `Category:Cars (FH6)`, pela API (`generator=categorymembers` + `prop=pageimages`, 480 px). Só valem arquivos `FH6_…`: uma página de carro que existe em vários jogos pode abrir com a foto de outro jogo.
- **Direitos:** são capturas de tela do jogo (conteúdo da Microsoft, **não** CC BY-SA). Usamos sob as regras de conteúdo da Microsoft: site sem anúncios, aviso no rodapé e link para as regras. Guardamos só o endereço; a imagem é servida pela Fandom.
- **Cobertura (2026-11-08):** 666 dos 667 carros.

### `fandom-drivetrain`: tração de fábrica (Forza Wiki)
- **Por quê:** provas como "2000s Total FWD - B Class" aceitam só carros com aquela tração **de fábrica**. O roster oficial não traz essa informação.
- **Fonte:** categorias `Category:Front-Wheel Drive`, `Rear-Wheel Drive` e `All-Wheel Drive` da [Forza Wiki](https://forza.fandom.com). Elas valem para todos os jogos Forza, então o adaptador cruza com `Category:Cars (FH6)` e só usa carros do FH6. Um carro listado em duas trações é ignorado (fica como desconhecido).
- **Licença:** como a raridade, CC BY-SA, com crédito no rodapé.
- **Cobertura (2026-11-08):** 666 dos 667 carros (falta o Subaru BRZ Forza Edition, cujo nome na wiki não bate com o roster).

### `noa-miyako`: tabela de meta de Noa Miyako

> **Observações em chinês:** aparecem traduzidas pela memória de tradução (`data/manual/translations.yaml`, [ADR-0014](adr/0014-traducao-dos-textos-das-fontes.md)). Os tempos citados ("白川1:04.3") viram selos "1:04.3 · Shirakawa" (`data/manual/track-aliases.yaml`).
- **URL:** https://docs.qq.com/sheet/DYWZVRWR0dnh3aHhZ (aba inicial `mmc7rv`)
- **Abas:** 引言 (introdução), 季节赛 每周更新 (temporada, atualização semanal), 新车调校速递 (tunes de carros novos), 老车调校更新 (atualização de carros antigos) e uma aba por classe × piso: `R 998公路`, `S2 900公路`, `S1 800公路/泥地/越野`, `A 700公路/泥地/越野`, `B 600公路/泥地/越野`, `C 500公路/泥地`. (公路 = road, 泥地 = dirt, 越野 = cross-country)
- **Acesso:** `GET /dop-api/opendoc?...` (primeiro bloco) e `GET /dop-api/get/sheet?padId=...&subId=<aba>&startrow=N&endrow=N+255` (blocos de 256 linhas). O campo `block_datas[].related_sheet` é base64 → zlib → protobuf não documentado. Sem login.
- **Conteúdo observado:** tier (`Meta+`, `Meta`, `T0.5`, `T1`, `T1.5`, `T2`, `T3`), carro com marca bilíngue (`Subaru 斯巴鲁` + `1994 Subaru Vivio RX-R`), tunador, dificuldade em chinês (非常困难 = very hard, 稍微困难 = slightly hard; demais a mapear), share code de 9 dígitos, notas em chinês.
- **Riscos:** formato interno pode mudar a qualquer momento. Plano B: Playwright.

**Implementação (Fase 1, 2026-11-08):**
- **Acesso sem login** (`pipeline/fetchers/qq-docs.ts`):
  1. abrir a página da planilha para receber os cookies de sessão anônima; o cookie `TOK` também serve de token xsrf;
  2. `dop-api/opendoc` devolve a revisão e o *workbook* com a lista de abas;
  3. `dop-api/get/sheet` é chamado uma vez por aba (linhas 0 até o total).

  O resultado é guardado como um pacote JSON (`*.qq.json`) com os blobs ainda codificados.
- **Decodificação** (`pipeline/lib/qq-sheet.ts`): base64 → zlib → protobuf sem schema publicado. O mapeamento dos campos está documentado no topo do arquivo:
  - lista de abas: mutação 1;
  - células: mutação 18, com *pool* de strings e células `{linha, coluna, tipo, índice}`.
- **Colunas** de cada aba de classe × piso: 竞争力 (tier), 制造商 (marca, "Toyota 丰田"), 车辆型号 (modelo com ano), 驱动 (tração), 难度 (dificuldade), 轮胎 (pneus), 定位 (perfil), 调校师 (tunador, em duas colunas), 备注 (notas, em geral um tempo em Shirakawa) e 获取方式 (como obter). Cada carro ocupa uma linha mais linhas de continuação com outros tunadores.
- **Sem share codes:** a tabela indica *quem* tunou; o jogador busca o gamertag no jogo. No nosso modelo, ela vira `MetaRanking` com `tunerIds`.
- **Mapeamentos de termos em chinês** (em `normalize/fields.ts`):
  - pneus: 越野胎 off-road, 拉力胎 rally, 半热熔 semi-slick, 全热熔 slick, 赛用热熔 super slick (inferido), 复古白胎 vintage;
  - dificuldade: 非常简单/简单 fácil, 中等 média, 稍微困难, 困难, 非常困难;
  - perfil: 全能 completo, 动力 potência, 操控 controle.
- **Limitações conhecidas** (2026-11-08):
  - 49 células do modelo são do tipo "conteúdo rico" e a API não entrega o texto. O carro vai para a fila de revisão como `<marca> [rich cell]`.
  - 42 carros estão marcados 未知 ("ainda não avaliado") e são ignorados.
  - Por isso, há saltos na numeração do ranking na página de meta.

### `gbr-ozzy`: GBR Ozzy's FH6 | FH5 & FH4 Spreadsheet
- **URL:** https://docs.google.com/spreadsheets/d/1FQ29uIAWVEJDT41sx9bEoqz0BGLpOi9MdA2hp0uzP9w
- **Abas relevantes:** `🛠️FH6 Tune List` (gid 711189847), `🏎️FH6 Car Collection` (1898804810), `🛠️FH6 Community Hub` (472878390), `📋Changelog` (1341616830).
- **Tune List:** coluna 0 vazia, cabeçalho na 5ª linha. Colunas: *Manufacturer, Model/Car, Class, Tune Name, Tuner, Drivetrain*, duas colunas numéricas sem nome (provavelmente BHP e peso), *Suspension, Tyre Compound*, uma data sem nome (DD/MM/AAAA) e *Sharecode* (`773 309 331`). Cerca de 2.660 tunes.
  - O ano do carro, quando aparece, fica **entre parênteses no modelo**: `911 GT3 RS (2023)`. Sem ele, carros de mesmo nome e anos diferentes ficam ambíguos e vão para revisão.
  - O adaptador (`pipeline/adapters/gbr-ozzy.ts`) não infere o piso a partir da suspensão; usa o nome do tune e os pneus.
- **Car Collection:** *BADGE, CAR, CAR TYPE, CLASS, OWNED, HOW TO OBTAIN*, agrupado por fabricante (~780 linhas). Útil no futuro para o texto detalhado de "como obter". A lista mestre é o roster oficial.
- **Community Hub:** lista 11 planilhas de tunadores. Os links ficam em hyperlinks, não no texto; extrair pelo `htmlview`.
- ⚠️ `/export?format=csv` retorna **401**: o dono desativou o download. Pedir autorização antes de publicar.

### `kleis`: Forza Tune & Design Sheet By kleis
- **URL:** https://docs.google.com/spreadsheets/d/1Lv3OzABIpX8_vlXS5zuOXMmrBVhpuLsU (arquivo `.xlsx` no Drive). Aba `FH6` (gid 901186628).
- **Cabeçalho na linha ~8:** *Car, Tuner, Tune, Terrain (Road / Dirt/CC), Drivetrain, Designer, Design, Comment (Powerbuild, Purist…)*. Acima dele: data da última atualização e links para outras planilhas.
- **Sem share code** (conferido em células, notas e hyperlinks do xlsx). O jogador busca o tune pelo gamertag do tunador no jogo.
- **Classe sem coluna:** indicada pela **cor de preenchimento** da coluna A, seguindo as cores de classe do jogo. Mapeamento confirmado em 2026-11-08, cruzando cerca de 1.400 nomes de tune que começam com a classe:

  | Cor (ARGB) | Classe |
  |---|---|
  | `FF9FC5E8` (azul-claro) | D |
  | `FFFFC000` ou tema 7 (amarelo) | C |
  | `FFED7D31` (laranja) | B |
  | `FFFF0000` (vermelho) | A |
  | `FF7030A0` (roxo) | S1 |
  | `FF0070C0` (azul) | S2 |
  | `FFFF00FF` / `FF9900FF` (magenta/violeta) | R |

  Cores fora da tabela caem para a classe no início do nome do tune. O sync avisa quantas linhas ficaram sem cor mapeada (2 em 2026-11-08) e quantas têm cor e nome em conflito (4).
- **Terrain** vale `Road` ou `Dirt/CC`. No segundo caso, o piso exato (terra ou cross country) vem do nome do tune; se o nome não indicar, fica "não informado".
- **Junção com códigos:** por (carro, tunador, nome do tune). Na primeira sincronização, **1.271 de 2.944** tunes do kleis ganharam share code vindo de outra fonte.
- **Valor:** é a maior cobertura de carros e uma curadoria ("testados pelos melhores jogadores"), o que conta como sinal de recomendação.

### `k1z-gray`: My Fh6 Tunes
- **URL:** https://docs.google.com/spreadsheets/d/1p3azjYqyL2OMD9Ksja_f4jTAhJD5tdRdF7nIT_umshQ, aba `FH6 Tunes` (gid 1914811100).
- **Colunas:** *Year, Make, Model, Tune Name, Class, Drivetrain, Engine, Build, Tires, Road Surface, Share Code* (sem espaços). Tabela limpa; a mais fácil.
- Foi aqui que o problema do gviz apareceu: as colunas *Year* e *Share Code* são numéricas, e o gviz apagava os cabeçalhos delas. A exportação CSV resolve.

### `letzelu-shirakawa`: Letz' Shirakawa Tune & Hotlap Sheet
- **URL:** https://docs.google.com/spreadsheets/d/12aoTNk0ROKqX3EYMY8PAoa8ZUivMMtI4uI-ndEg9CtY
- **Abas:** `Table Info` (0), `A700` (1109128970), `S1 800` (1623307181), `S2 900` (630549251).
- **Colunas:** *Tier* (célula mesclada, ex.: `Meta < 59.5`, `Offmeta < 49.0`; preencher para baixo), *Car* (nomes informais, sem ano), *Laptime, Driver, Tune* (tunador), *Build, Difficulty, Tires, Drivetrain, Engine, Aero, Tune Name, Notes*. Sem share code.
- **Valor:** dado objetivo de desempenho (tempo de volta em Shirakawa) para a nota.

### `whd-url`: Underground Racing League Released Cars
- **URL:** https://docs.google.com/spreadsheets/d/1J3rtv_BkLO8WDJqT0S6wJtXwmJANLuOTH1qpqn0MWJI. Abas `Cars/Tracks` (0) e `Introduction` (898987653).
- **Colunas:** personagem (ex.: `Rachel`, `Eddie`), carro (informal: `BMW M3 '08`), código de tune, código de pintura (às vezes texto, como `Paint Black`), PI, Adj. Aero, tração, tunado por. Usado no módulo M13 (eventos da comunidade).
- Os carros vêm em "packs". Cada pack começa numa linha com o título do pack e os rótulos *Adj. Aero / Drivetrain / Tuned By*.
- No último pack, as linhas **sem personagem** e com um **nome (não número) na coluna de PI** são **rotas de evento**: nome da rota, código do evento e criador. Elas viram entradas `kind: route`.

### `forza-playlist`: Festival Playlist oficial
- **URL:** https://forza.net/fh6playlists · dados em `https://forza.net/fh6playlists/_payload.json` (Nuxt/devalue, ~120 KB).
- **Colunas:** *Series / Season, Reward, Event Type, Event Name, Car / Requirement, Route*. Histórico desde S01. Ver [ADR-0009](adr/0009-playlist-fonte-oficial.md).
- **A investigar:** se o payload em `/pt-BR/` traz nomes de eventos traduzidos oficialmente; se `api.forza.net` oferece algo estruturado.
- **Temporada ao vivo:** a página tem a frase *search "City Life - Summer" for the seasonal events available through November 12*. Ela define a temporada atual e o último dia; as outras datas são derivadas (1 semana por temporada, na ordem da tabela).
- **Restrições:** interpretadas por `pipeline/normalize/requirement.ts` (formatos no [ADR-0009](adr/0009-playlist-fonte-oficial.md#atualizações)). Em 2026-11-08, **597 de 604** linhas foram entendidas. As 7 restantes usam tipos secundários de carro que o roster não traz ("Track Life", "Heavy Hitters", "Electric", "Microcar", "High Performance Dailies") ou carros ausentes do roster.

### `base-events`: eventos-base do mapa
- Não foi encontrada fonte estruturada e reutilizável. Será um **levantamento próprio** em `data/manual/base-events.yaml` (nome, disciplina, formato, restrição de classe e tipo de carro, wristband exigido, região), validado no jogo.
- Referências só para conferência (não copiar texto): guias do MapMaster (ex.: 22 eventos de Road Racing) e guides4gamers.

## Candidatas

| Fonte | ID da planilha | Observação |
|---|---|---|
| LogikJ FH6 Tune Sheet (abas de tunes) | `1ZDLQ1Jg6E6VWfMZUZX-GWflVRl75xSYPj4NHUYwZnLo` | ~530 tunes com código e "Cars List". A aba "Online Racing Tune Picks" já é a fonte `logikj`; a aba semanal **não** é usada (ADR-0009) |
| Dumbo, "Tunes in my Garage" | `13mOXgh-tqSodjh4DzepWjuwBsci7wkve` | Via links da planilha do kleis |
| SR1 Rain, "53Rain's Tune List" | `19sGnavfTsp3iPYN_OnNmPBW87I0Pz2ODuNFFhZgaU8g` | Via links da planilha do kleis |
| CTE seasons | `1_f6nPIqEkd1TUNsw_vuO3Hc8zxQrQUNVcppbyTL_Oz0` | Via links da planilha do kleis |
| xi in 4K / Fenrir3268 / K1Z Howzer | `18cFAU4Y04Kfv691IWAcuzwKOS-UlXl0BHqaQ2pCHfq0`, `1LV6gg9XqxEoG1OaiAiUSc-S1-JXcyTBnIuuKPC0CGks`, `1a1gXpcmVFDaipf2vlALtb9JVZhyyX0B8pIEvshJnbvk` | Listadas no hub do Ozzy; correspondência ID ↔ tunador a confirmar |

## Fontes sem definição

- **Team Wars:** não foi encontrada fonte nem confirmação de um modo com esse nome no FH6 (PRODUCT Q1).
