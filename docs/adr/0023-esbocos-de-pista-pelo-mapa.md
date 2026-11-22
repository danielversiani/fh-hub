# 0023. Esboçar as pistas ainda não gravadas a partir do mapa, com traçados calculados

- **Status:** Aceita (pedido do dono, 2026-11-21). Primeiro protótipo: Shirakawa Circuit, publicado no Paddock Lab em 2026-11-21.
- **Data:** 2026-11-21

## Contexto

Pelo [ADR-0021](0021-pistas-pela-telemetria.md), uma pista ganha página quando é gravada pela telemetria e reconstruída com vídeos. Isso dá precisão, mas leva horas por pista, e o jogo tem 88 corridas.

O dono pediu uma versão simplificada para as pistas que ainda não foram gravadas, com três ingredientes:

- o desenho da pista que já temos, das imagens das rotas (as mesmas usadas para reconhecer as gravações);
- só a pista "alargada" em 3D;
- dois traçados:
  - o **"ideal" genérico**, uma racing line clássica em cada curva;
  - o **"otimizado"**, que leva em conta o que vem antes e depois, por exemplo sacrificando a primeira curva de uma chicane para sair melhor para a reta, como na Irokawa.

## Decisão

1. **Desenho da pista:** a linha central sai da imagem da rota do labsgg.com.
   - Separamos os pixels da linha ciano e afinamos a linha até ficar com um pixel de largura (Zhang–Suen).
   - Depois percorremos o laço.
   - A seta branca de direção (com contorno preto) entra como parte da linha. Pelo lado estreito da seta, sabemos o sentido da corrida e o ponto de partida.
2. **Tamanho:** a escala vem da distância da corrida informada na lista do labsgg ("4.0 mi · 2 laps" quer dizer 2 mi por volta).
   - Corrigido de passagem: a leitura antiga de voltas pegava os dados do cartão seguinte, por isso todas as corridas apareciam com 1 volta. O cache foi refeito como `routes-v2.json`.
3. **Simplificações:**
   - A pista é plana (`y = 0`) e tem largura única (12 m por padrão, ajustável com `--width`).
   - Cada pixel da imagem vale cerca de 4 m, então a linha é suavizada (3 passadas de ±10 m) e detalhes menores que isso se perdem.
4. **Os dois traçados** (`pipeline/tracks/racing-line.ts`), na mesma escala das linhas do guia (−1 = carro encostado na borda direita, +1 = na esquerda):
   - **"Curva a curva" (genérico):** em cada curva, entrada pelo lado de fora 45 m antes, ápice no meio geométrico da curva e saída pelo lado de fora 45 m depois. Entre esses pontos, a linha de menor curvatura. Quando duas curvas estão próximas demais, ficam só os ápices. Nada olha mais longe do que isso.
   - **"Otimizado":** minimiza o tempo de volta de um carro típico das classes do meio (aderência de 1,25 g, frenagem de 1,15 g, potência de 260 W/kg, máxima de 78 m/s).
     - **Modelo do carro:** a velocidade em cada ponto é limitada pela aderência na curva, com aceleração e frenagem que dividem a aderência com a curva (elipse de atrito).
     - **Ponto de partida:** a linha de menor curvatura.
     - **Ajuste:** pontos de controle a cada 20 m, ligados por curvas suaves e ajustados pelo método Rprop.
   - **Ordem de grandeza na Shirakawa:** curva a curva, 78,1 s; menor curvatura, 71,8 s; otimizado, 71,1 s.
5. **Arquivos gerados** por `pnpm tracks:sketch -- --route=<id>`:
   - `data/tracks/<id>.json`, com `source: map` e `recordings: 0`, medido pelo mesmo código das gravações.
   - `<id>.lines.yaml`, refeito a cada execução: as duas linhas mais uma nota por curva onde o otimizado difere ("sacrifica a entrada para…").
   - Um `<id>.scene.yaml` inicial (`published: false`), criado uma vez só e que pode ser refinado à mão.
   - Uma pista com telemetria nunca é substituída por um esboço.
6. **Na página:**
   - Esboços ganham o selo "Esboço pelo mapa" e um aviso próprio.
   - Os números e o perfil de elevação, que seriam todos zero, não aparecem.
   - Quando a pista for gravada pela telemetria, o arquivo de telemetria toma o lugar do esboço.

