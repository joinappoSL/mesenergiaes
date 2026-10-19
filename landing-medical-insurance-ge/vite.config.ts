import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { negocio } from './src/config.ts';

const raiz = import.meta.dirname;

// Escribe en el HTML lo que depende del dominio (canonical, Open Graph, schema.org)
// para que buscadores y redes sociales lo lean sin ejecutar JavaScript, e inserta el mapa SVG.
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
        .replace('<!-- schema-org -->', `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
        .replace('<!-- mapa-usa -->', readFileSync(resolve(raiz, 'src/mapa-usa.svg'), 'utf8'));
    },
  };
}

// `npm run build:archivo` genera un único index.html autocontenido para enviarlo como vista previa.
export default defineConfig(({ mode }) => {
  const unArchivo = mode === 'archivo';
  return {
    base: process.env.VITE_BASE ?? './',
    plugins: [tailwindcss(), datosNegocio(), ...(unArchivo ? [viteSingleFile()] : [])],
    build: {
      outDir: unArchivo ? 'dist-archivo' : 'dist',
      rollupOptions: {
        input: unArchivo
          ? resolve(raiz, 'index.html')
          : { main: resolve(raiz, 'index.html'), legal: resolve(raiz, 'legal.html') },
      },
    },
  };
});
