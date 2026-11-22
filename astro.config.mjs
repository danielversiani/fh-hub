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

/**
 * Dev server only: saves renders of a track model posted by a fidelity check (RUNBOOK §3e) to
 * .cache/track-shots/<name>.png, to lay them over frames of a race video.
 * @returns {import('astro').ViteUserConfig['plugins'] extends (infer P)[] | undefined ? P : never}
 */
function trackShots() {
  return {
    name: 'track-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__track-shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const { name, data } = JSON.parse(body);
          const base64 = String(data).replace(/^data:image\/png;base64,/, '');
          if (!/^[a-z0-9-]+$/.test(name) || base64 === data) {
            res.statusCode = 400;
            res.end();
            return;
          }
          const dir = path.join(process.cwd(), '.cache', 'track-shots');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(base64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

const SITE = 'https://forzapaddock.racing';
/** Pages left out of the sitemap: operations, not-found, and the old car list (a redirect). */
// Guide drafts (/guides/draft/…) are for the owner's review only (ADR-0024).
const NOT_IN_SITEMAP = /^(en\/)?((status|404|cars)\/?$|guides\/draft\/)/;

/**
 * Writes dist/sitemap.xml after the build: every page, with its PT-BR/EN pair as hreflang
 * alternates (ADR-0022). Endpoints (paths with a file extension) are left out. Sorted, so the
 * file only changes when pages do.
 * @returns {import('astro').AstroIntegration}
 */
function sitemap() {
  return {
    name: 'sitemap',
    hooks: {
      'astro:build:done': ({ pages, dir }) => {
        const paths = new Set(
          pages
            .map((p) => p.pathname.replace(/^\/+/, ''))
            .filter((p) => !/\.[a-z0-9]+$/i.test(p) && !NOT_IN_SITEMAP.test(p)),
        );
        /** @param {string} p */
        const url = (p) => `${SITE}/${p}`;
        /** @param {string} p */
        const ptOf = (p) => (p === 'en' || p === 'en/' ? '' : p.replace(/^en\//, ''));
        /** @param {string} pt */
        const enOf = (pt) => (pt === '' ? 'en/' : `en/${pt}`);
        /** @param {string} s */
        const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const entries = [...paths].sort().map((p) => {
          const pt = ptOf(p);
          /** @type {[string, string][]} */
          const pair = [
            ['pt-BR', pt],
            ['en', enOf(pt)],
          ];
          const both = pair.every(([, q]) => paths.has(q));
          const links = both
            ? [...pair, /** @type {[string, string]} */ (['x-default', pt])]
                .map(
                  ([lang, q]) =>
                    `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${escape(url(q))}"/>`,
                )
                .join('')
            : '';
          return `  <url>\n    <loc>${escape(url(p))}</loc>${links}\n  </url>`;
        });
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
        fs.writeFileSync(new URL('sitemap.xml', dir), xml);
      },
    },
  };
}

// PT-BR is served at the root and English under /en/ (ADR-0007).
export default defineConfig({
  site: SITE,
  integrations: [preact(), sitemap()],
  i18n: {
    locales: ['pt-br', 'en'],
    defaultLocale: 'pt-br',
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss(), worldSnapshots(), trackShots()],
  },
});
