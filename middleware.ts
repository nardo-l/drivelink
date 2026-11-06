declare const process: { env: Record<string, string | undefined> };

// Enable REDIRECT_OLD_DOMAIN=true only after lotle.link is connected and SITE_URL is set.
export default function middleware(request: Request): Response | undefined {
  if (process.env.REDIRECT_OLD_DOMAIN !== 'true') return undefined;
  const requestUrl = new URL(request.url);
  const oldHost = (process.env.OLD_VERCEL_HOST || 'drivelink-gilt.vercel.app').toLowerCase();
  const destination = process.env.SITE_URL;
  if (requestUrl.hostname.toLowerCase() !== oldHost || !destination) return undefined;

  const target = new URL(destination);
  if (target.hostname.toLowerCase() === oldHost) return undefined;
  target.pathname = requestUrl.pathname;
  target.search = requestUrl.search;
  return Response.redirect(target, 301);
}

export const config = { matcher: '/:path*' };
