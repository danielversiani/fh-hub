# 0001. Registrar decisões de arquitetura com ADRs

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

O projeto começa sendo construído quase todo por um agente de IA (Claude) sob direção do dono do produto. Um requisito explícito é que, um dia, um programador humano possa assumir o projeto e entender **exatamente** como e por que tudo foi construído.
Código mostra *o quê*; comentários mostram *como*. Nenhum dos dois guarda o *porquê* de forma durável, nem as alternativas que foram descartadas.

## Decisão

- Toda decisão que afete arquitetura, stack, formato de dados, política de fontes ou custo é registrada como ADR em `docs/adr/`.
- ADRs são imutáveis depois de aceitos; mudanças geram um novo ADR que substitui o anterior.
- Pull Requests que contrariem um ADR aceito precisam vir acompanhados de um ADR novo.
- A documentação é tratada como código: vive no repositório, passa por revisão e é atualizada no mesmo PR da mudança que a afeta.

## Alternativas consideradas

- **Wiki externa (Notion, GitHub Wiki):** fica desatualizada porque não acompanha os PRs; descartada.
- **Só comentários no código:** não registram alternativas descartadas nem decisões transversais; descartada.

## Consequências

- Custo pequeno de escrita a cada decisão relevante.
- Quem herdar o projeto tem um histórico navegável das decisões.
- O agente de IA também passa a ler os ADRs antes de mudar algo, o que reduz decisões contraditórias.
