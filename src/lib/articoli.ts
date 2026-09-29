import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE } from '../consts';

export type Articolo = CollectionEntry<'articoli'>;
export type Pagina = CollectionEntry<'pagine'>;

// In sviluppo si vedono anche le bozze, in produzione no.
export async function getArticoli(): Promise<Articolo[]> {
  const all = await getCollection('articoli', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date));
}

// Permalink identico a WordPress: /AAAA/MM/GG/slug/. Calcolato dalla stringa della data
// (non da un Date) per non dipendere dal fuso orario della macchina di build.
export function permalink(a: Articolo): string {
  const [y, m, d] = a.data.date.slice(0, 10).split('-');
  return `/${y}/${m}/${d}/${a.id}/`;
}

export function pagePath(p: Pagina): string {
  return p.data.parent ? `/${p.data.parent}/${p.id}/` : `/${p.id}/`;
}

const dateFormat = new Intl.DateTimeFormat(SITE.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

// ISO 8601 con l'offset corretto di Europe/Rome (CET/CEST) per sitemap, RSS e JSON-LD.
export function isoDate(date: string): string {
  const local = `${date.slice(0, 16)}:00`;
  const guess = new Date(`${local}Z`);
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(guess)
    .find((p) => p.type === 'timeZoneName')!
    .value.replace('GMT', '') || '+00:00';
  return `${local}${offset}`;
}

export function toDate(date: string): Date {
  return new Date(isoDate(date));
}

export const hasVoti = (a: Articolo) => a.data.voti?.cafoneria != null && a.data.voti?.divertimento != null;

export function description(a: Articolo | Pagina): string {
  return a.data.seo?.description || SITE.description;
}

// "Vita Persa": il tempo totale speso a guardare i film recensiti.
export function vitaPersa(articoli: Articolo[]) {
  const minuti = articoli.reduce((sum, a) => sum + (a.data.scheda?.durataMin ?? 0), 0);
  return { giorni: Math.floor(minuti / 1440), ore: Math.floor((minuti % 1440) / 60), minuti: minuti % 60 };
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Pagine di un elenco con lo schema di URL di WordPress: /base/, /base/page/2/, /base/page/3/…
// Da usare con una rotta `[...page].astro`: il parametro è undefined per la prima pagina.
export function paginatePaths<T>(items: T[], perPage = SITE.postsPerPage) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: totalPages }, (_, i) => ({
    page: i === 0 ? undefined : `page/${i + 1}`,
    props: { items: items.slice(i * perPage, (i + 1) * perPage), current: i + 1, totalPages },
  }));
}

const monthFormat = new Intl.DateTimeFormat(SITE.lang, { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function monthLabel(anno: string, mese: string): string {
  return monthFormat.format(new Date(`${anno}-${mese}-15T12:00:00Z`));
}

// Archivio mensile ("RetroCafo"): mesi con almeno un articolo, dal più recente.
export function mesi(articoli: Articolo[]) {
  const byMonth = new Map<string, Articolo[]>();
  for (const a of articoli) {
    const key = a.data.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), a]);
  }
  return [...byMonth]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [anno, mese] = key.split('-');
      return { anno, mese, href: `/${anno}/${mese}/`, label: monthLabel(anno, mese), items };
    });
}

// Nuvola di tag ("CafoCloud"): i più usati, con un livello 1–8 proporzionale all'uso
// (classi CSS .tag-1…tag-8: niente style inline, che la CSP bloccherebbe).
export function tagCloud(articoli: Articolo[], limit = 45) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const a of articoli) {
    for (const name of a.data.tags) {
      const slug = slugify(name);
      if (!slug) continue;
      const entry = counts.get(slug) ?? { name, count: 0 };
      entry.count++;
      counts.set(slug, entry);
    }
  }
  const top = [...counts].sort((a, b) => b[1].count - a[1].count).slice(0, limit);
  const max = Math.max(...top.map(([, t]) => t.count), 1);
  const min = Math.min(...top.map(([, t]) => t.count));
  return top
    .map(([slug, t]) => ({
      slug,
      name: t.name,
      count: t.count,
      level: max === min ? 4 : 1 + Math.round(((t.count - min) / (max - min)) * 7),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, SITE.lang));
}

export function commentiLabel(n: number): string {
  return n === 0 ? 'Nessun commento' : n === 1 ? '1 commento' : `${n} commenti`;
}