7. **Pontos de passagem de quem conhece a pista** (`linePins` no arquivo de cenário, dono, 2026-11-21):
   - **Quando usar:** o cálculo não sabe o que só se aprende correndo, como um corte pela grama em cima do checkpoint ou um ápice tardio que endireita a curva seguinte. Esses pontos ficam anotados como `{ at, pos, note }`.
   - **Como o otimizado os respeita:** ele é obrigado a passar por eles, por uma penalidade forte (30 s por unidade² de desvio). Perto de um ponto fora do asfalto (além de ±1), o limite daquele lado se abre suavemente por 70 m para cada lado, e só ali a linha pode sair da pista.
   - **Notas:** a nota de cada ponto vira o texto do guia. Com pontos anotados, as notas automáticas saem.
   - **Na Shirakawa:**
     - cortes pela grama nos ápices da T1–T4, por fora da bandeira do checkpoint, que fica em cima do ápice;
     - T4 vindo encostado no lado direito e virando só no começo da curva (desenho do dono, 2026-11-22). Antes, a linha cruzava cedo e ficava uns 40 m colada no lado de dentro antes do ápice. A saída é a mesma do "curva a curva", abrindo até a borda direita ("a entrada é diferente, a saída é igual");
     - preparação da T6 saindo de leve pela esquerda e atravessando a curva em direção ao lado direito;
     - muro da direita da saída da T6 até o ponto de virar para a T7, com o ápice da T7 na borda de dentro do asfalto, mais tarde (desenho do dono, 2026-11-22);
     - T8 freando rente ao checkpoint do começo da curva, por dentro da pista, rolando até o ápice logo depois do fundo e acelerando sem parar até a chegada, com a T9 quase reta.
   - **Desenhos do dono:** um traço feito à mão sobre o modelo vira poucos pontos-chave (onde ficar de um lado, onde encostar, ápice), e não uma cópia do traço. O otimizado liga esses pontos com uma linha lisa.
   - **Tempos com os pontos:** otimizado, 72,4 s; menor curvatura com os mesmos pontos, 73,3 s (com os pontos da T4 e da T7 de 2026-11-22; antes, 71,9 s e 73,3 s). O carro típico perde um pouco com cada ponto a mais, porque o modelo não sabe o que o dono sabe da pista.
   - **Limite do modelo:** a grama tem menos aderência no jogo, mas o modelo trata grama e asfalto do mesmo jeito.

8. **Linhas lisas** (dono, 2026-11-21: "bem retinho"):
   - **Linha central:** a direção da linha central é suavizada ao longo da volta (gaussiana de 12 m), e os pontos são reconstruídos a partir dela. Assim as retas saem retas e cada curva mantém o ângulo total.
   - **Desenho na página:** as linhas calculadas usam `interpolation: spline`, que liga os pontos com uma curva lisa. Antes, a página "segurava" a linha em cada ponto (como nas linhas escritas à mão), e isso fazia uma escadinha a cada 10 m.
   - **"Curva a curva":** usa as mesmas curvas da página. Quando não há 80 m para cruzar a pista entre uma curva e a próxima, ficam só os ápices.
   - **Volta fechada:** num circuito, o último ponto de cada linha repete o primeiro na linha de chegada, e o degradê de cores volta à cor do começo. Assim o fim da volta encaixa no início.
   - **"Otimizado":** paga um preço pequeno por cada mudança de lado (15 s por unidade² de segunda diferença), então uma onda que não ganha tempo vira reta.
9. **Carro do modo "Dirigir":** sem volta gravada para seguir, o carro segue a linha marcada com `drive: true` no arquivo de linhas. Nos esboços, é o otimizado.
10. **Checkpoints sem número** (`checkpointNumbers: false`): enquanto só alguns checkpoints de uma rota estão posicionados, os números sairiam errados. Ficam só os relevantes para o traçado.

## Alternativas consideradas

- **Esperar a telemetria de cada pista:** é preciso, mas lento demais para cobrir o jogo.
- **Traçado só de menor curvatura:** é o "ideal" mais conhecido, mas não mostra o que o dono quer comparar (a curva sacrificada). Ele continua como ponto de partida do otimizado e aparece no resumo do script.
- **Modelo de carro por classe:** mais fiel, mas não muda a ideia e multiplica as linhas. Fica para depois.

## Consequências

- Qualquer corrida da lista do labsgg pode virar um esboço em segundos.
- **Esboços são aproximados:**
  - a largura é chutada;
  - não há elevação;
  - curvas mais apertadas que a resolução da imagem ficam arredondadas;
  - o carro típico não é o carro de ninguém.
  
  O aviso na página diz isso.
- **Conferência no jogo:** o dono olha o esboço e, se valer a pena, a pista sobe para o processo completo do ADR-0021.
- **Correção de passagem no modelo 3D:** o chão não sobe mais em platôs com degraus longe da pista (`terrain` em `src/tracks/scene3d.ts`), o que também melhora a Irokawa.
