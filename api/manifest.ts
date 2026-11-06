import { name, tagline, description, absoluteUrl } from '../src/config/brand';

export default function handler(_request: { method?: string }, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}): void {
  const manifest = {
    id: absoluteUrl('/'),
    name,
    short_name: name,
    description: `${tagline}. ${description}`,
    start_url: absoluteUrl('/'),
    scope: absoluteUrl('/'),
    display: 'standalone',
    background_color: '#FAF9F6',
    theme_color: '#FAF9F6',
    icons: [
      { src: absoluteUrl('/icon.svg?v=lotle-5'), sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: absoluteUrl('/icon.svg?v=lotle-5'), sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: absoluteUrl('/icon.svg?v=lotle-5'), sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(JSON.stringify(manifest));
}
