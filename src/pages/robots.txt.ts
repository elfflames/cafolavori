import type { APIRoute } from 'astro';
import { INDEXABLE } from '../consts';

// Sul dominio di test (*.workers.dev) i motori di ricerca vengono tenuti fuori.
export const GET: APIRoute = ({ site }) =>
  new Response(
    INDEXABLE
      ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`
      : 'User-agent: *\nDisallow: /\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
