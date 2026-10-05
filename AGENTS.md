## Progetto

Ricostruzione statica del blog WordPress cafolavori.it: Astro 7 + Keystatic (locale in dev, GitHub nell'admin online) + Markdoc,
deploy su Cloudflare Workers (asset statici, `wrangler.jsonc`). Documentazione per l'utente in `GUIDA.md`.

- Contenuti in `src/content/` (`.mdoc` con frontmatter, `.yaml`), commenti storici in `src/data/commenti/`.
- Ogni campo esiste due volte: `keystatic.config.ts` (form admin) e `src/content.config.ts` (Zod, usa `.nullish()`
  perché Keystatic salva i campi vuoti come null/""). Tenerli allineati.
- URL identici a WordPress (`/AAAA/MM/GG/slug/`, `/category/`, `/tag/`, `/author/`): non cambiare lo schema.
  Le date sono stringhe naive Europe/Rome: usare gli helper di `src/lib/articoli.ts`, non `new Date(data)`.
- Tre modalità in `astro.config.mjs`: `astro dev` (Keystatic storage locale), build pubblica (statica, CSP, niente
  Keystatic → Worker `cafolavori`, `wrangler.jsonc`), build admin `CAFO_ADMIN=1` (adapter `@astrojs/cloudflare`,
  Keystatic storage GitHub, niente CSP, `session: false` → Worker `cafolavori-admin`, `wrangler.admin.jsonc`).
  `trailingSlash` è `ignore` dove c'è Keystatic (le sue API sono senza slash).
- CSP con hash generata da Astro (`security.csp`): niente script/stili inline non processati da Astro, niente Shiki.
- `scripts/wp2astro.mjs` rigenera da zero i contenuti: non lanciarlo dopo modifiche fatte da Keystatic.
- Il dump SQL (fuori dal repo, in `../db/`) contiene dati personali: mai copiarlo nel repo.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

- [Routing](https://docs.astro.build/en/guides/routing/) · [Content collections](https://docs.astro.build/en/guides/content-collections/) · [Keystatic](https://keystatic.com/docs/installation-astro)
