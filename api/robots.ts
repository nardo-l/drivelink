declare const process: { env: Record<string, string | undefined> };

export default function handler(_request: { method?: string }, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}): void {
  const base = (process.env.SITE_URL || 'https://drivelink-gilt.vercel.app').replace(/\/+$/, '');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
}
