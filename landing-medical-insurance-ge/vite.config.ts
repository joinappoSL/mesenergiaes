import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { negocio } from './src/config.ts';

// Escribe en el HTML lo que depende del dominio (canonical, Open Graph, schema.org)
// para que buscadores y redes sociales lo lean sin ejecutar JavaScript.
function datosNegocio(): Plugin {
  return {
    name: 'datos-negocio',
    transformIndexHtml(html) {
      const url = negocio.dominio;
      const seo = url
        ? [
            `<link rel="canonical" href="${url}/" />`,
            `<meta property="og:url" content="${url}/" />`,
            `<meta property="og:image" content="${url}/og-image.jpg" />`,
            `<meta name="twitter:image" content="${url}/og-image.jpg" />`,
          ].join('\n    ')
        : '';

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'InsuranceAgency',
        name: negocio.nombre,
        description:
          'Agencia de seguros médicos en Estados Unidos: Obamacare, planes Oasis y seguros complementarios, con asesoría en español.',
        areaServed: { '@type': 'Country', name: 'United States' },
        availableLanguage: ['es', 'en'],
        ...(url && { url, logo: `${url}/logo-medical-insurance-ge.webp` }),
        ...(negocio.telefono && { telephone: negocio.telefono }),
        ...(negocio.email && { email: negocio.email }),
        ...(negocio.direccion && { address: negocio.direccion }),
      };

      return html
        .replace('<!-- seo-dominio -->', seo)
        .replace(
          '<!-- schema-org -->',
          `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
        );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [tailwindcss(), datosNegocio()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        legal: resolve(import.meta.dirname, 'legal.html'),
      },
    },
  },
});
