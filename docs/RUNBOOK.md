# Runbook: operação e incidentes

> **Status:** v0.2 · **Atualizado em:** 2026-11-08
> Itens marcados com ⏳ dependem de partes que entram nas próximas fases.

## Onde olhar primeiro

| Pergunta | Onde |
|---|---|
| Alguma fonte está com problema? | Página `/status` do site ou `data/generated/sources-status.json` |
| Por que o sync falhou? | GitHub → Actions → workflow `sync` → última execução |
| O que mudou nos dados? | `git log -- data/generated/` ou página de mudanças do site |
| O que está esperando revisão humana? | `data/review/*.json` (fontes públicas) e `.cache/preview/review/*.json` (todas, depois de um `pnpm sync` local). O sync também imprime o resumo |

## 1. Rotina semanal (quinta-feira, depois da virada da playlist)

1. Conferir se a nova season apareceu em `data/generated/playlist/seasons.json`.
2. Ver `data/review/unparsed-requirements.json`: restrições que as regras não entenderam. Formato novo e recorrente → adicionar em `pipeline/normalize/requirement.ts` com um teste em `requirement.test.ts`.
3. Revisar o **PR semanal da IA** (§9).
4. Conferir `data/review/unmatched-cars.json`: carros novos da season costumam aparecer aqui (§4).
5. Abrir a página da playlist no site e conferir visualmente.

## 2. Alerta: "fonte X falhando"

1. Abra a última execução do workflow `sync` e procure o erro da fonte.
2. Classifique:

| Sintoma | Causa provável | Ação |
|---|---|---|
| Timeout, HTTP 5xx, 429 | Instabilidade temporária | Nada; a próxima execução tenta de novo. Se passar de 24 h, investigar |
| HTTP 401/403/404 | Planilha ficou privada, foi apagada ou o dono restringiu o acesso | Marcar `active: false` em `data/sources.yaml` e falar com o tunador |
| `HeaderMismatchError` | O tunador mudou colunas ou abas | §3 |
| `RowDropGuard` | Queda de mais de 30% das linhas | Abrir a planilha manualmente: se a queda for intencional (limpeza), aprovar com `pnpm sync --source=<id> --accept-drop`; se for acidente, esperar o tunador corrigir |
| Erro de decodificação ou `unexpected opendoc response` (QQ Docs) | Mudança no formato interno da API | O site segue com o último dado bom. Rode `pnpm fixtures:update --source=noa-miyako` e compare a estrutura com o mapeamento documentado em `pipeline/lib/qq-sheet.ts`. ⏳ Plano B com navegador headless |

O site continua com o **último dado bom** durante todo o incidente ([ADR-0005](adr/0005-pipeline-adaptadores.md)).

## 3. Uma planilha mudou de layout

1. Atualize a fixture: `pnpm fixtures:update --source=<id>`.
2. Rode `pnpm test -- adapters/<id>` e veja o que quebrou.
3. Ajuste o adaptador (`pipeline/adapters/<id>.ts`): cabeçalhos esperados, índices, transformações.
4. Atualize a ficha da fonte em [DATA_SOURCES.md](DATA_SOURCES.md).
5. Rode `pnpm sync --source=<id> --dry-run` e confira o resumo (linhas lidas, carros não reconhecidos).
6. Abra o PR com fixture + adaptador + doc juntos.

## 3b. Um autor pediu para sair do site

- **Um tunador:** adicione o gamertag em `data/manual/opt-out.yaml` com a data e por onde o pedido chegou. As tunes e as indicações dele somem de todas as fontes na próxima sincronização ([ADR-0016](adr/0016-fontes-publicas-com-opcao-de-saida.md)).
- **Uma planilha inteira:** em `data/sources.yaml`, troque para `permission: denied` e `active: false`, e apague `data/snapshots/<fonte>.json` e `pipeline/__fixtures__/<fonte>/`.
- Prazo: até 7 dias.

## 3c. Ajustes manuais do ranking (dono e, no futuro, colaboradores)

