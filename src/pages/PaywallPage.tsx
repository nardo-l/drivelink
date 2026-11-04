import React from 'react';
import { Check, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import { storageService } from '../services/storage';

type Plan = 'monthly' | 'yearly';

export const PaywallPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [plan, setPlan] = React.useState<Plan>('yearly');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [checkoutId, setCheckoutId] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    const query = window.location.hash.split('?')[1] || window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(query);
    const checkout = params.get('checkout');
    if (checkout) setCheckoutId(checkout);
  }, []);

  const refreshAccess = React.useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('drivelink-payments', { body: { action: 'status' } });
      if (error) throw error;
      const subscription = data?.subscription;
      const now = Date.now();
      const trialValid = subscription?.status === 'trial' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now;
      const paidValid = subscription?.status === 'active' && subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > now;
      if (trialValid || paidValid) {
        navigate('/app');
        return true;
      }
      setMessage('No active subscription was found yet. If you have just paid, allow a moment for NardoPay to confirm it, then check again.');
      return false;
    } catch (error: any) {
      setMessage(error?.message || 'We could not verify your subscription. Please try again.');
      return false;
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  const checkCheckout = React.useCallback(async () => {
    if (!checkoutId) return;
    setChecking(true);
    setMessage('Checking your NardoPay payment…');
    try {
      const { data, error } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'check', checkout_id: checkoutId },
      });
      if (error) throw error;
      if (data?.paid || data?.status === 'completed') {
        setMessage('Payment confirmed. Restoring your DriveLink access…');
        await refreshAccess();
      } else if (data?.status === 'failed' || data?.status === 'cancelled') {
        setMessage('That payment was not completed. You can try again when ready.');
      } else {
        setMessage('Payment is still pending. Your account will unlock as soon as NardoPay confirms it.');
      }
    } catch (error: any) {
      setMessage(error?.message || 'We could not confirm the payment yet. Please try again shortly.');
    } finally {
      setChecking(false);
    }
  }, [checkoutId, refreshAccess]);

  React.useEffect(() => {
    if (checkoutId) void checkCheckout();
  }, [checkoutId, checkCheckout]);

  const subscribe = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'initiate', plan_code: plan },
      });
      if (error) throw error;
      if (!data?.url || !/^https:\/\//i.test(data.url)) throw new Error(data?.error || 'NardoPay did not return a secure checkout link.');
      window.location.assign(data.url);
    } catch (error: any) {
      setMessage(error?.message || 'We could not start your payment. Please try again.');
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await supabaseService.signOut();
    } finally {
      storageService.clearSession();
      navigate('/login');
      setBusy(false);
    }
  };

  const features = [
    'Your dealership showroom and public link',
    'Vehicle inventory, photos and listings',
    'Buyer enquiries and lead management',
    'Analytics, notifications and store settings',
  ];

  return (
    <main className="min-h-[100dvh] w-full bg-[#F7F8FA] px-4 py-8 text-slate-950 flex items-center justify-center">
      <section className="w-full max-w-[440px] rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <LockKeyhole size={22} />
        </div>
        <p className="text-center text-[10px] font-extrabold tracking-[0.2em] text-slate-400">DRIVE LINK PRO</p>
        <h1 className="mt-2 text-center text-[27px] font-black tracking-tight">Your free trial has ended</h1>
        <p className="mx-auto mt-2 max-w-[330px] text-center text-sm leading-6 text-slate-500">
          Subscribe to unlock your dealership workspace and continue where you left off.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setPlan('monthly')} className={`rounded-2xl border p-4 text-left ${plan === 'monthly' ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 bg-white'}`}>
            <span className="text-xs font-semibold text-slate-500">Monthly</span>
            <strong className="mt-1 block text-[27px] font-black">$3.99</strong>
            <span className="text-[11px] text-slate-500">Every 30 days</span>
          </button>
          <button type="button" onClick={() => setPlan('yearly')} className={`relative rounded-2xl border p-4 text-left ${plan === 'yearly' ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 bg-white'}`}>
            <span className="absolute -top-2.5 right-3 rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-extrabold text-white">BEST VALUE</span>
            <span className="text-xs font-semibold text-slate-500">Yearly</span>
            <strong className="mt-1 block text-[27px] font-black">$32</strong>
            <span className="text-[11px] text-slate-500">12 months · Save 33%</span>
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-extrabold">Everything you’ve built stays safe</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Your data is kept intact while your workspace is locked.</p>
          <ul className="mt-3 space-y-2.5">
            {features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs text-slate-700"><Check size={15} className="mt-0.5 shrink-0 text-slate-950" />{feature}</li>)}
          </ul>
        </div>

        {message && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{message}</div>}

        <button type="button" onClick={subscribe} disabled={busy || checking} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
          {busy ? 'Connecting to NardoPay…' : 'Subscribe now'}
        </button>
        {checkoutId && <button type="button" onClick={checkCheckout} disabled={checking} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">
          {checking && <Loader2 size={14} className="animate-spin" />} {checking ? 'Checking payment…' : "I've paid — check my payment"}
        </button>}
        <div className="mt-5 flex items-center justify-center gap-5 text-xs font-semibold text-slate-500">
          <button type="button" onClick={refreshAccess} disabled={checking} className="underline underline-offset-4 disabled:opacity-50">Restore purchase</button>
          <button type="button" onClick={logout} disabled={busy} className="underline underline-offset-4 disabled:opacity-50">Log out</button>
        </div>
        <p className="mt-5 text-center text-[10px] leading-5 text-slate-400">Payments are verified securely by NardoPay. Your dealership data is never deleted when access expires.</p>
      </section>
    </main>
  );
};
