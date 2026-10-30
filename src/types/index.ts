export type VehicleStatus = 'available' | 'reserved' | 'sold' | 'draft';
export type TransmissionType = 'Automatic' | 'Manual';
export type FuelType = 'Hybrid' | 'Petrol' | 'Diesel' | 'Electric';
export type StorefrontTemplate = 'signature' | 'inventory_first' | 'independent';
export type CurrencyCode = 'USD' | 'ZAR';

export interface Vehicle {
  id: string;
  dealershipId: string;
  make: string;
  model: string;
  year: number;
  price: number;
  currency: CurrencyCode;
  mileageKm: number;
  transmission: TransmissionType;
  fuel: FuelType;
  engineSize?: string;
  colour?: string;
  condition?: string; // e.g. "Ex-Japan Import", "Local Pre-owned", "Brand New"
  dutyStatus?: string; // e.g. "Duty Paid & Registered", "In Bond / Zimra Cleared", "Ex-Port"
  status: VehicleStatus;
  description: string;
  photos: string[];
  features?: string[];
  createdAt: string;
  updatedAt: string;
}

export type EnquiryStage = 'new' | 'contacted' | 'negotiating' | 'sold' | 'lost';

export interface Enquiry {
  id: string;
  dealershipId: string;
  vehicleId?: string | null;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  message: string;
  stage: EnquiryStage;
  source: 'whatsapp' | 'call' | 'form';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dealership {
  id: string;
  userId?: string;
  dealershipType?: SellerType;
  name: string;
  slug: string;
  tagline: string;
  bio: string;
  stickerText: string;
  country: 'Zimbabwe' | 'South Africa';
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  currency: CurrencyCode;
  template: StorefrontTemplate;
  logoUrl?: string;
  coverUrl?: string;
  isVerified: boolean;
  isPublished?: boolean;
  storefrontViews: number;
  totalEnquiries: number;
}

export interface UserSession {
  isLoggedIn: boolean;
  email: string;
  dealershipId: string;
  userId?: string;
}

// ---------------------------------------------------------------------
// Supabase Database Row Types (Matching real Supabase public schema)
// ---------------------------------------------------------------------
export interface DealershipRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  country: string;
  city: string;
  address: string | null;
  phone: string | null;
  whatsapp: string;
  email: string | null;
  currency: string;
  template: string;
  logo_url: string | null;
  cover_url: string | null;
  bio: string | null;
  tagline: string | null;
  sticker_text: string | null;
  is_verified: boolean;
  is_published: boolean;
  storefront_views: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleRow {
  id: string;
  dealership_id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  currency: string;
  mileage_km: number;
  transmission: string;
  fuel: string;
  engine_size: string | null;
  colour: string | null;
  condition: string | null;
  duty_status: string | null;
  status: string;
  description: string | null;
  photos: string[] | null;
  features: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryRow {
  id: string;
  dealership_id: string;
  vehicle_id: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string | null;
  message: string;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------
// Mappings between Database Rows and Application Types
// ---------------------------------------------------------------------
export function dealershipRowToModel(row: DealershipRow, totalEnquiries: number = 0): Dealership {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline || '',
    bio: row.bio || '',
    stickerText: row.sticker_text || '',
    country: (row.country === 'South Africa' ? 'South Africa' : 'Zimbabwe') as 'Zimbabwe' | 'South Africa',
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || row.whatsapp || '',
    whatsapp: row.whatsapp || '',
    email: row.email || '',
    currency: (row.currency === 'ZAR' ? 'ZAR' : 'USD') as CurrencyCode,
    template: (row.template as StorefrontTemplate) || 'signature',
    logoUrl: row.logo_url || undefined,
    coverUrl: row.cover_url || undefined,
    isVerified: Boolean(row.is_verified),
    isPublished: row.is_published !== false,
    storefrontViews: Number(row.storefront_views) || 0,
    totalEnquiries,
  };
}

export function dealershipModelToRow(model: Partial<Dealership>, userId?: string): Partial<DealershipRow> {
  const row: Partial<DealershipRow> = {};
  if (model.id) row.id = model.id;
  if (userId || model.userId) row.user_id = userId || model.userId;
  if (model.name !== undefined) row.name = model.name;
  if (model.slug !== undefined) row.slug = model.slug;
  if (model.country !== undefined) row.country = model.country;
  if (model.city !== undefined) row.city = model.city;
  if (model.address !== undefined) row.address = model.address;
  if (model.phone !== undefined) row.phone = model.phone;
  if (model.whatsapp !== undefined) row.whatsapp = model.whatsapp;
  if (model.email !== undefined) row.email = model.email;
  if (model.currency !== undefined) row.currency = model.currency;
  if (model.template !== undefined) row.template = model.template;
  if (model.logoUrl !== undefined) row.logo_url = model.logoUrl;
  if (model.coverUrl !== undefined) row.cover_url = model.coverUrl;
  if (model.bio !== undefined) row.bio = model.bio;
  if (model.tagline !== undefined) row.tagline = model.tagline;
  if (model.stickerText !== undefined) row.sticker_text = model.stickerText;
  if (model.isVerified !== undefined) row.is_verified = model.isVerified;
  if (model.isPublished !== undefined) row.is_published = model.isPublished;
  if (model.storefrontViews !== undefined) row.storefront_views = model.storefrontViews;
  return row;
}

export function vehicleRowToModel(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    dealershipId: row.dealership_id,
    make: row.make,
    model: row.model,
    year: row.year,
    price: Number(row.price),
    currency: (row.currency === 'ZAR' ? 'ZAR' : 'USD') as CurrencyCode,
    mileageKm: Number(row.mileage_km),
    transmission: (row.transmission as TransmissionType) || 'Automatic',
    fuel: (row.fuel as FuelType) || 'Petrol',
    engineSize: row.engine_size || undefined,
    colour: row.colour || undefined,
    condition: row.condition || undefined,
    dutyStatus: row.duty_status || undefined,
    status: (row.status as VehicleStatus) || 'available',
    description: row.description || '',
    photos: Array.isArray(row.photos) ? row.photos : [],
    features: Array.isArray(row.features) ? row.features : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function vehicleModelToRow(model: Partial<Vehicle>): Partial<VehicleRow> {
  const row: Partial<VehicleRow> = {};
  if (model.id) row.id = model.id;
  if (model.dealershipId) row.dealership_id = model.dealershipId;
  if (model.make !== undefined) row.make = model.make;
  if (model.model !== undefined) row.model = model.model;
  if (model.year !== undefined) row.year = Number(model.year);
  if (model.price !== undefined) row.price = Number(model.price);
  if (model.currency !== undefined) row.currency = model.currency;
  if (model.mileageKm !== undefined) row.mileage_km = Number(model.mileageKm);
  if (model.transmission !== undefined) row.transmission = model.transmission;
  if (model.fuel !== undefined) row.fuel = model.fuel;
  if (model.engineSize !== undefined) row.engine_size = model.engineSize;
  if (model.colour !== undefined) row.colour = model.colour;
  if (model.condition !== undefined) row.condition = model.condition;
  if (model.dutyStatus !== undefined) row.duty_status = model.dutyStatus;
  if (model.status !== undefined) row.status = model.status;
  if (model.description !== undefined) row.description = model.description;
  if (model.photos !== undefined) row.photos = model.photos;
  if (model.features !== undefined) row.features = model.features;
  return row;
}

export function enquiryRowToModel(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    dealershipId: row.dealership_id,
    vehicleId: row.vehicle_id || 'general',
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    buyerEmail: row.buyer_email || undefined,
    message: row.message,
    stage: (row.stage as EnquiryStage) || 'new',
    source: (row.source as 'whatsapp' | 'call' | 'form') || 'whatsapp',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function enquiryModelToRow(model: Partial<Enquiry>): Partial<EnquiryRow> {
  const row: Partial<EnquiryRow> = {};
  if (model.id) row.id = model.id;
  if (model.dealershipId) row.dealership_id = model.dealershipId;
  if (model.vehicleId !== undefined) row.vehicle_id = model.vehicleId === 'general' ? null : model.vehicleId;
  if (model.buyerName !== undefined) row.buyer_name = model.buyerName;
  if (model.buyerPhone !== undefined) row.buyer_phone = model.buyerPhone;
  if (model.buyerEmail !== undefined) row.buyer_email = model.buyerEmail;
  if (model.message !== undefined) row.message = model.message;
  if (model.stage !== undefined) row.stage = model.stage;
  if (model.source !== undefined) row.source = model.source;
  if (model.notes !== undefined) row.notes = model.notes;
  return row;
}

export type SellerType = 'dealership' | 'importer' | 'independent' | 'broker';

export interface OnboardingBrandingState {
  logoFile?: File | null;
  logoPreview?: string | null;
  coverFile?: File | null;
  coverPreview?: string | null;
}

export interface OnboardingState {
  currentStep: number;
  account: {
    businessName: string;
    email: string;
    password: string;
    handle: string;
  };
  sellerType: SellerType;
  showroom: {
    businessName: string;
    handle: string;
    isPublished?: boolean;
  };
  contact: {
    country: 'Zimbabwe' | 'South Africa';
    city: string;
    address: string;
    whatsappCountryCode: string;
    whatsappNumber: string;
    whatsappSameAsPhone: boolean;
    phoneCountryCode: string;
    phoneNumber: string;
    description: string;
  };
  branding: OnboardingBrandingState;
  template: StorefrontTemplate;
  firstVehicle: {
    make: string;
    model: string;
    year: number | '';
    price: number | '';
    currency: CurrencyCode;
    mileageKm: number | '';
    transmission: TransmissionType;
    fuel: FuelType;
    condition: string;
    status: VehicleStatus;
    description: string;
    photos: string[];
    isDraft?: boolean;
    isSkipped?: boolean;
  };
  isCompleted: boolean;
}

