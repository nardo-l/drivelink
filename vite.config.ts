import { name, legacyName, description, siteUrl, homeTitle } from './src/config/brand';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const lotleSeoPlugin = {
  name: 'lotle-seo',
  transformIndexHtml(html: string) {
    const structuredData = [
      { '@context': 'https://schema.org', '@type': 'Organization', name, alternateName: ['Lotle', legacyName], url: siteUrl, description },
      { '@context': 'https://schema.org', '@type': 'WebSite', name, alternateName: ['Lotle', legacyName], url: siteUrl, description },
    ];
    return html
      .replaceAll('__LOTLE_HOME_TITLE__', homeTitle)
      .replaceAll('__LOTLE_DESCRIPTION__', description)
      .replaceAll('__LOTLE_NAME__', name)
      .replace('__LOTLE_SITE_URL__', siteUrl)
      .replace('</head>', `<link rel="canonical" href="${siteUrl}/" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:site_name" content="${name}" />
    <script id="lotle-structured-data" type="application/ld+json">${JSON.stringify(structuredData)}</script>
    </head>`);
  },
};

const googleVerificationPlugin = {
  name: 'serve-google-verification',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url ? req.url.split('?')[0] : '';
      if (url === '/google8b6400bfc235f3ba.html') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('google-site-verification: google8b6400bfc235f3ba.html');
        return;
      }
      next();
    });
  },
};

export default defineConfig(() => {
  return {
    define: { 'globalThis.__SITE_URL__': JSON.stringify(process.env.SITE_URL || '') },
    plugins: [react(), tailwindcss(), googleVerificationPlugin, lotleSeoPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
