# 0024. Seção de Guias: a trilha que o jogo não dá ao iniciante

- **Status:** Aceita (dono, 2026-11-22)
- **Data:** 2026-11-22

## Contexto

O FH6 chega ao PS5 em 26/01/2027, com acesso antecipado a partir de 21/01/2027 para quem comprar a edição Premium. Pelo histórico do FH5 no PS5, pode chegar mais de um milhão de jogadores novos de uma vez. O dono quer uma seção de guias com o tutorial que o jogo deveria ter, e o [PRODUCT](../PRODUCT.md) já prevê isso como M10 ("Guias e tutoriais").

A pesquisa de 2026-11-22 (`reports/Guias para iniciantes no FH6.md`) mostrou o seguinte:

- **O problema é de ordem, não de falta de informação.** O jogo tem três progressões paralelas (Pulseiras, Carimbos do Discover Japan e Horizon Play), e os guias as misturam. O guia de fã mais citado parece confundir os pontos das pulseiras com os dos carimbos, porque as duas escadas usam as mesmas sete cores.
- **Ninguém diz que carro barato usar, com que tune, em cada fase.** Até a pulseira amarela só se corre na classe C, e os três carros iniciais vão todos para a garagem.
- **Já existe muito conteúdo:** listas de "N dicas" de maio, nunca atualizadas, e mapas de colecionáveis bem feitos (Shackmaps, Gamer Guides). Nenhum desses mapas tem licença aberta ou permite incorporar no site.
- **Em PT-BR só há matérias avulsas,** e o jogo é dublado. Quem joga em português lê guias em inglês com outros nomes para as mesmas coisas.
- **Muitas fontes que aparecem nas buscas vendem créditos ou "boosting",** e os números delas não são confiáveis.

## Decisão (proposta)

1. **Formato:** guias editoriais em Markdown, um arquivo por guia e por idioma (`src/content/guides/<idioma>/<guia>.md`). Cada arquivo tem um cabeçalho validado por zod:
   - título, resumo e ordem;
   - `verifiedAt`: a data em que o dono conferiu no jogo;
   - `sources[]`: as fontes, com URL;
   - opcionalmente, os carros e tunes citados, por id do catálogo, para que `pnpm validate` acuse um link quebrado.

   As páginas ficam em `/guides/` e `/en/guides/`, no mesmo padrão das outras seções. O menu ganha "Guias" quando o primeiro guia for publicado.
2. **Ordem de construção (meta: tudo antes de 21/01/2027):**
   1. **Comece aqui: as três trilhas.** Pulseiras, Carimbos e Horizon Play: o que cada uma libera, o que é obrigatório (Showcase e Horizon Rush) e por que misturá-las faz perder recompensas.
   2. **Primeiras 10 horas, em checklist.** Passos em ordem, cada um com o critério de "feito" e o motivo: dificuldade e assists que rendem créditos, a Estate, o primeiro celeiro.
   3. **Carro e tune por evento** (dono, 2026-11-22): cada evento da rota inicial tem sua própria restrição de classe e tipo de carro, e o guia respeita isso evento a evento.
      - **Tabela da rota:** evento → restrição (classe, tipo, piso) → carro recomendado → tune.
      - **Garagem mínima:** sempre que der, o mesmo carro grátis ou barato serve para vários eventos, e o guia mostra quantos créditos custa a garagem inteira.
      - **Carros e tunes:** de preferência fora do meta, com link para a página do carro e um tune do catálogo com o PI certo.
      - **De onde vêm as restrições:** de fontes públicas ou anotadas pelo dono no jogo, num arquivo de dados validado (os eventos da Playlist já têm restrições no site).
      - É o diferencial da Forza Paddock e leva o leitor ao núcleo do site.
   4. **Celeiros e Treasure Cars:** quais carimbos liberam o quê, com as divergências entre fontes marcadas, e a localização no nosso mapa (item 3 abaixo).
   5. **Glossário PT-BR ↔ EN** dos termos do jogo.
   6. **"Começando agora no FH6"** (uma seção do "Comece aqui"). O título é atemporal; o PS5 aparece no subtítulo e na descrição ("vai começar no PS5?"), para buscadores e IAs ligarem a página a essa busca (dono, 2026-11-22). Quem chega em janeiro encontra um jogo com oito meses de vida, e o guia explica:
      - o que já passou e como recuperar (temporadas e carros antigos da Playlist, expansão);
      - o que é compartilhado entre plataformas (tunes, partidas online);
      - as edições e o acesso antecipado.

      Publicar antes de 21/01/2027.
