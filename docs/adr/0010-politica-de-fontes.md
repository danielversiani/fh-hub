# 0010. Política de fontes: crédito, autorização e remoção

- **Status:** Substituída em parte por [0016](0016-fontes-publicas-com-opcao-de-saida.md) (o item 2, autorização prévia, deixou de valer; crédito, remoção e o resto continuam)
- **Data:** 2026-11-07

## Contexto

O valor do portal vem do trabalho de tunadores e curadores da comunidade. Tecnicamente, as planilhas públicas podem ser lidas sem pedir nada a ninguém, mas:
- O **GBR Ozzy desativou o download** da planilha dele (`/export` retorna HTTP 401), o que sinaliza preocupação com o uso dos dados, embora a leitura pelo endpoint de visualização continue funcionando.
- A comunidade é pequena e baseada em reputação. Um agregador visto como "aproveitador" perde as fontes e o público.
- O fh6meta publica uma política de uso de dados, e o mercado já tem essa expectativa.

## Decisão

1. **Crédito obrigatório:** todo tune exibe o tunador e o link para a fonte original (e para a planilha de onde o dado veio, se for diferente).
2. **Autorização antes de publicar:** cada fonte em `data/sources.yaml` tem o campo `permission: granted | pending | denied | not-required`.
   - Fontes `pending` podem ser sincronizadas em ambiente de desenvolvimento, mas **só vão ao ar com `granted`**.
   - Exceção: `not-required` para dados oficiais e factuais (forza.net).
   - Prioridade de contato: GBR Ozzy (download bloqueado), Noa Miyako, kleis.
3. **Remoção:** qualquer tunador pode pedir a remoção dos próprios dados por um canal público (Discord ou e-mail na página "Sobre"). Prazo de atendimento: 7 dias. Na prática, a remoção é feita com `active: false` na fonte ou com uma regra de exclusão por tunador.
4. **Sem redistribuição em massa:** o site não oferece download das planilhas de terceiros nem uma API pública dos dados agregados sem autorização das fontes.
5. **Conteúdo de terceiros:** não copiamos textos, imagens ou mapas de guias de outros sites (MapMaster, wikis etc.). Usamos fatos verificados, escritos com nossas palavras, citando a fonte.
6. **Marca:** aviso visível de que o site não é afiliado à Microsoft, Xbox Game Studios ou Playground Games. Sem logos oficiais.

## Alternativas consideradas

- **Publicar tudo o que é público, sem contato:** tecnicamente possível; risco ético e de reputação alto; descartado.

## Consequências

- **+** Relação de parceria com os tunadores, que passam a divulgar o portal.
- **−** O lançamento depende de respostas de terceiros. Mitigação: começar o contato já na Fase 0.

## Atualizações

- **2026-11-08 (Fase 0), implementação:**
  - O pipeline monta dois datasets: o **público** (`data/`, commitado) só com fontes `granted`/`not-required`, e a **prévia** (`.cache/preview/`, git-ignored) com todas. Um teste garante que nada de fonte pendente entra no público.
  - O workflow agendado usa `--public-only` e nem baixa as fontes pendentes.
  - As fixtures de teste são **amostras** (cerca de 100 linhas por planilha), não cópias completas.
  - Hoje só o roster oficial está publicado. Os dados dos tunadores aparecem no site à medida que as autorizações chegam.
- **2026-11-08, conteúdo com licença aberta:** dados de wikis sob CC BY-SA (ex.: raridade da Forza Wiki) entram como `not-required`, desde que o site dê crédito visível à fonte e à licença (rodapé). Sites comerciais sem licença de reuso (ex.: codmunity/forzacity) não são usados como fonte.
- **2026-11-08, imagens do jogo:** o item 5 ganha uma exceção: capturas de tela do jogo (fotos dos carros da Forza Wiki), usadas sob as regras de conteúdo da Microsoft ([ADR-0013](0013-miniaturas-dos-carros.md)).
- **2026-11-08, pré-lançamento:** o item 2 ("só vão ao ar com `granted`") fica suspenso durante o pré-lançamento, por decisão do dono ([ADR-0015](0015-pre-lancamento-com-todas-as-fontes.md)). Crédito, link para a fonte e remoção em 7 dias continuam valendo.
- **2026-11-08, traduções:** as observações das fontes podem aparecer traduzidas, sempre com o crédito à fonte original ([ADR-0014](0014-traducao-dos-textos-das-fontes.md)).
