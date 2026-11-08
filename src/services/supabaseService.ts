import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { Database } from '../types/database';
import { planService } from './planService';
import type {
  Dealership,
  Vehicle,
  Enquiry,
  VehicleStatus,
  TransmissionType,
  FuelType,
  StorefrontTemplate,
  CurrencyCode,
  EnquiryStage,
} from '../types';

type DealershipRow = Database['public']['Tables']['dealerships']['Row'];
type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type EnquiryRow = Database['public']['Tables']['enquiries']['Row'];

/**
 * Bidirectional mappers between database snake_case columns and frontend camelCase models.
 */
export function mapDealershipFromRow(row: DealershipRow): Dealership {
  return {
    id: row.id,
    dealershipType: row.dealership_type as Dealership['dealershipType'],
    name: row.name,
    slug: row.slug,
    tagline: row.tagline || 'Quality vehicles. Fair prices.',
    bio: row.bio || '',
    stickerText: row.sticker_text || 'Good cars brighter days',
    country: (row.country === 'South Africa' ? 'South Africa' : 'Zimbabwe') as 'Zimbabwe' | 'South Africa',
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    email: row.email,
    currency: (row.currency || 'USD') as CurrencyCode,
    template: (row.template || 'signature') as StorefrontTemplate,
    logoUrl: row.logo_url || undefined,
    coverUrl: row.banner_url || row.cover_url || undefined,
    isVerified: row.is_verified,
    isPublished: row.is_published,
    storefrontViews: row.storefront_views || 0,
    totalEnquiries: 0,
  };
}

export function mapDealershipToRow(
  d: Partial<Dealership>,
  userId: string
): Database['public']['Tables']['dealerships']['Insert'] {
  return {
    ...(d.id ? { id: d.id } : {}),
    user_id: userId,
    dealership_type: d.dealershipType || 'dealership',
    name: d.name || 'My Dealership',
    slug: d.slug || 'my-dealership',
    country: d.country || 'Zimbabwe',
    city: d.city || 'Harare',
    address: d.address || null,
    phone: d.phone || null,
    whatsapp: d.whatsapp || '',
    email: d.email || '',
    currency: d.currency || 'USD',
    template: d.template || 'signature',
    logo_url: d.logoUrl || null,
    cover_url: d.coverUrl || null,
    banner_url: d.coverUrl || null,
    bio: d.bio || null,
    tagline: d.tagline || null,
    sticker_text: d.stickerText || null,
    is_verified: d.isVerified ?? false,
    is_published: d.isPublished ?? true,
    storefront_views: d.storefrontViews ?? 0,
  };
}

export function mapVehicleFromRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    dealershipId: row.dealership_id,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    currency: (row.currency || 'USD') as CurrencyCode,
    mileageKm: row.mileage_km,
    transmission: (row.transmission || 'Automatic') as TransmissionType,
    fuel: (row.fuel || 'Petrol') as FuelType,
    engineSize: row.engine_size || undefined,
    colour: row.colour || undefined,
    condition: row.condition || undefined,
    dutyStatus: row.duty_status || undefined,
    status: (row.status || 'available') as VehicleStatus,
    description: row.description || '',
    photos: row.photos || [],
    features: row.features || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVehicleToRow(
  v: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  dealershipId: string
): Database['public']['Tables']['vehicles']['Insert'] {
  return {
    ...(v.id ? { id: v.id } : {}),
    dealership_id: dealershipId,
    make: v.make,
    model: v.model,
    year: v.year,
    price: v.price,
    currency: v.currency || 'USD',
    mileage_km: v.mileageKm,
    transmission: v.transmission,
    fuel: v.fuel,
    engine_size: v.engineSize || null,
    colour: v.colour || null,
    condition: v.condition || null,
    duty_status: v.dutyStatus || null,
    status: v.status || 'available',
    description: v.description || null,
    photos: v.photos || [],
    features: v.features || null,
  };
}

