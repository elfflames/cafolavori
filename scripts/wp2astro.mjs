#!/usr/bin/env node
// Conversione una tantum del dump WordPress di cafolavori.it in contenuti Astro/Keystatic.
//
//   node scripts/wp2astro.mjs <dump.sql> <cartella wp-content/uploads>
//
// Genera (sovrascrivendo): src/content/{articoli,pagine,autori,categorie}, src/data/commenti,
// src/assets/articoli, public/_redirects e scripts/report.csv.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as yaml from 'js-yaml';

const [dumpPath, uploadsDir] = process.argv.slice(2);
if (!dumpPath || !uploadsDir) {
  console.error('uso: node scripts/wp2astro.mjs <dump.sql> <wp-content/uploads>');
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = {
  articoli: path.join(ROOT, 'src/content/articoli'),
  pagine: path.join(ROOT, 'src/content/pagine'),
  autori: path.join(ROOT, 'src/content/autori'),
  categorie: path.join(ROOT, 'src/content/categorie'),
  commenti: path.join(ROOT, 'src/data/commenti'),
  assets: path.join(ROOT, 'src/assets/articoli'),
  pagineAssets: path.join(ROOT, 'src/assets/pagine'),
};
for (const dir of Object.values(OUT)) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------- dump SQL

const sql = fs.readFileSync(dumpPath, 'utf8');
const VALUE = /"((?:[^"\\]|\\.)*)"|(NULL)/gs;
const unescape = (s) =>
  s.replace(/\\(.)/gs, (_, c) => ({ n: '\n', r: '', t: '\t', 0: '', Z: '' })[c] ?? c);

function rows(table) {
  const re = new RegExp(`INSERT INTO \`bnhhg_${table}\` VALUES\\((.*?(?:"|NULL))\\);\\n`, 'gs');
  return [...sql.matchAll(re)].map((m) =>
    [...m[1].matchAll(VALUE)].map((v) => (v[2] ? null : unescape(v[1]))),
  );
}

const posts = rows('posts').map((r) => ({
  id: r[0], author: r[1], date: r[2], content: r[4], title: r[5], status: r[7],
  slug: decodeURIComponent(r[11]), parent: r[17], menuOrder: Number(r[19]), type: r[20],
}));
const postById = new Map(posts.map((p) => [p.id, p]));

const meta = new Map();
for (const [, postId, key, value] of rows('postmeta')) {
  if (!meta.has(postId)) meta.set(postId, {});
  meta.get(postId)[key] = value;
}

const terms = new Map(rows('terms').map((r) => [r[0], { name: r[1], slug: decodeURIComponent(r[2]) }]));
const taxonomy = new Map(
  rows('term_taxonomy').map((r) => [r[0], { ...terms.get(r[1]), taxonomy: r[2], description: r[3] }]),
);
const postTerms = new Map();
for (const [objectId, ttId] of rows('term_relationships')) {
  if (!postTerms.has(objectId)) postTerms.set(objectId, []);
  postTerms.get(objectId).push(taxonomy.get(ttId));
}

const users = new Map(rows('users').map((r) => [r[0], { slug: r[3], name: r[9] }]));

// ---------------------------------------------------------------- immagini

const uploads = new Map(); // "2011/10/foo.jpg" -> dimensione in byte
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else uploads.set(path.relative(uploadsDir, full), fs.statSync(full).size);
  }
})(uploadsDir);

const stemOf = (f) => f.replace(/\.[^.]+$/, '');
const baseStem = (s) => s.replace(/-\d+x\d+$/, '').replace(/-e\d{10,}$/, '').replace(/-\d+x\d+$/, '');

