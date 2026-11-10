// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/**
 * Dev server only: saves the world snapshots posted by `/?snapshots` (src/world/client.ts) to
 * public/world/<spot>.webp — the still backgrounds of normal mode (ADR-0019).
 * @returns {import('astro').ViteUserConfig['plugins'] extends (infer P)[] | undefined ? P : never}
 */
function worldSnapshots() {
  return {
    name: 'world-snapshots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__world-snapshot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const { name, data } = JSON.parse(body);
          const base64 = String(data).replace(/^data:image\/webp;base64,/, '');
          if (!/^[a-z-]+$/.test(name) || base64 === data) {
            res.statusCode = 400;
            res.end();
            return;
          }
          const dir = path.join(process.cwd(), 'public', 'world');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${name}.webp`), Buffer.from(base64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

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
    plugins: [tailwindcss(), worldSnapshots()],
  },
});
