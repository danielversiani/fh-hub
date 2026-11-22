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