// Dato un URL di WordPress restituisce il file recuperato più grande che corrisponde
// (originale, ritagli -e123…, miniature -WxH), oppure null.
function resolveUpload(url) {
  const m = url?.match(/wp-content\/uploads\/([^?#"]+)/);
  if (!m) return null;
  const rel = decodeURI(m[1]);
  const dir = path.dirname(rel);
  const base = baseStem(stemOf(path.basename(rel)));
  let best = null;
  for (const [file, size] of uploads) {
    if (path.dirname(file) !== dir || baseStem(stemOf(path.basename(file))) !== base) continue;
    if (!best || size > best.size) best = { file, size };
  }
  return best?.file ?? null;
}

// Copia un upload nella cartella dell'articolo e restituisce il percorso relativo al file .mdoc.
function copyUpload(rel, assetsDir, slug, name) {
  const ext = path.extname(rel).toLowerCase().replace('.jpeg', '.jpg');
  const fileName = (name ?? baseStem(stemOf(path.basename(rel)))) + ext;
  const destDir = path.join(assetsDir, slug);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(path.join(uploadsDir, rel), path.join(destDir, fileName));
  return `../../assets/${path.basename(assetsDir)}/${slug}/${fileName}`;
}

// ---------------------------------------------------------------- HTML -> Markdoc

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '_',
  strongDelimiter: '**',
  br: '\\',
});
turndown.addRule('youtube', {
  filter: (node) => node.nodeName === 'YOUTUBE-EMBED',
  replacement: (_, node) => `\n\n{% youtube id="${node.getAttribute('data-id')}" /%}\n\n`,
});
turndown.addRule('underline', { filter: ['u', 'span', 'font'], replacement: (c) => c });

const SCHEDA_LABELS = [
  ['titoloOriginale', /^titolo originale$/i],
  ['regia', /^regia$/i],
  ['ideatore', /^ideatore$/i],
  ['cast', /^cast$/i],
  ['durata', /^durata$/i],
  ['nazionalita', /^nazionalit[aà]$/i],
  ['anno', /^anno$/i],
  ['stagioni', /^numero stagioni$/i],
  ['stato', /^stato$/i],
  ['frase', /^frase (del film|della serie)$/i],
];
const BLOCK = /^<(p|ul|ol|li|h\d|table|blockquote|div|youtube-embed|pre)\b/i;
const YT = /(?:\[httpv\s+)?https?v?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})[^\s<\]"]*\]?/g;

const stripTags = (html) => cheerio.load(`<div>${html}</div>`)('div').text().replace(/\s+/g, ' ').trim();

// Simile al wpautop di WordPress: righe vuote -> paragrafi, a capo singoli -> <br>.
function autop(html) {
  return html
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (BLOCK.test(block) ? block : `<p>${block.replace(/\n/g, '<br>\n')}</p>`))
    .join('\n');
}

