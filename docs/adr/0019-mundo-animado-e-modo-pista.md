# 0019. Dar ao site um mundo animado de blocos (modo pista), com um modo normal

- **Status:** Aceita (decisões do dono, 2026-11-09 e 2026-11-10)
- **Data:** 2026-11-10

## Contexto

O dono quis tirar o site do visual estático e dar a ele personalidade, de acordo com a filosofia de "sair do meta". A referência foi o y-n10.com: um mundo de blocos animado ao fundo e uma rolagem fora do comum, com opção de voltar ao modo normal. O cenário pedido é próprio: um paddock e um circuito, com pessoas e carros. O dono acompanhou várias rodadas de prévia e escolheu entre versões.

## Decisão

1. **Um mundo só para o site inteiro** (`src/world/`, three.js): um circuito de blocos com paddock, boxes, pit lane, arquibancada, largada, curvas, palco do festival e o logo 3D "FORZA PADDOCK" (zebras e guard-rail).
   - Visual nítido: chão em quadriculado fino e blocos inteiros, bem definidos, renderizados em resolução cheia.
   - Tudo é original e genérico: carros sem marca, patrocínios só como padrões de cor.
   - Animação coerente:
     - pessoas andam pelas calçadas e pelos caminhos do paddock, nunca na pista;
     - os carros mantêm distância, ultrapassam pela linha livre e às vezes param nos boxes, voltando à pista só quando há espaço.
2. **Página inicial no modo pista:**
   - abertura com o logo e o manifesto fixo;
   - a rolagem leva a câmera por uma volta completa no circuito;
   - as novidades de cada fonte e a playlist aparecem numa **torre de cronometragem** fixa (escolhida entre três versões; garagem por fonte e telões foram descartados), com o título da seção fixo e a lista rolando por dentro;
   - pausa no fim de cada lista antes da próxima;
   - o rodapé aparece só no fim da volta;
   - no celular, a torre fica centralizada.
3. **Outras páginas:**
   - a câmera estaciona num lugar: Tunes nos boxes, Meta no grid, Playlist no palco, Tunadores no paddock, as demais na arquibancada;
   - o cenário fica atrás de um véu escuro e desliza de leve com a rolagem;
   - trocar de página faz a câmera voar até o novo lugar, e o conteúdo desliza na diagonal (navegação do Astro com `ClientRouter` e o canvas preservado entre páginas).
4. **Modo normal**, num botão do menu que acompanha a página:
   - o mesmo site, sem animação nem rolagem pela pista, sobre uma **imagem parada** do mesmo lugar (`public/world/<lugar>.webp`);
   - o código 3D nem é baixado;
   - a escolha fica guardada no navegador;
   - quem pede ao sistema para reduzir animações já começa no modo normal;
   - se o 3D falhar, cai no modo normal só naquela visita.
5. **Visual em blocos:** cantos retos e sombras duras deslocadas em cards, caixas, botões e filtros, nos dois modos. Menu fixo e translúcido; filtros fixos logo abaixo dele.

## Alternativas consideradas

- **Rolagem só na diagonal:** o dono preferiu a que segue a pista. A primeira versão era um sprint; virou uma volta completa.
- **Cards espalhados pela pista:** confuso, porque não dava para saber o que era de qual fonte.
- **Garagem por fonte:** a câmera parava no paddock e perdia a volta.
- **Telões gigantes:** elegantes, mas a torre se mostrou mais clara.
- **Pixelização grossa (baixa resolução ampliada):** ficou num "meio do caminho". O dono escolheu pixels pequenos e definidos.

## Consequências

- **Positivas:**
  - identidade própria e coerente;
  - o mesmo mundo liga todas as páginas;
  - o modo normal mantém o site leve e acessível.
- **Negativas:**
  - mais código para manter;
  - cerca de 140 KB de 3D no modo pista;
  - celulares fracos podem esquentar (o desenho pausa com a aba oculta).
- **Imagens do modo normal:** são geradas à mão quando o mundo muda. Rode `pnpm dev`, abra `http://localhost:4321/?snapshots` e confira o resultado em `public/world/` (ver RUNBOOK).

## Atualizações

- **2026-11-10, qualidade "de jogo de verdade"** (pedido do dono): sombras de contato em tudo; grama cortada em faixas; linhas brancas de borda, linha de corrida borrachada e marcas de frenagem na pista; alambrados nas curvas; carros refeitos (carroceria, rodas com aro, asa, faróis), que freiam e inclinam nas curvas, acendem as luzes de freio e soltam fumaça de pneu; equipes de box que correm até o carro no pit stop; pessoas com braços; fiscais de pista acenando bandeira; arquibancada com assentos e "ola", mudada para trás da reta oposta (na frente da reta principal ela escondia o grid); balão sobre o circuito; 12 carros em comboio.
