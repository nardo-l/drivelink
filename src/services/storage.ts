import { Dealership, Enquiry, UserSession, Vehicle, VehicleStatus, EnquiryStage, OnboardingState, SellerType } from '../types';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  CAR_AQUA_WHITE,
  CAR_FIT_NAVY,
  CAR_CX5_RED,
  CAR_RAV4_SILVER,
  CAR_RANGER_WHITE,
  CAR_MERC_BLACK,
  CAR_INTERIOR_SHOT,
  CAR_REAR_SHOT,
  DEFAULT_DEALER_LOGO,
  DEFAULT_STOREFRONT_COVER,
} from '../utils/carVisuals';

const STORAGE_KEYS = {
  DEALERSHIP: 'drivelink_dealership_v1',
  VEHICLES: 'drivelink_vehicles_v1',
  ENQUIRIES: 'drivelink_enquiries_v1',
  SESSION: 'drivelink_session_v1',
  ONBOARDING: 'drivelink_onboarding_v1',
  DEMO_MODE_ACTIVE: 'drivelink_demo_active_v1',
};

const INITIAL_DEALERSHIP: Dealership = {
  id: 'dealer-1',
  name: 'Prime Motors',
  slug: 'prime-motors',
  tagline: 'Quality vehicles. Fair prices.',
  bio: 'Quality vehicles. Fair prices. A better way to buy cars, people, and a smoother journey.',
  stickerText: 'Good cars brighter days',
  country: 'Zimbabwe',
  city: 'Harare · Borrowdale',
  address: '14 Enterprise Road, Newlands, Harare',
  phone: '+263 77 245 8891',
  whatsapp: '+263772458891',
  email: 'dealer@primemotors.co.zw',
  currency: 'USD',
  template: 'signature',
  logoUrl: DEFAULT_DEALER_LOGO,
  coverUrl: DEFAULT_STOREFRONT_COVER,
  isVerified: true,
  storefrontViews: 1892,
  totalEnquiries: 12,
};

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-1',
    dealershipId: 'dealer-1',
    make: 'Toyota',
    model: 'Aqua',
    year: 2019,
    price: 15990,
    currency: 'USD',
    mileageKm: 68000,
    transmission: 'Automatic',
    fuel: 'Hybrid',
    engineSize: '1.5 L',
    colour: 'Pearl White',
    condition: 'Ex-Japan Import',
    dutyStatus: 'Duty Paid & Registered',
    status: 'available',
    description: 'Well looked after Toyota Aqua with excellent fuel economy. A reliable and practical hybrid, perfect for city driving. Fresh import from Yokohama, immaculate condition with full service history and reverse camera.',
    photos: [CAR_AQUA_WHITE, CAR_REAR_SHOT, CAR_INTERIOR_SHOT],
    features: ['Push Start', 'Reverse Camera', 'Lane Assist', 'Bluetooth Audio', 'Keyless Entry', 'Eco Mode'],
    createdAt: '2026-03-10T08:00:00Z',
    updatedAt: '2026-03-10T08:00:00Z',
  },
  {
    id: 'veh-2',
    dealershipId: 'dealer-1',
    make: 'Honda',
    model: 'Fit',
    year: 2021,
    price: 17990,
    currency: 'USD',
    mileageKm: 42000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    engineSize: '1.3 L',
    colour: 'Midnight Navy',
    condition: 'Ex-Japan Import',
    dutyStatus: 'Duty Paid & Zimra Cleared',
    status: 'reserved',
    description: 'Modern 4th gen Honda Fit GR model. Spacious Magic Seats interior, digital cockpit display, LED headlights, and exceptional fuel efficiency. Currently reserved under deposit.',
    photos: [CAR_FIT_NAVY, CAR_INTERIOR_SHOT, CAR_REAR_SHOT],
    features: ['Digital Dashboard', 'Apple CarPlay', 'Honda Sensing', 'Alloy Wheels', 'Magic Seats'],
    createdAt: '2026-03-08T11:20:00Z',
    updatedAt: '2026-03-09T14:10:00Z',
  },
  {
    id: 'veh-3',
    dealershipId: 'dealer-1',
    make: 'Mazda',
    model: 'CX-5',
    year: 2020,
    price: 28990,
    currency: 'USD',
    mileageKm: 54000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    engineSize: '2.5 L',
    colour: 'Soul Red Crystal',
    condition: 'Local Pre-Owned',
    dutyStatus: 'Duty Paid & Registered',
    status: 'sold',
    description: 'Stunning Mazda CX-5 finished in the signature Soul Red Crystal. Full leather upholstery, Bose premium audio, sunroof, and heads-up display. Successfully delivered to customer.',
    photos: [CAR_CX5_RED, CAR_INTERIOR_SHOT, CAR_REAR_SHOT],
    features: ['Bose Sound System', 'Head-Up Display', 'Power Tailgate', 'Leather Seats', 'Sunroof'],
    createdAt: '2026-03-01T09:30:00Z',
    updatedAt: '2026-03-11T16:00:00Z',
  },
  {
    id: 'veh-4',
    dealershipId: 'dealer-1',
    make: 'Toyota',
    model: 'RAV4',
    year: 2022,
    price: 36990,
    currency: 'USD',
    mileageKm: 52000,
    transmission: 'Automatic',
    fuel: 'Hybrid',
    engineSize: '2.5 L',
    colour: 'Silver Metallic',
    condition: 'Ex-Japan Import',
    dutyStatus: 'Duty Paid & Registered',
    status: 'available',
    description: 'Rugged, economical 2022 Toyota RAV4 E-Four AWD Hybrid. Dual climate control, Toyota Safety Sense 2.0, robust all-weather capability, and roomy trunk for family trips.',
    photos: [CAR_RAV4_SILVER, CAR_INTERIOR_SHOT, CAR_REAR_SHOT],
    features: ['AWD E-Four', 'Adaptive Cruise', 'Blind Spot Monitor', 'Roof Rails', 'Wireless Charging'],
    createdAt: '2026-03-11T12:00:00Z',
    updatedAt: '2026-03-11T12:00:00Z',
  },
  {
    id: 'veh-5',
    dealershipId: 'dealer-1',
    make: 'Ford',
    model: 'Ranger 2.0 Wildtrak',
    year: 2021,
    price: 42500,
    currency: 'USD',
    mileageKm: 38000,
    transmission: 'Automatic',
    fuel: 'Diesel',
    engineSize: '2.0 L Bi-Turbo',
    colour: 'Glacier White',
    condition: 'Ex-South Africa',
    dutyStatus: 'Duty Paid',
    status: 'available',
    description: 'Tough and capable Ford Ranger Wildtrak 4x4 Double Cab. 10-speed automatic gearbox, roller shutter, tow bar, side steps, and SYNC3 touchscreen with navigation.',
    photos: [CAR_RANGER_WHITE, CAR_INTERIOR_SHOT, CAR_REAR_SHOT],
    features: ['4x4 Terrain Selector', 'Roller Shutter', 'Tow Bar', 'Leather Trim', 'Reverse Camera'],
    createdAt: '2026-03-12T09:00:00Z',
    updatedAt: '2026-03-12T09:00:00Z',
  },
  {
    id: 'veh-6',
    dealershipId: 'dealer-1',
    make: 'Mercedes-Benz',
    model: 'C200 AMG Line',
    year: 2020,
    price: 33500,
    currency: 'USD',
    mileageKm: 49000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    engineSize: '1.5 L Turbo',
    colour: 'Obsidian Black',
    condition: 'UK Import',
    dutyStatus: 'Duty Paid & Registered',
    status: 'available',
    description: 'Executive sedan with full AMG styling package. Panoramic glass roof, ambient interior lighting (64 colors), diamond grille, and sport suspension.',
    photos: [CAR_MERC_BLACK, CAR_INTERIOR_SHOT, CAR_REAR_SHOT],
    features: ['AMG Line Body Styling', 'Panoramic Sunroof', '64-Color Ambient Light', 'Burmester Audio'],
    createdAt: '2026-03-12T14:30:00Z',
    updatedAt: '2026-03-12T14:30:00Z',
  },
];

