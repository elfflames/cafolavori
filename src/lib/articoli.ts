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
