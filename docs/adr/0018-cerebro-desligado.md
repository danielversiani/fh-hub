# 0018. Marcar tunes fortes demais e fáceis demais como "Cérebro desligado"

- **Status:** Aceita (decisão do dono, 2026-11-09)
- **Data:** 2026-11-09

## Contexto

A filosofia do site é incentivar as pessoas a sair do meta online ([ADR-0017](0017-ranking-proprio-e-alternativas.md)). Algumas tunes são ridiculamente fortes e fáceis de pilotar: não exigem nada do piloto. Exemplos do dono: o Mazda 787B no S1 e a tune meta do Huracán STO no S1.

O dono pediu uma categoria de dificuldade levemente pejorativa, "Cérebro desligado" ("Brain AFK" em inglês), como incentivo para o jogador escolher algo mais desafiador e divertido. Ela vale para **a tune**, não para o carro inteiro. Deve ser atribuída automaticamente, mas o dono (e, no futuro, colaboradores) precisa poder marcar ou desmarcar tunes.

## Decisão

1. **Campo `brainAfk`** na tune (`auto` ou `curator`), calculado em `pipeline/curate/brain-afk.ts` depois do ranking.
2. **Marca automática:** a tune que a tabela de Noa Miyako recomenda (`credited`) e chama de "fácil", num carro com tier **Meta+** do Forza Paddock naquela classe × piso.
   - Com Meta também, mais de 60 tunes ganhavam a marca, e ela perdia o sentido.
   - Com só Meta+, são 8 tunes (2026-11-09).
3. **Marca manual:** em `data/manual/brain-afk.yaml`, por carro, com classe, piso e tunador opcionais.
   - `brainAfk: false` tira uma marca automática.
   - A última regra que casa com a tune vale.
4. **No site:** o selo rosa tracejado "Cérebro desligado" aparece no lugar da dificuldade (lista de tunes, página do carro, sugestões da playlist). Ao passar o mouse, aparece o convite a tentar algo mais desafiador.

## Alternativas consideradas

- **Marcar o carro inteiro:** errado, porque outras tunes do mesmo carro podem ser difíceis.
- **Só manual:** não escala; o dono quer a marca automática para os casos óbvios.

## Consequências

- O rótulo é uma opinião editorial do site, não das fontes. Ele fica restrito à dificuldade e não altera o ranking.
- Quando a tabela de Noa Miyako mudar a dificuldade ou o carro sair do Meta+, a marca automática sai sozinha.
