# 0016. Publicar fontes públicas com crédito, e tirar quem pedir para sair

- **Status:** Aceita (decisão do dono, 2026-11-08)
- **Data:** 2026-11-08
- **Substitui:** o item 2 do [ADR-0010](0010-politica-de-fontes.md) ("só vão ao ar com `granted`") e o [ADR-0015](0015-pre-lancamento-com-todas-as-fontes.md) (pré-lançamento).

## Contexto

O ADR-0010 exigia autorização expressa de cada autor antes de publicar. O ADR-0015 abriu uma exceção temporária ("pré-lançamento"). A pesquisa de 2026-11-08 mostrou que nenhuma planilha ou site da comunidade oferece licença de reuso, então a regra antiga deixaria o site quase vazio por tempo indefinido.

O dono decidiu: quando um tunador compartilha uma tune ou uma planilha publicamente, a informação é pública. O site pode reunir e cruzar essas informações, com crédito, desde que o autor possa pedir para sair a qualquer momento.

## Decisão

1. **Nova permissão `public`:** fonte pública da comunidade, publicada com crédito e link, sem autorização prévia. Substitui `prelaunch`.
2. **Permanece:**
   - `granted`: o autor deu autorização expressa. É mostrado como selo na página "Uso de dados".
   - `not-required`: dado oficial (forza.net) ou de licença aberta (Forza Wiki).
   - `pending`: fonte ainda não avaliada; não vai ao ar.
   - `denied` + `active: false`: o autor pediu para ficar de fora. Não vai ao ar (ex.: GBR Ozzy).
3. **Saída a pedido (opt-out):**
   - **Um tunador** que peça para sair entra em `data/manual/opt-out.yaml`. Suas tunes e indicações somem de todas as fontes na sincronização seguinte.
   - **O dono de uma planilha inteira** que peça para sair tem a fonte marcada como `denied`.
   - Prazo de atendimento: 7 dias.
4. **Mantido do ADR-0010:** crédito e link em toda tune, página "Uso de dados", nenhum download em massa das planilhas, aviso de não afiliação com a Microsoft.
5. **Objetivo do site:** somar e cruzar informações quando elas existem. Ligar um tempo de volta a uma tune específica não é objetivo do projeto.
6. **Fora desta regra:** acessar os servidores do jogo (APIs internas, raspagem do Creative Hub ou dos rankings), que continua vetado pelos termos da Microsoft.

## Alternativas consideradas

- **Manter a autorização prévia (ADR-0010):** mais cauteloso, mas nenhuma fonte tem licença, e o site ficaria sem conteúdo.
- **Pré-lançamento sem prazo (ADR-0015):** na prática já era publicação aberta, só que com um rótulo provisório.

## Consequências

- **Positivas:** o site pode usar toda informação pública da comunidade e cruzar fontes, que é o seu valor. As regras ficam simples e honestas na página "Uso de dados".
- **Negativas:** algum autor pode não gostar de ver o trabalho reunido aqui. A saída rápida, o crédito e o link reduzem esse risco.
- O aviso de pré-lançamento passa a dizer só que o site está em testes e como pedir remoção.

## Atualização (2026-11-10): lançamento

O aviso de pré-lançamento e o `noindex` saíram: o site está aberto e pode ser indexado. O caminho para pedir remoção, correção ou mudança de crédito fica na página "Uso de dados" (`/legal/`, link no rodapé), com o prazo de 7 dias.
