# 0004. GitHub como fonte da verdade de código e dados

- **Status:** Aceita (repositório público vs. privado: pendente, ver PRODUCT Q3)
- **Data:** 2026-11-07

## Contexto

Precisamos de: versionamento de código, agendamento da sincronização, histórico auditável dos dados, revisão de mudanças vindas da IA e um lugar onde um futuro programador encontre tudo.

## Decisão

- Um único repositório no GitHub contém código, documentação, dados manuais, dados gerados e conteúdo editorial.
- A automação roda no **GitHub Actions** (`ci.yml`, `sync.yml`, `deploy.yml`, `health.yml`).
- Os dados gerados são commitados pelo bot na `main`. Mudanças humanas e da IA entram por Pull Request.
- **Recomendação: repositório público.**
  - No plano gratuito, Actions em repositório público não tem limite de minutos. Em privado, a cota mensal gratuita (2.000 minutos na data desta decisão; conferir) seria consumida pelo sync de hora em hora (cerca de 720 execuções por mês) somado ao CI.
  - Abre espaço para contribuições da comunidade (correções de alias, guias).
  - Os dados agregados já são públicos no site, então não há segredo a proteger no repositório.

## Alternativas consideradas

- **Cron num servidor próprio ou VPS:** custo e manutenção; descartado.
- **Tarefa agendada no PC do dono:** depende do PC ligado; descartado para o sync (ver [ADR-0008](0008-curadoria-regras-e-ia.md)).
- **Dados num bucket (R2/S3) em vez do Git:** perde o histórico e o diff gratuitos. Fica como evolução se o repositório crescer demais.

## Consequências

- **+** Histórico completo: `git log data/generated/` mostra quando e por que cada dado mudou.
- **+** Revisão de mudanças da IA pelo fluxo normal de PR.
- **−** Commits frequentes do bot poluem o log. Mitigação: mensagens padronizadas e filtro `git log --invert-grep --grep="chore(data)"`.
- **−** No GitHub, workflows agendados de repositórios públicos são desativados após 60 dias sem atividade. Os commits do bot contam como atividade, e o `health.yml` alerta se o sync parar.
