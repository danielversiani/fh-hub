# 0003. Astro + TypeScript como stack

- **Status:** Aceita
- **Data:** 2026-11-07

## Contexto

O site combina duas naturezas:
1. **Dados**: centenas de páginas geradas (uma por carro, tunador e evento) com filtros interativos.
2. **Conteúdo editorial**: guias e tutoriais longos em dois idiomas, que idealmente podem ser editados sem programar.

O dono do produto não vai programar no dia a dia; o código precisa ser simples e convencional para quem herdar.

## Decisão

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | **TypeScript** (modo `strict`) em tudo: site e pipeline | Uma linguagem só; tipos compartilhados entre pipeline e site |
| Framework do site | **Astro** | Gera HTML estático por padrão; coleções de conteúdo em Markdown/MDX com frontmatter validado; roteamento i18n nativo |
| Interatividade | **Preact** em *islands* | Leve (~3 KB); API compatível com React, conhecida pela maioria dos devs |
| Estilo | **Tailwind CSS** + tokens de design em variáveis CSS | Convenção muito difundida; tema claro/escuro via tokens |
| Validação de dados | **zod** | Schemas em runtime que também geram os tipos TypeScript |
| Testes | **Vitest** (unidade, com fixtures reais) e **Playwright** (fumaça no site e plano B da QQ Docs) | Padrão do ecossistema |
| Qualidade | ESLint + Prettier | Padrão do ecossistema |
| Runtime e pacotes | Node.js LTS + **pnpm** | Instalação rápida e determinística |

As versões exatas ficam fixadas no `package.json` e no `.nvmrc` quando o código for criado.

## Alternativas consideradas

- **Next.js:** excelente, mas orientado a servidor/React; para um site 100% estático e cheio de conteúdo, traz complexidade sem benefício.
- **SvelteKit / Nuxt:** boas opções, com menos devs disponíveis para herdar o projeto.
- **Python no pipeline:** bom para dados, mas obrigaria a manter duas linguagens e duplicar os tipos.

## Consequências

- **+** Guias podem ser editados como arquivos Markdown direto no GitHub.
- **+** Páginas leves e rápidas; JavaScript só onde há interação.
- **−** Recursos dinâmicos futuros (Fase 3) vão exigir o modo servidor do Astro ou um serviço separado; a decisão fica para o ADR daquela fase.
