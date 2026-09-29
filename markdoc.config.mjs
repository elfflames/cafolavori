import { component, defineMarkdocConfig } from '@astrojs/markdoc/config';

// Tag personalizzati usabili nel testo degli articoli (in Keystatic: "Inserisci → Video YouTube").
export default defineMarkdocConfig({
  tags: {
    youtube: {
      render: component('./src/components/YouTube.astro'),
      selfClosing: true,
      attributes: { id: { type: String, required: true } },
    },
  },
});
