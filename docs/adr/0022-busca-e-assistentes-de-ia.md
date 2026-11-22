# 0022. Abrir o site para buscadores e assistentes de IA

- **Status:** Aceita
- **Data:** 2026-11-21

## Contexto

O dono quer que o Forza Paddock seja encontrado no Google e, principalmente, recomendado por assistentes de IA (Claude, ChatGPT, Gemini, Perplexity). O site já tinha título, descrição, link canônico e versões PT/EN em cada página, mas faltavam algumas peças:

- **Sitemap:** não havia.
- **robots.txt:** só o padrão do Cloudflare, que não bloqueia nada e não aponta para um sitemap.
- **Descrições:** a maioria das páginas usava o slogan do site como descrição.
- **hreflang:** os links apontavam para endereços relativos, mas o Google pede endereços completos.
- **Prévia de compartilhamento:** sem imagem nem resumo ao colar um link no WhatsApp ou no Discord.
- **Ícone:** o site não tinha ícone.

Os assistentes de IA acham páginas de dois jeitos: pelos buscadores (Bing, Google e os índices próprios deles) e lendo as páginas diretamente. Os dois jeitos dependem de as páginas serem acessíveis, terem texto no HTML (o site é estático, então tem) e se descreverem bem.

## Decisão

1. **Acesso aberto:** `public/robots.txt` libera tudo para todos os robôs, inclusive os de IA, e aponta o sitemap. Os robôs dos assistentes (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) recebem a página normalmente; conferido em 2026-11-21.
2. **Sitemap gerado no build:**
   - Uma integração em `astro.config.mjs` grava `dist/sitemap.xml` com todas as páginas, cada uma ligada ao seu par PT/EN (hreflang e `x-default` para o PT-BR). A lista vem ordenada, então o arquivo só muda quando as páginas mudam.
   - Ficam de fora a página de status (que também ganha `noindex`), a 404 e o redirecionamento antigo `/cars/`.
   - Não usamos `@astrojs/sitemap`: são poucas linhas, sem dependência nova.
3. **Cabeçalho de cada página** (`src/layouts/Base.astro`):
   - Endereços completos no canônico e no hreflang.
   - Tags Open Graph e de cartão do X: a página do carro usa a foto do carro, e as outras usam `public/og.jpg`.
   - Ícones (`favicon.svg`, `favicon-48.png`, `apple-touch-icon.png`).
   - Na home, dados estruturados schema.org (`WebSite`, sobre o jogo Forza Horizon 6).
4. **Descrições próprias** (chaves `seo.*` e `site.about` no i18n):
   - Carros, tunadores e pistas ganham descrições com o nome e a contagem de tunes ou a extensão.
   - Meta, Tunes, Playlist e Tunadores também ganham descrições próprias.
   - O texto das descrições cita "off-meta", o foco do site.
5. **`/llms.txt`** (`src/pages/llms.txt.ts`):
   - Um resumo em texto do site para assistentes de IA, no formato de llmstxt.org: o que é o site, os números atuais, as seções, as pistas e os créditos.
   - Fica em inglês, a língua que esses robôs mais leem, e diz onde estão as páginas em português.
   - É gerado com os mesmos dados das páginas, então os números se atualizam sozinhos.
6. **Medição fica com o dono:** o Google Search Console (indexação e pesquisas) e o Cloudflare Web Analytics (visitas, sem cookies, como já previsto no PRODUCT) são ativados na conta dele (RUNBOOK §10c).

## Alternativas consideradas

- **Bloquear os robôs de IA que só treinam modelos:** isso tiraria o site das respostas que o dono quer. A licença dos dados continua sendo das fontes, creditadas em cada página.
- **Google Analytics:** usa cookies e exigiria aviso de cookies. O Cloudflare Web Analytics basta.
- **Dados estruturados por carro ou tune** (ItemList, Product): não há um tipo do schema.org que descreva bem "tune de jogo", e marcação forçada pode ser ignorada ou penalizada. Fica para depois, se o Search Console mostrar ganho.

## Consequências

- O Google e o Bing passam a achar as cerca de 1.900 páginas pelo sitemap, em vez de só pelos links.
- Links compartilhados mostram imagem e resumo.
- Os assistentes de IA têm um resumo fiel do site. Ser recomendado, porém, depende sobretudo de o site ser citado e linkado em outros lugares (Reddit, Discord, YouTube), algo que código nenhum resolve.
- A imagem `public/og.jpg` foi gerada a partir de `public/world/home.webp`. Se a identidade visual mudar, ela precisa ser refeita.
- Um agente de SEO (rotina mensal com relatório e PR, como a curadoria) fica para quando houver umas 4 semanas de dados do Search Console.
