# 0002. Site estático, sem banco de dados na v1

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

- Todos os dados da v1 vêm de fontes externas que mudam no máximo algumas vezes por hora. Não há dado gerado por usuários (sem contas, votos ou envios).
- Volume pequeno: alguns milhares de tunes, cerca de 600 carros, algumas centenas de eventos por temporada. Na casa de poucos MB de JSON.
- Requisitos: custo zero, manutenção mínima, muito rápido no celular, bom SEO.

## Decisão

- O pipeline gera arquivos JSON versionados no Git (`data/generated/`).
- O site é **estático**: todas as páginas são geradas no build a partir desses JSONs. Interatividade (filtros, busca) roda no navegador sobre JSONs servidos pela CDN.
- **Sem servidor e sem banco** até existir um requisito que precise deles.

**Gatilho para reavaliar:** a Fase 3 (comunidade: contas, votos, favoritos, envio de tunes). Nesse momento, um novo ADR deve escolher o armazenamento (candidatos: Supabase/Postgres ou Cloudflare D1) e o modelo de autenticação. Os dados das fontes podem continuar no fluxo estático.

## Alternativas consideradas

- **Next.js + Postgres (Supabase) desde o início:** mais peças para manter, custo potencial e pouco ganho enquanto não há dado de usuário.
- **Site lendo as planilhas direto no navegador:** sem normalização nem deduplicação, lento, quebra quando a fonte muda e expõe as fontes a tráfego direto.

## Consequências

- **+** Custo zero, hospedagem trivial, sem servidor para cair ou ser invadido.
- **+** O histórico do Git vira auditoria e changelog dos dados de graça.
- **+** Rollback de dados ruins = `git revert` de um commit do bot.
- **−** Toda mudança de dado exige um novo build/deploy (mitigado em [ADR-0012](0012-hospedagem-cloudflare-pages.md)).
- **−** Recursos de comunidade vão exigir uma mudança de arquitetura na Fase 3 (prevista e aceita).