const INITIAL_ENQUIRIES: Enquiry[] = [
  {
    id: 'enq-1',
    dealershipId: 'dealer-1',
    vehicleId: 'veh-1',
    buyerName: 'Tendai Moyo',
    buyerPhone: '+263 77 412 9001',
    buyerEmail: 'tendai.moyo@gmail.com',
    message: 'Hello, is the 2019 Toyota Aqua still available for viewing tomorrow in Borrowdale?',
    stage: 'new',
    source: 'whatsapp',
    notes: 'Interested in paying cash USD. Requested test drive at 10 AM.',
    createdAt: '2026-03-12T07:15:00Z',
    updatedAt: '2026-03-12T07:15:00Z',
  },
  {
    id: 'enq-2',
    dealershipId: 'dealer-1',
    vehicleId: 'veh-2',
    buyerName: 'Sipho Ndlovu',
    buyerPhone: '+27 83 234 5678',
    buyerEmail: 'sipho@ndlovu-group.co.za',
    message: 'I am ready to deposit on the Honda Fit. Can you hold it until Friday?',
    stage: 'negotiating',
    source: 'whatsapp',
    notes: 'Deposit paid $1,000 via transfer. Balance due on inspection.',
    createdAt: '2026-03-11T16:20:00Z',
    updatedAt: '2026-03-12T08:00:00Z',
  },
  {
    id: 'enq-3',
    dealershipId: 'dealer-1',
    vehicleId: 'veh-4',
    buyerName: 'Tinashe Marange',
    buyerPhone: '+263 71 889 1234',
    message: 'Interested in the 2022 RAV4 Hybrid. Does the price include Zimra duty and plates?',
    stage: 'contacted',
    source: 'call',
    notes: 'Confirmed duty is fully paid. Sent spec sheet and warranty booklet on WhatsApp.',
    createdAt: '2026-03-10T11:45:00Z',
    updatedAt: '2026-03-10T14:30:00Z',
  },
  {
    id: 'enq-4',
    dealershipId: 'dealer-1',
    vehicleId: 'veh-3',
    buyerName: 'Farai Chidzero',
    buyerPhone: '+263 78 554 2210',
    message: 'Purchased Mazda CX-5. Handover completed.',
    stage: 'sold',
    source: 'form',
    notes: 'Full payment received. Customer thrilled with the Soul Red finish.',
    createdAt: '2026-03-05T09:10:00Z',
    updatedAt: '2026-03-11T15:30:00Z',
  },
];