Todos ficam em `data/manual/`, valem na próxima sincronização e têm instruções no topo de cada arquivo ([CURATION.md §10](CURATION.md#10-ranking-do-forza-paddock-e-alternativas)):

- **Escolha do Forza Paddock:** `featured-picks.yaml` (carro, classe, piso, data e comentário). Tom do comentário: "competitivo" basta.
- **Nicho ou correção de tier:** `tier-overrides.yaml`. Vale mais que a fórmula.
- **Cérebro desligado:** `brain-afk.yaml`. Marca tunes; com `brainAfk: false`, tira uma marca automática.

Depois de editar, rode `pnpm validate` (o id do carro precisa existir em `data/generated/cars.json`).

## 3d. Imagens paradas do modo normal

O modo normal mostra fotos do mundo animado (`public/world/<lugar>.webp`, [ADR-0019](adr/0019-mundo-animado-e-modo-pista.md)). Quando o mundo mudar (modelos, logo, cores):
1. Rode `pnpm dev` e abra `http://localhost:4321/?snapshots` no modo pista.
2. As imagens são salvas em `public/world/` em alguns segundos.
3. Confira as imagens e faça o commit junto com a mudança.

## 3e. Gravar pistas pela telemetria ([ADR-0021](adr/0021-pistas-pela-telemetria.md))

1. **No jogo:** o Data Out deve mandar para o SimHub. **No SimHub**, ligue o repasse de UDP (UDP forwarding) para `127.0.0.1`, porta **5301**.
2. **Gravar:** `pnpm telemetry:record -- --name=<algo>`. Corra as rotas normalmente (várias numa gravação só) e pare com Ctrl+C. Os pacotes ficam em `.cache/telemetry/`.
3. **Processar:** `pnpm telemetry:process`.
   - Cada corrida é reconhecida pelo formato da rota, comparado com as imagens públicas do labsgg.com (baixadas uma vez para `.cache/tracks/`).
   - O nome da rota dá o piso.
   - O resultado vai para `data/tracks/<rota>.json`, e a gravação bruta é apagada.
4. **Corrida "not recognised":** a rota não está na lista do labsgg ou o formato ficou ambíguo. Se faltar, acrescente a rota em `data/manual/routes.yaml` (nome, piso, tipo) e rode de novo com `--route=<id>`. A gravação só é apagada quando todas as corridas foram identificadas; `--keep` guarda a gravação de qualquer jeito.
5. Rode `pnpm validate` e abra o PR com os arquivos de `data/tracks/`.
6. **Modelo 3D:** crie `data/tracks/<rota>.scene.yaml` a partir de um vídeo de corrida.
   - Extraia uma volta, um quadro por segundo, com o ffmpeg do projeto (`node_modules/ffmpeg-static`).
   - **Em que metro está cada quadro:** o cronômetro da volta no HUD dá o instante exato de cada quadro. Some a velocidade do painel segundo a segundo; o total deve fechar com a extensão medida pela telemetria (na Irokawa, 1.832 m contra 1.830 m).
   - **Posição do carro na pista (`drivenLine`):** desenhe sobre cada quadro uma régua em metros na linha da imagem que fica uns 7 m à frente do carro. A escala vem da perspectiva da câmera, calibrada pela largura do carro (1,9 m). Leia onde ficam as faixas brancas das bordas. A posição vai de −1 (carro encostado na borda direita) a +1 (na esquerda), na mesma escala das linhas do guia. A largura de cada trecho vai em `sections[].width` e vale até outro trecho mudá-la.
   - Anote cada trecho: acostamento (`edge`, `edgeWidth`), barreira e cenário de cada lado, mais os marcos. Dentro da pista vale caprichar: pintura (`markings`), cones, área asfaltada, muros. Fora dela, basta o essencial.
   - Deixe `camber: flat` até haver uma medida de cambagem confiável.
   - **Checkpoints:** o tempo parcial (canto superior direito) muda na passagem por cada checkpoint, e o cronômetro da volta diz em que metro isso acontece. A distância que o jogo mostra sobre o checkpoint serve de conferência. Anote em `checkpoints:` no arquivo de cenário.
   - **Conferência:** em `pnpm dev`, abra `/tracks/<rota>/`, clique em "Dirigir" e compare a vista com os quadros do vídeo nos mesmos metros. A câmera imita a do jogo.
   - **Comparar com o vídeo:** recorte a volta medida com o ffmpeg do projeto: 1280 px de largura, 30 qps, sem som, `-crf 30 -movflags +faststart`. Salve o recorte em `public/tracks/<rota>/volta.mp4` e anote em `lapVideo` o caminho (`src`) e os pares `[segundo do recorte, metro da volta]` (`sync`), um por segundo. O cronômetro do HUD dá o instante, e o velocímetro, a distância. Com isso aparece na página o botão "Comparar com o vídeo".
   - **Sobreposição com o vídeo:** em `pnpm dev`, no console da página da pista, `__track.shot(metro, 1280, 536)` devolve a visão "Dirigir" daquele metro, sem as linhas do guia. Mandada por POST para `/__track-shot` (`{ name, data }`), a imagem é gravada em `.cache/track-shots/<name>.png`. Sobreponha-a ao quadro do vídeo do mesmo metro. Primeiro confira a câmera pelas lanternas do carro (mesma largura e altura na tela) e depois as faixas das bordas. `__track.shotPose({ x, y, z, yaw }, w, h, look, { vfov })` faz o mesmo a partir de uma pose da telemetria. Para isso, grave a telemetria junto com o vídeo (`pnpm telemetry:record`) e sincronize os dois pela troca de volta no contador da tela. Os scripts de sobreposição e medição usados na Irokawa ainda não estão no repositório.
   - **Guia de traçado:** em `data/tracks/<rota>.lines.yaml`, com linhas (posição de −1 = carro encostado na borda direita a +1 = na esquerda), setas e textos por sequência. Uma linha com `visible: false` começa desligada.
   - Só marque `published: true` quando o dono aprovar. A pista passa a aparecer no Paddock Lab (`/lab/`), com o aviso de trabalho em andamento.

## 3f. Esboço de uma pista ainda não gravada ([ADR-0023](adr/0023-esbocos-de-pista-pelo-mapa.md))

1. Ache o id da rota (o nome em minúsculas com hífens, como `shirakawa-circuit`). A lista vem do labsgg e fica em cache em `.cache/tracks/labsgg/`.
2. Rode `pnpm tracks:sketch -- --route=<id>`. O resumo mostra a extensão, a escala, as curvas e o tempo de volta de cada traçado. `--width=<m>` muda a largura (12 m por padrão).
3. **Conferência:** em `pnpm dev`, abra `/tracks/<id>/`. A seta da imagem dá o sentido: confira se as curvas da tabela batem com o jogo. Ligue os dois traçados e use "Dirigir" nas chicanes.
4. **Ajustes:** o `<id>.scene.yaml` pode ser refinado à mão (larguras por trecho, checkpoints, cenário) e não é sobrescrito.
   - **O que só quem corre sabe** (um corte pela grama no checkpoint, um ápice tardio) vai em `linePins`: `at` é o metro, `pos` a posição (±1 = encostado na borda; além disso, fora do asfalto, até ±1,6), e `note` (pt-br/en) é o texto do guia.
   - Rode o comando de novo: o otimizado passa pelos pontos e calcula o resto.
   - **Desenho à mão do dono:** transforme o traço em poucos pontos-chave (de que lado ficar, onde encostar, ápice), não numa cópia do traço; o cálculo deixa a linha lisa.
   - **Checkpoints:** enquanto só alguns estiverem posicionados, use `checkpointNumbers: false`. O `<id>.lines.yaml` e o `<id>.json` são refeitos a cada execução, por isso não os edite.
5. Uma pista já gravada pela telemetria não aceita esboço. Para gravar uma pista esboçada, siga o §3e: o arquivo da telemetria substitui o esboço.
6. Só marque `published: true` quando o dono aprovar.

## 3g. Escrever ou atualizar um guia ([ADR-0024](adr/0024-secao-de-guias-para-iniciantes.md))

1. Cada guia tem dois arquivos com o mesmo nome: `src/content/guides/pt-br/<guia>.md` e `src/content/guides/en/<guia>.md`. O nome do arquivo vira o endereço (`/guides/<guia>/`).
2. O cabeçalho tem `title`, `summary` (vira a descrição nas buscas), `order`, `verifiedAt`, `sources` e `published`.
   - `verifiedAt`: a data em que o dono conferiu no jogo. Use `null` enquanto não for conferido; a página avisa.
   - `sources`: toda fonte usada, com `label` e `url`. Fontes que vendem créditos ou boosting não servem de base.
   - `published`: `false` deixa o guia fora do menu, do mapa do site e das buscas. Ele fica num endereço não listado, `/guides/draft/<guia>/` (e `/en/guides/draft/<guia>/`), para o dono revisar no celular; a página avisa que é rascunho. Ao publicar, esse endereço some e o guia passa para `/guides/<guia>/`.
3. No texto, marque com _A conferir no jogo_ o que ainda não foi confirmado. Escreva com as próprias palavras, sem copiar texto de outros sites.
   - **Camadas** (dono, 2026-11-22): cada parte tem um resumo curto, e o resto vai em blocos que abrem e fecham. Use `<details>` com uma linha `<summary>…</summary>` e deixe uma linha em branco depois do `<summary>` e antes de `</details>`; um `<details>` dentro de outro é a camada seguinte. A página tem "Expandir tudo" e "Recolher tudo".
   - **Tunes do catálogo:** `<tune-picks car="<id do carro>" class="C" surface="dirt"></tune-picks>` vira uma caixa com o carro, a classe de fábrica e até 3 tunes (com código primeiro), atualizada a cada sync. `limit="5"` muda a quantidade. Um id de carro errado quebra o build.
   - **Tabelas largas:** envolva em `<div class="table-wrap">` (com linhas em branco em volta) para rolar de lado no celular.
   - **Abas por pulseira:** `<details class="band band-yellow">` (ou `green`, `blue`, `pink`, `orange`, `purple`, `gold`) pinta a camada com a cor da pulseira.
   - **Baralho de cartões** (celeiros, carros tesouro): `<card-deck set="barns"></card-deck>` ou `set="treasures"`. Os dados ficam em `src/lib/guide-decks.ts`. Cada cartão mostra os screenshots de `public/guides/collectibles/<id>-map.webp` (no mapa) e `<id>-game.webp` (no jogo) quando existirem; até lá aparece "Screenshot em breve".
4. As duas línguas devem ter a mesma ordem, a mesma data e o mesmo estado de publicação: `pnpm test` confere. O menu só mostra "Guias" quando há pelo menos um guia publicado.

## 4. Carros ou tunadores não reconhecidos

1. Abra `data/review/unmatched-cars.json`. Cada item mostra o texto original e os candidatos com a similaridade.
2. Para cada item:
   - **É um carro existente com outro nome:** adicione em `data/manual/car-aliases.yaml`:
     ```yaml
     "Nissan GTR R35 Black Edition": 2017-nissan-gt-r-black-edition
     ```
   - **É um carro novo no jogo:** ele entra pela lista mestre, o roster oficial (forza.net/fh6cars). Se o roster ainda não o tem, espere a atualização oficial (⏳ `data/manual/cars-extra.yaml` para casos urgentes ainda não existe).
   - **O nome é ambíguo** (ex.: Ozzy escreve "Volkswagen Golf R" sem ano e o jogo tem dois): só um alias resolve, se ficar claro pelo contexto qual é o carro.
   - **É lixo** (linha de cabeçalho, texto solto): adicione um padrão de exclusão no adaptador.
3. Mantenha os arquivos de alias em ordem alfabética (a CI verifica).
4. O mesmo vale para tunadores em `data/manual/tuner-aliases.yaml`.
5. **Textos sem tradução** (`data/review/untranslated-texts.json`, [ADR-0014](adr/0014-traducao-dos-textos-das-fontes.md)): observações e nomes em chinês vão para `data/manual/translations.yaml` (`pt-br` e `en`, sem os tempos de volta que já viram selo). Desafios da playlist em inglês vão para `data/manual/playlist-texts.yaml`. Enquanto não forem traduzidos, o site esconde o texto.
6. **Tune caindo no piso errado:** se um tunador é especialista num piso e as linhas dele não dizem o piso, registre a especialidade em `data/manual/tuner-surfaces.yaml` (ex.: `sr1-rain: dirt`). Só vale para tunes sem nenhuma pista de piso (nome, coluna ou pneu).
7. **Pistas citadas nas observações** (ex.: "白川1:04.3"): o nome vira inglês por `data/manual/track-aliases.yaml`. Uma pista nova que aparece nas notas sem tradução simplesmente não vira referência de tempo. Para incluir, adicione a linha `<nome nas notas>: "<nome oficial em inglês>"` (use o nome das rotas em forza.net/fh6playlists) e só quando tiver certeza da tradução.

## 5. Chegou um pacote de carros novos (DLC ou atualização)

1. Espere o roster oficial atualizar (a Playground costuma atualizar junto com o anúncio).
2. Enquanto isso, os tunes desses carros ficam na fila de revisão, e nada errado é publicado.
3. ⏳ Para casos urgentes, `data/manual/cars-extra.yaml` (ainda não implementado).
4. Se o patch mudar a física, atualize `lastPhysicsPatch` em `data/curation/config.yaml`.

## 6. Adicionar uma nova fonte

1. Registre a permissão: `public` para fonte pública da comunidade, `granted` com autorização expressa ([ADR-0016](adr/0016-fontes-publicas-com-opcao-de-saida.md)).
2. Adicione a entrada em `data/sources.yaml`.
3. Baixe a fixture: `pnpm fixtures:update --source=<id>`.
4. Escreva `pipeline/adapters/<id>.ts` e o teste correspondente.
5. Rode `pnpm sync --source=<id> --dry-run` e resolva os itens de revisão (§4).
6. Escreva a ficha em [DATA_SOURCES.md](DATA_SOURCES.md).
7. Abra o PR. A fonte vai ao ar com `permission` `granted`, `public` ou `not-required` e `active: true`.

## 7. Um tunador pediu remoção

1. Confirme a identidade (mensagem vinda da conta oficial do tunador).
2. Siga o [§3b](#3b-um-autor-pediu-para-sair-do-site): tunador em `data/manual/opt-out.yaml`; planilha inteira com `permission: denied` e `active: false`.
3. O próximo sync remove os dados. Para acelerar, rode o workflow `sync` manualmente.
4. Responda ao tunador com a confirmação. Prazo: 7 dias.

## 8. Dado errado publicado

1. Identifique o commit do bot que introduziu o erro: `git log -p -- data/generated/<arquivo>`.
2. Para corrigir na hora, use `git revert <commit>` e faça push. O site republica.
3. Corrija a causa (adaptador, alias, regra) **e adicione um teste** que teria pegado o erro.
4. Se o erro veio da fonte, avise o tunador.

## 9. PR semanal da IA

- **Chegou:** confira se a CI passou (schema válido, só referencia tunes existentes) e leia as escolhas Meme e os comentários. Ajuste direto no PR, se quiser, e faça o merge.
- **Não chegou até quinta à noite:**
  1. veja o histórico da rotina no Claude Code (comando `/schedule`);
  2. o site já está no ar com as sugestões só por regras, então não há urgência;
  3. se precisar, rode a rotina manualmente pelo mesmo comando.
- **A IA errou feio:** feche o PR sem merge. O site continua com as regras.

## 10. Site fora do ar ou deploy falhando

1. Veja o workflow `deploy` no GitHub Actions.
2. Se o erro for de build: o último deploy bom continua no ar no Cloudflare Pages. Corrija e faça push.
3. Rollback imediato: no painel do Cloudflare Pages → Deployments → promover o deploy anterior.
4. Se o problema for o limite de builds do mês: aumente o intervalo mínimo do deploy de dados no `deploy.yml` até a virada do mês.

## 10b. Domínio

- Endereço oficial: **forzapaddock.racing**, registrado no Porkbun com renovação automática ligada (cerca de US$ 10,79 por ano; confira o cartão antes de renovar em 2027-11-10).
- O DNS fica no Cloudflare: não mude os nameservers no Porkbun, senão o site sai do ar.
- Para trocar ou acrescentar um endereço: `routes` em `wrangler.jsonc` ([ADR-0012](adr/0012-hospedagem-cloudflare-pages.md)).

## 10c. Busca, assistentes de IA e visitas ([ADR-0022](adr/0022-busca-e-assistentes-de-ia.md))

- **O que o site já entrega sozinho:** `/sitemap.xml`, `/robots.txt` e `/llms.txt`, gerados no build; a descrição e a prévia de compartilhamento de cada página.
- **Google Search Console** (search.google.com/search-console, conta do dono):
  1. Adicione a propriedade de **domínio** `forzapaddock.racing`.
  2. Prove que o domínio é seu com o registro TXT. Como o DNS fica no Cloudflare, aceite a configuração automática ou cole o registro em DNS.
  3. Em **Sitemaps**, envie `https://forzapaddock.racing/sitemap.xml`.
- **Bing Webmaster Tools** (bing.com/webmasters): importe o site do Search Console. O Bing alimenta o ChatGPT e outros assistentes.
- **Visitas:** no painel do Cloudflare, ative **Web Analytics** para o domínio, sem cookies. A contagem começa no dia em que for ativada.
- **Conferir rapidamente:**
  - No Google, a pesquisa `site:forzapaddock.racing` mostra as páginas indexadas.
  - Para ver a prévia de um link, cole o endereço numa conversa do WhatsApp ou do Discord.
- **Se o Cloudflare passar a bloquear robôs de IA** (opções "AI Crawl Control" ou "Block AI bots"): deixe os assistentes liberados, senão o site some das respostas deles.
- **Imagem de prévia:** `public/og.jpg` (1200×630). Se a identidade visual mudar, refaça a imagem.

## 11. O sync parou de rodar sozinho

O GitHub desativa workflows agendados de repositórios públicos após 60 dias sem atividade.
Reative em Actions → `sync` → *Enable workflow* e investigue por que não houve commits (fontes paradas? bot sem permissão?).

## 12. Segredos

| Segredo | Onde | Rotação |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub → Settings → Secrets | Anual ou se vazar. Permissão mínima: Pages Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Idem | Não é sensível, mas fica junto |
| `DISCORD_WEBHOOK_URL` | Idem | Se vazar: apagar o webhook no Discord e criar outro |

Nenhum segredo vai em arquivo do repositório. Se algum for commitado por engano, **revogue primeiro** e limpe o histórico depois.
