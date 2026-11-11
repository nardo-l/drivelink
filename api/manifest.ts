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
    start_url: absoluteUrl('/app'),
    scope: absoluteUrl('/'),
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0A0F1E',
    icons: [
      { src: absoluteUrl('/icons/lotle-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: absoluteUrl('/icons/lotle-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: absoluteUrl('/icons/lotle-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  response.status(200).send(JSON.stringify(manifest));
}