export function mapEnquiryFromRow(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    dealershipId: row.dealership_id,
    vehicleId: row.vehicle_id,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    buyerEmail: row.buyer_email || undefined,
    message: row.message,
    stage: (row.stage || 'new') as EnquiryStage,
    source: (row.source || 'form') as 'whatsapp' | 'call' | 'form',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseService = {
  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------
  async signUp(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/onboarding` } });
    if (error) throw error;
    return data;
  },

  async resendConfirmationEmail(email: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
  },

  async signInWithGoogle() {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/onboarding` } });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },

  async getCurrentUser() {
    if (!isSupabaseConfigured()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getSession() {
    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (session: any, event?: string) => void) {
    if (!isSupabaseConfigured()) {
      return { unsubscribe: () => {} };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session, event);
    });
    return subscription;
  },

  // ---------------------------------------------------------------------------
  // DEALERSHIP (Multi-Tenant)
  // ---------------------------------------------------------------------------
  async getCurrentDealership(): Promise<Dealership | null> {
    if (!isSupabaseConfigured()) return null;
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('dealerships')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current dealership:', error);
      throw error;
    }
    return data ? mapDealershipFromRow(data) : null;
  },

  async getDealershipBySlug(slug: string): Promise<Dealership | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('dealerships')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching dealership by slug:', error);
      throw error;
    }
    return data ? mapDealershipFromRow(data) : null;
  },

  async checkHandleAvailability(slug: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return true;
    const { data, error } = await supabase.rpc('check_dealership_slug_availability' as any, { p_slug: slug } as any);
    if (error) {
      console.error('Error checking showroom link availability:', error);
      return false;
    }
    return data === true;
  },

  async updateDealershipSlug(slug: string): Promise<Dealership> {
    if (!isSupabaseConfigured()) throw new Error('Showroom links are unavailable offline.');
    const { data, error } = await supabase.rpc('update_my_dealership_slug' as any, { p_slug: slug } as any);
    if (error) {
      console.error('Error updating showroom link:', error);
      throw new Error(error.message?.toLowerCase().includes('taken') ? 'That showroom link is taken. Try another.' : 'Could not update your showroom link. Please try again.');
    }
    return mapDealershipFromRow(data as DealershipRow);
  },

  async createDealership(dealershipData: Partial<Dealership>): Promise<Dealership> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Authentication required to create a dealership.');
    const payload = mapDealershipToRow(dealershipData, user.id);
    const { data, error } = await supabase.rpc(
      'complete_dealership_onboarding' as any,
      { p_dealership: payload as any } as any
    );
    if (error) {
      const message = error.message || 'Unknown database error';
      const details = error.details || null;
      const hint = error.hint || null;
      const code = error.code || null;
      const diagnostic = { step: 'dealership_insert_update', message, code, details, hint };
      console.error('[DriveLink onboarding][dealership_insert_update] RPC failed:', diagnostic, error);
      const lower = [message, details || '', hint || ''].join(' ').toLowerCase();
      const setupCode =
        (code === '42501' || (code === 'PGRST116' && lower.includes('0 rows'))) ? 'SETUP_PERMISSION' :
        (code === '42883' || code === 'PGRST202') ? 'SETUP_DB_MISSING_FUNCTION' :
        (code === '23505' && lower.includes('slug')) ? 'SETUP_SLUG_TAKEN' :
        code === 'P0002' ? 'SETUP_DEALERSHIP_MISSING' :
        'SETUP_UNKNOWN';
      throw Object.assign(
        new Error('We could not finish setting up your showroom. Your details are saved. Please try again.'),
        { code, details, hint, setupCode, setupStep: 'dealership_insert_update' }
      );
    }
    return mapDealershipFromRow(data as DealershipRow);
  },

  async updateDealership(dealershipId: string, updates: Partial<Dealership>): Promise<Dealership> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Authentication required to update dealership.');
    }

    const dbPayload: Partial<Database['public']['Tables']['dealerships']['Update']> = {};
    if (updates.dealershipType !== undefined) dbPayload.dealership_type = updates.dealershipType;
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.slug !== undefined) dbPayload.slug = updates.slug;
    if (updates.country !== undefined) dbPayload.country = updates.country;
    if (updates.city !== undefined) dbPayload.city = updates.city;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.whatsapp !== undefined) dbPayload.whatsapp = updates.whatsapp;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.currency !== undefined) dbPayload.currency = updates.currency;
    if (updates.template !== undefined) dbPayload.template = updates.template;
    if (updates.logoUrl !== undefined) dbPayload.logo_url = updates.logoUrl;
    if (updates.coverUrl !== undefined) { dbPayload.cover_url = updates.coverUrl; dbPayload.banner_url = updates.coverUrl; }
    if (updates.bio !== undefined) dbPayload.bio = updates.bio;
    if (updates.tagline !== undefined) dbPayload.tagline = updates.tagline;
    if (updates.stickerText !== undefined) dbPayload.sticker_text = updates.stickerText;
    if (updates.storefrontViews !== undefined) dbPayload.storefront_views = updates.storefrontViews;

    const { data, error } = await supabase
      .from('dealerships')
      .update(dbPayload)
      .eq('id', dealershipId)
      .eq('user_id', user.id) // Enforce user isolation
      .select()
      .single();

    if (error) {
      console.error('Error updating dealership:', error);
      throw error;
    }
    return mapDealershipFromRow(data);
  },

  async incrementStorefrontViews(slug: string): Promise<void> {
    if (!isSupabaseConfigured() || !slug) return;
    // Public visitors cannot directly update dealership rows under RLS.
    // This narrowly scoped RPC increments only published storefronts and logs a timestamped event.
    const { error } = await supabase.rpc('record_storefront_view', { p_slug: slug });
    if (error) {
      console.error('Failed to record storefront view:', error);
      throw error;
    }
  },

  async getStorefrontViewHistory(days: number = 30): Promise<{ view_date: string; views: number }[]> {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.rpc('get_storefront_view_history', { p_days: days });
    if (error) {
      console.error('Failed to load storefront view history:', error);
      throw error;
    }
    return (data || []).map(row => ({ view_date: row.view_date, views: Number(row.views) || 0 }));
  },

  async getDealershipPerformance(dealershipId: string, days: number): Promise<{ visits: number; enquiries: number }> {
    if (!isSupabaseConfigured()) return { visits: 0, enquiries: 0 };
    if (!dealershipId) throw new Error('A dealership is required to load performance.');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const [visitResult, enquiryResult] = await Promise.all([
      supabase
        .from('storefront_view_events')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealershipId)
        .gte('viewed_at', since),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealershipId)
        .gte('created_at', since),
    ]);

    if (visitResult.error) {
      console.error('Failed to load dealership visit activity:', visitResult.error);
      throw visitResult.error;
    }
    if (enquiryResult.error) {
      console.error('Failed to load dealership enquiry activity:', enquiryResult.error);
      throw enquiryResult.error;
    }

    return { visits: visitResult.count || 0, enquiries: enquiryResult.count || 0 };
  },

  // ---------------------------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------------------------
  async getVehicles(dealershipId: string, isPublic: boolean = false): Promise<Vehicle[]> {
    if (!isSupabaseConfigured()) return [];
    if (isPublic) await planService.getPublicPlan(dealershipId); // reconcile downgrade before reading public inventory

    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    if (isPublic) {
      // Must strictly filter for 'available' vehicles belonging to published dealerships as per database RLS policy
      query = query.eq('status', 'available');
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching vehicles from Supabase:', error);
      throw error;
    }
    const mapped = (data || []).map(mapVehicleFromRow);
    if (isPublic && mapped.length) {
      const plan = await planService.getPublicPlan(dealershipId);
      const photoLimit = plan.config[plan.plan].maxPhotosPerVehicle;
      return mapped.map(vehicle => ({ ...vehicle, photos: (vehicle.photos || []).slice(0, photoLimit) }));
    }
    return mapped;
  },

  async getVehicleById(vehicleId: string, isPublic: boolean = false): Promise<Vehicle | null> {
    if (!isSupabaseConfigured()) return null;

    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId);

    if (isPublic) {
      query = query.eq('status', 'available');
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching vehicle by ID:', error);
      throw error;
    }
    if (!data) return null;
    let row = data;
    let photoLimit = 10;
    if (isPublic) {
      const plan = await planService.getPublicPlan(data.dealership_id);
      photoLimit = plan.config[plan.plan].maxPhotosPerVehicle;
      const refreshed = await supabase.from('vehicles').select('*').eq('id', vehicleId).eq('status', 'available').maybeSingle();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data) return null;
      row = refreshed.data;
    }
    const vehicle = mapVehicleFromRow(row);
    if (isPublic) vehicle.photos = (vehicle.photos || []).slice(0, photoLimit);
    return vehicle;
  },

  async createVehicle(
    vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>,
    dealershipId: string
  ): Promise<Vehicle> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const payload = mapVehicleToRow(vehicleData, dealershipId);
    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle in Supabase:', error);
      throw error;
    }
    return mapVehicleFromRow(data);
  },

  async updateVehicle(vehicleId: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const payload: Partial<Database['public']['Tables']['vehicles']['Update']> = {};
    if (updates.make !== undefined) payload.make = updates.make;
    if (updates.model !== undefined) payload.model = updates.model;
    if (updates.year !== undefined) payload.year = updates.year;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.mileageKm !== undefined) payload.mileage_km = updates.mileageKm;
    if (updates.transmission !== undefined) payload.transmission = updates.transmission;
    if (updates.fuel !== undefined) payload.fuel = updates.fuel;
    if (updates.engineSize !== undefined) payload.engine_size = updates.engineSize;
    if (updates.colour !== undefined) payload.colour = updates.colour;
    if (updates.condition !== undefined) payload.condition = updates.condition;
    if (updates.dutyStatus !== undefined) payload.duty_status = updates.dutyStatus;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.photos !== undefined) payload.photos = updates.photos;
    if (updates.features !== undefined) payload.features = updates.features;

    const { data, error } = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', vehicleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle in Supabase:', error);
      throw error;
    }
    return mapVehicleFromRow(data);
  },

  async deleteVehicle(vehicleId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);

    if (error) {
      console.error('Error deleting vehicle from Supabase:', error);
      throw error;
    }
    return true;
  },

  // ---------------------------------------------------------------------------
  // ENQUIRIES (Multi-Tenant & Public submissions)
  // ---------------------------------------------------------------------------
  async getEnquiries(dealershipId: string): Promise<Enquiry[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching enquiries from Supabase:', error);
      throw error;
    }
    return (data || []).map(mapEnquiryFromRow);
  },

  async createEnquiry(enquiryData: Omit<Enquiry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Enquiry> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    // UUID regex check to prevent PostgreSQL syntax error with 'general' or non-UUID strings
    const isValidUuid = (val?: string | null): boolean => {
      if (!val) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    };

    const sanitizedVehicleId = isValidUuid(enquiryData.vehicleId) ? (enquiryData.vehicleId as string) : null;

    const payload: Database['public']['Tables']['enquiries']['Insert'] = {
      dealership_id: enquiryData.dealershipId,
      vehicle_id: sanitizedVehicleId,
      buyer_name: enquiryData.buyerName,
      buyer_phone: enquiryData.buyerPhone,
      buyer_email: enquiryData.buyerEmail || null,
      message: enquiryData.message,
      stage: enquiryData.stage || 'new',
      source: enquiryData.source || 'form',
      notes: enquiryData.notes || null,
    };

    const { data, error } = await supabase
      .from('enquiries')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error submitting enquiry to Supabase:', error);
      throw error;
    }
    return mapEnquiryFromRow(data);
  },

  async deleteEnquiry(enquiryId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('enquiries').delete().eq('id', enquiryId);
    if (error) {
      console.error('Error deleting enquiry from Supabase:', error);
      throw error;
    }
  },

  async updateEnquiryStage(enquiryId: string, stage: EnquiryStage, notes?: string): Promise<Enquiry> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const payload: Partial<Database['public']['Tables']['enquiries']['Update']> = {
      stage,
      ...(notes !== undefined ? { notes } : {}),
    };

    const { data, error } = await supabase
      .from('enquiries')
      .update(payload)
      .eq('id', enquiryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating enquiry in Supabase:', error);
      throw error;
    }
    return mapEnquiryFromRow(data);
  },

  // ---------------------------------------------------------------------------
  // SUPABASE STORAGE (Strict path convention: {dealership_id}/{filename})
  // ---------------------------------------------------------------------------
  async assertCurrentDealershipWriteAccess(): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Authentication required to upload dealership assets.');
    // Storage RLS now checks dealership ownership. Plan dates never gate uploads.
    // Vehicle photo counts are enforced separately by the database vehicle trigger.
    await this.getCurrentDealership();
  },

  async getFreshVehiclePhotoDealershipId(): Promise<{ userId: string; dealershipId: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase Storage is not configured.');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Authentication required: You must be signed in to upload photos.');
    const { data, error } = await supabase.from('dealerships').select('id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('No dealership is linked to the signed-in account. Complete dealership onboarding first.');
    return { userId: user.id, dealershipId: data.id };
  },

  async createVehiclePhotoSession(dealershipId: string): Promise<string> {
    if (!isSupabaseConfigured()) throw new Error('Supabase Storage is not configured.');
    const { data, error } = await supabase.rpc('create_vehicle_photo_session' as any, { p_dealership_id: dealershipId } as any);
    if (error) {
      console.error('[Lotlé photo session] Could not create upload session', { code: error.code, message: error.message, details: error.details });
      throw error;
    }
    if (typeof data !== 'string' || !data) throw new Error('PHOTO_SESSION_INVALID');
    return data;
  },

  async uploadVehiclePhoto(dealershipId: string, file: File, uploadSessionId: string, photoIndex: number, isCover: boolean): Promise<string> {
    const bucket = 'vehicle-photos';
    if (!isSupabaseConfigured()) throw new Error('Supabase Storage is not configured.');
    // Resolve ownership from the live auth user on every attempt; never trust a device cache for the path.
    const { userId, dealershipId: freshDealershipId } = await this.getFreshVehiclePhotoDealershipId();
    if (!uploadSessionId) throw new Error('Photo upload is not ready: the upload session is missing. Please retry.');
    let activeSessionId = uploadSessionId;
    if (dealershipId !== freshDealershipId) {
      console.warn('[Lotlé vehicle photo upload] Requested dealership differs from fresh owner query; creating a fresh session.', {
        signedInUserId: userId, requestedDealershipId: dealershipId || null, freshDealershipId, previousSessionId: uploadSessionId,
      });
      activeSessionId = await this.createVehiclePhotoSession(freshDealershipId);
    }
    await this.assertCurrentDealershipWriteAccess();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const safeExtension = extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
      ? extension : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uploadId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const path = `${freshDealershipId}/vehicles/${activeSessionId}/${uploadId}.${safeExtension}`;
    const diagnostic = {
      bucket, fileName: file?.name || null, signedInUserId: userId,
      dealershipIdUsedInPath: freshDealershipId, requestedDealershipId: dealershipId || null,
      freshDealershipId, sessionId: activeSessionId, sessionDealershipId: freshDealershipId,
      photoIndex, isCover, path, dealershipIdsMatch: dealershipId === freshDealershipId,
      sessionAndPathDealershipMatch: true,
    };
    console.info('[Lotlé vehicle photo upload] Identity and path check', diagnostic);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      console.error('[Lotlé vehicle photo upload] Upload failed', {
        ...diagnostic, statusCode: (uploadError as any).statusCode || (uploadError as any).status || null,
        error: (uploadError as any).error || null, message: uploadError.message || null,
        details: (uploadError as any).details || null, fullError: uploadError,
      });
      throw uploadError;
    }
    console.info('[Lotlé vehicle photo upload] Upload succeeded', diagnostic);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Photo uploaded, but its public URL could not be created.');
    return data.publicUrl;
  },

  async uploadDealershipAsset(
    dealershipId: string,
    file: File,
    type: 'logo' | 'cover'
  ): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase Storage is not configured.');
    }

    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Authentication required: You must be signed in to upload assets.');
    }

    // Ensure we use the authenticated user's real dealership UUID
    let targetDealershipId = dealershipId;
    let liveDealer = await this.getCurrentDealership().catch(() => null);
    if (liveDealer) {
      targetDealershipId = liveDealer.id;
    } else if (!targetDealershipId || targetDealershipId === 'dealer-1' || targetDealershipId.startsWith('dealer-')) {
      // Create user's dealership row first to obtain a real UUID
      liveDealer = await this.createDealership({
        name: 'My Dealership',
        slug: `dealer-${user.id.slice(0, 8)}`,
      });
      targetDealershipId = liveDealer.id;
    }

    const rawExt = file.name.split('.').pop()?.toLowerCase();
    const ext = rawExt && ['png', 'jpg', 'jpeg', 'webp'].includes(rawExt)
      ? rawExt
      : type === 'logo'
      ? 'png'
      : 'jpg';
    await this.assertCurrentDealershipWriteAccess();
    const path = `${targetDealershipId}/${type}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('dealership-assets')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      console.error('Dealership asset upload error:', uploadError);
      const msg = uploadError.message || '';
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('bucket')) {
        throw new Error(
          `Storage bucket 'dealership-assets' was not found. Please create a public bucket named 'dealership-assets' in your Supabase dashboard under Storage.`
        );
      }
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('dealership-assets')
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve public URL from Supabase Storage.');
    }

    const publicUrl = data.publicUrl;

    // Persist public URL directly to the dealership record
    try {
      await this.updateDealership(targetDealershipId, {
        [type === 'logo' ? 'logoUrl' : 'coverUrl']: publicUrl,
      });
    } catch (dbErr) {
      console.error('Failed to save asset URL to dealerships table:', dbErr);
      throw new Error('Asset uploaded to Storage, but failed to save URL to dealership record.');
    }

    return publicUrl;
  },

  async uploadShowroomBrandingAsset(file: File, type: 'logo' | 'banner' | 'banner-og', onProgress?: (percent: number) => void): Promise<string> {
    if (!isSupabaseConfigured()) throw new Error('Supabase Storage is not configured.');
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Please sign in before uploading showroom branding.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    await this.assertCurrentDealershipWriteAccess();
    const path = `${user.id}/${type}.webp`;
    const url = `${supabaseUrl}/storage/v1/object/dealership-branding/${encodeURIComponent(user.id)}/${encodeURIComponent(type)}.webp`;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('Content-Type', file.type || 'image/webp');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('cache-control', '3600');
      xhr.upload.onprogress = event => { if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
        else {
          let message = 'Image upload failed. Please try again.';
          try { message = JSON.parse(xhr.responseText)?.message || message; } catch {}
          const uploadError: any = new Error(xhr.status === 403
            ? `Storage access denied. Check dealership ownership and storage permissions. [STORAGE_RLS_403]`
            : message);
          uploadError.code = xhr.status === 403 ? 'STORAGE_RLS_403' : xhr.status === 409 ? 'STORAGE_CONFLICT_409' : undefined;
          uploadError.status = xhr.status;
          uploadError.details = xhr.responseText;
          reject(uploadError);
        }
      };
      xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection and retry.'));
      xhr.onabort = () => reject(new Error('Upload cancelled.'));
      xhr.send(file);
    });
    if (type === 'banner') {
      const { error: staleOgError } = await supabase.storage.from('dealership-branding').remove([`${user.id}/banner-og.webp`]);
      if (staleOgError) console.warn('Could not remove the previous generated banner preview:', staleOgError.message);
    }
    const { data } = supabase.storage.from('dealership-branding').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    const dealer = await this.getCurrentDealership().catch(() => null);
    if (dealer) {
      const previousUrl = type === 'logo' ? dealer.logoUrl : dealer.coverUrl;
      await this.updateDealership(dealer.id, type === 'logo' ? { logoUrl: publicUrl } : { coverUrl: publicUrl });
      if (previousUrl && previousUrl !== publicUrl) await this.removeLegacyBrandingObject(previousUrl);
    }
    return publicUrl;
  },

  async removeShowroomBrandingAsset(type: 'logo' | 'banner', currentUrl?: string | null): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Please sign in before changing showroom branding.');
    const path = `${user.id}/${type}.webp`;
    const { error } = await supabase.storage.from('dealership-branding').remove([path]);
    if (error && !/not found|does not exist/i.test(error.message)) throw error;
    const dealer = await this.getCurrentDealership().catch(() => null);
    if (dealer) {
      await this.updateDealership(dealer.id, type === 'logo' ? { logoUrl: '' } : { coverUrl: '' });
      if (currentUrl) await this.removeLegacyBrandingObject(currentUrl);
    }
  },

  async removeLegacyBrandingObject(publicUrl: string): Promise<void> {
    const marker = '/storage/v1/object/public/dealership-assets/';
    const index = publicUrl.indexOf(marker);
    if (index < 0) return;
    const path = publicUrl.slice(index + marker.length).split('?')[0].split('/').map(part => decodeURIComponent(part)).join('/');
    if (path) {
      const { error } = await supabase.storage.from('dealership-assets').remove([path]);
      if (error) console.warn('Legacy showroom branding cleanup could not remove old object:', error.message);
    }
  },

};