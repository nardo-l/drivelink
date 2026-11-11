import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { storageService } from '../../services/storage';
import { notificationService } from '../../services/notificationService';
import { usePwaInstall } from '../../context/PwaInstallContext';

export const NotificationPermissionPrompt: React.FC = () => {
  const { openInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dealershipId, setDealershipId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !isSupabaseConfigured()) return;
    const session = storageService.getUserSession();
    if (!session.isLoggedIn || !session.dealershipId || !notificationService.isPushSupported()) return;
    setDealershipId(session.dealershipId);
    let active = true;
    let checking = false;
    const checkForFirstActivity = async () => {
      if (checking || !active || Notification.permission !== 'default') return;
      checking = true;
      try {
        const { data: prefs } = await (supabase as any).from('notification_preferences')
          .select('notifications_prompt_dismissed_at,contextual_notifications_prompted_at')
          .eq('dealership_id', session.dealershipId).maybeSingle();
        if (!prefs?.notifications_prompt_dismissed_at || prefs.contextual_notifications_prompted_at) return;
        const { data: event } = await (supabase as any).from('notification_events')
          .select('id,occurred_at')
          .eq('dealership_id', session.dealershipId)
          .in('event_type', ['enquiry_created', 'vehicle_created'])
          .gt('occurred_at', prefs.notifications_prompt_dismissed_at)
          .order('occurred_at', { ascending: true }).limit(1).maybeSingle();
        if (!event || !active) return;
        await (supabase as any).from('notification_preferences').update({
          contextual_notifications_prompted_at: new Date().toISOString(),
        }).eq('dealership_id', session.dealershipId);
        if (active) setOpen(true);
      } catch (error) {
        console.warn('Lotlé contextual notification prompt could not be checked', error);
      } finally {
        checking = false;
      }
    };
    void checkForFirstActivity();
    const timer = window.setInterval(() => void checkForFirstActivity(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const enable = async () => {
    if (!dealershipId || busy) return;
    setBusy(true);
    try {
      await notificationService.enablePush(dealershipId, true);
      setOpen(false);
    } catch (error) {
      if (notificationService.getPermissionState() === 'denied') {
        await (supabase as any).from('notification_preferences').update({
          contextual_notifications_prompted_at: new Date().toISOString(),
        }).eq('dealership_id', dealershipId);
        setOpen(false);
      }
    } finally { setBusy(false); }
  };

  const dismiss = () => setOpen(false);
  if (!open) return null;
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="lotle-notification-prompt-title">
      <div className="mb-4 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Bell size={21}/></span><button type="button" onClick={dismiss} aria-label="Close notification prompt" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"><X size={17}/></button></div>
      <h2 id="lotle-notification-prompt-title" className="text-lg font-extrabold text-slate-950">Stay on top of new activity</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Get a notification when a buyer contacts you or your showroom needs attention.</p>
      <button type="button" onClick={()=>{setOpen(false);window.setTimeout(openInstall,250);}} className="mt-3 w-full text-center text-xs font-bold text-slate-700 underline">Install Lotlé</button>
      <button type="button" disabled={busy} onClick={() => void enable()} className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Enabling…' : 'Turn on notifications'}</button>
      <button type="button" onClick={dismiss} className="mt-2 h-10 w-full text-sm font-semibold text-slate-500">Not now</button>
    </section>
  </div>;
};
