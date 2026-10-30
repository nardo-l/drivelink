import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../types/database';
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
    coverUrl: row.cover_url || undefined,
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
    const { data, error } = await supabase.auth.signUp({ email, password });
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
    const { error } = await supabase.auth.signOut();
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

  onAuthStateChange(callback: (session: any) => void) {
    if (!isSupabaseConfigured()) {
      return { unsubscribe: () => {} };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
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

    const { count, error } = await supabase
      .from('dealerships')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (error) {
      console.error('Error checking handle availability:', error);
      return false;
    }
    return count === 0;
  },

  async createDealership(dealershipData: Partial<Dealership>): Promise<Dealership> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Authentication required to create a dealership.');
    }

    // Prevent duplicate records if user retries onboarding
    const existing = await this.getCurrentDealership();
    if (existing) {
      return await this.updateDealership(existing.id, dealershipData);
    }

    const payload = mapDealershipToRow(dealershipData, user.id);
    const { data, error } = await supabase
      .from('dealerships')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating dealership:', error);
      throw error;
    }
    return mapDealershipFromRow(data);
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
    if (updates.coverUrl !== undefined) dbPayload.cover_url = updates.coverUrl;
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

  // ---------------------------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------------------------
  async getVehicles(dealershipId: string, isPublic: boolean = false): Promise<Vehicle[]> {
    if (!isSupabaseConfigured()) return [];

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
    return (data || []).map(mapVehicleFromRow);
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
    return data ? mapVehicleFromRow(data) : null;
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
  async uploadVehiclePhoto(dealershipId: string, file: File): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase Storage is not configured.');
    }

    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Authentication required: You must be signed in to upload photos.');
    }

    const currentDealership = await this.getCurrentDealership();
    if (!currentDealership || currentDealership.id !== dealershipId) {
      throw new Error('Unauthorized: You can only upload photos to your own dealership.');
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${dealershipId}/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('vehicle-photos')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Vehicle photo upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('vehicle-photos')
      .getPublicUrl(path);

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
};
