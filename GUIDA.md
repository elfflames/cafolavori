# Cafolavori – guida all'uso e alla personalizzazione

Sito statico generato con **Astro 7**. I contenuti si gestiscono con **Keystatic** (admin React che scrive file nel repo)
e il sito viene pubblicato su **Cloudflare Workers** (solo asset statici). In produzione ci sono solo file HTML/CSS/JS statici: niente PHP,
database, login o endpoint da attaccare.

```
PC locale ── npm run dev ──► http://127.0.0.1:4321/keystatic  (admin, scrive src/content/**)
     │
     └─ git commit + push ──► GitHub (repo privato) ──► Cloudflare Workers Builds: npm run build ──► CDN
```

---

## 1. Avvio rapido

```bash
cd ~/cafolavori/sito
nvm use            # Node 22 (vedi .nvmrc); la prima volta: nvm install
npm install        # solo la prima volta o dopo aggiornamenti
npm run dev        # sito su http://127.0.0.1:4321, admin su http://127.0.0.1:4321/keystatic
```

| Comando              | Cosa fa                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run dev`        | Server di sviluppo con hot reload + admin Keystatic (anche le bozze)     |
| `npm run build`      | Build di produzione in `dist/` + indice di ricerca Pagefind              |
| `npm run preview`    | Serve `dist/` in locale: è il sito esattamente come andrà online         |
| `npm run check`      | Type-check di componenti e schemi (`astro check`)                        |
| `npm run import:wp`  | **Rigenera** tutti i contenuti dal dump WordPress (sovrascrive! vedi §8) |

> Il server di sviluppo ascolta solo su `127.0.0.1`: l'admin non è raggiungibile da altre macchine della rete.

---

## 2. Scrivere e modificare i contenuti (Keystatic)

1. `npm run dev` e apri <http://127.0.0.1:4321/keystatic>.
2. **Articoli e recensioni → Add** (o apri una voce esistente).
3. Compila i campi a destra:
   - **Titolo / Slug**: lo slug diventa l'URL `/AAAA/MM/GG/slug/`. Per gli articoli vecchi **non cambiarlo**,
     altrimenti si rompono i link esterni (se proprio serve, aggiungi un redirect: §6).
   - **Data**: determina l'URL e l'ordinamento.
   - **Bozza**: le bozze si vedono solo in `dev`, non vengono pubblicate.
   - **Locandina**: se manca, il sito mostra il segnaposto "Locandina dispersa".
   - **Valutazioni**: Cafoneria (cacche) e Divertimento (faccine), 0–5 a mezzi punti. Vuote = articolo non-recensione.
   - **Scheda del film**: compila **Durata in minuti** per far crescere il contatore "Vita Persa".
4. Nel testo: la toolbar gestisce titoli, grassetti, liste, link, immagini. **+ → Video YouTube** inserisce un trailer
   (solo l'ID, es. `wRyDVykI-EA`).
5. **Save**. Keystatic scrive `src/content/articoli/<slug>.mdoc` e le immagini in `src/assets/articoli/<slug>/`;
   la pagina in dev si aggiorna da sola.

Pubblica:

```bash
git add -A && git commit -m "Recensione: Titolo del film" && git push
```

Cloudflare ricostruisce e pubblica in ~1–2 minuti. Puoi anche scrivere/modificare i file `.mdoc` a mano in VS Code:
sono Markdown con frontmatter YAML ([sintassi Markdoc](https://markdoc.dev/docs/syntax)).

---

## 3. Struttura del progetto

```
astro.config.mjs        integrazioni, CSP, Keystatic solo in dev
keystatic.config.ts     campi dell'admin (form)
markdoc.config.mjs      tag personalizzati nel testo ({% youtube id="…" /%})
src/content.config.ts   collezioni Astro + schema Zod (validazione in build)
src/consts.ts           nome sito, menu, link sidebar, configurazione Giscus
src/content/
  articoli/*.mdoc       102 articoli/recensioni
  pagine/*.mdoc         Glossario, Staff (+ sottopagine), La Lista…
  categorie/*.yaml      generi
  autori/*.yaml         autori (con link alla pagina staff)
src/data/commenti/*.json  commenti storici WordPress (sola lettura, niente email/IP)
src/assets/             immagini (ottimizzate in build: webp, srcset), tema, icone voti, font
src/lib/articoli.ts     helper: permalink, date (fuso Europe/Rome), Vita Persa…
src/components/         Scheda, Voto, YouTube, Commenti, Giscus, Nav, Sidebar, Seo…
src/layouts/Base.astro  scheletro della pagina
src/pages/              routing a file (vedi sotto)
src/styles/global.css   tutto il tema
public/_headers         header di sicurezza per Cloudflare
wrangler.jsonc          deploy su Cloudflare Workers (solo asset statici)
public/_redirects       redirect 301 (vecchi slug, feed WordPress)
scripts/wp2astro.mjs    conversione una tantum dal dump SQL
```

Rotte (identiche a WordPress, così i vecchi link funzionano ancora):

| URL                              | File                                        |
| -------------------------------- | ------------------------------------------- |
| `/`, `/page/2/`…                 | `pages/index.astro`, `pages/page/[page].astro` |
| `/2017/09/13/assassins-creed/`   | `pages/[anno]/[mese]/[giorno]/[slug].astro` |
| `/2012/09/`, `/2012/09/page/2/`  | `pages/[anno]/[mese]/[...page].astro` (archivio mensile "RetroCafo") |
| `/category/`, `/category/horror/page/2/` | `pages/category/…`                  |
| `/tag/<tag>/`, `/author/<nome>/` (+ `/page/N/`) | `pages/tag/[slug]/[...page].astro`, `pages/author/[slug]/[...page].astro` |
| `/glossario/`, `/staff/cater/`   | `pages/[...path].astro`                     |
| `/rss.xml`, `/sitemap-index.xml`, `/robots.txt` | `pages/rss.xml.ts`, integrazione sitemap, `pages/robots.txt.ts` |

---

## 4. Personalizzare

### Aspetto
Tutto in `src/styles/global.css`, organizzato per sezioni. Colori e misure sono custom properties in `:root`
(`--c-orange`, `--c-dark`, `--c-cream`, `--sheet-width`…). Le immagini del tema originale sono in `src/assets/theme/`:
l'header con logo e polaroid è **dentro** `Middle_texture.jpg` (1565×1200), quindi per cambiare l'header si modifica
quell'immagine. Il font dei titoli è `src/assets/fonts/Cafolavori.ttf` (ha glifi piccoli: per questo le dimensioni
dei titoli sono alte).

I componenti sono `.astro` (HTML + frontmatter TypeScript, niente JS al client salvo dove serve). L'integrazione
React in `astro.config.mjs` è caricata **solo in dev** (serve a Keystatic): per usare componenti React nel sito
(`client:visible` ecc.) va spostata fuori dal blocco `isDev`. Per questo sito conviene evitarlo: meno JS, CSP più semplice.

### Home ed elenchi
Come nel vecchio WordPress, home e archivi mostrano gli **articoli completi**, 5 per pagina (`SITE.postsPerPage` in
`src/consts.ts`), con la paginazione in stile WP-PageNavi. Il componente di un articolo è `src/components/Post.astro`
(usato sia negli elenchi sia nella pagina singola), l'elenco paginato è `src/components/Archivio.astro`.

### Avatar degli autori
Keystatic → **Autori** → campo **Avatar** (originali 62×62 px, in `src/assets/autori/`). Compare accanto al titolo
di ogni articolo dell'autore.

### Menu e sidebar
`src/consts.ts` → `MENU` (voci e sottomenu), `SIDEBAR_LINKS`, `GENRE_EXCLUDED` (categorie che non sono "generi"),
`AMICI` (banner del box "Amici", immagini in `src/assets/amici/`), `CONTATTI` (box "Contatti": nascosto finché
`href` è vuoto). I box della sidebar sono in `src/components/Sidebar.astro`.

### Aggiungere un campo a una recensione
Esempio: "Voto IMDb".

1. `keystatic.config.ts`, dentro `articoli.schema`:
   ```ts
   imdb: fields.number({ label: 'Voto IMDb', step: 0.1 }),
   ```
2. `src/content.config.ts`, dentro lo schema `articoli`:
   ```ts
   imdb: z.number().nullish(),
   ```
3. Usalo in un componente: `articolo.data.imdb` (tipizzato automaticamente).

Keystatic scrive il file, Zod lo valida in build: se i due schemi divergono, `npm run build` fallisce con un errore chiaro.

### Nuovo tag nel testo (come `youtube`)
1. Componente in `src/components/` (es. `Spoiler.astro` con uno `<slot />`).
2. Registralo in `markdoc.config.mjs` (`tags: { spoiler: { render: component('./src/components/Spoiler.astro') } }`).
3. Rendilo inseribile da Keystatic in `keystatic.config.ts` → `components` (`wrapper()` per contenuto annidato,
   `block()` per blocchi senza contenuto).

---

## 5. Pubblicazione su Cloudflare (Workers, sito statico)

Il sito è pubblicato come **Worker con soli asset statici** (`wrangler.jsonc`: nessun `main`, quindi nessun codice
server; Cloudflare serve `dist/` rispettando `_headers`, `_redirects` e `404.html`).

- Progetto: Cloudflare → **Compute → Workers e Pages → cafolavori**, collegato a `elfflames/cafolavori` (solo quel repo).
- Build: `npm run build`, deploy: `npx wrangler deploy`, variabile `NODE_VERSION=22`.
- URL: <https://cafolavori.danilo-guidi.workers.dev> (più gli URL di anteprima per i branch diversi da `main`).
- Ogni `git push` su `main` ricostruisce e pubblica. Storico e rollback: scheda **Distribuzioni**.
- Dominio personalizzato: scheda **Domini → Aggiungi dominio** (il dominio deve essere prima aggiunto all'account
  Cloudflare, con i nameserver di Cloudflare impostati presso il registrar).

Prova in locale di quello che verrebbe caricato: `npm run build && npx wrangler deploy --dry-run`.

### Dominio di test e migrazione al dominio definitivo

L'indirizzo del sito (canonical, sitemap, RSS, Open Graph) viene dalla variabile di build **`SITE_URL`**
(Worker → Impostazioni → Build → Variabili). Senza variabile vale `https://www.cafolavori.it`.
Sui domini `*.workers.dev` / `*.pages.dev` il sito si mette da solo in `noindex` e `robots.txt` blocca i crawler,
così la versione di test non finisce su Google.

Per passare al dominio definitivo:
1. Aggiungi il dominio all'account Cloudflare e imposta i nameserver presso il registrar.
2. Worker → **Domini → Aggiungi dominio**: `www.tuodominio.it` (e il dominio nudo, con redirect al `www`).
3. Cambia `SITE_URL` in `https://www.tuodominio.it` (o eliminala, se il dominio è `www.cafolavori.it`)
   e rilancia la build (Distribuzioni → riesegui, oppure un push qualsiasi).
4. Controlla `https://www.tuodominio.it/robots.txt` (deve dire `Allow`) e invia la sitemap a Google Search Console.

La CI GitHub (`.github/workflows/ci.yml`) esegue `check` e `build` a ogni push e verifica che Keystatic
non sia finito in `dist/`. Dependabot propone aggiornamenti settimanali delle dipendenze.

---

## 6. Redirect, SEO e ricerca

- **Redirect**: `public/_redirects`, una riga per regola (`/vecchio/ /nuovo/ 301`). Già presenti: vecchi slug
  WordPress, tag rinominati, `/feed/` → `/rss.xml`.
- **SEO**: title/description per pagina (campo SEO in Keystatic, altrimenti estratto automatico), canonical,
  Open Graph con la locandina, JSON-LD `Review`/`Movie` (voto = Divertimento) o `BlogPosting`, sitemap, RSS.
  Dopo la pubblicazione: aggiungi il sito a Google Search Console e invia `https://www.cafolavori.it/sitemap-index.xml`.
- **Ricerca "CerCafolavoro"**: [Pagefind](https://pagefind.app), indice statico generato in build (solo il testo di
  articoli e pagine, grazie a `data-pagefind-body`). Non funziona in `npm run dev`: provala con `build` + `preview`.

---

## 7. Commenti

- **Storici**: i 69 commenti WordPress sono in `src/data/commenti/<slug>.json` e vengono mostrati in sola lettura.
  Sono stati esportati solo nome, data e testo (niente email, IP o siti dei commentatori).
- **Nuovi, con Giscus** (GitHub Discussions: niente database, niente spam anonimo; per commentare serve un account GitHub):
  1. Crea un repo **pubblico** dedicato, es. `cafolavori-commenti`, e attiva *Settings → Features → Discussions*.
  2. Installa l'app <https://github.com/apps/giscus> su quel repo.
  3. Su <https://giscus.app> inserisci il repo, mappatura "pathname", crea/scegli la categoria "Commenti"
     (tipo *Announcements*, così solo giscus può aprire discussioni).
  4. Copia `repo`, `repoId`, `categoryId` in `GISCUS` dentro `src/consts.ts`. Il box compare da solo.

---

## 8. Import da WordPress (solo se serve rifarlo)

`scripts/wp2astro.mjs` legge il dump in `../db/` e le immagini recuperate in `../cafolavori/…/uploads`, e **rigenera da
zero** `src/content/{articoli,pagine,autori,categorie}`, `src/data/commenti`, `src/assets/{articoli,pagine}` e
`public/_redirects`. Dopo aver iniziato a modificare i contenuti con Keystatic **non rilanciarlo**: perderesti le
modifiche (restano comunque recuperabili da git). `scripts/report.csv` elenca per ogni post locandina, campi della
scheda riconosciuti e immagini mancanti: utile per sapere quali locandine rimettere a mano.

Il dump SQL contiene hash delle password ed email: resta fuori dal repo (`.gitignore` blocca `*.sql`).

---

## 9. Sicurezza: cosa è stato fatto e cosa tocca a te

Fatto nel progetto:
- Sito **solo statico**: nessuna superficie d'attacco lato server. L'admin Keystatic esiste solo sul tuo PC
  (integrazione caricata solo con `astro dev`, server legato a `127.0.0.1`).
- **CSP** generata da Astro con hash di script e stili (niente `unsafe-inline`), origini esterne ridotte a
  `i.ytimg.com`, `youtube-nocookie.com` e `giscus.app`. Header extra in `public/_headers`: HSTS, `frame-ancestors 'none'`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- Trailer YouTube caricati solo al click da `youtube-nocookie.com`: nessun cookie di terze parti finché non si preme play.
- Nessun tracker (rimosso il box Facebook del vecchio sito), nessun dato personale dei commentatori.
- Dipendenze monitorate da Dependabot; `npm audit` pulito al momento del setup.

Da fare tu:
- **2FA** su GitHub e Cloudflare (sono le uniche "porte" del sito).
- Repo dei contenuti **privato**; sul branch `main` attiva la protezione contro i force-push.
- Dopo il primo deploy verifica gli header su <https://securityheaders.com>.
- Aggiorna ogni tanto: `npm outdated`, `npm update`, oppure accetta le PR di Dependabot quando la CI è verde.

---

## 10. Problemi comuni

| Sintomo | Soluzione |
| --- | --- |
| `Unsupported engine` / errori strani all'avvio | `nvm use` (serve Node ≥ 22.12) |
| Build fallisce con errore Zod su un campo | Il file `.mdoc` indicato ha un valore non valido: correggilo da Keystatic o a mano |
| Una voce appare vuota nella lista di Keystatic | Un campo viola le validazioni dell'admin (es. meta description > 200 caratteri) |
| La ricerca non funziona in dev | Normale: Pagefind si genera in build → `npm run build && npm run preview` |
| Nuova immagine non ottimizzata | Le immagini vanno in `src/assets/` (non in `public/`) per essere ottimizzate |
