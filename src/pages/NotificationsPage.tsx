import { name } from '../config/brand';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, BellOff, CheckCheck, ShieldCheck, Clock3, Send, Loader2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { notificationService, type LotleNotification, type NotificationPreferences } from '../services/notificationService';
import { isSupabaseConfigured } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';

type CategoryKey = 'enquiries' | 'reminders' | 'summaries' | 'account_billing';
const categoryLabel: Record<string, string> = {
  daily_summary: 'Summaries', enquiry: 'Enquiries', inventory: 'Reminders',
  sharing: 'Reminders', showroom: 'Reminders', subscription: 'Account and billing', system: name,
};
const categorySettings: { key: CategoryKey; label: string; description: string; fields: (keyof NotificationPreferences)[] }[] = [
  { key: 'enquiries', label: 'Enquiries', description: 'New buyer enquiries and unanswered-enquiry reminders.', fields: ['new_enquiries'] },
  { key: 'reminders', label: 'Reminders', description: 'Inventory, sharing and showroom reminders.', fields: ['vehicle_reminders', 'share_reminders', 'showroom_activity'] },
  { key: 'summaries', label: 'Summaries', description: 'Your weekly showroom activity summary.', fields: ['daily_summary'] },
  { key: 'account_billing', label: 'Account and billing', description: 'Trial and renewal reminders. Payment confirmations always remain enabled.', fields: ['subscription_reminders'] },
];
const defaults: NotificationPreferences = {
  daily_summary: true, new_enquiries: true, vehicle_reminders: true, share_reminders: true,
  showroom_activity: true, subscription_reminders: true, push_enabled: true,
  quiet_hours_start: null, quiet_hours_end: null,
};

