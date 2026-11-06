import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const lotleSeoPlugin = {
  name: 'lotle-seo',
  transformIndexHtml(html: string) {
    const siteUrl = (process.env.SITE_URL || 'https://drivelink-gilt.vercel.app').replace(/\\/+$/, '');
    const description = 'Create a professional online car showroom, manage vehicle inventory and receive buyer enquiries with Lotlé. Built for car dealers in Zimbabwe and South Africa.';
    const structuredData = [
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'Lotlé', alternateName: ['Lotle', 'DriveLink'], url: siteUrl, description },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lotlé', alternateName: ['Lotle', 'DriveLink'], url: siteUrl, description },
    ];
    const tags = `<link rel="canonical" href="${siteUrl}/" />
    <meta property="og:url" content="${siteUrl}/" />
    <script id="lotle-structured-data" type="application/ld+json">${JSON.stringify(structuredData)}</script>`;
    return html.replace('</head>', `${tags}\\n  </head>`);
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
    define: { 'import.meta.env.SITE_URL': JSON.stringify(process.env.SITE_URL || '') },
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
