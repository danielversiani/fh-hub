# 0008. Curadoria por regras + camada de IA via Pull Request

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

As sugestões da Festival Playlist devem seguir os **critérios do dono**, organizadas em quatro categorias (Meta, Off-meta, Purista, Meme), com alguma "inteligência".
O dono propôs: uma tarefa recorrente do Claude no PC dele gera um arquivo, e um script do Google (Apps Script) lê esse arquivo e atualiza o site. Ele também disse que, se a programação sozinha mantiver a qualidade, a IA não é obrigatória.

Análise do que cada abordagem consegue:

| Tarefa | Regras resolvem? |
|---|---|
| Cruzar a restrição do evento (classe + tipo de carro) com os carros elegíveis | Sim |
| Ordenar os tunes por nota | Sim |
| Classificar em Meta / Off-meta / Purista | Sim (tiers, tags de build, nomes) |
| Classificar em **Meme** | Não: exige julgamento |
| Interpretar restrições em texto livre que fogem do padrão | Parcialmente |
| Escrever um comentário curto por evento ("por que este carro") | Não |

## Decisão

1. **As regras são a base e sempre existem.** Toda semana, o pipeline gera sugestões completas só com regras ([CURATION.md](../CURATION.md)). O site nunca depende da IA para ter conteúdo.
2. **A IA é uma camada de enriquecimento**, executada por uma **rotina agendada do Claude Code na nuvem**, na conta do dono (criada com o comando `/schedule`), toda quinta-feira depois da virada da playlist:
   1. clona o repositório e lê a playlist da semana, as sugestões por regras e os candidatos;
   2. escolhe as sugestões Meme, revisa os casos que as regras marcaram como ambíguos e escreve comentários curtos em PT-BR e EN;
   3. grava `data/curation/weekly/<season-id>.json` no schema definido em `pipeline/schema/`;
   4. roda `pnpm validate` e **abre um Pull Request**.
3. **Revisão:** o dono aprova o PR (inclusive pelo celular). Opcional: merge automático quando a CI passa.
4. **Limites da IA, garantidos pelo schema:**
   - só pode referenciar tunes e carros que existem no banco de dados gerado;
   - não altera notas nem dados das fontes, só escolhe, comenta e sinaliza;
   - sugestões vindas da IA levam um selo "curadoria assistida por IA".
5. Se a rotina falhar ou não rodar, o site segue com as sugestões por regras e o `health.yml` avisa.

## Alternativas consideradas

- **Proposta original (tarefa no PC → arquivo → Apps Script → site):** três pontos de falha (PC ligado, sincronização do arquivo, script), sem histórico nem revisão; descartada. A rotina na nuvem mantém a ideia (o Claude da conta do dono fazendo a curadoria) sem esses problemas.
- **GitHub Action chamando a API da Anthropic:** viável e totalmente automática, mas exige chave de API com cobrança por uso. Fica como **plano B** se a rotina na nuvem não atender.
- **Só regras:** é a base. A categoria Meme e os comentários ficariam de fora ou dependeriam de palavras-chave fracas.

## Consequências

- **+** Qualidade de curadoria com julgamento, sem tornar o site dependente de IA.
- **+** Cada semana fica registrada num PR revisável.
- **−** Exige que o dono aprove um PR por semana (ou habilite o merge automático).
- **−** A rotina precisa de acesso ao repositório no GitHub.
