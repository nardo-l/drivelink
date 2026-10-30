import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, BellOff, CheckCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { notificationService, DriveLinkNotification, NotificationPreferences } from '../services/notificationService';
import { isSupabaseConfigured } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';

const categoryLabel: Record<string, string> = {
  daily_summary: 'Daily summary', enquiry: 'Buyer enquiry', inventory: 'Inventory',
  sharing: 'Showroom sharing', showroom: 'Showroom activity', subscription: 'Subscription', system: 'DriveLink',
};

export const NotificationsPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [items, setItems] = useState<DriveLinkNotification[]>([]);
  const [dealershipId, setDealershipId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);\n  const [preferences, setPreferences] = useState<NotificationPreferences>({ daily_summary: true, new_enquiries: true, vehicle_reminders: true, share_reminders: true, showroom_activity: true, subscription_reminders: true, push_enabled: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const dealer = await storageService.getDealershipAsync();
      setDealershipId(dealer.id);
      const [rows, enabled] = await Promise.all([notificationService.list(dealer.id), notificationService.isPushEnabled()]);
      setItems(rows); setPushEnabled(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isSupabaseConfigured()) void load(); else setLoading(false); }, []);

  const togglePush = async () => {
    if (busy || !dealershipId) return;
    setBusy(true);
    try {
      if (pushEnabled) { await notificationService.disablePush(); setPushEnabled(false); showToast('Push notifications disabled'); }
      else { await notificationService.enablePush(dealershipId); setPushEnabled(true); showToast('Push notifications enabled'); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Could not update push settings'); }
    finally { setBusy(false); }
  };

  const togglePreference = async (key: keyof NotificationPreferences) => {\n    const next = { ...preferences, [key]: !preferences[key] };\n    setPreferences(next);\n    try { await notificationService.updatePreferences(dealershipId, { [key]: next[key] }); }\n    catch { setPreferences(preferences); showToast('Could not save notification preference'); }\n  };\n\n  const markAllRead = async () => {
    if (!dealershipId) return;
    try { await notificationService.markAllRead(dealershipId); setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() }))); }
    catch { showToast('Could not mark notifications as read'); }
  };

  const openNotification = async (item: DriveLinkNotification) => {
    if (!item.read_at) {
      try { await notificationService.markRead(item.id); setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)); }
      catch { /* Keep notification visible even if marking read fails. */ }
    }
    const target = typeof item.data?.url === 'string' ? item.data.url : item.category === 'enquiry' ? '/app/enquiries' : item.category === 'inventory' ? '/app/vehicles' : '';
    if (target) navigate(target);
  };

  return <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col">
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app')} aria-label="Back to dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Your activity</p><h1 className="text-xl font-extrabold tracking-tight">Notifications</h1></div>
        <button onClick={() => void load()} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
    </header>
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5 pb-28">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Bell className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Browser notifications</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Get important dealership updates even when DriveLink is closed. Your browser will ask for permission.</p></div>
          <button disabled={busy || !isSupabaseConfigured()} onClick={() => void togglePush()} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold disabled:opacity-50 ${pushEnabled ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-white'}`}>{busy ? '…' : pushEnabled ? 'Disable' : 'Enable'}</button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Push permission is controlled by your browser.</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">What should DriveLink notify you about?</h2>
        <p className="mt-1 text-xs text-slate-500">Choose which updates appear in your inbox and can be sent as push alerts.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {([
            ['daily_summary', 'Daily dealership summary', 'A 7 PM overview of views, enquiries and inventory.'],
            ['new_enquiries', 'Buyer enquiries', 'New leads and follow-up reminders.'],
            ['vehicle_reminders', 'Add vehicles', 'Reminders when your showroom needs more inventory.'],
            ['share_reminders', 'Share showroom link', 'Gentle reminders to share your public showroom.'],
            ['showroom_activity', 'Showroom activity', 'Vehicle sold and important showroom milestones.'],
            ['subscription_reminders', 'Subscription updates', 'Trial, renewal and expiry reminders.'],
          ] as [keyof NotificationPreferences, string, string][]).map(([key, label, description]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{label}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{description}</p></div>
              <button type="button" role="switch" aria-checked={preferences[key]} onClick={() => void togglePreference(key)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${preferences[key] ? 'bg-slate-950' : 'bg-slate-200'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${preferences[key] ? 'translate-x-6' : 'translate-x-1'}`} /></button>
            </div>
          ))}
        </div>
      </section>
      <div className="flex items-center justify-between px-1"><div><h2 className="text-sm font-bold">Recent activity</h2><p className="text-[11px] text-slate-500">{items.filter(item => !item.read_at).length} unread</p></div><button onClick={() => void markAllRead()} disabled={!items.some(item => !item.read_at)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"><CheckCheck className="h-4 w-4" /> Mark all read</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {loading ? <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div> :
        items.length ? <div className="space-y-2">{items.map(item => <button key={item.id} onClick={() => void openNotification(item)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-slate-300 ${item.read_at ? 'border-slate-200 bg-white' : 'border-slate-300 bg-white shadow-sm'}`}>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-indigo-600'}`} />
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{categoryLabel[item.category] || 'Update'}</span><span className="shrink-0 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span></span><span className="mt-1 block text-sm font-bold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.body}</span></span>
        </button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><BellOff className="h-6 w-6 text-slate-500" /></div><h3 className="mt-4 text-sm font-bold">You're all caught up</h3><p className="mt-1 text-xs text-slate-500">New enquiries and dealership activity will appear here.</p></div>}
    </main>
    <BottomNav />
  </div>;
};