3. **Mapa próprio, no site** (dono, 2026-11-22: prefere tudo dentro do site):
   - **Base:** o mapa do jogo, em capturas de tela do próprio jogo (conteúdo do jogo, permitido pelas regras de uso da Microsoft, num site sem anúncios). As capturas são montadas em blocos para dar zoom.
   - **Visualização:** uma biblioteca leve de mapas (Leaflet, com coordenadas planas), com zoom, filtros por tipo e marcação de "já peguei".
   - **Calibração:** a ligação entre o mapa e as coordenadas do jogo sai das rotas já gravadas pela telemetria, que caem sobre as estradas da imagem.
   - **Marcações:** feitas por nós, a partir da telemetria. O dono para o carro em cada celeiro ou carro tesouro com o gravador ligado, e a posição sai exata, sem copiar pins de outros sites, que não têm licença aberta.
   - **Primeira leva:** os 15 celeiros, os 9 carros tesouro, as casas e os aftermarket. Os 400 mascotes e placas ficam para depois.
   - **Trabalho:** o mapa em si é rápido de fazer. O grosso é passar por cada ponto no jogo, umas duas a três horas de volta pelo mapa.
4. **Fontes e verificação:**
   - **Fontes:** as afirmações citam a fonte, sem copiar texto de outros sites. Fontes que vendem créditos ou boosting não servem de base. Tunes, só de fontes publicáveis pelo [ADR-0016](0016-fontes-publicas-com-opcao-de-saida.md). Nada de ler servidores do jogo nem usar apps "trainer".
   - **Verificação:** o rascunho é escrito a partir das fontes, e o dono confere no jogo os fatos marcados como pendentes (a lista de 14 fatos do relatório). Cada página mostra "verificado em <data>". Um fato ainda não conferido aparece como tal, ou não aparece.
5. **Manutenção:** os guias que dependem da temporada (Festival Playlist, carros da vez) ficam fora desta primeira leva. As páginas fixas são revisadas a cada atualização grande do jogo.

## Atualizações

- **2026-11-22, camadas de detalhe** (dono): o primeiro nível de cada guia é curto e direto, e cada parte abre camadas cada vez mais detalhadas (o que fazer em que ordem, o que priorizar, que carro e que rota), até o nível bem granular. Cada leitor aprofunda o quanto quiser. Feito com `<details>` no Markdown, mais "Expandir tudo" e "Recolher tudo".
- **2026-11-22, tunes dentro do guia:** onde o guia recomenda um carro, uma caixa mostra os tunes do catálogo para a classe e o piso daquele ponto (`<tune-picks>`, preenchida no build por `src/lib/guide-picks.ts`). Os tunes, códigos e créditos acompanham cada sync.
- **2026-11-22, revisão do dono no "Comece aqui":**
  - **Prioridade ao Discover Japan:** os celeiros guardam carros de meta, como o Mazda 787B (S1, S2 e R) e o Nissan #11 Tomica (S1), e o conserto leva tempo.
  - **Ford GT grátis cedo:** o carro tesouro é excelente na classe A.
  - **ABS ligado:** não recomendar desligar o ABS. O que se busca é o equilíbrio entre dificuldade e assists com que se vence de primeira.
  - **Casas depois da Yashiki:** só com reserva de créditos; carros e tunes vêm antes.
  - **Horizon Stunt Party desde a pulseira amarela.**
  - **Abas por pulseira:** uma por cor, com carros grátis ou baratos, fáceis, sem DLC e com tune do catálogo.
  - **Baralho de cartões:** os celeiros e os carros tesouro passam como cartões, com espaço para os screenshots do mapa e do jogo.