function convertBody(raw, { slug, assetsDir, isReview, report }) {
  const out = { voti: null, scheda: {}, poster: null, verdetto: null };

  const r1 = raw.match(/\[rating:([\d.]+)\]/);
  const r2 = raw.match(/\[rating2:([\d.]+)\]/);
  if (r1 || r2) out.voti = { cafoneria: Number(r1?.[1] ?? 0), divertimento: Number(r2?.[1] ?? 0) };

  let html = raw
    .replace(/\[fb_button\]/g, '')
    .replace(/<a\b[^>]*href="([^"]*youtu[^"]*)"[^>]*>.*?<\/a>/gs, ' $1 ')
    .replace(/<iframe[^>]*youtube[^>]*src="[^"]*\/embed\/([\w-]{11})[^"]*"[^>]*><\/iframe>/g, 'https://youtu.be/$1')
    // Il testo interno serve: turndown scarta gli elementi vuoti prima di applicare le regole.
    .replace(YT, (_, id) => `\n\n<youtube-embed data-id="${id}">${id}</youtube-embed>\n\n`)
    .replace(/&nbsp;/g, ' ')
    .replace(/<strong>\s*<strong>/g, '<strong>')
    .replace(/<\/strong>\s*<\/strong>/g, '</strong>');

  const $ = cheerio.load(html, null, false);
  $('table.tblValutazioni').remove();
  $('[style]').removeAttr('style');

  // Locandina: la prima immagine di una recensione.
  if (isReview) {
    const img = $('img').first();
    if (img.length) {
      const link = img.parent('a');
      const rel = resolveUpload(link.attr('href')) ?? resolveUpload(img.attr('src'));
      if (rel) out.poster = copyUpload(rel, assetsDir, slug, 'locandina');
      else report.missing.push(img.attr('src'));
      (link.length && link.text().trim() === '' ? link : img).remove();
    }
  }

  // Immagini nel testo: puntano ai file locali, spariscono se non recuperate.
  $('img').each((_, el) => {
    const img = $(el);
    const link = img.parent('a');
    const rel = resolveUpload(link.attr('href')) ?? resolveUpload(img.attr('src'));
    if (!rel) {
      report.missing.push(img.attr('src'));
      (link.length && link.text().trim() === '' ? link : img).remove();
      return;
    }
    const clean = $('<img>').attr({ src: copyUpload(rel, assetsDir, slug), alt: img.attr('alt') || img.attr('title') || '' });
    (link.length && /wp-content\/uploads/.test(link.attr('href') ?? '') ? link : img).replaceWith(clean);
  });

  // Cast in elenco puntato -> testo su una riga.
  $('ul').each((_, el) => {
    const ul = $(el);
    const label = ul.prevAll('strong').first().text();
    if (/^\s*cast/i.test(label)) ul.replaceWith(' ' + ul.find('li').map((_, li) => $(li).text().trim()).get().join(', '));
  });

  // Frasi finali "Sconsigliato a…" / "Se ne consiglia…".
  $('h4').each((_, el) => {
    const text = $(el).text().trim();
    if (/consigli/i.test(text)) out.verdetto = text.replace(/^["“\s]+|["”\s]+$/g, '');
    if (/consigli/i.test(text) || text === '' || /^cafolavori, il bello del brutto$/i.test(text)) $(el).remove();
  });

  // Tabelle di impaginazione -> righe di testo.
  $('table').each((_, el) => {
    const cells = $(el).find('td').map((_, td) => $(td).html().trim()).get().filter(Boolean);
    $(el).replaceWith('\n\n' + cells.join('\n\n') + '\n\n');
  });

  // Link interni assoluti -> relativi.
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href').replace(/^https?:\/\/(www\.)?cafolavori\.it/, '') || '/';
    $(el).attr('href', href);
  });

  html = $.html().replace(/<strong>\s*\n/g, '\n<strong>');

  // Riga per riga: campi della scheda ed etichette usate come titoletti.
  // Un campo della scheda senza valore prende la riga successiva (es. "Cast:" seguito dall'elenco).
  const kept = [];
  let pending = null;
  for (const line of html.split('\n')) {
    const text = stripTags(line);
    if (pending && text && !/^\s*<strong>/i.test(line)) {
      out.scheda[pending] = text;
      pending = null;
      continue;
    }
    const labelled = /^\s*<strong>/i.test(line) && text.match(/^([^:]{2,60}?)\s*:\s*(.*)$/);
    if (labelled) {
      const [, label, value] = labelled;
      const field = SCHEDA_LABELS.find(([, re]) => re.test(label.trim()));
      if (field && value && !out.scheda[field[0]]) {
        out.scheda[field[0]] = value.trim().replace(/^[“"]|[”"]$/g, '');
        continue;
      }
      if (field && !value && !out.scheda[field[0]]) {
        pending = field[0];
        continue;
      }
      if (!value) {
        kept.push('', `<h2>${label.trim()}</h2>`, '');
        continue;
      }
    }
    kept.push(line);
  }

  // Gli a capo dentro grassetti e corsivi rompono il Markdown: vanno spostati fuori.
  let body = autop(kept.join('\n'));
  const brInside = /<br>\s*(<\/(?:strong|b|em|i)>)/g;
  while (brInside.test(body)) body = body.replace(brInside, '$1<br>');

  let md = turndown
    .turndown(body)
    .replace(/\\\n\s*\n/g, '\n\n') // <br> a fine paragrafo
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { ...out, body: md + '\n' };
}

