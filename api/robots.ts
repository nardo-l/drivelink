declare const process: { env: Record<string, string | undefined> };

type Request = {
  method?: string;
  headers?: { 'x-forwarded-host'?: string | string[] };
};
type Response = {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
};

function getBaseUrl(request: Request): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const forwarded = request.headers?.['x-forwarded-host'];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim();
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return 'https://' + host;

  return 'https://lotle.vercel.app';
}

export default function handler(request: Request, response: Response): void {
  const base = getBaseUrl(request);
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
}
