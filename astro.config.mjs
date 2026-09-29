// @ts-check
import { defineConfig } from 'astro/config';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import pagefind from 'astro-pagefind';

// Keystatic inietta route server (/keystatic, /api/keystatic): la carichiamo solo in sviluppo,
// così la build resta 100% statica e l'admin non esiste in produzione.
const isDev = process.argv.includes('dev');

export default defineConfig({
  site: 'https://www.cafolavori.it',
  // Le API di Keystatic (/api/keystatic/tree…) sono senza slash finale: in dev non va forzato.
  trailingSlash: isDev ? 'ignore' : 'always',
  output: 'static',
  integrations: [
    markdoc(),
    // I tag sono pagine sottili (molte noindex): in sitemap solo articoli, pagine, categorie e autori.
    sitemap({ filter: (page) => !page.includes('/tag/') }),
    pagefind(),
    ...(isDev ? [react(), keystatic()] : []),
  ],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://i.ytimg.com",
        "frame-src https://www.youtube-nocookie.com https://giscus.app",
        "connect-src 'self'",
        "font-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      // Pagefind usa WebAssembly; Giscus carica il suo script dal proprio dominio.
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", 'https://giscus.app'] },
    },
  },
  // Niente codice da evidenziare, e Shiki usa stili inline incompatibili con la CSP.
  markdown: { syntaxHighlight: false },
  image: {
    responsiveStyles: true,
  },
});
