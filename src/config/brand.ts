export const name = 'Lotlé';
export const nameAscii = 'lotle';
export const tagline = 'Your car showroom, online';
export const description = 'Create a professional online car showroom, manage vehicle inventory and receive buyer enquiries with Lotlé. Built for car dealers in Zimbabwe and South Africa.';
export const supportWhatsApp = '263789113734';
export const supportEmail = 'support@lotle.link';
export const legacyName = 'DriveLink';
const runtime = globalThis as typeof globalThis & {
  __SITE_URL__?: string;
  process?: { env?: Record<string, string | undefined> };
  Deno?: { env?: { get(key: string): string | undefined } };
};
let denoSiteUrl: string | undefined;
try { denoSiteUrl = runtime.Deno?.env?.get('SITE_URL'); } catch { denoSiteUrl = undefined; }
export const siteUrl = (runtime.__SITE_URL__ || runtime.process?.env?.SITE_URL || denoSiteUrl || 'https://drivelink-gilt.vercel.app').trim().replace(/\\/+$/, '');
export const homeTitle = 'Lotlé | Online car showroom for dealers in Zimbabwe';

export function pageTitle(page: string): string {
  return page === name || page === homeTitle ? homeTitle : `${page} | ${name}`;
}

export function absoluteUrl(path = ''): string {
  const normalized = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${siteUrl}${normalized}`;
}

export function updateBrandMetadata(options: { title?: string; description?: string; path?: string } = {}): void {
  if (typeof document === 'undefined') return;
  const title = options.title || homeTitle;
  const pageDescription = options.description || description;
  const canonical = absoluteUrl(options.path || window.location.pathname);

  document.title = title;
  const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = content;
  };
  setMeta('meta[name="description"]', 'name', 'description', pageDescription);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', pageDescription);
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', name);
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', pageDescription);

  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;

  let structuredData = document.getElementById('lotle-structured-data') as HTMLScriptElement | null;
  if (!structuredData) {
    structuredData = document.createElement('script');
    structuredData.id = 'lotle-structured-data';
    structuredData.type = 'application/ld+json';
    document.head.appendChild(structuredData);
  }
  structuredData.textContent = JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Organization', name, alternateName: ['Lotle', legacyName], url: siteUrl, description },
    { '@context': 'https://schema.org', '@type': 'WebSite', name, alternateName: ['Lotle', 'DriveLink'], url: siteUrl, description },
  ]);
}
