// Viene da `site` in astro.config.mjs (variabile SITE_URL).
const siteUrl = import.meta.env.SITE.replace(/\/$/, '');

// Sui domini di test di Cloudflare il sito non va indicizzato: sul dominio definitivo sì, automaticamente.
export const INDEXABLE = !/\.(workers|pages)\.dev$/.test(new URL(siteUrl).hostname);

export const SITE = {
  url: siteUrl,
  name: 'Cafolavori',
  tagline: 'Il bello del brutto',
  description: 'Il blog dove i film brutti si sentono a casa! Recensioni di cafolavori: film brutti, serie e flop cinematografici.',
  lang: 'it',
  locale: 'it_IT',
  postsPerPage: 10,
};

// Menu principale. `href` senza figli è un link semplice; con `children` diventa un sottomenu.
// Le voci "categories" vengono riempite con le categorie di genere (vedi GENRE_EXCLUDED).
export type MenuItem = { label: string; href: string; children?: { label: string; href: string }[] | 'categories' };
export const MENU: MenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'CafoGeneri', href: '/category/', children: 'categories' },
  {
    label: 'CafoSerie',
    href: '/category/cafoserie/',
    children: [
      { label: 'La Spada della Verità', href: '/2013/05/05/la-spada-della-verita/' },
      { label: 'Nymphs', href: '/2014/01/12/nymphs/' },
    ],
  },
  {
    label: 'CafoAttori',
    href: '/category/cafoattori/',
    children: [
      { label: 'Nicolas Cage', href: '/2012/09/06/nicolas-cage/' },
      { label: 'Steven Seagal', href: '/2012/09/30/steven-seagal/' },
    ],
  },
  { label: 'Staff', href: '/staff/' },
  { label: 'La Lista', href: '/la-lista/' },
];

// Categorie che non sono generi cinematografici: escluse da "CafoGeneri".
export const GENRE_EXCLUDED = ['news-dal-blog', 'cafoserie', 'cafoattori', 'cafosoon'];

// Link fissi nella sidebar (era il "leftMenu" di WordPress).
export const SIDEBAR_LINKS = [
  { label: 'Perché?', href: '/2011/10/18/nasce-cafolavori-it/' },
  { label: 'Glossario', href: '/glossario/' },
  { label: 'Staff', href: '/staff/' },
];

// Commenti nuovi via Giscus (GitHub Discussions). Finché repoId è vuoto il box non viene mostrato.
// Valori da https://giscus.app dopo aver creato il repository pubblico delle discussioni.
export const GISCUS = {
  repo: '',
  repoId: '',
  category: 'Commenti',
  categoryId: '',
};
