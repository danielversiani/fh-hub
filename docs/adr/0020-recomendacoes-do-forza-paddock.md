# 0020. Publicar as recomendações do próprio Forza Paddock e as recomendações por evento da comunidade

- **Status:** Aceita (decisões do dono, 2026-11-14)
- **Data:** 2026-11-14

## Contexto

O dono começou a montar uma planilha própria de tunes recomendadas ("Forza Paddock Tune Recommendations"), com uma aba por classe e piso e uma escala de dificuldade de 6 níveis. Além disso, a planilha de LogikJ tem, para cada semana da Playlist, os carros e tunes que ele recomenda por evento, e a planilha de Noa Miyako passou a trazer o mesmo tipo de recomendação. O dono quer as duas coisas no site, sempre dizendo quem recomendou.

## Decisão

1. **Fonte `forza-paddock`** (planilha do dono, permissão `granted`, peso 1):
   - o site lê todas as abas no formato "<classe> <PI> - <Road|Dirt|CC>", inclusive as que o dono criar depois;
   - **linha sem "Date Created" fica de fora** (o dono confirmou que essas linhas ainda não estão prontas). A linha entra sozinha quando ganhar a data;
   - cada tune ganha o selo **"Recomendada pelo Forza Paddock"** e fica em **primeiro** na classe e no piso daquele carro; na aba Tunes, ao escolher uma classe, os carros recomendados entram todos na caixa "Destaques", como "Escolha do Forza Paddock";
   - o ranking de carros (Meta+, Meta…) **não muda** por causa dessas recomendações;
   - a planilha **não aparece nas novidades da página inicial**, que ficam só para as planilhas externas: ela aparece apenas dentro do site (lista de tunes, cards e páginas dos carros).
2. **Escala de dificuldade de 6 níveis, no site inteiro**, com os níveis da planilha do dono e os nomes escolhidos por ele:

   | Nível | Nome no site |
   |---|---|
   | Brain AFK | Cérebro desligado |
   | Very Easy | Muito fácil |
   | Easy | Fácil |
   | Medium | Médio |
   | Hard | Difícil |
   | Death (ou "Very Hard") | Muito difícil |

   - A escala de Noa Miyako sobe um degrau: 简单 (fácil) = Muito fácil, 普通 (normal) = Fácil, 稍微困难 = Médio, 困难 = Difícil e 非常困难 (muito difícil) = Muito difícil.
   - "Brain AFK" na planilha do dono vale como o selo "Cérebro desligado" marcado pela curadoria ([ADR-0018](0018-cerebro-desligado.md)).
   - O selo automático passa a usar o nível "Muito fácil" (o antigo "easy" de Noa Miyako).
   - As descrições de cada nível ainda vão ser ajustadas pelo dono; por enquanto o site mostra só os nomes.
3. **Recomendações por evento na Playlist**, de duas fontes:
   - **LogikJ** (`logikj-playlist`): abas "Series <n> <estação>" da mesma planilha da fonte `logikj`;
   - **Noa Miyako**: aba "季节赛 每周更新" (eventos da temporada, atualizada toda semana) da mesma planilha da fonte `noa-miyako`.
   - **Ligação com o evento:** as planilhas não usam exatamente os nomes do forza.net (LogikJ escreve "Blood Gulch and Tears"; Noa Miyako escreve em chinês). O site liga cada recomendação ao evento pela semana, pelo tipo de evento e pelo carro, que precisa ser elegível no evento; o nome só desempata. Quando a semana tem um único evento daquele tipo, o site confia na planilha, mesmo que a sua leitura da regra não inclua o carro. Recomendações que não se encaixam vão para a revisão (`.cache/preview/review/unknown-values.json`).
   - **Na página do evento:** um bloco por fonte, "Recomendado por LogikJ" e "Recomendado por Noa Miyako", e depois as sugestões automáticas do Forza Paddock. O card fechado já diz quem recomendou.
4. **Temporada atual:** cada série vai Verão → Outono → Inverno → Primavera. As datas das outras semanas seguem essa ordem (antes seguiam a ordem da tabela do forza.net, que é outra). Se o forza.net demorar a virar a semana, o site usa a temporada cujas datas cobrem o dia.

## Alternativas consideradas

- **Converter a escala do dono para a de Noa Miyako:** o dono preferiu adotar a escala nova no site todo.
- **Publicar todas as linhas da planilha:** 15 linhas sem data pareciam exemplo (o mesmo código em dois carros e nenhum código conhecido); ficam de fora até ganharem data.
- **Contar a recomendação no ranking de carros:** descartado; o selo e a primeira posição bastam.

## Consequências

- **Positivas:**
  - a curadoria do dono aparece com destaque, sem mexer no ranking;
  - a Playlist fica mais útil, com a palavra de quem conhece cada evento.
- **Negativas:**
  - mais duas leituras de planilha para manter;
  - o casamento de eventos pode falhar quando a regra do evento é lida de forma incompleta. Esses casos ficam na revisão.
