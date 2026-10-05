// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import pagefind from 'astro-pagefind';

// Tre modalità, dallo stesso codice:
// - sviluppo (`astro dev`): sito + Keystatic con storage locale, su 127.0.0.1;
// - build pubblica (`npm run build`): solo file statici, niente Keystatic, CSP stretta → Worker "cafolavori";
// - build admin (`npm run build:admin`, CAFO_ADMIN=1): sito + Keystatic in modalità GitHub sul runtime Workers
//   → Worker "cafolavori-admin", dietro Cloudflare Access. Il sito pubblico non contiene mai l'admin.
const isDev = process.argv.includes('dev');
const isAdmin = process.env.CAFO_ADMIN === '1';
const withKeystatic = isDev || isAdmin;

// Indirizzo pubblico del sito (canonical, sitemap, RSS, Open Graph). Si imposta con la variabile SITE_URL
// nella build di Cloudflare: così si passa dal dominio di test a quello definitivo senza toccare il codice.
const site = process.env.SITE_URL || 'https://www.cafolavori.it';

export default defineConfig({
  site,
  // Le API di Keystatic (/api/keystatic/tree…) sono senza slash finale: dove c'è Keystatic non va forzato.
  trailingSlash: withKeystatic ? 'ignore' : 'always',
  output: 'static',
  ...(isAdmin && {
    // Solo le rotte di Keystatic sono on-demand; tutte le pagine restano prerenderizzate (in Node, come la
    // build pubblica, così l'ottimizzazione delle immagini con sharp è identica).
    adapter: cloudflare({ configPath: 'wrangler.admin.jsonc', prerenderEnvironment: 'node', imageService: 'compile' }),
    // Le sessioni di Astro non servono (Keystatic usa i suoi cookie): senza, l'adapter non crea un KV inutile.
    session: false,
  }),
  integrations: [
    markdoc(),
    // I tag sono pagine sottili (molte noindex): in sitemap solo articoli, pagine, categorie e autori.
    sitemap({ filter: (page) => !page.includes('/tag/') }),
    pagefind(),
    ...(withKeystatic ? [react(), keystatic()] : []),
  ],
  // CSP solo sul sito pubblico: l'interfaccia di Keystatic inietta stili inline (e l'admin è dietro Access).
  ...(!isAdmin && {
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
        // Pagefind usa WebAssembly; Giscus carica script e foglio di stile dal proprio dominio.
        scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", 'https://giscus.app'] },
        styleDirective: { resources: ["'self'", 'https://giscus.app'] },
      },
    },
  }),
  // Niente codice da evidenziare, e Shiki usa stili inline incompatibili con la CSP.
  markdown: { syntaxHighlight: false },
  image: {
    responsiveStyles: true,
  },
});
