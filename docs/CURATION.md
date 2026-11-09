# Curadoria: notas, categorias e sugestões

> **Status:** v0.3, implementada por regras em `pipeline/curate/` · **Atualizado em:** 2026-11-09
> Estes são os **critérios do dono do produto**, traduzidos em regras. Todos os pesos e limiares ficam em `data/curation/config.yaml`, não no código: ajustar um critério = editar o YAML num PR.
> ⚠️ Os valores abaixo são um **ponto de partida** e precisam ser validados pelo dono com dados reais (ver [§9](#9-pendências-com-o-dono)).

## Regras do dono (2026-11-09) — ranking do Forza Paddock

O ranking principal do site é o **tier do Forza Paddock** (Meta+, Meta, Off-meta, Nicho, Outros), calculado a partir de todas as fontes ([ADR-0017](adr/0017-ranking-proprio-e-alternativas.md), [§10](#10-ranking-do-forza-paddock-e-alternativas)). As regras 1, 2 e 6 abaixo ficam **substituídas** nesse ponto: a tabela de Noa Miyako continua como fonte e como referência creditada, mas não é mais o ranking do site. Falta um passo: as categorias Meta / Off-meta das sugestões da playlist (regra 2) ainda vêm do tier de Noa Miyako, e devem passar para o tier do Forza Paddock num PR próprio.

## Regras do dono (2026-11-08) — prevalecem sobre o resto deste documento, exceto onde a seção acima as substitui

1. **A tabela de meta de Noa Miyako é a referência.** O tier de um carro numa classe × piso vem dela. Carro que a tabela não lista recebe **T3** (`defaultTier`) até ser avaliado.
2. **Meta / Off-meta vêm só desse tier**: Meta = Meta+, Meta, T0.5; Off-meta = T1, T1.5, T2.
3. **Meme é uma lista de carros**: carros que ninguém associa a corrida, mas que funcionam porque o jogo é arcade (Peel P50, Cadillac XTS Limousine, vans da Ford e da Wuling, Unimog, táxis japoneses…). A lista fica em `data/curation/config.yaml` (`memeCars`). **Meme só existe nas sugestões de campeonatos da playlist**, e só quando algum carro da lista é elegível. Não é filtro da lista de tunes.
4. **Só sugerir quando a elegibilidade é conhecida.** A raridade e a tração de fábrica vêm da Forza Wiki: só carros com o dado conhecido entram.
5. **A nota numérica não aparece no site.** Ela só desempata tunes do mesmo tier. Ordem usada em listas e sugestões: tier → tunador indicado por Noa Miyako → tem share code → posição na tabela → nota.
6. **Ordem da lista de tunes**: alfabética sem filtro de classe; com classe, na ordem do meta (melhor tier primeiro, depois a posição na tabela), e os carros fora da tabela (T3) por último.
7. **Várias sugestões por categoria** (2026-11-08): cada evento mostra até 4 carros Meta, 3 Off-meta, 2 Purista e 2 Meme (`suggestionsPerCategory`). Um carro aparece uma vez só entre Meta, Off-meta e Meme, com a sua melhor tune. Purista pode repetir um carro, desde que com outra tune.
8. **Toda indicação da tabela vira tune.** Quando Noa Miyako indica um tunador para um carro ("busque MSR Mian no jogo") e nenhuma planilha tem uma tune desse tunador para aquele carro, a indicação vira uma tune sem código (`fromMeta`). Assim um carro nunca aparece como "sem tune" ao lado de um tunador recomendado.
9. **As colunas da tabela acompanham a tune do tunador indicado:** tração, pneu, estilo (completo, potência, controle), dificuldade, observações e tempos citados nas observações ("白川1:04.3" vira "1:04.3 · Shirakawa", pela lista `data/manual/track-aliases.yaml`). Tunes de outros tunadores para o mesmo carro não herdam essas colunas.

## 0. Estado da implementação (2026-11-08)

- Implementado: sinais `tier` (Noa), `laptime` (Letz), `endorsement`, `tuner`, `recency` e `ease`; categorias; sugestões por evento; selos "Recomendado" nas páginas de carro.
- **Ainda não:**
  - sinal `rivals`: a planilha de Rivals não está no pipeline;
  - casos-âncora (§8): aguardam exemplos do dono;
  - camada de IA ([ADR-0008](adr/0008-curadoria-regras-e-ia.md)).
- Diferenças em relação à proposta:
  - o peso de um tier cai para `unlistedTunerTierFactor` (0,8) quando o tune não é de um tunador creditado na tabela de meta;
  - `recency` é medido contra o tune mais novo dos dados, não contra "hoje", para a saída ser determinística;
  - o perfil das sugestões usa `weightsPlaylist`, que dá mais peso à facilidade.

## 1. O que a curadoria produz

1. **Nota (`score`) de cada tune**, no contexto da sua classe e piso.
2. **Categorias** de cada tune: Meta, Off-meta, Purista, Meme. Um tune pode ter mais de uma.
3. **Sugestões por evento** da Festival Playlist e dos eventos-base: algumas tunes por categoria em cada evento (`suggestionsPerCategory`).
4. **Recomendado** na página de cada carro: o tune de maior nota por classe × piso.

## 2. Sinais

Cada sinal é normalizado entre 0 e 1. **Sinal ausente não vale zero**: ele simplesmente não entra na conta (ver §3).

| Sinal | De onde vem | Como vira número |
|---|---|---|
| `tier` | Tabela de meta de Noa Miyako (classe × piso do tune) | `meta-plus` 1,0 · `meta` 0,9 · `t0.5` 0,8 · `t1` 0,65 · `t1.5` 0,55 · `t2` 0,45 · `t3` 0,3 |
| `rivals` | Planilha de Rivals (aparições do carro em classe × piso) | Aparições ÷ aparições do 1º colocado |
| `laptime` | Letz (Shirakawa, por classe) | `max(0, 1 − (tempo − melhor) / melhor × 20)`: 1 s de diferença numa volta de 50 s dá ≈ 0,6 |
| `endorsement` | Quantas fontes independentes listam o tune | `log2(1 + n) / log2(1 + nMax)`; listas curadas (ex.: kleis) contam com o peso da fonte |
| `tuner` | Reputação do tunador, **definida pelo dono** | Valor por tunador no config; padrão 0,5 |
| `recency` | Data do tune, quando a fonte informa | 1,0 se criado depois do último patch de física relevante; decai com o tempo |
| `ease` | Dificuldade (Noa, Letz) | `easy` 1,0 … `very-hard` 0,2. Peso maior nas sugestões para iniciantes |
| `community` | Votos (Fase 3) | Ainda não existe |

## 3. Nota

```
score = Σ (peso_i × sinal_i) / Σ peso_i      ← somando só os sinais presentes
confiança = Σ peso_i (presentes) / Σ peso_i (todos)
```

- Pesos ausentes são redistribuídos automaticamente, para que um carro sem dados de meta não seja punido só por isso.
- **Confiança baixa** (< 0,35) aparece no site como "poucos dados", e o tune não pode ocupar a vaga **Meta** de uma sugestão.
- Desempate: mais fontes > tem share code > mais recente > ordem alfabética do tunador (para ser determinístico).

## 4. Categorias

| Categoria | Regra (proposta) |
|---|---|
| **Meta** | Pelo menos um **sinal forte**: tier ≥ `t0.5`, top 3 de Rivals na classe × piso, ou rótulo "Meta" no Letz. Palavras como "Meta" no nome do tune dão bônus, mas **sozinhas não bastam** |
| **Off-meta** | Competitivo sem ser meta: tier entre `t1` e `t2`, rótulo "Offmeta" no Letz, "offmeta"/"off-meta" no nome, **ou** nota ≥ 0,6 sem sinal de meta |
| **Purista** | Tag `purist`: coluna Build/Comment = Purist, ou "purist" no nome do tune. Ordenado por nota entre os puristas |
| **Meme** | **Exige julgamento.** Candidatos por regra: tipo de carro improvável para o evento (microcarro, van, pickup em corrida de asfalto S1+), carro de classe de fábrica muito baixa levado a S2/R, ou palavras no nome ("meme", "fun", "troll", "joke"). A escolha final é feita pela IA ([ADR-0008](adr/0008-curadoria-regras-e-ia.md)) ou pelo dono. Sem IA, a vaga mostra o melhor candidato por regra ou fica vazia |

## 5. Sugestões por evento da playlist

1. **Interpretar a restrição** (`requirement`, ver [ADR-0009](adr/0009-playlist-fonte-oficial.md)): classe, tipos de carro, carro específico, meta numérica.
2. **Interpretar as rotas:** prefixo `Road:` → road/circuit-sprint; `Street:` → road/street; `Dirt:` → dirt; `Cross Country:` → cross-country.
3. **Carros elegíveis:** os tipos do carro cruzam com os tipos exigidos (ou é o carro exigido).
4. **Tunes elegíveis:** da classe exigida e do piso compatível. Para PR Stunts:
   - Speed Trap / Speed Zone: tunes de velocidade final;
   - Danger Sign: velocidade e aceleração;
   - Trailblazer: cross-country;
   - Time Attack: tunes de circuito.
5. **Preenchimento das vagas, nesta ordem:** Meta → Off-meta → Purista → Meme, com várias vagas por categoria (regra do dono 7). Meme só em campeonatos (regra 3).
6. **Share code:** preferir sempre tunes com código. Um tune sem código só entra se não houver alternativa, com o aviso "buscar pelo gamertag no jogo".
7. **Obtenção:** se `preferObtainable` estiver ligado, carros que hoje só existem como recompensa encerrada perdem prioridade, e o site mostra "difícil de obter".
8. **Explicação:** cada sugestão carrega `reasons`, por exemplo "Tier T0.5 na tabela de Noa Miyako", "Listado em 3 planilhas" ou "4º melhor tempo em Shirakawa (A 700)".
9. Restrições `unparsed` vão para `data/review/unparsed-requirements.json` e ficam para a IA ou para o dono.

## 6. Eventos-base

Mesmo algoritmo do §5, aplicado aos eventos de `data/manual/base-events.yaml`. Como esses eventos não mudam, as sugestões só mudam quando os dados de tunes mudam.

## 7. Exemplo de `data/curation/config.yaml`

```yaml
version: 1
weights:            # contexto geral (página de carro)
  tier: 0.30
  rivals: 0.15
  laptime: 0.15
  endorsement: 0.20
  tuner: 0.10
  recency: 0.05
  ease: 0.05
weightsBeginner:    # sugestões da playlist (público amplo)
  tier: 0.25
  rivals: 0.10
  laptime: 0.10
  endorsement: 0.20
  tuner: 0.10
  recency: 0.05
  ease: 0.20
thresholds:
  minConfidenceForMeta: 0.35
  offMetaMinScore: 0.60
  fuzzyCarMatch: 0.92
categories:
  metaTiers: [meta-plus, meta, t0.5]
  offMetaTiers: [t1, t1.5, t2]
  memeKeywords: [meme, fun, troll, joke, potato]
  memeCarTypes: [Microcar, Vans & Utility, Pickups & 4x4's]   # em eventos de asfalto S1+
tuners:             # reputação, definida pelo dono (0–1); ausente = 0.5
  # noa-miyako: 0.9
preferObtainable: true
lastPhysicsPatch: 2026-11-05   # tunes anteriores perdem o bônus de recência
```

## 8. Testes de curadoria

- **Casos-âncora:** uma lista em `pipeline/__fixtures__/curation/anchors.yaml` com escolhas que o dono considera óbvias (ex.: "em R 998 road, o 787B tem que aparecer como Meta"). Toda mudança de peso roda contra ela.
- **Relatório de diferenças:** a CI mostra quais sugestões da semana mudariam com o novo config, antes do merge.

## 9. Pendências com o dono

1. Validar ou ajustar os pesos e limiares acima.
2. Definir a reputação dos tunadores (ou manter todos neutros).
3. Definir **Meme** com exemplos concretos (PRODUCT Q5).
4. As sugestões da playlist devem priorizar **iniciantes** (facilidade e carros fáceis de obter) ou **competitivos** (desempenho máximo)? Proposta: perfil iniciante por padrão, com uma alternância no site.
5. Fornecer de 5 a 10 casos-âncora.

## 10. Ranking do Forza Paddock e alternativas

Implementado em `pipeline/curate/roles.ts` ([ADR-0017](adr/0017-ranking-proprio-e-alternativas.md)). Saída: `data/generated/roles.json`, uma linha por carro × classe × piso. Os limiares ficam no topo do arquivo (constantes), com testes em `roles.test.ts`.

### 10.1 Opiniões das fontes (0 a 1)

| Fonte | Escala | Nota |
|---|---|---|
| Noa Miyako (tabela de meta) | Meta+ / Meta / T0.5 / T1 / T1.5 / T2 / T3 | 1 / 0,85 / 0,75 / 0,65 / 0,55 / 0,45 / 0,3 |
| fhstats (lista online), LogikJ | Meta+ / Meta / Strong / Offmeta | 1 / 0,85 / 0,7 / 0,6 |
| Attax Johnson | "pick" (sem tier) | 0,65; conta como fonte, mas fica **fora da média** quando há fonte com tier |

- **Consenso:** média das opiniões com tier.
- **Rivais** (fhstats, aparições no top 10): `√(top10 do carro ÷ top10 do líder da classe × piso)`. Entra na força só quando o carro tem top 10: `0,65 × consenso + 0,35 × Rivais`.
- **Fontes:** opiniões + 1 se tem top 10 em Rivais + 1 se aparece na planilha de Rivais.

### 10.2 Tier

1. **Meta:** 2 ou mais fontes no topo (Meta+ ou Meta), ou 1 no topo com Rivais ≥ 0,6 ou 10+ pontos na planilha de Rivais.
2. **Meta+:** um carro Meta com consenso ≥ 0,9 e pelo menos um voto Meta+. Se as fontes se dividem entre Meta+ e Meta, ele precisa também de Rivais ≥ 0,8, comparado com o carro Meta mais forte da classe (não com o líder do ranking, que costuma ser um especialista em contra o relógio).
3. **Off-meta (alternativa):** citado por alguma fonte e com força ≥ 0,55.
4. **Outros:** citado, mas abaixo disso.
5. **Builds de Rivais:** quando metade ou mais das opiniões citam uma build de handling puro ou velocidade pura (Attax "Pure Handling"/"Speed", LogikJ grip sem nota de online; o estilo do fhstats sozinho não conta), o carro vai para **Outros** com a etiqueta **Rivais**. Com uma só build dessas, ele mantém o tier e ganha só a etiqueta.
6. **Nicho** e correções: só à mão, em `data/manual/tier-overrides.yaml` (vale mais que a fórmula). Exemplo: R390 GT1 no S1 asfalto, bom em sprints com curvas de média e alta velocidade.

### 10.3 Ordem das alternativas

1. **Mais fontes primeiro.**
2. **+0,5** quando o T1 de Noa Miyako é confirmado por outra fonte (o "sweet spot" do dono).
3. **−1** para carros **manjados**: 3 ou mais fontes, e a data mais antiga citada é de 90 dias ou mais antes da mais nova.
4. **Desempate:** a força.

### 10.4 Destaques ("Destaques" no topo das alternativas)

- **Escolha do Forza Paddock:** `data/manual/featured-picks.yaml`, com comentário.
  - Tom: "competitivo" basta; "muito competitivo" só para um achado raro.
- **Achado recente:** o site viu o carro pela primeira vez há até 21 dias (`firstSeen`), com 2 ou mais fontes, e ele não é manjado.
  - A etiqueta sai sozinha depois de 21 dias.
  - O registro começou em 2026-11-09; os carros já listados contam desde o lançamento (2026-05-19).
- **Sleeper:** uma só lista o cita, mas ele tem Rivais ≥ 0,35.
- **Limite:** até 6 destaques por classe × piso.

### 10.5 Cérebro desligado

Ver [ADR-0018](adr/0018-cerebro-desligado.md).
- **Automático:** a tune recomendada pela tabela de Noa Miyako e chamada de "fácil", em carro Meta+.
- **Manual:** `data/manual/brain-afk.yaml`.
