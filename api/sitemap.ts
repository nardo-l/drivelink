import { siteUrl } from '../src/config/brand';
declare const process: { env: Record<string, string | undefined> };

type DealerSitemapRow = { slug: string; updated_at?: string | null };
const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export default async function handler(_request: { method?: string }, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}): Promise<void> {
  const base = siteUrl.replace(/\/$/, '');
  let dealers: DealerSitemapRow[] = [];
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey) {
    try {
      const endpoint = new URL('/rest/v1/dealerships', supabaseUrl);
      endpoint.searchParams.set('select', 'slug,updated_at');
      endpoint.searchParams.set('is_published', 'eq.true');
      endpoint.searchParams.set('order', 'updated_at.desc');
      const result = await fetch(endpoint.toString(), {
        headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey },
      });
      if (result.ok) dealers = await result.json() as DealerSitemapRow[];
    } catch (error) {
      console.error('[sitemap] Could not load published dealership URLs', error);
    }
  }

  const dealerUrls = dealers
    .filter(dealer => typeof dealer.slug === 'string' && /^[a-z0-9-]+$/i.test(dealer.slug))
    .map(dealer => {
      const lastmod = dealer.updated_at ? '<lastmod>' + xmlEscape(dealer.updated_at) + '</lastmod>' : '';
      return '<url><loc>' + xmlEscape(base + '/' + encodeURIComponent(dealer.slug)) + '</loc>' + lastmod + '</url>';
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${xmlEscape(base)}/</loc></url>
  ${dealerUrls.join('\n  ')}
</urlset>`;
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(xml);
}
