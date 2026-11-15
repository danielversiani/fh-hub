# 0021. Montar as páginas de pista a partir da telemetria do jogo

- **Status:** Aceita (decisão do dono, 2026-11-14)
- **Data:** 2026-11-14

## Contexto

O dono quer páginas de pista no estilo do "Track Analytics" do ForzaLabs: o traçado colorido por piso, o perfil de elevação e de curvas, a lista de curvas e o quanto a rota exige do carro (aceleração, frenagem, velocidade final, aderência em curva lenta e rápida). O objetivo é ligar cada evento da Playlist à sua pista e, no futuro, sugerir carros e tunes que combinem com ela.

O jogo tem um recurso oficial, o **Data Out**, que envia a telemetria do carro (posição x, y e z, velocidade, pedais, forças G e vibração de cada roda) para o computador do jogador. O dono já o usa com o SimHub. Num teste em 2026-11-14 foram gravadas 10 corridas, e os traçados, a elevação e a velocidade saíram coerentes (os circuitos fecham com 16 a 58 m de diferença entre largada e chegada).

## Decisão

1. **Fonte: telemetria gravada por pessoas convidadas.**
   - Primeiro o dono, com `pnpm telemetry:record` (o SimHub repassa o Data Out para a porta 5301).
   - Depois, outras pessoas convidadas, por um programa simples para Windows: ele escuta o Data Out, grava a volta e envia para o site.
     - Uma página do site sem link no menu, acessível só para quem tem o endereço, explica como configurar o Data Out e oferece o programa para baixar.
     - Um navegador não consegue receber o Data Out sozinho, por isso o programa é necessário.
     - Receber as gravações exige um ponto de envio no site (um Worker do Cloudflare com armazenamento). Isso abre uma exceção ao [ADR-0002](0002-site-estatico-sem-banco.md), que ficaria restrita a esse recebimento: o resto do site continua estático.
     - Toda gravação de terceiros passa pela revisão do dono antes de virar dado do site.
2. **Nenhum acesso a servidores do jogo.** O Data Out sai do aparelho do próprio jogador. Isso continua dentro da regra do projeto.
3. **Reconhecer a rota automaticamente.**
   - **Imagens das rotas:** usar as imagens públicas das rotas (recortes do mapa do jogo com o traçado, como as do labsgg.com) como referência. O dono decidiu que conteúdo do jogo publicado por terceiros não precisa de crédito, porque não há autoria envolvida.
   - **Comparação de formato:** o formato gravado é comparado com o de cada imagem, ajustando escala e posição; o comprimento e o número de voltas desempatam.
   - **Plano B:** quando não houver certeza (nota de diferença acima de 0,3), a rota fica como "não reconhecida" e o processamento pede o nome. Rotas fora da lista do labsgg (como a Tokyo Railway Sprint) ficam em `data/manual/routes.yaml`, com nome e piso.
   - **O nome dá o piso** (dono, 2026-11-14): o labsgg agrupa as corridas por tipo (Street, Road, Touge e Drag = asfalto; Dirt = terra; Cross Country = cross country). Assim a entrada de gravações fica automática.
   - **Fora daqui:** o que o ForzaLabs calcula e só mostra a assinantes (as notas de demanda, por exemplo) não é usado. O site calcula as próprias.
4. **O que vira dado do site, por rota: só o que vale para qualquer carro** (dono, 2026-11-14). A velocidade não entra, porque muda com a classe e o carro.
   - o traçado simplificado, com elevação;
   - a inclinação (subidas e descidas) e a cambagem das curvas;
   - as curvas (direção, ângulo, raio), as retas, as lombadas e os saltos;
   - o piso, pelo nome da rota;
   - as notas de demanda, calculadas por nós a partir da forma da pista e comparadas entre as rotas em percentis.
5. **Gravações brutas são apagadas depois de processadas.** O teste somou 78 MB. Só o resumo processado da rota fica guardado no projeto.

## Etapas

1. Reconhecimento das 10 corridas já gravadas pelo formato, para validar o método.
2. Processamento: traçado, elevação, inclinação, cambagem, curvas, retas e saltos, com as gravações apagadas no fim.
3. Página da pista no site e ligação com os eventos da Playlist.
4. **Modelo 3D de cada pista** (dono, 2026-11-14), com three.js, que o site já usa, para marcar linhas ideais e alternativas por tipo de carro e condição da pista.
5. Programa de gravação para convidados, página escondida e recebimento no site (exceção ao ADR-0002).
6. Sugestões de carro e tune por pista.

## Atualizações

- **2026-11-14, modelo 3D realista** (pedido do dono): o modelo não segue o estilo de blocos do fundo do site. É realista e simplificado, para reconhecer o lugar do jogo, e vem do traçado medido somado a um arquivo de cenário por pista (`data/tracks/<rota>.scene.yaml`).
  - **O arquivo de cenário** diz, trecho a trecho, a largura da pista, o acostamento, a barreira e o que se vê de cada lado (arquibancadas, setas, muro de contenção, tendas, árvores, prédios, água), além dos marcos (pórtico, viaduto, passarela, tanque esférico, torre).
  - **Como é escrito:** a partir de vídeos de corrida. Os quadros de uma volta são extraídos um por segundo, e a velocidade do painel, somada segundo a segundo, diz em que metro da volta cada quadro está. O dono revisa o resultado.
  - **Publicação:** uma pista só vai ao ar quando o dono a libera (`published: true`); antes disso, aparece só em `pnpm dev`. A liberação é aos poucos, uma a uma ou em pacotes.
  - **Protótipo:** Irokawa Circuit, a partir da live do dono de 2026-11-14.
