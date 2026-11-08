# Produto: visão, escopo e roadmap

> **Status:** rascunho v0.1 · **Atualizado em:** 2026-11-07 · **Dono do produto:** Daniel Versiani
> Nome do projeto: **Forza Paddock** (escolhido pelo dono em 2026-11-08; codinome do repositório: `fh-hub`). Ver [§8](#8-nome-e-identidade).

## 1. Visão

Um portal para a comunidade de Forza Horizon 6 que reúne, em **português e inglês**, o que o jogador precisa e hoje está espalhado:
os melhores tunes para **qualquer** carro, o meta atual, a Festival Playlist da semana com sugestões de carro e tune por evento,
e os guias que o próprio jogo não oferece.

## 2. Problema

1. **Informação fragmentada.** Os tunes e rankings estão em dezenas de planilhas (Google Sheets, QQ Docs), Discords e vídeos, cada um com formato próprio e atualizado em ritmo próprio.
2. **O site de referência atual tem lacunas.** O [fh6meta.com](https://fh6meta.com) agrega bem, mas:
   - o meta (tiers) vem de uma única fonte (planilha de Noa Miyako);
   - a cobertura de tunes se limita a três planilhas (GBR Ozzy, LogikJ, Johnson Racing);
   - a playlist semanal reaproveita as escolhas de um único tunador (LogikJ);
   - não existe versão em português;
   - não cobre progressão, acessórios nem eventos organizados pela comunidade.
3. **O jogo explica mal a progressão:** wristbands, celeiros (barn finds), tesouros, como obter cada carro e qual carro/tune usar em cada evento.

## 3. Público

| Público | Necessidade principal |
|---|---|
| Jogadores brasileiros (iniciantes a competitivos) | Tudo em PT-BR. Hoje não existe hub em português |
| Comunidade global | Agregador mais completo que os atuais |
| Tunadores | Crédito, visibilidade e tráfego para suas planilhas e canais |

## 4. Princípios de produto

1. **Automático por padrão.** Se um dado existe numa fonte, o site se atualiza sozinho. Trabalho manual fica restrito a conteúdo editorial (guias).
2. **Crédito sempre.** Todo tune mostra o autor e o link para a fonte original. Tunadores podem pedir remoção ([ADR-0010](adr/0010-politica-de-fontes.md)).
3. **Transparência.** Toda nota ou sugestão mostra *por que* foi dada (quais sinais pesaram).
4. **Nunca quebrar em silêncio.** Se uma fonte mudar de formato, o site mantém os últimos dados válidos e o mantenedor é alertado.
5. **Barato de manter.** Infraestrutura com custo zero na v1, exceto o domínio.
6. **Feito para ser herdado.** Um dev que nunca viu o projeto deve entendê-lo lendo `docs/`.

## 5. Módulos

### 5.1 Paridade com o fh6meta (com ajustes de estilo)

| ID | Módulo | O que entrega | Fonte | Automação |
|---|---|---|---|---|
| M1 | Início | Mudanças recentes, playlist da semana, busca, números de cobertura | Derivado | Total |
| M2 | Busca de tunes | Busca global com filtros: tunador, fonte, classe, piso, marca, país, tipo de carro, forma de obter | Todas as fontes de tunes | Total |
| M4 | Tabela de meta | Tiers por classe × piso, resumo (mix de tiers, pneus, tunadores), log de mudanças | QQ Docs (Noa Miyako) | Total (fonte frágil) |
| M5 | Meta de Rivals | Mapa de calor classe × piso, ranking por aparições, escolhas por pista | Planilha de Rivals (candidata) | Total |
| M6 | Lista de carros | Todos os carros com tipo, país e forma de obter | Lista mestre ([ADR-0006](adr/0006-identidade-canonica.md)) | Total |
| M7 | Guias de tuning e PI | Conteúdo editorial equivalente | Editorial | Manual |

### 5.2 Novos

| ID | Módulo | O que entrega | Fonte | Automação |
|---|---|---|---|---|
| M3 | **Página de carro** | Para *cada* carro do jogo: todos os tunes conhecidos por classe e piso, tier quando houver, nota, código copiável, crédito | Todas | Total |
| M8 | **Festival Playlist da semana** | Todos os eventos da semana numa diagramação própria, com sugestões por evento em 4 categorias: **Meta, Off-meta, Purista, Meme** | forza.net (oficial) + banco de tunes + curadoria própria ([ADR-0009](adr/0009-playlist-fonte-oficial.md)) | Total por regras; IA opcional ([ADR-0008](adr/0008-curadoria-regras-e-ia.md)) |
| M9 | Página de tunador | Todos os tunes de um tunador, links para os canais dele | Todas | Total |
| M10 | Guias e tutoriais | Progressão (wristbands, Legend Island), celeiros, tesouros, como obter carros da história | Editorial, com fontes citadas | Manual |
| M11 | Eventos-base | Catálogo das corridas fixas do mapa com restrição e combos sugeridos | Levantamento próprio, validado no jogo | Dados manuais + sugestões automáticas |
| M12 | Acessórios | SimHub, RaceElement, overlays de controle para OBS, com guias passo a passo | Editorial (testado em máquina real) | Manual |
| M13 | Eventos da comunidade | Séries como a Underground Racing League (Wrong Hand Drive): regras, carros, códigos de tune e pintura | Planilhas dos organizadores + curadoria | Semiautomática |
| M14 | Team Wars | Combos populares de pista + carro + tune | **A definir** ([§10](#10-questões-em-aberto)) | A definir |
| M15 | Comunidade | Contas, votos, favoritos, envio de tunes, bot de Discord | Usuários | Exige banco de dados |

### 5.3 Ajustes de produto (2026-11-08, revisão visual do dono)

- **Carros + Tunes viraram uma aba só ("Tunes")**: lista de carros que se expande mostrando as tunes; a página própria de cada carro continua existindo para links diretos.
- **Página inicial = novidades** (carros com tunes atualizadas e que subiram de tier; quanto maior o salto, maior o destaque) e a playlist da semana. Os números do catálogo saíram do destaque e foram para o rodapé.
- **Visual** (revisto em 2026-11-08): segue as páginas do FH6 em forza.net (fundo preto e grafite, verde-limão como cor de destaque, linhas com uma faixa verde à esquerda, títulos em maiúsculas), mas mais discreto: títulos e rótulos menores, bordas finas. A cor de detalhe muda com a estação ao vivo da playlist.
- **Lista de tunes** (2026-11-08):
  - cada linha mostra tier, modelo, raridade, marca, ano e **como obter o carro** em português (Concessionária, Roleta, Exclusivo da playlist, Diário de coleção, Tesouro…). Carro de Roleta ou da playlist que não está na concessionária ganha "também no Leilão";
  - ao abrir um carro, as tunes ficam **separadas por piso** (Asfalto, Terra, Cross country), com uma linha divisória;
  - cada tune mostra as colunas da tabela de Noa Miyako: tração, pneu, estilo, dificuldade, tempos de referência ("1:04.3 · Shirakawa") e a observação, **já traduzida** ([ADR-0014](adr/0014-traducao-dos-textos-das-fontes.md));
  - o **tunador** ganha destaque (nome grande, com link para a página dele);
  - classe e PI **de fábrica** saíram da linha e viraram nota de rodapé dentro da caixa, porque a tune muda os dois;
  - Meme saiu dos filtros: é só uma categoria das sugestões de campeonato.
- **Página do tunador** usa a mesma lista e os mesmos filtros da aba Tunes.
- **Playlist** (2026-11-08): eventos separados por tipo (Campeonatos, The Trial, Desafio semanal, Rivals, PR Stunts, Horizon Life, outros), com título e linha entre os grupos. Cada sugestão mostra tração, pneu, estilo e dificuldade.
- **Fotos dos carros** ([ADR-0013](adr/0013-miniaturas-dos-carros.md)): na caixa do carro, na página do carro e nas novidades do início.
- **Celular primeiro** (2026-11-08): a maioria do público vai abrir no celular. Toda página precisa funcionar a partir de 375 px de largura, sem rolagem para o lado. No celular, o menu de seções ganha uma linha própria e cada carro da lista mostra o nome numa linha e os detalhes embaixo.
- **Português de verdade** (2026-11-08): na versão PT, tudo o que é do site aparece em português (tipos de evento, tipos de carro, recompensas, pneus, "Playlist do Festival"), com mph e pés convertidos para km/h e metros. Termos que a comunidade usa como estão (tune, meta, off-meta, drift, slick) continuam. Os **nomes dos eventos** ficam como o forza.net escreve até confirmarmos como o jogo em português os chama.
- **Sem anúncios, com doação** (2026-11-08): um bloco "Projeto feito por fãs" convida a apoiar, no início e no menu ("♥ Apoie"). O endereço da página de doação fica em `src/lib/site.ts` (`DONATE_URL`); enquanto estiver vazio, o botão diz "em breve".
- **Menções a Noa Miyako:** sempre o nome completo e, em português, no masculino ou neutro ("tabela de Noa Miyako").
- **Sem estatísticas de carro** (velocidade, aceleração etc.): o sistema do jogo que as calcula não é confiável.

## 6. Fases

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0. Fundação** | Repositório, CI, schemas, lista mestre de carros, adaptadores das fontes Google, i18n base | `pnpm sync` gera dados válidos de todas as fontes Google; CI verde |
| **1. Lançamento** | M1–M9 (M8 com curadoria só por regras); M10, M12 e M13 no ar com o primeiro conteúdo; PT-BR + EN | Site público, sincronização de hora em hora sem intervenção por 2 semanas |
| **1.5. Curadoria com IA** | Rotina semanal que enriquece as sugestões da playlist via Pull Request | 4 semanas seguidas de PRs válidos |
| **2. Expansão** | M11 completo, M14 (se houver fonte), mais guias, acessórios e fontes de tunadores | — |
| **3. Comunidade** | M15 | Ver [ADR-0002](adr/0002-site-estatico-sem-banco.md) (reavaliar banco) |

**Por que o lançamento é definido pelo núcleo automático:** conteúdo editorial nunca "fica pronto" e cresce continuamente.
O que faz o jogador voltar toda semana são os dados vivos: tunes, meta e playlist.

## 7. Requisitos não funcionais

| Requisito | Meta |
|---|---|
| Frescor dos dados | Fontes de tunes sincronizadas a cada 1 h; playlist a cada 6 h, com checagem reforçada na virada semanal (quinta-feira) |
| Desempenho | Páginas estáticas; LCP < 2,5 s em 4G |
| Mobile-first | Uso típico: celular ao lado do console/PC |
| Acessibilidade | WCAG 2.1 AA básico: contraste, navegação por teclado, rótulos |
| SEO | Uma URL por carro, tunador e evento; `hreflang` PT/EN; sitemap |
| Custo | R$ 0 de infraestrutura na v1 (exceto domínio) |
| Privacidade | Sem login na v1; analytics sem cookies (ex.: Cloudflare Web Analytics) |
| Direitos | Nada de artes, logos ou textos de terceiros; fatos (nomes de eventos, restrições) apresentados em diagramação própria, com link para a fonte ([ADR-0010](adr/0010-politica-de-fontes.md)) |

## 8. Nome e identidade

- **Nome:** Forza Paddock (2026-11-08). Não fica preso a um jogo da série. Usa "Forza" de forma referencial: risco pequeno de a Microsoft pedir troca de nome ou do domínio, aceito pelo dono. Domínio ainda não comprado (opções: `.com.br`, `.com`, `.gg`). Nomes anteriores: FH6 Hub (provisório), `everythingforza.gg`.
- **Risco de marca:** "Forza" é marca registrada da Microsoft. Muitos sites de fãs usam o termo, mas um domínio com a marca tem mais risco de contestação do que um nome genérico. Não é parecer jurídico; vale considerar na escolha.
- **Candidatos sem a marca** (sem registro DNS em 2026-11-07, o que *sugere* que estão livres; confirmar no registrador):
  `sharecode.gg`, `sharecodes.gg`, `tunehub.gg`, `tunecodes.gg`, `tuneboard.gg`, `metagarage.gg`, `wristband.gg`, `festivalhq.gg`, `garage998.gg`.
  Já registrados: `horizonhub.gg`, `metagarage.com`, `pitcrew.gg`.
- **Identidade visual:** a definir. Referência funcional: fh6meta, com ajustes de estilo.

## 9. Métricas de sucesso (indicativas)

| Métrica | Meta |
|---|---|
| Cobertura | > 90% dos carros do jogo com pelo menos 1 tune com share code |
| Frescor | Atraso médio entre mudança na fonte e no site < 2 h |
| Saúde | Nenhuma fonte com falha por mais de 24 h |
| Uso | Visitantes semanais; pico de retorno às quintas (virada da playlist) |

## 10. Questões em aberto

| # | Questão | Impacto | Dono |
|---|---|---|---|
| Q1 | **Team Wars:** o que é exatamente (modo do jogo? evento da comunidade?) e onde os combos são registrados? Não foi encontrada referência a um modo com esse nome no FH6. Os modos online documentados são Eliminator, Hide & Seek, Touge Showdown e Horizon Drift | Define se M14 é viável | Daniel |
| Q2 | Nome e domínio | Branding, SEO | Daniel |
| Q3 | Repositório público ou privado | Custo de GitHub Actions ([ADR-0004](adr/0004-github-como-fonte-da-verdade.md)) | Daniel |
| Q4 | Autorização dos tunadores, começando pelo GBR Ozzy, que bloqueou o download da planilha | Ético e de reputação ([ADR-0010](adr/0010-politica-de-fontes.md)) | Daniel |
| Q5 | Definição exata da categoria **Meme** | Curadoria ([CURATION.md](CURATION.md)) | Daniel |
| Q6 | Identidade visual | Front-end | Daniel |
