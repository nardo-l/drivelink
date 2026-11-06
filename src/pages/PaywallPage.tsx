import { name } from '../config/brand';
import React from 'react';
import { Logo } from '../components/common/Logo';
import { Check, Loader2, LockKeyhole, ShieldCheck, Store, CarFront, MessageCircle, CalendarDays, Sparkles } from 'lucide-react';
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
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    const query = window.location.hash.split('?')[1] || window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(query);
    const checkout = params.get('checkout');
    if (checkout) setCheckoutId(checkout);
    setTransactionId(params.get('transaction_id') || params.get('transactionId'));
  }, []);

  const refreshAccess = React.useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('drivelink-payments', { body: { action: 'status' } });
      if (error) throw error;
      const subscription = data?.subscription;
      const now = data?.server_now ? new Date(data.server_now).getTime() : Date.now();
      const trialValid = (subscription?.status === 'trial' || subscription?.status === 'trialing') && subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now;
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
        body: { action: 'check', checkout_id: checkoutId, transaction_id: transactionId || undefined },
      });
      if (error) throw error;
      if (data?.paid || data?.status === 'completed') {
        setMessage('Payment confirmed. Restoring your {name} access…');
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
  }, [checkoutId, transactionId, refreshAccess]);

  React.useEffect(() => {
    if (!checkoutId) return;
    let attempts = 0;
    void checkCheckout();
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 10) {
        window.clearInterval(timer);
        return;
      }
      void checkCheckout();
    }, 3000);
    return () => window.clearInterval(timer);
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
    { title: 'Your showroom and public link', caption: 'Stays live for your buyers', Icon: Store, tint: 'bg-sky-50 text-sky-700' },
    { title: 'Inventory, photos and listings', caption: "Everything you've added is safe", Icon: CarFront, tint: 'bg-indigo-50 text-indigo-700' },
    { title: 'Enquiries and lead management', caption: 'Never miss a buyer', Icon: MessageCircle, tint: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <main className="relative flex min-h-[100dvh] w-full justify-center overflow-y-auto bg-[linear-gradient(180deg,#DCEEFF_0%,#EFF7FF_19%,#F8FAFC_36%,#FFFFFF_58%)] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] text-[#0A0F1E]">
      <section className="flex min-h-[calc(100dvh-max(28px,env(safe-area-inset-top))-max(20px,env(safe-area-inset-bottom)))] w-full max-w-[430px] flex-col">
        <header className="flex flex-col items-center text-center">
          <div className="mb-5"><Logo variant="dark" size="sm" /></div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/75 text-slate-500 shadow-sm ring-1 ring-white/90">
            <LockKeyhole size={17} strokeWidth={1.8} />
          </div>
          <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-[-0.045em] text-[#0A0F1E]">Your free trial has ended</h1>
          <p className="mt-2 text-[13px] font-medium text-slate-500">Subscribe to unlock your dealership workspace</p>
        </header>

        <div className="mt-7 space-y-4">
          {features.map(({ title, caption, Icon, tint }) => (
            <div key={title} className="flex items-center gap-3.5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${tint}`}>
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-5 tracking-[-0.015em] text-[#0A0F1E]">{title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{caption}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7">
          <p className="mb-3 text-center text-[12px] font-bold tracking-[-0.01em] text-slate-600">Choose your plan</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlan('monthly')}
              aria-pressed={plan === 'monthly'}
              className={`relative min-w-0 rounded-[20px] border bg-white/90 p-3.5 text-left transition-all duration-200 ease-out ${plan === 'monthly' ? 'border-[#0A0F1E] border-2 shadow-[0_8px_22px_rgba(15,23,42,0.10)]' : 'border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.025)] hover:border-slate-300'}`}
            >
              {plan === 'monthly' && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0F1E] text-white"><Check size={12} strokeWidth={3} /></span>}
              <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600"><CalendarDays size={15} /></span>
              <span className="block text-[11px] font-semibold text-slate-500">Monthly</span>
              <span className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                <strong className="text-[25px] font-extrabold leading-none tracking-[-0.055em] text-[#0A0F1E]">$3.99</strong>
                <span className="text-[10px] font-medium text-slate-500">/mo</span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">Billed every 30 days</span>
            </button>

            <button
              type="button"
              onClick={() => setPlan('yearly')}
              aria-pressed={plan === 'yearly'}
              className={`relative min-w-0 rounded-[20px] border bg-white/95 p-3.5 text-left transition-all duration-200 ease-out ${plan === 'yearly' ? 'border-[#0A0F1E] border-2 shadow-[0_8px_22px_rgba(15,23,42,0.10)]' : 'border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.025)] hover:border-slate-300'}`}
            >
              <span className="absolute -top-2.5 left-3 rounded-full bg-[#0A0F1E] px-2 py-1 text-[8px] font-extrabold tracking-[0.08em] text-white">BEST VALUE</span>
              {plan === 'yearly' && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0F1E] text-white"><Check size={12} strokeWidth={3} /></span>}
              <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-[10px] bg-sky-50 text-sky-700"><Sparkles size={15} /></span>
              <span className="block text-[11px] font-semibold text-slate-500">Yearly</span>
              <span className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                <strong className="text-[25px] font-extrabold leading-none tracking-[-0.055em] text-[#0A0F1E]">$2.67</strong>
                <span className="text-[10px] font-medium text-slate-500">/mo</span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">Billed $32 per year · Save 33%</span>
            </button>
          </div>
        </div>

        <div className="mt-auto pt-6">
          {message && <div role="status" className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900">{message}</div>}

          <button
            type="button"
            onClick={subscribe}
            disabled={busy || checking}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0A0F1E] px-5 text-[14px] font-bold tracking-[-0.01em] text-white shadow-[0_8px_20px_rgba(10,15,30,0.16)] transition-all duration-200 hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {busy ? 'Connecting to NardoPay…' : `Subscribe now · ${plan === 'yearly' ? '$2.67/mo' : '$3.99/mo'}`}
          </button>

          {plan === 'yearly' && <p className="mt-2 text-center text-[10px] font-medium text-slate-500">Yearly plan billed as a single $32 payment</p>}

          {checkoutId && (
            <button type="button" onClick={checkCheckout} disabled={checking} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 text-[11px] font-semibold text-slate-600 disabled:opacity-50">
              {checking && <Loader2 size={13} className="animate-spin" />}
              {checking ? 'Checking payment…' : "I've paid — check my payment"}
            </button>
          )}

          <div className="mt-4 flex items-center justify-center gap-6 text-[11px] font-semibold text-slate-500">
            <button type="button" onClick={refreshAccess} disabled={checking} className="transition-colors hover:text-[#0A0F1E] disabled:opacity-50">Restore purchase</button>
            <span className="h-3 w-px bg-slate-200" />
            <button type="button" onClick={logout} disabled={busy} className="transition-colors hover:text-[#0A0F1E] disabled:opacity-50">Log out</button>
          </div>
          <p className="mx-auto mt-3 max-w-[330px] text-center text-[9px] leading-[1.45] text-slate-400">Payments are verified securely by NardoPay. Your dealership data is never deleted when access expires.</p>
        </div>
      </section>
    </main>
  );
};
