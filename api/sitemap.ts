import { siteUrl } from '../src/config/brand';
declare const process: { env: Record<string, string | undefined> };

export default function handler(_request: { method?: string }, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}): void {
  const base = siteUrl;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc></url>
</urlset>`;
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(xml);
}
