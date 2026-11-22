# 0024. Seção de Guias: a trilha que o jogo não dá ao iniciante

- **Status:** Proposta (aguarda aprovação do dono)
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
   3. **Carro e tune para cada fase:** primeiro a classe C, depois B/A. Um carro grátis ou barato, de preferência fora do meta, com link para a página do carro e um tune do catálogo com o PI certo. É o diferencial da Forza Paddock e leva o leitor ao núcleo do site.
   4. **Celeiros e Treasure Cars:** quais carimbos liberam o quê, com as divergências entre fontes marcadas. Para a localização exata, link para os mapas que já existem.
   5. **Glossário PT-BR ↔ EN** dos termos do jogo.
   6. **Chegando do PS5:** datas, edições, o que já saiu desde maio e o que é igual nas outras plataformas. Os tunes, por exemplo, são compartilhados entre plataformas. Publicar antes de 21/01/2027.
3. **Mapa:** nesta fase **não** fazemos mapa próprio de colecionáveis e **não** copiamos pins de outros sites, que não têm licença aberta. Os guias linkam os mapas que já existem. Um mapa próprio, sobre a imagem do mapa do jogo e com marcações feitas por nós, fica para depois, se o dono quiser.
4. **Fontes e verificação:**
   - **Fontes:** as afirmações citam a fonte, sem copiar texto de outros sites. Fontes que vendem créditos ou boosting não servem de base. Tunes, só de fontes publicáveis pelo [ADR-0016](0016-fontes-publicas-com-opcao-de-saida.md). Nada de ler servidores do jogo nem usar apps "trainer".
   - **Verificação:** o rascunho é escrito a partir das fontes, e o dono confere no jogo os fatos marcados como pendentes (a lista de 14 fatos do relatório). Cada página mostra "verificado em <data>". Um fato ainda não conferido aparece como tal, ou não aparece.
5. **Manutenção:** os guias que dependem da temporada (Festival Playlist, carros da vez) ficam fora desta primeira leva. As páginas fixas são revisadas a cada atualização grande do jogo.

## Alternativas consideradas

- **Lista de dicas e mapa de colecionáveis próprios:** é o que já existe em excesso, e os mapas prontos não podem ser reaproveitados.
- **Guias gerados automaticamente pelas fontes:** o conteúdo é editorial e precisa de conferência no jogo. Gerar automaticamente repetiria os erros das fontes.
- **Um guia longo só:** iniciantes procuram respostas pontuais, e o Google e as IAs também indexam melhor páginas curtas, cada uma sobre um assunto.

## Consequências

- Uma porta de entrada para o público do PS5 que leva ao catálogo de tunes, o que o site tem de mais valioso.
- **O dono precisa reservar algumas horas no jogo para conferir os fatos pendentes.** Sem isso, os guias saem com avisos de "não conferido".
- O conteúdo editorial é manual, como o PRODUCT já admite para os guias.
- O mapa próprio fica adiado, e os guias dependem de links externos para as localizações exatas.
