import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Supabase client configuration.
 * Uses client-safe environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

// Sanitize inputs by stripping accidental quotes or whitespace
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const envUrl = rawUrl?.trim().replace(/^["']|["']$/g, '');
const envAnonKey = rawAnonKey?.trim().replace(/^["']|["']$/g, '');

// Validate that environment variables are real and not placeholder strings
export function isSupabaseConfigured(): boolean {
  if (!envUrl || !envAnonKey) return false;
  if (
    envUrl.includes('YOUR_SUPABASE_URL') ||
    envUrl.includes('placeholder') ||
    envUrl.includes('your-project') ||
    envAnonKey.includes('YOUR_SUPABASE_ANON_KEY') ||
    envAnonKey.includes('placeholder') ||
    envAnonKey.includes('your-anon-publishable-key')
  ) {
    return false;
  }
  return envUrl.startsWith('https://') && envAnonKey.length > 20;
}

// Public hostname without sensitive credentials for display in diagnostics
export function getSupabaseHost(): string | null {
  if (!envUrl) return null;
  try {
    const parsed = new URL(envUrl);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Fallback dummy values for client initialization if keys are not yet configured
const dummyUrl = 'https://placeholder-project.supabase.co';
const dummyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-key-placeholder';

export const supabase = createClient<Database>(
  isSupabaseConfigured() ? envUrl! : dummyUrl,
  isSupabaseConfigured() ? envAnonKey! : dummyAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type SupabaseConnectionState =
  | 'missing_config'          // Missing Supabase configuration
  | 'configured_unverified'   // Supabase client configured, but connection not yet verified
  | 'connected'              // Supabase connection verified
  | 'authenticated'          // Authenticated Supabase session
  | 'demo_mode';             // Local demo mode

export interface BackendDiagnosticResult {
  state: SupabaseConnectionState;
  statusLabel: string;
  description: string;
  host: string | null;
  hasUrl: boolean;
  hasAnonKey: boolean;
  pingOk: boolean;
  pingError?: string;
  isAuthenticated: boolean;
  userEmail?: string;
  userId?: string;
  tables: {
    dealerships: boolean;
    vehicles: boolean;
    enquiries: boolean;
  };
  storageBuckets: {
    vehiclePhotos: boolean;
    dealershipAssets: boolean;
    vehiclePhotosError?: string;
    dealershipAssetsError?: string;
  };
}

/**
 * Runs a live connection diagnostic against the Supabase backend.
 * Tests table access, auth session, and storage bucket availability.
 */
export async function runBackendDiagnostic(isExplicitDemo: boolean = false): Promise<BackendDiagnosticResult> {
  const configured = isSupabaseConfigured();
  const host = getSupabaseHost();

  if (isExplicitDemo) {
    return {
      state: 'demo_mode',
      statusLabel: 'Local Demo Mode',
      description: 'Running with local mock data and demo dealership state.',
      host,
      hasUrl: Boolean(envUrl),
      hasAnonKey: Boolean(envAnonKey),
      pingOk: false,
      isAuthenticated: false,
      tables: { dealerships: false, vehicles: false, enquiries: false },
      storageBuckets: { vehiclePhotos: false, dealershipAssets: false },
    };
  }

  if (!configured) {
    return {
      state: 'missing_config',
      statusLabel: 'Missing Supabase Configuration',
      description: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or contains placeholder values.',
      host: null,
      hasUrl: Boolean(envUrl),
      hasAnonKey: Boolean(envAnonKey),
      pingOk: false,
      isAuthenticated: false,
      tables: { dealerships: false, vehicles: false, enquiries: false },
      storageBuckets: { vehiclePhotos: false, dealershipAssets: false },
    };
  }

  // Supabase is configured; perform actual network checks
  let pingOk = false;
  let pingError: string | undefined;
  let isAuthenticated = false;
  let userEmail: string | undefined;
  let userId: string | undefined;

  const tables = {
    dealerships: false,
    vehicles: false,
    enquiries: false,
  };

  const storageBuckets = {
    vehiclePhotos: false,
    dealershipAssets: false,
    vehiclePhotosError: undefined as string | undefined,
    dealershipAssetsError: undefined as string | undefined,
  };

  try {
    // 1. Check Auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      isAuthenticated = true;
      userEmail = session.user.email;
      userId = session.user.id;
    }

    // 2. Query dealerships table (public read or head query)
    const { count, error: dealerErr } = await supabase
      .from('dealerships')
      .select('id', { count: 'exact', head: true });

    if (dealerErr) {
      pingError = dealerErr.message;
    } else {
      tables.dealerships = true;
      pingOk = true;
    }

    // 3. Query vehicles table
    const { error: vehErr } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true });
    if (!vehErr) tables.vehicles = true;

    // 4. Query enquiries table
    const { error: enqErr } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true });
    if (!enqErr) tables.enquiries = true;

    // 5. Test storage buckets
    try {
      const { data: b1, error: b1Err } = await supabase.storage.getBucket('vehicle-photos');
      if (b1 && !b1Err) {
        storageBuckets.vehiclePhotos = true;
      } else {
        storageBuckets.vehiclePhotosError = b1Err?.message || 'Bucket not found';
      }
    } catch (e: any) {
      storageBuckets.vehiclePhotosError = e?.message || 'Bucket check failed';
    }

    try {
      const { data: b2, error: b2Err } = await supabase.storage.getBucket('dealership-assets');
      if (b2 && !b2Err) {
        storageBuckets.dealershipAssets = true;
      } else {
        storageBuckets.dealershipAssetsError = b2Err?.message || 'Bucket not found';
      }
    } catch (e: any) {
      storageBuckets.dealershipAssetsError = e?.message || 'Bucket check failed';
    }
  } catch (err: any) {
    pingError = err?.message || 'Network error during backend ping';
  }

  let state: SupabaseConnectionState = 'configured_unverified';
  let statusLabel = 'Supabase Configured (Unverified)';
  let description = 'Client has valid URL and anon key, but connection could not be verified.';

  if (pingOk) {
    if (isAuthenticated) {
      state = 'authenticated';
      statusLabel = 'Authenticated Supabase Session';
      description = `Signed in as ${userEmail}. Connected to ${host}.`;
    } else {
      state = 'connected';
      statusLabel = 'Supabase Connection Verified';
      description = `Database connection active on ${host}. No user currently signed in.`;
    }
  } else if (pingError) {
    description = `Connection failed: ${pingError}`;
  }

  return {
    state,
    statusLabel,
    description,
    host,
    hasUrl: true,
    hasAnonKey: true,
    pingOk,
    pingError,
    isAuthenticated,
    userEmail,
    userId,
    tables,
    storageBuckets,
  };
}

