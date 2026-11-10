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
