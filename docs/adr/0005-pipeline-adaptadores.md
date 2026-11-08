# 0005. Pipeline com adaptadores por fonte e "último dado bom"

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

Cada fonte tem um layout próprio, e os tunadores mudam suas planilhas sem aviso. Exemplos observados em 2026-11-07:
- O GBR Ozzy tem uma coluna vazia à esquerda e cabeçalhos mesclados.
- A planilha do kleis não tem share codes e indica a classe pela **cor** da célula.
- O Letz usa células mescladas na coluna de tier.
- A Noa usa QQ Docs, com dados em protobuf compactado e rótulos em chinês.

Um parser genérico ("acha a coluna que parece share code") quebraria de formas silenciosas e difíceis de depurar.

## Decisão

1. **Um adaptador por fonte** (`pipeline/adapters/<source-id>.ts`), explícito sobre aba, linha de cabeçalho, colunas esperadas e transformações.
2. **Fetchers** reutilizáveis por tipo de origem (`google-gviz`, `google-xlsx`, `qq-docs`, `forza-net`, `manual`).
3. **Contrato de validação:** o adaptador declara os cabeçalhos esperados; qualquer divergência marca a fonte como `degraded` e **interrompe só aquela fonte**.
4. **Último dado bom:** se uma fonte falha, as observações dela da última sincronização bem-sucedida continuam valendo, e a página mostra a idade desses dados.
5. **Freios de segurança:** queda de mais de 30% no número de linhas bloqueia a publicação de remoções; remoções só valem após 2 sincronizações saudáveis seguidas.
6. **Fixtures reais:** cada adaptador tem testes com uma cópia real da fonte em `pipeline/__fixtures__/<source-id>/`. Quando a fonte muda de layout, o fluxo é atualizar a fixture e o adaptador juntos (ver [RUNBOOK](../RUNBOOK.md)).

## Alternativas consideradas

- **Parser genérico com heurísticas:** menos código no começo, mas falhas silenciosas (dado errado publicado sem alerta); descartado.
- **Pedir que todos os tunadores usem um formato padrão:** irreal no curto prazo. Pode ser oferecido no futuro como um "formato recomendado" opcional.

## Consequências

- **+** Falhas são localizadas, visíveis e não derrubam o site.
- **+** Adicionar uma fonte nova é um procedimento conhecido: entrada no registro + adaptador + fixture + teste.
- **−** Mais código por fonte (aceitável: cada adaptador tem algumas dezenas de linhas).
