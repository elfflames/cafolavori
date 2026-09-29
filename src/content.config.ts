import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Gli schemi devono restare allineati ai campi di keystatic.config.ts:
// Keystatic scrive i file, Astro li valida in build.

// Id = nome del file, identico allo slug di Keystatic e al vecchio slug WordPress.
const byFileName = ({ entry }: { entry: string }) => entry.replace(/\.(mdoc|ya?ml|json)$/, '');

// Data "naive" nel fuso di Roma, come la scrive il campo datetime di Keystatic.
const datetime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'formato atteso AAAA-MM-GGTHH:MM');
const voto = z.number().min(0).max(5).multipleOf(0.5);
// Keystatic salva i campi vuoti come null o "": vanno accettati come "assenti".
const text = z.string().nullish();
const seo = z.object({ title: text, description: text }).nullish();

const articoli = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/articoli', generateId: byFileName }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: datetime,
      draft: z.boolean().default(false),
      author: reference('autori'),
      categories: z.array(reference('categorie')).default([]),
      tags: z.array(z.string()).default([]),
      poster: image().nullish(),
      voti: z.object({ cafoneria: voto.nullish(), divertimento: voto.nullish() }).nullish(),
      scheda: z
        .object({
          titoloOriginale: text,
          regia: text,
          ideatore: text,
          cast: text,
          durata: text,
          durataMin: z.number().int().positive().nullish(),
          nazionalita: text,
          anno: z.coerce.string().nullish(),
          stagioni: z.coerce.string().nullish(),
          stato: text,
          frase: text,
        })
        .nullish(),
      verdetto: text,
      seo,
      legacyId: z.number().nullish(),
    }),
});

const pagine = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/pagine', generateId: byFileName }),
  schema: z.object({
    title: z.string(),
    parent: text,
    order: z.number().nullish(),
    seo,
  }),
});

const autori = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/autori', generateId: byFileName }),
  schema: z.object({ name: z.string(), page: text }),
});

const categorie = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/categorie', generateId: byFileName }),
  schema: z.object({ name: z.string(), description: text }),
});

// Commenti storici di WordPress, in sola lettura (non gestiti da Keystatic).
const commenti = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/commenti', generateId: byFileName }),
  schema: z.object({
    comments: z.array(
      z.object({ id: z.number(), parent: z.number().optional(), author: z.string(), date: datetime, text: z.string() }),
    ),
  }),
});

export const collections = { articoli, pagine, autori, categorie, commenti };
