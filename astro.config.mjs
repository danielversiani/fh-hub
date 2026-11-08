// @ts-check
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// PT-BR is served at the root and English under /en/ (ADR-0007).
export default defineConfig({
  site: 'https://fh-hub.pages.dev',
  integrations: [preact()],
  i18n: {
    locales: ['pt-br', 'en'],
    defaultLocale: 'pt-br',
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
