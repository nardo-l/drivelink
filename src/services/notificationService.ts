import { supabase } from '../lib/supabase';

export interface DriveLinkNotification {
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
}

const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export const notificationService = {
  async list(dealershipId: string, limit = 50): Promise<DriveLinkNotification[]> {
    const { data, error } = await (supabase as any).from('notifications').select('id,category,title,body,data,read_at,created_at')
      .eq('dealership_id', dealershipId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []) as DriveLinkNotification[];
  },
  async getPreferences(dealershipId: string): Promise<NotificationPreferences> {
    const { data, error } = await (supabase as any).from('notification_preferences').select('*').eq('dealership_id', dealershipId).maybeSingle();
    if (error) throw error;
    return {
      daily_summary: data?.daily_summary ?? true, new_enquiries: data?.new_enquiries ?? true,
      vehicle_reminders: data?.vehicle_reminders ?? true, share_reminders: data?.share_reminders ?? true,
      showroom_activity: data?.showroom_activity ?? true, subscription_reminders: data?.subscription_reminders ?? true,
      push_enabled: data?.push_enabled ?? true,
    };
  },
  async updatePreferences(dealershipId: string, updates: Partial<NotificationPreferences>): Promise<void> {
    const { error } = await (supabase as any).from('notification_preferences')
      .upsert({ dealership_id: dealershipId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'dealership_id' });
    if (error) throw error;
  },
  async unreadCount(dealershipId: string): Promise<number> {
    const { count, error } = await (supabase as any).from('notifications').select('id', { count: 'exact', head: true })
      .eq('dealership_id', dealershipId).is('read_at', null);
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
  async enablePush(dealershipId: string): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support Web Push.');
    if (!vapidPublicKey) throw new Error('VITE_VAPID_PUBLIC_KEY is not configured in the app environment.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    const keys = json.keys;
    if (!json.endpoint || !keys?.p256dh || !keys.auth) throw new Error('The browser returned an incomplete push subscription.');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in again before enabling notifications.');
    const { error } = await (supabase as any).from('push_subscriptions').upsert({
      dealership_id: dealershipId, user_id: user.id, endpoint: json.endpoint, p256dh: keys.p256dh,
      auth: keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    await this.updatePreferences(dealershipId, { push_enabled: true });
  },
  async disablePush(dealershipId: string): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const { error } = await (supabase as any).from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    if (error) throw error;
    await subscription.unsubscribe();
    await this.updatePreferences(dealershipId, { push_enabled: false });
  },
  async isPushEnabled(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    return Boolean(await registration?.pushManager.getSubscription());
  },
};