function parseDurata(s) {
  if (!s) return undefined;
  const h = s.match(/(\d+)\s*(h|ore|ora)/i);
  const m = s.match(/(\d+)\s*(min|m\b|'|’)/i);
  if (h) return Number(h[1]) * 60 + (m ? Number(m[1]) : 0);
  const n = s.match(/\d+/);
  return n ? Number(n[0]) : undefined;
}

const truncate = (text, max) => (text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text);

function description(md, max = 160) {
  const text = md
    .replace(/\{%.*?%\}/g, '')
    .replace(/^#+ .*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, max);
}

// Data WordPress "2011-10-19 12:46:13" -> formato del campo datetime di Keystatic.
const toDatetime = (d) => d.slice(0, 16).replace(' ', 'T');
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));

function writeMdoc(file, data, body) {
  const front = yaml.dump(clean(data), { lineWidth: -1, quotingType: '"' });
  fs.writeFileSync(file, `---\n${front}---\n${body}`);
}

const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- articoli

// Tag messi su quasi tutti i post per la SEO del 2011: non distinguono niente.
const GENERIC_TAGS = new Set(['cafolavori', 'film', 'movie', 'films', 'movies']);

const report = [];
const redirects = ['/feed/ /rss.xml 301', '/feed /rss.xml 301', '/comments/feed/ /rss.xml 301'];
const tagSlugs = new Map();
const permalink = (p) => `/${p.date.slice(0, 4)}/${p.date.slice(5, 7)}/${p.date.slice(8, 10)}/${p.slug}/`;

const published = posts.filter((p) => p.type === 'post' && p.status === 'publish');
for (const p of published) {
  const m = meta.get(p.id) ?? {};
  const t = postTerms.get(p.id) ?? [];
  const isReview = /\[rating2?:/.test(p.content);
  const rep = { missing: [] };
  const c = convertBody(p.content, { slug: p.slug, assetsDir: OUT.assets, isReview, report: rep });

  // Senza locandina nel testo si prova con l'immagine in evidenza.
  if (isReview && !c.poster && m._thumbnail_id) {
    const attached = meta.get(m._thumbnail_id)?._wp_attached_file;
    const rel = attached && resolveUpload(`wp-content/uploads/${attached}`);
    if (rel) c.poster = copyUpload(rel, OUT.assets, p.slug, 'locandina');
  }

  const tags = t.filter((x) => x.taxonomy === 'post_tag' && !GENERIC_TAGS.has(x.name.toLowerCase()));
  for (const tag of tags) {
    if (slugify(tag.name) !== tag.slug) tagSlugs.set(tag.slug, slugify(tag.name));
  }
  // Titoli Yoast senza il suffisso del sito (lo aggiunge il layout); inutili se uguali al titolo.
  const yoastTitle = (m._yoast_wpseo_title ?? '').replace(/\s*[-–|]\s*Cafolavori.*$/i, '').trim();
  const seoTitle = yoastTitle && !yoastTitle.includes('%%') && yoastTitle !== p.title ? yoastTitle : undefined;
  // Le meta description che ripetono la scheda non servono: meglio l'inizio del testo.
  const yoastDesc = (m._yoast_wpseo_metadesc ?? '').replace(/\s+/g, ' ').trim();
  const seoDescription = yoastDesc && !/titolo originale/i.test(yoastDesc) ? truncate(yoastDesc, 200) : description(c.body);
  const { durata, ...scheda } = c.scheda;

  writeMdoc(
    path.join(OUT.articoli, `${p.slug}.mdoc`),
    {
      title: p.title,
      date: toDatetime(p.date),
      author: users.get(p.author)?.slug,
      categories: t.filter((x) => x.taxonomy === 'category' && x.slug !== 'senza-categoria').map((x) => x.slug),
      tags: tags.map((x) => x.name),
      poster: c.poster,
      voti: c.voti ?? undefined,
      scheda: Object.keys(c.scheda).length ? clean({ ...scheda, durata, durataMin: parseDurata(durata) }) : undefined,
      verdetto: c.verdetto,
      seo: clean({ title: seoTitle, description: seoDescription }),
      legacyId: Number(p.id),
    },
    c.body,
  );

  if (m._wp_old_slug && m._wp_old_slug !== p.slug) {
    redirects.push(`${permalink({ ...p, slug: m._wp_old_slug })} ${permalink(p)} 301`);
  }
  report.push({
    id: p.id, slug: p.slug, recensione: isReview, voti: !!c.voti, locandina: !!c.poster,
    scheda: Object.keys(c.scheda).join('|'), immagini_mancanti: rep.missing.length,
  });
}
for (const [from, to] of tagSlugs) redirects.push(`/tag/${from}/ /tag/${to}/ 301`);

// ---------------------------------------------------------------- pagine

for (const p of posts.filter((p) => p.type === 'page' && p.status === 'publish')) {
  const rep = { missing: [] };
  const c = convertBody(p.content, { slug: p.slug, assetsDir: OUT.pagineAssets, isReview: false, report: rep });
  const parent = p.parent !== '0' ? postById.get(p.parent)?.slug : undefined;
  writeMdoc(
    path.join(OUT.pagine, `${p.slug}.mdoc`),
    { title: p.title, parent, order: p.menuOrder || undefined, seo: { description: description(c.body) } },
    c.body,
  );
  report.push({ id: p.id, slug: `pagina:${parent ? parent + '/' : ''}${p.slug}`, recensione: false, voti: false, locandina: false, scheda: '', immagini_mancanti: rep.missing.length });
}

// ---------------------------------------------------------------- autori e categorie

const pages = posts.filter((p) => p.type === 'page' && p.status === 'publish');
for (const u of users.values()) {
  const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const page = pages.find((p) => key(p.title) === key(u.name));
  fs.writeFileSync(path.join(OUT.autori, `${u.slug}.yaml`), yaml.dump(clean({ name: page?.title ?? u.name, page: page?.slug })));
}
for (const tx of taxonomy.values()) {
  if (tx.taxonomy !== 'category' || tx.slug === 'senza-categoria') continue;
  fs.writeFileSync(path.join(OUT.categorie, `${tx.slug}.yaml`), yaml.dump(clean({ name: tx.name, description: tx.description })));
}

// ---------------------------------------------------------------- commenti storici
// Solo nome, data e testo: email, IP, user agent e siti web dei commentatori non vengono esportati.

const bySlug = new Map();
for (const r of rows('comments')) {
  const [id, postId, author, , , , date, , content, , approved, , type, parent] = r;
  if (approved !== '1' || type) continue;
  const post = postById.get(postId);
  if (!post) continue;
  const $ = cheerio.load(`<div>${content.replace(/\n/g, '<br>')}</div>`);
  $('br').replaceWith('\n');
  $('p').append('\n\n');
  const list = bySlug.get(post.slug) ?? [];
  list.push({ id: Number(id), parent: Number(parent) || undefined, author, date: toDatetime(date), text: $('div').text().replace(/\n{3,}/g, '\n\n').trim() });
  bySlug.set(post.slug, list);
}
for (const [slug, comments] of bySlug) {
  comments.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(path.join(OUT.commenti, `${slug}.json`), JSON.stringify({ comments }, null, 2) + '\n');
}

// ---------------------------------------------------------------- redirect e report

fs.writeFileSync(path.join(ROOT, 'public/_redirects'), redirects.join('\n') + '\n');
const cols = Object.keys(report[0]);
fs.writeFileSync(
  path.join(ROOT, 'scripts/report.csv'),
  [cols.join(','), ...report.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n') + '\n',
);

const reviews = report.filter((r) => r.recensione);
console.log(`articoli: ${published.length} (recensioni ${reviews.length}, con locandina ${reviews.filter((r) => r.locandina).length})`);
console.log(`pagine: ${report.length - published.length}, commenti: ${[...bySlug.values()].flat().length} su ${bySlug.size} articoli`);
console.log(`immagini mancanti nel testo: ${report.reduce((n, r) => n + r.immagini_mancanti, 0)}, redirect: ${redirects.length}`);
