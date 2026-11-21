// These values mirror src/config/brand.ts. Keep this endpoint self-contained so
// the Vercel function does not depend on loading application source modules.
const NAME = 'Lotlé';
const SHORT_NAME = 'Lotlé';
const DESCRIPTION = 'Your car showroom, online. Start a Free online car showroom with Lotlé, manage up to 3 vehicles and receive buyer enquiries. Upgrade to Lotlé Pro for unlimited vehicles and full analytics. Built for car dealers in Zimbabwe and South Africa.';
const BACKGROUND_COLOR = '#FFFFFF';
const THEME_COLOR = '#0A0F1E';

type Response = {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
};

function createManifest() {
  return {
    id: '/',
    name: NAME,
    short_name: SHORT_NAME,
    description: DESCRIPTION,
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: '/api/icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/icon?size=512&maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    lang: 'en',
    orientation: 'portrait-primary',
  };
}

export default function handler(_request: { method?: string }, response: Response): void {
  const send = (manifest: ReturnType<typeof createManifest>) => {
    response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    response.status(200).send(JSON.stringify(manifest));
  };

  try {
    send(createManifest());
  } catch {
    // Keep the endpoint installable even if an unexpected runtime issue occurs.
    try {
      send({
        id: '/',
        name: NAME,
        short_name: SHORT_NAME,
        description: DESCRIPTION,
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: BACKGROUND_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: '/api/icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/api/icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/api/icon?size=512&maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        lang: 'en',
        orientation: 'portrait-primary',
      });
    } catch {
      // Response transport failures cannot be recovered inside the function.
    }
  }
}