- **2026-11-22, rascunho em endereço não listado** (dono): um guia com `published: false` é gerado em `/guides/draft/<guia>/`, com aviso de rascunho, `noindex` e fora do menu, do sitemap e do `llms.txt`. Serve para o dono ler com calma no celular antes de publicar. O endereço não é secreto (o repositório é público), só não é divulgado.
- **2026-11-25, revisão do dono nas abas por pulseira:**
  - **Mesmo padrão da aba amarela:** cada aba abre com uma tabela (evento, tipo, piso, carro sugerido, por quê). A primeira linha é o evento que vale a pulseira; as outras, os tipos de evento da classe nova. Nenhuma fonte lista os eventos do Festival de cada pulseira, só quantos são (MapMaster). Abaixo da tabela vêm as caixas de tunes e outras opções com custo e benefício.
  - **Custo da preparação:** tunes de meta costumam trocar a tração e o motor, e isso sai caro. As caixas põem os tunes que mantêm a tração original (o campo `drivetrain` do tune comparado ao do carro) antes dos que trocam, e dizem, em cada tune, se ele mantém ou troca a tração e qual pneu usa. A troca de motor quase nenhuma fonte informa.
  - **Carros que o jogador já tem primeiro:** os iniciais e os brindes com tunes puristas (por exemplo, o Silvia K's 1989 e o GR86 na classe B); depois, carros baratos de comprar.
  - **Pneu de rali ou off-road** serve, via de regra, nos dois pisos até a classe B, principalmente com Drivatars mais fáceis.
  - **Carros de DLC** (Car Pass, Welcome Pack, pacotes) só como menção honrosa.
  - **Carros dos últimos celeiros** (787B e Tomica) não são a sugestão principal da S1 e da S2: nessa fase o jogador dificilmente já os tem.
  - **Escolhas do dono por classe:**
    - classes B e A: cuidado com o City E-II (pouca velocidade final); o Beat é forte, mas tem tunes caros;
    - S1: Viper 2008 antes do Ford GT; Corvette 2020 e Audi R8 2013 como alternativas; na terra, GT350R e Lancia Delta S4;
    - S2: Lexus LFA Forza Edition e Porsche 911 GT2 RS;
    - classe R: Lotus Exige WTAC, recompensa do Collection Journal.
- **2026-11-25, segunda revisão do dono nas abas por pulseira:**
  - **Só tunes fáceis de guiar:** os powerbuilds (por exemplo, os de tração traseira com mais de 1000 cv) e os tunes marcados como difíceis (`hard`, `death`) ficam fora das caixas.
  - **Ordem das caixas:** os tunes fixados pelo guia (`pick="<id do tune>"`, escolhas do dono), as escolhas do Forza Paddock ([ADR-0020](0020-recomendacoes-do-forza-paddock.md)), a tração original, os fáceis e, por fim, código, tier e nota. Um tune fixado que um sync renomeie só sai da caixa, sem quebrar o build, e um teste aponta qual.
  - **Eventos de pulseira têm carro definido:** a tabela diz "o do evento", sem sugerir carro.
  - **Texto direto:** o guia afirma o que as fontes dizem, sem "segundo as fontes". O dono corrige o que estiver errado ao conferir no jogo.
- **2026-11-25, corrida a corrida** (dono: cada evento tem classe e tipo de carro fixos, e as sugestões precisam entrar nessa restrição). É o item 3 da decisão ("Carro e tune por evento") para as corridas do Festival:
  - **Fonte:** o guides4gamers lista as 64 corridas do Festival (24 de asfalto, 21 de terra, 19 de cross country) com a restrição (classe e grupo de carro, por exemplo "B-600 Total Sports Cars") e o evento de pulseira que libera cada uma. São fatos, citados nas fontes do guia, sem copiar texto. Ficam de fora Street Racing, Drag, Touge e PR Stunts. Algumas corridas não têm classe na fonte, só o grupo.
  - **Arquivo validado:** `data/guides/festival-races.yaml` guarda cada corrida (nome, piso, pulseira, classe, grupo, carros sugeridos e o porquê em PT-BR e EN) e a definição de cada grupo pelos dados do catálogo (tipos de carro, país, tração de fábrica ou nome do modelo). Os grupos "Total X" seguem a regra da Playlist ([ADR-0009](0009-playlist-fonte-oficial.md)): todo tipo de carro cujo nome tem X, ou a tração de fábrica. "Heavy Hitters" e "Evo vs Impreza" são deduções pelo nome, marcadas `confirmed: false`.
  - **No guia:** `<festival-races unlock="green"></festival-races>` vira, no build, a tabela das corridas que a pulseira libera e uma caixa de tunes por carro sugerido, com as corridas em que ela serve (`src/lib/guide-races.ts`). Sem classe na corrida, a caixa usa a classe da pulseira.
  - **Teste:** cada carro sugerido precisa entrar no grupo e na classe da corrida (a classe de fábrica, ou um tune do catálogo naquela classe), e cada tune fixado ou excluído precisa existir.
  - **O que isso corrigiu:** a pulseira verde libera corridas de classe B, e não C e D; a azul já libera classe A; o Horizon Invitational (amarela) libera as primeiras corridas de classe B, uma para cada brinde (GR86, Evo VI e Ram TRX); o Airfield Trail pede carro de rali (o Celica, não o Jimmy). O jogo dá um carro inicial para cada tipo de corrida do começo, e um brinde para cada corrida que a amarela libera.
  - **Conferido no jogo pelo dono (2026-11-26):** as 17 corridas de asfalto que ele já tem, com a restrição igual à da fonte (cada uma com `checked` no arquivo). "Total X" inclui todos os tipos do grupo (Total Sports Cars: classic, retro e modern), "Track Life" são todos os tipos "Track" (Track Toys e Extreme Track Toys), e uma corrida sem classe na fonte não tem restrição de classe. O Edo Circuit é B · Modern Sports Cars; a pulseira que o libera ainda não se sabe. Os touge só travam a classe, e as corridas de rua não têm restrição de carro (o guides4gamers diz o mesmo). Escolhas dele: o Nissan GT-R 2012 no Narai-Juku (off-meta forte na classe A; o carro não é caro e o tune vale o preço), o Corvette Stingray 2020 no Ito Sprint e o Viper SRT-10 ACR 2008 no Hokubu Circuit, com o tune do LetzeLU (74.800 créditos). As corridas de terra e de cross country ficam para depois.
  - **Fora das tabelas:** o Silvia K's na classe A, o GT350R na terra, o Ford GT na terra e na S1, o Coronet, o Rivian e o F-450 não entram em nenhuma corrida da classe deles; os carros de classe C para comprar (Integra, Civic, Beat) não entram nas três corridas de classe C.
- **Achados do catálogo usados no "Comece aqui":**
  - o GMC Jimmy, carro inicial grátis, é muito fácil de pilotar no cross country;
  - os brindes da primeira pulseira (GR86, Evo VI, Ram TRX) vêm de fábrica na classe B, cada um no grupo de uma das corridas que a amarela libera;
  - o Honda Beat, recompensa dos Regional Mascots, é Eclectic Domestics e entra nas corridas desse grupo.

## Alternativas consideradas

- **Lista de dicas:** é o que já existe em excesso.
- **Só linkar os mapas que já existem:** é mais rápido, mas manda o leitor para fora do site, e o dono prefere tudo dentro.
- **Copiar os pins de outros mapas:** eles não têm licença aberta, e as nossas marcações pela telemetria são mais precisas.
- **Guias gerados automaticamente pelas fontes:** o conteúdo é editorial e precisa de conferência no jogo. Gerar automaticamente repetiria os erros das fontes.
- **Um guia longo só:** iniciantes procuram respostas pontuais, e o Google e as IAs também indexam melhor páginas curtas, cada uma sobre um assunto.

## Consequências

- Uma porta de entrada para o público do PS5 que leva ao catálogo de tunes, o que o site tem de mais valioso.
- **O dono precisa reservar algumas horas no jogo para conferir os fatos pendentes.** Sem isso, os guias saem com avisos de "não conferido".
- O conteúdo editorial é manual, como o PRODUCT já admite para os guias.
- O mapa próprio depende de o dono passar pelos pontos no jogo com o gravador ligado. Até lá, o guia de celeiros mostra só as regiões.
