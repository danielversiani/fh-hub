# 0014. Traduzir os textos das fontes com uma memória de tradução revisada por PR

- **Status:** Aceita (pedido do dono em 2026-11-08: "já mostra tudo traduzido desde o início")
- **Data:** 2026-11-08

## Contexto

Parte do que as fontes escrevem não está na língua do site:
- **Observações de Noa Miyako** estão em chinês, cheias de gíria de pilotagem (推头 = "sai de frente", 轮椅 = "carro muito fácil", 控油 = "controle do acelerador"). Em 2026-11-08 eram 289 textos; 119 eram só um tempo de volta ("白川1:04.3"), que o site já mostra como "1:04.3 · Shirakawa".
- **Alguns nomes de tune** estão em chinês.
- **Descrições dos desafios da Playlist do Festival** vêm do forza.net em inglês, inclusive na versão pt-BR do site oficial.

A primeira versão mostrava o texto original com um link "Traduzir" (Google Tradutor). O dono pediu o texto já traduzido.

Opções de tradução automática avaliadas:
- **Serviços de tradução** (DeepL Free, Microsoft Translator, Google Cloud): têm cota gratuita, mas pedem conta e cartão do dono e uma chave secreta no GitHub. Traduzem mal a gíria ("推头" vira "empurrar a cabeça").
- **Endpoints gratuitos sem conta** (MyMemory, proxies do Google): qualidade baixa, limites diários e termos de uso duvidosos.
- **IA do próprio projeto** (Claude, já usado na curadoria, [ADR-0008](0008-curadoria-regras-e-ia.md)): entende a gíria e escreve em português natural, sem custo extra. Mas não roda dentro da sincronização de hora em hora.

## Decisão

1. Uma **memória de tradução** versionada no repositório:
   - `data/manual/translations.yaml`: texto original → `pt-br` e `en`. Cobre as observações e os nomes de tune;
   - `data/manual/playlist-texts.yaml`: desafio da playlist em inglês → português.
2. A sincronização aplica a memória ao montar os dados. O site **nunca mostra chinês sem tradução**:
   - texto sem caracteres chineses aparece como foi escrito;
   - texto que é só tempo de volta não precisa de palavras (o tempo aparece no selo);
   - texto novo sem tradução fica **escondido** e entra em `data/review/untranslated-texts.json`. Os desafios entram só se forem da série ao vivo.
3. As traduções são feitas pela **IA** (sessão de trabalho ou rotina semanal de curadoria) e entram por **Pull Request**, como o resto da curadoria. Ao traduzir:
   - deixar de fora os tempos de volta que já viram selo;
   - manter nomes de pista e de habilidade do jogo em inglês;
   - pista que não sabemos identificar fica com o nome em pinyin e o original entre parênteses.
4. **Nomes de eventos da playlist** ("Urban Legend") **não** são traduzidos enquanto não soubermos como o jogo em português os chama. Os tipos de evento, tipos de carro, recompensas e unidades (mph → km/h, pés → metros) são traduzidos pelo dicionário do site (`src/i18n`).

## Alternativas consideradas

- **Link para o Google Tradutor** (versão anterior): funciona, mas o dono pediu o texto já traduzido.
- **Serviço de tradução na sincronização:** totalmente automático, mas depende de conta paga/cartão do dono e traduz mal a gíria. Pode voltar como complemento (preencher só o que falta até a IA revisar), se o atraso incomodar.

## Consequências

- **Positivas:** textos em português natural desde o primeiro acesso; tradução revisável e com histórico; nenhum custo novo.
- **Negativas:** uma observação nova de Noa Miyako só aparece depois da próxima rodada de tradução. Até lá, o selo de tempo e as colunas (tração, pneu, dificuldade) aparecem normalmente.
- A rotina semanal de curadoria passa a também traduzir os itens de `untranslated-texts.json`.
