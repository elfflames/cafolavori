import { collection, config, fields } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

// Admin dei contenuti, in due modalità:
// - `npm run dev` → http://127.0.0.1:4321/keystatic, scrive i file direttamente in src/content (storage locale);
// - admin online (Worker "cafolavori-admin", build con CAFO_ADMIN=1) → login GitHub, ogni "Save" è un commit
//   sul repository. Il sito pubblico non include mai questo file.
// Ogni campo qui deve avere il corrispettivo nello schema Zod di src/content.config.ts.

const voto = (label: string) =>
  fields.number({ label, step: 0.5, validation: { min: 0, max: 5 }, description: 'Da 0 a 5, a mezzi punti' });

const seo = fields.object(
  {
    title: fields.text({ label: 'Titolo SEO', description: 'Facoltativo: sostituisce il titolo nel tag <title>' }),
    description: fields.text({ label: 'Meta description', multiline: true, validation: { length: { max: 200 } } }),
  },
  { label: 'SEO' },
);

const components = {
  youtube: block({
    label: 'Video YouTube',
    schema: { id: fields.text({ label: 'ID del video', description: 'La parte dopo watch?v= (11 caratteri)' }) },
  }),
};

export default config({
  storage: import.meta.env.DEV ? { kind: 'local' } : { kind: 'github', repo: 'elfflames/cafolavori' },
  ui: {
    brand: { name: 'Cafolavori' },
    navigation: {
      Contenuti: ['articoli', 'pagine'],
      Archivio: ['categorie', 'autori'],
    },
  },
  collections: {
    articoli: collection({
      label: 'Articoli e recensioni',
      slugField: 'title',
      path: 'src/content/articoli/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Titolo' }, slug: { label: 'Slug (URL)' } }),
        date: fields.datetime({ label: 'Data di pubblicazione', defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
        draft: fields.checkbox({ label: 'Bozza', description: 'Le bozze non vengono pubblicate' }),
        author: fields.relationship({ label: 'Autore', collection: 'autori', validation: { isRequired: true } }),
        categories: fields.multiRelationship({ label: 'Categorie', collection: 'categorie' }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tag', itemLabel: (p) => p.value }),
        poster: fields.image({
          label: 'Locandina',
          directory: 'src/assets/articoli',
          publicPath: '../../assets/articoli/',
        }),
        voti: fields.object(
          { cafoneria: voto('Cafoneria'), divertimento: voto('Divertimento') },
          { label: 'Valutazioni', description: 'Lasciare vuoto per gli articoli che non sono recensioni' },
        ),
        scheda: fields.object(
          {
            titoloOriginale: fields.text({ label: 'Titolo originale' }),
            regia: fields.text({ label: 'Regia' }),
            ideatore: fields.text({ label: 'Ideatore (serie)' }),
            cast: fields.text({ label: 'Cast', multiline: true }),
            durata: fields.text({ label: 'Durata (testo)', description: 'Es. "116 min"' }),
            durataMin: fields.integer({ label: 'Durata in minuti', description: 'Usata per il contatore "Vita Persa"' }),
            nazionalita: fields.text({ label: 'Nazionalità' }),
            anno: fields.text({ label: 'Anno' }),
            stagioni: fields.text({ label: 'Numero stagioni (serie)' }),
            stato: fields.text({ label: 'Stato (serie)' }),
            frase: fields.text({ label: 'Frase del film' }),
          },
          { label: 'Scheda del film' },
        ),
        verdetto: fields.text({ label: 'Verdetto finale', description: 'Es. "Sconsigliato agli amanti dell\'Irlanda."' }),
        seo,
        legacyId: fields.ignored(),
        content: fields.markdoc({
          label: 'Testo',
          options: {
            image: { directory: 'src/assets/articoli', publicPath: '../../assets/articoli/' },
          },
          components,
        }),
      },
    }),
    pagine: collection({
      label: 'Pagine',
      slugField: 'title',
      path: 'src/content/pagine/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Titolo' } }),
        parent: fields.relationship({ label: 'Pagina madre', collection: 'pagine', description: 'Es. "staff" per /staff/nome/' }),
        order: fields.integer({ label: 'Ordine' }),
        seo,
        content: fields.markdoc({
          label: 'Testo',
          options: { image: { directory: 'src/assets/pagine', publicPath: '../../assets/pagine/' } },
          components,
        }),
      },
    }),
    categorie: collection({
      label: 'Categorie',
      slugField: 'name',
      path: 'src/content/categorie/*',
      schema: {
        name: fields.slug({ name: { label: 'Nome' } }),
        description: fields.text({ label: 'Descrizione', multiline: true }),
      },
    }),
    autori: collection({
      label: 'Autori',
      slugField: 'name',
      path: 'src/content/autori/*',
      schema: {
        name: fields.slug({ name: { label: 'Nome' } }),
        page: fields.relationship({ label: 'Pagina di presentazione', collection: 'pagine' }),
        avatar: fields.image({
          label: 'Avatar',
          description: 'Mostrato accanto al titolo degli articoli (originali: 62×62 px)',
          directory: 'src/assets/autori',
          publicPath: '../../assets/autori/',
        }),
      },
    }),
  },
});