export const NotificationsPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [items, setItems] = useState<LotleNotification[]>([]);
  const [dealershipId, setDealershipId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => notificationService.getPermissionState());
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaults);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('20:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState('');
  const deepLinkHandled = useRef(false);
  const iosInstallRequired = notificationService.isIOSInstallRequired();

  const load = async () => {
    setLoading(true); setError('');
    try {
      const dealer = await storageService.getDealershipAsync();
      setDealershipId(dealer.id);
      const [rows, subscribed, settings] = await Promise.all([
        notificationService.list(dealer.id),
        notificationService.isPushEnabled(),
        notificationService.getPreferences(dealer.id),
      ]);
      setItems(rows);
      setPreferences(settings);
      setPushEnabled(Boolean(subscribed && settings.push_enabled));
      setQuietEnabled(Boolean(settings.quiet_hours_start && settings.quiet_hours_end));
      setQuietStart(settings.quiet_hours_start?.slice(0, 5) || '20:00');
      setQuietEnd(settings.quiet_hours_end?.slice(0, 5) || '07:00');
      setPermission(notificationService.getPermissionState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isSupabaseConfigured()) void load(); else setLoading(false); }, []);

  const togglePush = async () => {
    if (busy || !dealershipId) return;
    if (iosInstallRequired) {
      showToast('Add Lotlé to your Home Screen to get notifications.');
      return;
    }
    if (permission === 'denied') {
      showToast('Notifications are blocked. Change the permission in your browser settings, then return to Lotlé.');
      return;
    }
    setBusy(true);
    try {
      if (pushEnabled) {
        await notificationService.disablePush(dealershipId);
        setPushEnabled(false);
        setPreferences(current => ({ ...current, push_enabled: false }));
        showToast('Push notifications turned off');
      } else {
        await notificationService.enablePush(dealershipId, true);
        setPushEnabled(true);
        setPreferences(current => ({ ...current, push_enabled: true }));
        setPermission(notificationService.getPermissionState());
        showToast('Push notifications turned on');
      }
    } catch (err) {
      setPermission(notificationService.getPermissionState());
      showToast(err instanceof Error ? err.message : 'Could not update push settings');
    } finally { setBusy(false); }
  };

  const categoryEnabled = (key: CategoryKey) => {
    const config = categorySettings.find(item => item.key === key)!;
    return config.fields.every(field => preferences[field] !== false);
  };
  const toggleCategory = async (key: CategoryKey) => {
    const config = categorySettings.find(item => item.key === key)!;
    const enabled = !categoryEnabled(key);
    const patch: Partial<NotificationPreferences> = {};
    config.fields.forEach(field => { (patch as Record<string, unknown>)[field] = enabled; });
    const previous = preferences;
    setPreferences(current => ({ ...current, ...patch }));
    try { await notificationService.updatePreferences(dealershipId, patch); }
    catch {
      setPreferences(previous);
      showToast('Could not save notification preference');
    }
  };

  const saveQuietHours = async () => {
    const patch = quietEnabled
      ? { quiet_hours_start: quietStart, quiet_hours_end: quietEnd }
      : { quiet_hours_start: null, quiet_hours_end: null };
    try {
      await notificationService.updatePreferences(dealershipId, patch);
      setPreferences(current => ({ ...current, ...patch }));
      showToast('Quiet hours saved');
    } catch {
      showToast('Could not save quiet hours');
    }
  };

  const sendTest = async () => {
    if (!dealershipId || testBusy) return;
    setTestBusy(true);
    try {
      const result = await notificationService.sendTestNotification(dealershipId);
      await load();
      showToast(result.pushSent > 0 ? 'Test notification sent to your device' : !result.pushReady ? 'In-app test saved. Server VAPID keys are not configured.' : result.deviceCount === 0 ? 'In-app test saved. This browser has no registered push device.' : 'In-app test saved. Check the notification delivery attempts for the push result.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send test notification');
    } finally { setTestBusy(false); }
  };

  const markAllRead = async () => {
    if (!dealershipId) return;
    try {
      await notificationService.markAllRead(dealershipId);
      setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      window.dispatchEvent(new Event('lotle:notifications-updated'));
    } catch { showToast('Could not mark notifications as read'); }
  };

  const openNotification = async (item: LotleNotification) => {
    if (!item.read_at) {
      try {
        await notificationService.markRead(item.id);
        setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
        window.dispatchEvent(new Event('lotle:notifications-updated'));
      } catch { /* Keep the notification visible if read-state sync fails. */ }
    }
    const target = typeof item.data?.url === 'string' ? item.data.url : item.category === 'enquiry' ? '/app/enquiries' : item.category === 'inventory' ? '/app/vehicles' : '/app/billing';
    navigate(target);
  };

  useEffect(() => {
    const query = window.location.hash.split('?')[1] || window.location.search.slice(1);
    const params = new URLSearchParams(query);
    const ids = (params.get('notificationIds') || params.get('notificationId') || '').split(',').filter(Boolean);
    if (!ids.length || !dealershipId || !items.length || deepLinkHandled.current) return;
    let item = items.find(row => ids.includes(row.id));
    if (!item && ids[0]) void notificationService.getById(ids[0]).then(found => {
      if (found && !deepLinkHandled.current) {
        deepLinkHandled.current = true;
        void notificationService.markRead(found.id).then(() => window.dispatchEvent(new Event('lotle:notifications-updated'))).catch(() => undefined);
        const target = params.get('target') || (typeof found.data?.url === 'string' ? found.data.url : '/app/vehicles/new');
        navigate(target);
      }
    }).catch(() => undefined);
    if (!item) return;
    deepLinkHandled.current = true;
    void (async () => {
      await Promise.all(ids.map(id => notificationService.markRead(id).catch(() => undefined)));
      setItems(current => current.map(row => ids.includes(row.id) ? { ...row, read_at: row.read_at || new Date().toISOString() } : row));
      window.dispatchEvent(new Event('lotle:notifications-updated'));
      const target = params.get('target') || (typeof item.data?.url === 'string' ? item.data.url : '/app/enquiries');
      navigate(target);
    })();
  }, [dealershipId, items, navigate]);

  const permissionLabel = permission === 'granted' && pushEnabled ? 'On' : permission === 'denied' ? 'Blocked' : 'Off';

  return <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/settings')} aria-label="Back to settings" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Lotlé settings</p><h1 className="text-xl font-extrabold tracking-tight">Notifications</h1></div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5 pb-28">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Bell className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="text-sm font-bold">Push notifications</h2><span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + (permissionLabel === 'On' ? 'bg-emerald-50 text-emerald-700' : permissionLabel === 'Blocked' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>{permissionLabel}</span></div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Get important dealership updates when Lotlé is not open.</p>
          </div>
          <button type="button" role="switch" aria-checked={pushEnabled} disabled={busy || !isSupabaseConfigured() || iosInstallRequired || permission === 'denied'} onClick={() => void togglePush()} className={'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ' + (pushEnabled ? 'bg-slate-950' : 'bg-slate-200')}><span className={'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ' + (pushEnabled ? 'translate-x-6' : 'translate-x-1')}/></button>
        </div>
        {iosInstallRequired && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700"><strong>Add Lotlé to your Home Screen to get notifications.</strong><ol className="mt-2 list-decimal space-y-1 pl-4"><li>Open the Share menu in Safari.</li><li>Choose Add to Home Screen.</li><li>Open Lotlé from the new Home Screen icon, then enable notifications here.</li></ol></div>}
        {permission === 'denied' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Notifications are blocked by your browser. Open your browser or device Settings, find Site settings or Website settings, choose Notifications, allow Lotlé, then return here. Lotlé will not ask again while permission remains blocked.</p>}
        {permission === 'unsupported' && !iosInstallRequired && <p className="mt-3 text-xs text-slate-500">This browser does not support web push. Your Lotlé in-app inbox will continue to work.</p>}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Browser permission is controlled by your device.</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">Notification categories</h2>
        <p className="mt-1 text-xs text-slate-500">Choose which updates can be sent to this device and appear in your inbox.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {categorySettings.map(category => (
            <div key={category.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{category.label}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{category.description}</p></div>
              <button type="button" role="switch" aria-checked={categoryEnabled(category.key)} onClick={() => void toggleCategory(category.key)} className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (categoryEnabled(category.key) ? 'bg-slate-950' : 'bg-slate-200')}><span className={'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ' + (categoryEnabled(category.key) ? 'translate-x-6' : 'translate-x-1')}/></button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Payment confirmations are always recorded in your Lotlé inbox, regardless of category preferences.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4"/><h2 className="text-sm font-bold">Quiet hours</h2></div>
        <p className="mt-1 text-xs text-slate-500">Pause push reminders during hours you choose. In-app notifications remain available while push is paused. Scheduled alerts are sent between 07:00 and 20:00 Africa/Harare time.</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold">Enable quiet hours</span>
          <button type="button" role="switch" aria-checked={quietEnabled} onClick={() => setQuietEnabled(value => !value)} className={'relative h-6 w-11 rounded-full ' + (quietEnabled ? 'bg-slate-950' : 'bg-slate-200')}><span className={'absolute top-1 h-4 w-4 rounded-full bg-white shadow ' + (quietEnabled ? 'translate-x-6' : 'translate-x-1')}/></button>
        </div>
        {quietEnabled && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[10px] font-semibold text-slate-500">Start<input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"/></label><label className="text-[10px] font-semibold text-slate-500">End<input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"/></label></div>}
        <button type="button" onClick={() => void saveQuietHours()} className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white">Save quiet hours</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Test notifications</h2><p className="mt-1 text-xs text-slate-500">Enable push to send a real test alert and add a test item to your Lotlé inbox.</p></div><button type="button" disabled={testBusy || !dealershipId || !pushEnabled} onClick={() => void sendTest()} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{testBusy ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}Send me a test notification</button></div>
      </section>

      <div className="flex items-center justify-between px-1"><div><h2 className="text-sm font-bold">Recent activity</h2><p className="text-[11px] text-slate-500">{items.filter(item => !item.read_at).length} unread</p></div><button onClick={() => void markAllRead()} disabled={!items.some(item => !item.read_at)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"><CheckCheck className="h-4 w-4" /> Mark all read</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {loading ? <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div> :
        items.length ? <div className="space-y-2">{items.map(item => <button key={item.id} onClick={() => void openNotification(item)} className={'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-slate-300 ' + (item.read_at ? 'border-slate-200 bg-white' : 'border-slate-300 bg-white shadow-sm')}>
          <span className={'mt-1 h-2 w-2 shrink-0 rounded-full ' + (item.read_at ? 'bg-transparent' : 'bg-slate-900')} />
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{categoryLabel[item.category] || 'Update'}</span><span className="shrink-0 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span></span><span className="mt-1 block text-sm font-bold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.body}</span></span>
        </button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><BellOff className="h-6 w-6 text-slate-500" /></div><h3 className="mt-4 text-sm font-bold">You're all caught up</h3><p className="mt-1 text-xs text-slate-500">New enquiries and dealership activity will appear here.</p></div>}
    </main>
    <BottomNav />
  </div>;
};
