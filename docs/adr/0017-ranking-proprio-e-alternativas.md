# 0017. Usar um ranking próprio, calculado a partir de todas as fontes, e destacar as alternativas ao meta

- **Status:** Aceita (decisões do dono, 2026-11-09)
- **Data:** 2026-11-09
- **Substitui:** as regras 1, 2 e 6 de "Regras do dono (2026-11-08)" do [CURATION.md](../CURATION.md), que faziam da tabela de Noa Miyako o ranking principal do site.

## Contexto

O foco do site mudou: ajudar o jogador a sair do meta online, encontrando carros e tunes competitivos e divertidos além do óbvio (o "manifesto" da página inicial). Para isso, o dono pediu:

1. **Usar todas as fontes**, sem que uma delas (a tabela de Noa Miyako) seja o ranking do site. As fontes são: tabela de Noa Miyako, lista online e estatísticas de Rivais do fhstats, escolhas online de LogikJ, lista de Attax Johnson e planilha de Rivais. fhgarage e fh6meta não contam separado, porque só agregam outras fontes.
2. **Uma fórmula automática**, que não dependa do dono, porque ele conhece bem só algumas classes.
3. **Um campo de destaque** "Alternativas competitivas ao meta atual", com a lista completa, da mais forte para a menos forte, e uma caixa de destaques (achados recentes, sleepers e escolhas da plataforma).
4. **Datas** nas tunes e nas sugestões, e a detecção automática de carros "manjados".
5. Nada de rótulo negativo do tipo "pouca evidência"; nenhum bônus por a tune ter share code.

## Decisão

1. **Tier do Forza Paddock** para cada carro × classe × piso, calculado em `pipeline/curate/roles.ts`, gravado em `data/generated/roles.json` e usado como ranking principal em todo o site (lista de tunes, página do carro, sugestões da playlist):
   - **Meta+** e **Meta**: o que se encontra online;
   - **Off-meta**: alternativa competitiva;
   - **Nicho**: forte em eventos específicos. Só entra à mão (`data/manual/tier-overrides.yaml`), porque a fórmula não consegue detectar isso com precisão;
   - **Outros**: citado, mas abaixo dos outros, ou com builds quase só de handling ou velocidade pura.
2. **Etiquetas** por cima do tier:
   - **Rivais**: alguma fonte lista uma tune de handling ou velocidade pura do carro;
   - **Achado recente**: o site viu o carro pela primeira vez há até 3 semanas, citado por 2 ou mais fontes;
   - **Sleeper**: citado por uma só lista, mas forte nos rankings de Rivais;
   - **Escolha do Forza Paddock**: escolha da plataforma (`data/manual/featured-picks.yaml`), com comentário.
3. **A fórmula** (números em [CURATION.md §10](../CURATION.md#10-ranking-do-forza-paddock-e-alternativas)):
   - cada fonte vira uma opinião de 0 a 1;
   - listas sem tier (as "escolhas" de Attax Johnson) contam como fonte, mas ficam fora da média;
   - os dados de Rivais entram só quando o carro aparece no top 10;
   - os carros "manjados" (3 ou mais fontes, citados há 90 dias ou mais) descem na lista de alternativas;
   - a confirmação de um T1 de Noa Miyako por outra fonte sobe o carro (o "sweet spot" do dono).
4. **O site guarda quando viu cada carro pela primeira vez** (`firstSeen` em `roles.json`, mantido de uma sincronização para a outra). Os carros já listados quando o registro começou contam desde o lançamento do jogo e não aparecem como novidade.
5. **Novidades por fonte na página inicial:** cada fonte (tabela de Noa Miyako, listas e planilhas de tunes) tem o seu bloco, só quando há atualização detectada nas últimas 2 semanas. As mudanças são descritas **com as palavras e a escala da própria fonte** (o tier de Noa Miyako, o nível da lista, o nome da tune). Mudanças causadas pelo nosso processamento (fonte nova, correção de nome, autor que saiu) não entram no registro: só conta o que mudou numa fonte cujos dados realmente mudaram naquela sincronização.
6. **A tabela de Noa Miyako continua no site** como referência creditada (página "Meta" e bloco próprio nas novidades), mas não é mais o ranking principal.

## Alternativas consideradas

- **Manter a tabela de Noa Miyako como ranking:** ela não é consenso, e o dono quer um ranking objetivo, de várias fontes.
- **Classificação feita à mão pelo dono:** não escala, porque o dono conhece bem só algumas classes.
- **Comparar Rivais com o líder do ranking:** o líder costuma ser um carro especialista em contra o relógio (ex.: MX-5 Forza Edition no S2 asfalto), o que achatava o resto. O desempate do Meta+ compara com o carro meta mais forte da classe.

## Consequências

- **Positivas:** o ranking é automático, explicável ("Como funciona" no site e evidências em cada carro) e melhora sozinho quando as fontes mudam. O dono intervém só onde a fórmula não alcança (Nicho, escolhas da plataforma).
- **Negativas:** classes com poucas fontes ficam com ranking mais pobre. O desempate do Meta+ depende dos dados de Rivais.
- **Pendente:** as categorias Meta / Off-meta das sugestões da playlist e do filtro "Categoria" ainda vêm do tier de Noa Miyako (`pipeline/curate/index.ts`). Elas devem passar a usar o tier do Forza Paddock num PR próprio.
