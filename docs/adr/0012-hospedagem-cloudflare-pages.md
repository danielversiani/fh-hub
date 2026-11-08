# 0012. Hospedagem no Cloudflare Pages com deploy limitado

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

Site estático ([ADR-0002](0002-site-estatico-sem-banco.md)), público global, custo zero desejado e possibilidade futura de monetização (ex.: anúncios ou apoio) que não deve violar os termos da hospedagem.

## Decisão

- **Cloudflare Pages**, plano gratuito: CDN global, HTTPS, domínio próprio e analytics sem cookies (Cloudflare Web Analytics).
- O build roda no **GitHub Actions** e o deploy é feito com `wrangler pages deploy` (`deploy.yml`).
- **Limitação de deploy:** o plano gratuito tem um limite mensal de builds (500 na data desta decisão; conferir). Por isso:
  - mudanças de código: deploy a cada push na `main`;
  - mudanças **só de dados**: no máximo 1 deploy a cada 2 h, juntando todas as alterações do período (≈ 360/mês no pior caso);
  - grupo de concorrência no workflow para nunca rodar dois deploys ao mesmo tempo.
- Pull Requests ganham um *preview deploy* (URL temporária) para revisão visual.

## Alternativas consideradas

- **Vercel (Hobby):** ótima experiência, mas o plano gratuito é restrito a uso não comercial, o que conflita com uma monetização futura.
- **Netlify (gratuito):** cota mensal de minutos de build mais apertada para o nosso ritmo de atualização.
- **GitHub Pages:** gratuito e simples, mas sem preview por PR e com menos controle de cache e cabeçalhos.

## Consequências

- **+** Custo zero e desempenho de CDN global.
- **−** Os dados no site podem ficar até cerca de 2 h atrás da sincronização. Aceitável, porque as fontes mudam no ritmo de horas.
