import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { description, getArticoli, permalink, toDate } from '../lib/articoli';

export async function GET(context: APIContext) {
  const articoli = await getArticoli();
  return rss({
    title: `${SITE.name} – ${SITE.tagline}`,
    description: SITE.description,
    site: context.site!,
    trailingSlash: true,
    customData: `<language>${SITE.lang}</language>`,
    items: articoli.slice(0, 30).map((a) => ({
      title: a.data.title,
      link: permalink(a),
      pubDate: toDate(a.data.date),
      description: description(a),
      categories: a.data.categories.map((c) => c.id),
    })),
  });
}
