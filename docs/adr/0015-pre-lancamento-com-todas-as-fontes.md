# 0015. Pré-lançamento público com todas as fontes, enquanto as autorizações são pedidas

- **Status:** Substituída por [0016](0016-fontes-publicas-com-opcao-de-saida.md)
- **Data:** 2026-11-08

## Contexto

O [ADR-0010](0010-politica-de-fontes.md) diz que dados de tunadores só vão ao ar com autorização (`granted`). Nenhuma autorização chegou ainda. Publicado assim, o site teria playlist, carros e fotos, mas nenhuma tune.

O dono quer publicar já, com tudo, para testar, colher opiniões e **convencer os autores** das planilhas: ver o site pronto mostra o potencial melhor do que uma descrição. Ele assume pedir as autorizações com o tempo e tirar quem não quiser participar (ex.: GBR Ozzy, que já bloqueou o download da planilha).

## Decisão

1. Nova permissão **`prelaunch`**: a fonte vai ao ar durante o pré-lançamento, enquanto a autorização é pedida. Hoje valem para Noa Miyako, GBR Ozzy, kleis, K1Z Gray, LetzeLU e WHD URL.
2. **Mantido do ADR-0010:**
   - crédito ao tunador e link para a planilha original em toda tune;
   - remoção em até 7 dias a pedido do autor: a fonte volta para `pending` (ou `denied`) e sai na próxima sincronização.
3. **Durante o pré-lançamento** (`PRELAUNCH` em `src/lib/site.ts`):
   - aviso em todas as páginas, com link para pedir remoção ou dar opinião;
   - `noindex`, para o site não aparecer em buscadores. Os links compartilhados funcionam normalmente.
4. O pré-lançamento termina quando o dono decidir. As fontes que tiverem autorização passam a `granted`; as outras voltam a `pending`.

## Alternativas consideradas

- **Publicar só o que já pode** (playlist, carros, fotos): respeita o ADR-0010, mas o site fica sem o principal (as tunes) e convence menos.
- **Prévia completa num endereço secreto:** dados igualmente expostos, sem o aviso público. Descartado.

## Atualizações

- **2026-11-08:** GBR Ozzy pediu para ficar de fora por enquanto: a fonte foi desligada (`permission: denied`, `active: false`) e a cópia salva da planilha apagada do repositório. Com isso, o site perdeu a maior parte dos códigos de compartilhamento (de 2675 para 73). kleis deu autorização expressa (`granted`). Os demais continuam em `prelaunch`.
- **2026-11-08:** nova página **Uso de dados** (`/legal/`), com os mesmos tópicos da página do fh6meta.com, escrita com nossas palavras: o site não reivindica a posse de nada, só agrega e compila informações públicas; a fonte original é a referência; como pedir remoção ou correção; o que pode continuar existindo; sem garantia. Ela lista cada fonte com a situação da autorização.

## Consequências

- **Positivas:** o site completo fica no ar para testes e para mostrar aos autores.
- **Negativas:** usamos o trabalho dos tunadores antes da permissão. Um autor pode se incomodar e recusar, o que custa reputação numa comunidade pequena. O aviso, o crédito e a remoção rápida reduzem esse risco, mas não o eliminam.
- Como o repositório é público, os dados dessas fontes também ficam visíveis no GitHub (`data/generated/`).