export const storageService = {
  getDealership(): Dealership {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DEALERSHIP);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    this.saveDealership(INITIAL_DEALERSHIP);
    return INITIAL_DEALERSHIP;
  },

  saveDealership(dealership: Dealership): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DEALERSHIP, JSON.stringify(dealership));
    } catch {
      // ignore
    }
  },

  updateDealership(partial: Partial<Dealership>): Dealership {
    const current = this.getDealership();
    const updated = { ...current, ...partial };
    this.saveDealership(updated);
    return updated;
  },

  getVehicles(): Vehicle[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    this.saveVehicles(INITIAL_VEHICLES);
    return INITIAL_VEHICLES;
  },

  saveVehicles(vehicles: Vehicle[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    } catch {
      // ignore
    }
  },

  getVehicleById(id: string): Vehicle | undefined {
    return this.getVehicles().find((v) => v.id === id);
  },

  createVehicle(vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
    const vehicles = this.getVehicles();
    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `veh-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newVehicle, ...vehicles];
    this.saveVehicles(updated);
    return newVehicle;
  },

  updateVehicle(id: string, updates: Partial<Vehicle>): Vehicle | undefined {
    const vehicles = this.getVehicles();
    const index = vehicles.findIndex((v) => v.id === id);
    if (index === -1) return undefined;
    const updatedVehicle: Vehicle = {
      ...vehicles[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    vehicles[index] = updatedVehicle;
    this.saveVehicles(vehicles);
    return updatedVehicle;
  },

  deleteVehicle(id: string): boolean {
    const vehicles = this.getVehicles();
    const filtered = vehicles.filter((v) => v.id !== id);
    if (filtered.length !== vehicles.length) {
      this.saveVehicles(filtered);
      return true;
    }
    return false;
  },

  changeVehicleStatus(id: string, status: VehicleStatus): Vehicle | undefined {
    return this.updateVehicle(id, { status });
  },

  getEnquiries(): Enquiry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ENQUIRIES);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    this.saveEnquiries(INITIAL_ENQUIRIES);
    return INITIAL_ENQUIRIES;
  },

  saveEnquiries(enquiries: Enquiry[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
    } catch {
      // ignore
    }
  },

  createEnquiry(enquiryData: Omit<Enquiry, 'id' | 'createdAt' | 'updatedAt'>): Enquiry {
    const enquiries = this.getEnquiries();
    const newEnquiry: Enquiry = {
      ...enquiryData,
      id: `enq-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveEnquiries([newEnquiry, ...enquiries]);

    // Update dealership counter
    const dealer = this.getDealership();
    this.updateDealership({ totalEnquiries: (dealer.totalEnquiries || 0) + 1 });
    return newEnquiry;
  },

  updateEnquiryStage(id: string, stage: EnquiryStage, notes?: string): Enquiry | undefined {
    const enquiries = this.getEnquiries();
    const index = enquiries.findIndex((e) => e.id === id);
    if (index === -1) return undefined;
    const updated: Enquiry = {
      ...enquiries[index],
      stage,
      notes: notes !== undefined ? notes : enquiries[index].notes,
      updatedAt: new Date().toISOString(),
    };
    enquiries[index] = updated;
    this.saveEnquiries(enquiries);
    return updated;
  },

  isDemoModeActive(): boolean {
    if (!isSupabaseConfigured()) return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.DEMO_MODE_ACTIVE) === 'true';
    } catch {
      return false;
    }
  },

  setDemoModeActive(active: boolean): void {
    try {
      if (active) {
        localStorage.setItem(STORAGE_KEYS.DEMO_MODE_ACTIVE, 'true');
        this.setUserSession({
          isLoggedIn: true,
          email: 'demo@primemotors.co.zw',
          dealershipId: 'dealer-1',
        });
      } else {
        localStorage.removeItem(STORAGE_KEYS.DEMO_MODE_ACTIVE);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } catch {
      // ignore
    }
  },

  getUserSession(): UserSession {
    if (this.isDemoModeActive()) {
      return {
        isLoggedIn: true,
        email: 'demo@primemotors.co.zw',
        dealershipId: 'dealer-1',
      };
    }

    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed.isLoggedIn === 'boolean') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // Default to unauthenticated when Supabase backend is configured
    return {
      isLoggedIn: false,
      email: '',
      dealershipId: '',
    };
  },

  setUserSession(session: UserSession): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } catch {
      // ignore
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch {
      // ignore
    }
  },

  incrementViews(): number {
    const dealer = this.getDealership();
    const newViews = (dealer.storefrontViews || 1892) + 1;
    this.updateDealership({ storefrontViews: newViews });
    return newViews;
  },

  getOnboardingState(): OnboardingState {
    const defaultState: OnboardingState = {
      currentStep: 1, // 1 to 8 (Account, Type, Name/URL, Contact, Branding, Template, Vehicle, Preview)
      account: {
        businessName: '',
        email: '',
        password: '',
        handle: '',
      },
      sellerType: 'dealership',
      showroom: {
        businessName: '',
        handle: '',
      },
      contact: {
        country: 'Zimbabwe',
        city: '',
        address: '',
        whatsappCountryCode: '+263',
        whatsappNumber: '',
        whatsappSameAsPhone: true,
        phoneCountryCode: '+263',
        phoneNumber: '',
        description: '',
      },
      branding: {
        logoFile: null,
        logoPreview: null,
        coverFile: null,
        coverPreview: null,
      },
      template: 'signature',
      firstVehicle: {
        make: '',
        model: '',
        year: '',
        price: '',
        currency: 'USD',
        mileageKm: '',
        transmission: 'Automatic',
        fuel: 'Petrol',
        condition: 'Excellent',
        status: 'available',
        description: '',
        photos: [],
        isDraft: false,
        isSkipped: true,
      },
      isCompleted: false,
    };

    try {
      const data = localStorage.getItem(STORAGE_KEYS.ONBOARDING);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...defaultState,
          ...parsed,
          account: {
            ...defaultState.account,
            ...(parsed.account || {}),
          },
          showroom: {
            ...defaultState.showroom,
            ...(parsed.showroom || {}),
          },
          contact: {
            ...defaultState.contact,
            ...(parsed.contact || {}),
          },
          branding: {
            ...defaultState.branding,
            ...(parsed.branding || {}),
            logoFile: null,
            coverFile: null,
          },
          firstVehicle: {
            ...defaultState.firstVehicle,
            ...(parsed.firstVehicle || {}),
          },
        };
      }
    } catch {
      // ignore
    }
    return defaultState;
  },

  clearOnboardingState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
    } catch {
      // ignore
    }
  },

  saveOnboardingState(state: OnboardingState): void {
    try {
      // Avoid storing temporary blob: URLs or oversized strings in localStorage that exceed browser quota
      const safeLogo =
        state.branding?.logoPreview &&
        !state.branding.logoPreview.startsWith('blob:') &&
        state.branding.logoPreview.length < 500000
          ? state.branding.logoPreview
          : null;
      const safeCover =
        state.branding?.coverPreview &&
        !state.branding.coverPreview.startsWith('blob:') &&
        state.branding.coverPreview.length < 500000
          ? state.branding.coverPreview
          : null;

      const serializableState = {
        ...state,
        branding: {
          logoPreview: safeLogo,
          coverPreview: safeCover,
        },
      };
      localStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(serializableState));
    } catch (e) {
      console.warn('localStorage saveOnboardingState error:', e);
    }
  },

  updateOnboardingState(partial: Partial<OnboardingState>): OnboardingState {
    const current = this.getOnboardingState();
    const updated = { ...current, ...partial };
    this.saveOnboardingState(updated);
    return updated;
  },

  resetOnboarding(): void {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
  },

  isSupabaseMode(): boolean {
    return isSupabaseConfigured();
  },

  // ---------------------------------------------------------------------------
  // ASYNC SUPABASE-AWARE METHODS
  // ---------------------------------------------------------------------------
  async getDealershipAsync(): Promise<Dealership> {
    if (isSupabaseConfigured()) {
      const liveDealer = await supabaseService.getCurrentDealership();
      if (!liveDealer) {
        throw new Error('No dealership is linked to the signed-in account. Complete dealership onboarding first.');
      }
      this.saveDealership(liveDealer);
      return liveDealer;
    }
    return this.getDealership();
  },

  async updateDealershipAsync(partial: Partial<Dealership>): Promise<Dealership> {
    const updatedLocal = this.updateDealership(partial);
    if (isSupabaseConfigured() && updatedLocal.id) {
      try {
        const liveUpdated = await supabaseService.updateDealership(updatedLocal.id, partial);
        this.saveDealership(liveUpdated);
        return liveUpdated;
      } catch (err) {
        console.error('Failed to sync dealership update to Supabase:', err);
      }
    }
    return updatedLocal;
  },

  async getVehiclesAsync(isPublic: boolean = false): Promise<Vehicle[]> {
    if (isSupabaseConfigured()) {
      // Never use cached/demo inventory for an authenticated production session.
      if (isPublic) {
        throw new Error('Public vehicle loading must resolve a published dealership before querying inventory.');
      }
      const dealer = await this.getDealershipAsync();
      const liveVehicles = await supabaseService.getVehicles(dealer.id, false);
      this.saveVehicles(liveVehicles);
      return liveVehicles;
    }
    return this.getVehicles();
  },

  async createVehicleAsync(
    vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Vehicle> {
    const localVehicle = this.createVehicle(vehicleData);
    if (isSupabaseConfigured()) {
      try {
        const dealer = this.getDealership();
        const liveVehicle = await supabaseService.createVehicle(vehicleData, dealer.id);
        // Replace temporary local vehicle with persisted row
        const currentVehicles = this.getVehicles().filter((v) => v.id !== localVehicle.id);
        this.saveVehicles([liveVehicle, ...currentVehicles]);
        return liveVehicle;
      } catch (err) {
        console.error('Failed to persist vehicle to Supabase:', err);
      }
    }
    return localVehicle;
  },

  async updateVehicleAsync(id: string, updates: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const localUpdated = this.updateVehicle(id, updates);
    if (isSupabaseConfigured()) {
      try {
        const liveUpdated = await supabaseService.updateVehicle(id, updates);
        return liveUpdated;
      } catch (err) {
        console.error('Failed to update vehicle in Supabase:', err);
      }
    }
    return localUpdated;
  },

  async deleteVehicleAsync(id: string): Promise<boolean> {
    const localDeleted = this.deleteVehicle(id);
    if (isSupabaseConfigured()) {
      try {
        await supabaseService.deleteVehicle(id);
      } catch (err) {
        console.error('Failed to delete vehicle from Supabase:', err);
      }
    }
    return localDeleted;
  },

  async getEnquiriesAsync(): Promise<Enquiry[]> {
    if (isSupabaseConfigured()) {
      try {
        const dealer = this.getDealership();
        const liveEnquiries = await supabaseService.getEnquiries(dealer.id);
        if (liveEnquiries && liveEnquiries.length > 0) {
          this.saveEnquiries(liveEnquiries);
          return liveEnquiries;
        }
      } catch (err) {
        console.warn('Falling back to local enquiries data:', err);
      }
    }
    return this.getEnquiries();
  },

  async createEnquiryAsync(
    enquiryData: Omit<Enquiry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Enquiry> {
    const localEnquiry = this.createEnquiry(enquiryData);
    if (isSupabaseConfigured()) {
      try {
        const liveEnquiry = await supabaseService.createEnquiry(enquiryData);
        return liveEnquiry;
      } catch (err) {
        console.error('Failed to submit enquiry to Supabase:', err);
      }
    }
    return localEnquiry;
  },

  async updateEnquiryStageAsync(
    id: string,
    stage: EnquiryStage,
    notes?: string
  ): Promise<Enquiry | undefined> {
    const localUpdated = this.updateEnquiryStage(id, stage, notes);
    if (isSupabaseConfigured()) {
      try {
        const liveUpdated = await supabaseService.updateEnquiryStage(id, stage, notes);
        return liveUpdated;
      } catch (err) {
        console.error('Failed to update enquiry stage in Supabase:', err);
      }
    }
    return localUpdated;
  },

  async incrementViewsAsync(dealershipId: string): Promise<number> {
    const newViews = this.incrementViews();
    if (isSupabaseConfigured()) {
      try {
        await supabaseService.incrementStorefrontViews(dealershipId);
      } catch (err) {
        console.error('Failed to increment views on Supabase:', err);
      }
    }
    return newViews;
  },

  resetToDemo(): void {
    localStorage.removeItem(STORAGE_KEYS.DEALERSHIP);
    localStorage.removeItem(STORAGE_KEYS.VEHICLES);
    localStorage.removeItem(STORAGE_KEYS.ENQUIRIES);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
  },
};
