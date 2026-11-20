/**
 * Reserved first path segments for Lotlé application routes.
 * Keep this client-side list aligned with App.tsx and vercel.json.
 */
export const RESERVED_SHOWROOM_HANDLES = new Set([
  'app','start','signup','login','onboarding','onboarding-classic','confirm-email',
  'forgot-password','reset-password','dashboard','settings','billing','admin','api',
  'showroom','cars','browse','www','support','help','about','pricing','privacy','terms','lotle',
  // Additional first-level routes currently registered in App.tsx.
  'welcome','vehicles','enquiries','analytics','notifications','upgrade','more','storefront',
  'contact','vehicle','new','edit',
]);
export const isReservedShowroomHandle = (value: string): boolean =>
  RESERVED_SHOWROOM_HANDLES.has(value.trim().toLowerCase());
