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

export const storageService = {
  getDealership(): Dealership {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DEALERSHIP);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    throw new Error('No dealership data is available. Sign in and load your dealership from the server.');
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
    return [];
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
    return [];
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
    // Demo data is only available when there is no live backend.
    // When Supabase is configured, discard any old browser flag so cached demo
    // metrics cannot override the authenticated dealer's live records.
    if (!isSupabaseConfigured()) return true;
    try {
      const hadLegacyDemoFlag = localStorage.getItem(STORAGE_KEYS.DEMO_MODE_ACTIVE) === 'true';
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE_ACTIVE);
      if (hadLegacyDemoFlag) {
        // A demo session must never masquerade as a real Supabase login.
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } catch {
      // ignore storage access failures
    }
    return false;
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
    const newViews = (dealer.storefrontViews || 0) + 1;
    this.updateDealership({ storefrontViews: newViews });
    return newViews;
  },

  getOnboardingState(): OnboardingState {
    const defaultState: OnboardingState = {
      currentStep: 3, // Start with showroom setup; account creation is stage four.
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
        isPublished: true,
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
          currentStep: parsed.isCompleted ? 9 : 3,
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
    if (isSupabaseConfigured()) {
      const dealer = await this.getDealershipAsync();
      const liveUpdated = await supabaseService.updateDealership(dealer.id, partial);
      this.saveDealership(liveUpdated);
      return liveUpdated;
    }

    const updatedLocal = this.updateDealership(partial);
    return updatedLocal;
  },

  async getVehiclesAsync(isPublic: boolean = false): Promise<Vehicle[]> {
    if (isSupabaseConfigured()) {
      // Public storefront routes set the selected published dealership in their route flow.
      // Dealer dashboards must resolve ownership from the authenticated Supabase user.
      const dealer = isPublic ? this.getDealership() : await this.getDealershipAsync();
      const liveVehicles = await supabaseService.getVehicles(dealer.id, isPublic);
      if (!isPublic) this.saveVehicles(liveVehicles);
      return liveVehicles;
    }
    return this.getVehicles();
  },

  async createVehicleAsync(
    vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Vehicle> {
    if (isSupabaseConfigured()) {
      const dealer = await this.getDealershipAsync();
      const liveVehicle = await supabaseService.createVehicle(vehicleData, dealer.id);
      return liveVehicle;
    }
    return this.createVehicle(vehicleData);
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
      const dealer = await this.getDealershipAsync();
      const liveEnquiries = await supabaseService.getEnquiries(dealer.id);
      this.saveEnquiries(liveEnquiries);
      return liveEnquiries;
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
    if (isSupabaseConfigured()) {
      const liveUpdated = await supabaseService.updateEnquiryStage(id, stage, notes);
      this.updateEnquiryStage(id, stage, notes);
      return liveUpdated;
    }
    return this.updateEnquiryStage(id, stage, notes);
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