- **2026-11-14, checkpoints e guia de traçado** (pedido do dono, com vídeos de referência de Spa e Monza):
  - **Checkpoints:** as bandeiras são a referência de mira, então ficam no modelo como no jogo: um par de bandeiras verdes altas por checkpoint, mais a linha vertical com o número. A posição sai do HUD do vídeo: a distância que o jogo mostra sobre cada checkpoint, somada ao ponto da volta em que o quadro está, conferida com o momento em que o tempo parcial muda (cerca de ±15 m).
  - **Guia de traçado** (`data/tracks/<rota>.lines.yaml`):
    - linhas pintadas sobre a pista, com cores em gradiente, cada uma com nome e para que carro ou condição serve;
    - setas de mira (✓ melhor, seta verde, seta laranja, ✗ evitar);
    - textos por sequência de curvas, explicando quando vale perder numa curva para sair mais rápido na seguinte.

    A página mostra cada linha com um botão para ligar e desligar, e cada texto leva a câmera ao trecho.
  - **Linhas da Irokawa:** são um rascunho do Forza Paddock para o dono revisar.
- **2026-11-14, revisão cuidadosa pelo vídeo** (o dono achou as curvas e as elevações estranhas na visão "Dirigir" e viu um "caroço" entre o CP7 e o CP8):
  - **Câmera "Dirigir" igual à do jogo:** medida no vídeo, fica a cerca de 2 m de altura e 8,6 m atrás do centro do carro, com 67° de visão horizontal, e mostra um carro de referência sem marca. A câmera anterior (1,3 m de altura, olhando 25 m à frente) exagerava curvas e elevações.
  - **Meio da pista:** a telemetria dá o traçado do piloto, não o meio da pista. A posição do carro na pista é lida em 38 quadros, com uma régua em metros desenhada em perspectiva (a largura do carro serve de escala), e vai para `drivenLine` no arquivo de cenário. Com ela, o modelo põe a pista no lugar (±0,2 da meia-largura). A escala é a mesma das linhas do guia: −1 e +1 são o carro encostado na borda.
  - **Cambagem:** o primeiro método misturava a rolagem da carroceria com a inclinação da pista (chegou a dar −5° no grampo). Até haver uma medida confiável, a pista fica nivelada (`camber: flat`) e a coluna de cambagem some da página. Uma ideia para o futuro é medir pelo curso da suspensão.
  - **O "caroço":** era o terreno, não a telemetria. O grampo (T4, a 117 m de altitude) passa perto da descida da T5 (114,6 m), e o terreno copiava a altura do ponto de pista mais próximo. Agora o terreno fica abaixo da pista mais baixa num raio de 60 m.
  - **Checkpoints exatos:** o cronômetro da volta no HUD dá o instante de cada quadro. A velocidade do painel somada dá 1.832 m, contra os 1.830 m da telemetria. A troca do tempo parcial dá a passagem por cada checkpoint, e a distância mostrada pelo jogo confere com 1 a 3 m de diferença.
  - **Dentro da pista:** pintura (faixa central tracejada, faixa de pedestres, linhas e blocos coloridos), cones, área asfaltada (praça da T2, ápice da T3), calçadas, guard-rail, muros de grade inclinados (T1, reta oposta) e muros de concreto no corte sob o viaduto. Fora da pista, o cenário segue simples, como o dono pediu.
  - **Larguras:** a largura de um trecho vale até outro trecho mudá-la.
  - **Limitação conhecida:** as bordas continuam estimadas pelo vídeo. As voltas que o dono vai gravar coladas em cada borda podem substituir essa leitura.
- **2026-11-14, navegação** (o dono viu o carro "pulando" e achou a vista livre ruim):
  - **Carro sem tremer:** carro e câmera pegavam o ponto de 2 em 2 m mais próximo, cada um num instante, e por isso saltavam. Agora deslizam entre os pontos, a uma velocidade constante (cerca de 140 km/h) que não depende da tela. O carro também inclina nas subidas e descidas.
  - **Vista livre como um mapa:** arrastar move pelo chão; botão direito (ou Ctrl/Shift + arrastar) gira e inclina; a roda aproxima em direção ao cursor; duplo clique voa até o ponto; as setas do teclado também movem. Uma dica na tela explica (no celular: um dedo move, dois giram e aproximam). Ao voltar de "Dirigir", a vista começa acima e atrás do carro.
  - **Uma cena 3D por vez:** na página da pista, o fundo animado do site para depois que a câmera chega, para não disputar a placa de vídeo com o modelo.
- **2026-11-14, publicada como protótipo:** o dono liberou a Irokawa (`published: true`) para servir de vitrine e colher opiniões, numa seção nova do site, o Paddock Lab (`/lab/`, [PRODUCT §5.6](../PRODUCT.md)). A página da pista mostra o aviso de trabalho em andamento e o botão "Dar opinião". As linhas do guia continuam marcadas como rascunho.

## Alternativas consideradas

- **Copiar os dados de análise do ForzaLabs:** só existem para assinantes e são cálculos deles.
- **Servidores ou arquivos do jogo:** proibidos pela regra do projeto.
- **Só uma página no site, sem programa:** o navegador não recebe o Data Out.

## Consequências

- **Positivas:**
  - dados próprios, do jogo real, sem depender de terceiros;
  - qualquer pessoa convidada pode ajudar a cobrir as cerca de 90 rotas.
- **Negativas:**
  - um programa para manter;
  - um ponto de envio no site (fim do site 100% estático);
  - o reconhecimento por formato pode errar em rotas parecidas, por isso há revisão.
