import { supabase } from '../lib/supabase';

export interface LotleNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}
export interface NotificationPreferences {
  daily_summary: boolean;
  new_enquiries: boolean;
  vehicle_reminders: boolean;
  share_reminders: boolean;
  showroom_activity: boolean;
  subscription_reminders: boolean;
  push_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export const notificationService = {
  async list(dealershipId: string, limit = 50): Promise<LotleNotification[]> {
    const { data, error } = await (supabase as any).from('notifications').select('id,category,title,body,data,read_at,created_at')
      .eq('dealership_id', dealershipId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return ((data || []) as LotleNotification[]).filter(row => !Array.isArray(row.data?.channels) || row.data.channels.includes('in_app'));
  },
  async getPreferences(dealershipId: string): Promise<NotificationPreferences> {
    const { data, error } = await (supabase as any).from('notification_preferences').select('*').eq('dealership_id', dealershipId).maybeSingle();
    if (error) throw error;
    return {
      daily_summary: data?.daily_summary ?? true, new_enquiries: data?.new_enquiries ?? true,
      vehicle_reminders: data?.vehicle_reminders ?? true, share_reminders: data?.share_reminders ?? true,
      showroom_activity: data?.showroom_activity ?? true, subscription_reminders: data?.subscription_reminders ?? true,
      push_enabled: data?.push_enabled ?? true,
      quiet_hours_start: data?.quiet_hours_start ?? null,
      quiet_hours_end: data?.quiet_hours_end ?? null,
    };
  },
  async updatePreferences(dealershipId: string, updates: Partial<NotificationPreferences>): Promise<void> {
    const { error } = await (supabase as any).from('notification_preferences')
      .upsert({ dealership_id: dealershipId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'dealership_id' });
    if (error) throw error;
  },
  async notifyPlanLimitReached(dealershipId: string, message: string, limitKey = 'vehicle_limit'): Promise<void> {
    const { data, error } = await supabase.functions.invoke('drivelink-notifications', { body: { action: 'plan_limit_reached', dealershipId, message, limitKey } });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
  },
  async sendTestNotification(dealershipId: string): Promise<{ pushSent: number; pushReady: boolean; deviceCount: number }> {
    const { data, error } = await supabase.functions.invoke('drivelink-notifications', { body: { action: 'test', dealershipId } });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return { pushSent: Number(data?.pushSent || 0), pushReady: Boolean(data?.pushReady), deviceCount: Number(data?.deviceCount || 0) };
  },
  async unreadCount(dealershipId: string): Promise<number> {
    const { data, error } = await (supabase as any).from('notifications').select('id,data')
      .eq('dealership_id', dealershipId).is('read_at', null);
    if (error) throw error;
    return (data || []).filter((row: any) => !Array.isArray(row.data?.channels) || row.data.channels.includes('in_app')).length;
  },
  async getById(id: string): Promise<LotleNotification | null> {
    const { data, error } = await (supabase as any).from('notifications').select('id,category,title,body,data,read_at,created_at').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as LotleNotification | null;
  },
  async unreadEnquiryCount(dealershipId: string): Promise<number> {
    const { count, error } = await (supabase as any).from('notifications').select('id', { count: 'exact', head: true })
      .eq('dealership_id', dealershipId).eq('category', 'enquiry').is('read_at', null);
    if (error) throw error;
    return count || 0;
  },
  async markRead(id: string): Promise<void> {
    const { error } = await (supabase as any).from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  async markAllRead(dealershipId: string): Promise<void> {
    const { error } = await (supabase as any).from('notifications').update({ read_at: new Date().toISOString() })
      .eq('dealership_id', dealershipId).is('read_at', null);
    if (error) throw error;
  },
  async trackShareStarted(dealershipId: string, channel: 'copy' | 'whatsapp' | 'open'): Promise<void> {
    const { error } = await (supabase as any).from('notification_events').insert({
      dealership_id: dealershipId, event_type: 'showroom_share_started', metadata: { channel },
    });
    if (error) throw error;
  },
  isIOSInstallRequired(): boolean {
    if (typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installed = (window.matchMedia?.('(display-mode: standalone)').matches ?? false) || (navigator as any).standalone === true;
    return isIOS && !installed;
  },
  getPermissionState(): NotificationPermission | 'unsupported' {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  },
  isPushSupported(): boolean {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    return !this.isIOSInstallRequired();
  },
  async enablePush(dealershipId: string, requestPermission = true): Promise<void> {
    if (!this.isPushSupported()) throw new Error('This browser does not support Web Push in its current mode.');
    if (!vapidPublicKey) throw new Error('VITE_VAPID_PUBLIC_KEY is not configured in the app environment.');
    let permission = Notification.permission;
    if (permission === 'default' && requestPermission) permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Notification permission was not granted.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('The browser returned an incomplete push subscription.');
    const { error } = await supabase.functions.invoke('drivelink-push-subscriptions', { body: { action: 'upsert', dealershipId, subscription: json, userAgent: navigator.userAgent } });
    if (error) throw error;
    await this.updatePreferences(dealershipId, { push_enabled: true });
  },
  async dismissOnboardingPrompt(dealershipId: string): Promise<void> {
    const { error } = await (supabase as any).from('notification_preferences').upsert({ dealership_id: dealershipId, notifications_prompt_dismissed_at: new Date().toISOString() }, { onConflict: 'dealership_id' });
    if (error) throw error;
  },
  async disablePush(dealershipId: string): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const { error } = await supabase.functions.invoke('drivelink-push-subscriptions', { body: { action: 'delete', dealershipId, endpoint: subscription.endpoint } });
      if (error) throw error;
      await subscription.unsubscribe();
    }
    await this.updatePreferences(dealershipId, { push_enabled: false });
  },
  async isPushEnabled(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    return Boolean(await registration?.pushManager.getSubscription());
  },
};
