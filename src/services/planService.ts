import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type LotlePlan = 'free' | 'pro';
export type PlanConfig = {
  maxVehicles: number | null;
  maxPhotosPerVehicle: number;
  analyticsCharts: boolean;
  analyticsPeriods: number[];
  showPoweredBy: boolean;
  supportLevel: 'standard' | 'priority';
};
export type PlanSnapshot = {
  plan: LotlePlan;
  pro_trial_ends_at: string | null;
  current_period_end: string | null;
  subscription_status: string | null;
  dealership_id: string | null;
  config: {
    free: PlanConfig;
    pro: PlanConfig;
    sharedFeatures: Record<string, boolean>;
  };
};

const fallbackConfig: PlanSnapshot['config'] = {
  free: { maxVehicles: 3, maxPhotosPerVehicle: 5, analyticsCharts: false, analyticsPeriods: [], showPoweredBy: true, supportLevel: 'standard' },
  pro: { maxVehicles: null, maxPhotosPerVehicle: 10, analyticsCharts: true, analyticsPeriods: [7, 30, 90], showPoweredBy: false, supportLevel: 'priority' },
  sharedFeatures: { showroomLink: true, landingPage: true, logoAndBanner: true, whatsapp: true, enquiries: true, enquiryPushNotifications: true },
};

export const planService = {
  async getMyPlan(): Promise<PlanSnapshot> {
    if (!isSupabaseConfigured()) {
      return { plan: 'free', pro_trial_ends_at: null, current_period_end: null, subscription_status: null, dealership_id: null, config: fallbackConfig };
    }
    const { data, error } = await supabase.rpc('get_my_plan' as any);
    if (error) {
      console.error('[Lotle plan] Could not load plan snapshot', { code: error.code, message: error.message, details: error.details });
      throw error;
    }
    const value = data as Partial<PlanSnapshot> | null;
    return {
      plan: value?.plan === 'pro' ? 'pro' : 'free',
      pro_trial_ends_at: value?.pro_trial_ends_at || null,
      current_period_end: value?.current_period_end || null,
      subscription_status: value?.subscription_status || null,
      dealership_id: value?.dealership_id || null,
      config: value?.config || fallbackConfig,
    };
  },

  async getPublicPlan(dealershipId: string): Promise<Pick<PlanSnapshot, 'plan' | 'config'>> {
    if (!isSupabaseConfigured()) return { plan: 'free', config: fallbackConfig };
    const { data, error } = await supabase.rpc('get_public_dealership_plan' as any, { p_dealership_id: dealershipId } as any);
    if (error) throw error;
    const value = data as { plan?: string; config?: PlanSnapshot['config'] } | null;
    return { plan: value?.plan === 'pro' ? 'pro' : 'free', config: value?.config || fallbackConfig };
  },
};
