import React from 'react';
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { storageService } from '../services/storage';

type Subscription = {
  status: string;
  amount: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_used?: boolean;
};
type Payment = {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  payment_method?: string;
};

const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

export const BillingPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'yearly'>('yearly');
  const [error, setError] = React.useState('');
  const [checkoutId, setCheckoutId] = React.useState<string | null>(null);
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [paymentCheck, setPaymentCheck] = React.useState<'idle' | 'checking' | 'pending' | 'completed' | 'failed'>('idle');

  const loadStatus = React.useCallback(async () => {
    if (!isSupabaseConfigured() || storageService.isDemoModeActive()) {
      setError('Subscription payments are available when DriveLink is connected to your account.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'status' },
      });
      if (invokeError) throw invokeError;
      setSubscription(data?.subscription || null);
      setPayments(data?.payments || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load your subscription.');
    } finally {
      setLoading(false);
    }
  }, []);


  React.useEffect(() => {
    loadStatus();
    const hashQuery = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(hashQuery);
    const checkout = params.get('checkout');
    const transaction = params.get('transaction_id') || params.get('transactionId');
    if (checkout) setCheckoutId(checkout);
    if (transaction) setTransactionId(transaction);
  }, [loadStatus]);

  const checkPayment = React.useCallback(async () => {
    if (!checkoutId) return;
    setPaymentCheck('checking');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'check', checkout_id: checkoutId, transaction_id: transactionId || undefined },
      });
      if (invokeError) throw invokeError;
      if (data?.paid || data?.status === 'completed') {
        setPaymentCheck('completed');
        setCheckoutId(null);
        await loadStatus();
        return;
      }
      if (data?.status === 'failed' || data?.status === 'cancelled') {
        setPaymentCheck('failed');
        return;
      }
      setPaymentCheck('pending');
    } catch {
      setPaymentCheck('pending');
    }
  }, [checkoutId, transactionId, loadStatus]);

  React.useEffect(() => {
    if (!checkoutId) return;
    let attempts = 0;
    void checkPayment();
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 10) {
        window.clearInterval(timer);
        return;
      }
      void checkPayment();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [checkoutId, checkPayment]);


  const startPayment = async () => {
    setPaying(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'initiate', plan_code: selectedPlan },
      });
      if (invokeError) throw invokeError;
      if (!data?.url) throw new Error(data?.error || 'NardoPay did not return a checkout link.');
      window.location.assign(data.url);
    } catch (e: any) {
      setError(e?.message || 'Could not start your NardoPay payment.');
      setPaying(false);
    }
  };

  const now = Date.now();
  const selectedAmount = selectedPlan === 'yearly' ? 32 : 3.99;
  const selectedDuration = selectedPlan === 'yearly' ? '365 days' : '30 days';
  const end = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
  const graceEnd = subscription?.grace_until ? new Date(subscription.grace_until).getTime() : 0;
  const trialEnd = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : 0;
  const trialActive = Boolean(subscription?.trial_used && trialEnd && now <= trialEnd && !end);
  const inGrace = Boolean(end && now > end && graceEnd >= now);
  const active = Boolean(end && now <= end);
  const statusLabel = trialActive ? 'Free trial active' : active ? 'Active' : inGrace ? 'Grace period' : 'Not active';
  const statusTone = trialActive || active ? 'text-emerald-700 bg-emerald-50' : inGrace ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';

  return (
    <div className="min-h-full bg-[#F8F9FA] text-slate-900 flex flex-col">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <button onClick={() => navigate('/app/settings')} aria-label="Back to settings" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-extrabold tracking-tight">Subscription & billing</h1>
          <p className="text-[11px] text-slate-500">Manage your DriveLink access</p>
        </div>
      </header>

      <main className="flex-1 px-5 py-5 pb-10 flex flex-col gap-4">
        <section className="rounded-3xl bg-slate-950 text-white p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/65">Choose your DriveLink Pro plan</span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10">NARDOPAY</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSelectedPlan('monthly')} className={`relative rounded-2xl border p-3 text-left transition ${selectedPlan === 'monthly' ? 'border-white bg-white/10 ring-1 ring-white/50' : 'border-white/15 bg-white/[0.03]'}`}>
              <span className="block text-[11px] text-white/65">Monthly</span>
              <strong className="mt-1 block text-2xl font-black tracking-tight">$3.99</strong>
              <span className="text-[10px] text-white/60">per 30 days</span>
              {selectedPlan === 'monthly' && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white"/>}
            </button>
            <button type="button" onClick={() => setSelectedPlan('yearly')} className={`relative rounded-2xl border p-3 text-left transition ${selectedPlan === 'yearly' ? 'border-white bg-white/10 ring-1 ring-white/50' : 'border-white/15 bg-white/[0.03]'}`}>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold text-black">BEST VALUE · SAVE 33%</span>
              <strong className="mt-1 block text-2xl font-black tracking-tight">$32</strong>
              <span className="text-[10px] text-white/60">per year</span>
              {selectedPlan === 'yearly' && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white"/>}
            </button>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">${selectedAmount.toFixed(2)}</span>
            <span className="text-xs text-white/60">/ {selectedDuration}</span>
          </div>
          {selectedPlan === 'yearly' ? <p className="mt-1 text-xs text-white/65">Pay once for 12 months. That's just $2.67/month — save $15.88 (33%) compared with paying monthly.</p> : <p className="mt-1 text-xs text-white/65">$3.99 every 30 days. Pay securely through NardoPay using EcoCash or another available payment method.</p>}
          <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
            <span className="text-xs text-white/65">Subscription status</span>
            <span className="text-xs font-bold">{loading ? 'Checking…' : statusLabel}</span>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        {checkoutId && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-extrabold">{paymentCheck === 'checking' ? 'Checking your payment…' : paymentCheck === 'failed' ? 'Payment was not completed' : 'Waiting for payment confirmation'}</p>
          <p className="mt-1 leading-relaxed">{paymentCheck === 'failed' ? 'The payment was declined or cancelled. You can start a new checkout when ready.' : 'NardoPay is processing your checkout. Your subscription will activate only after the payment is verified.'}</p>
          <button type="button" onClick={checkPayment} disabled={paymentCheck === 'checking'} className="mt-3 rounded-full bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50">
            {paymentCheck === 'checking' ? 'Checking…' : "I've paid, check my payment"}
          </button>
        </section>}
        {paymentCheck === 'completed' && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Payment confirmed. Your DriveLink subscription is active.</div>}
}

        <section className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold">Your subscription</h2>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusTone}`}>{loading ? 'Loading' : statusLabel}</span>
          </div>
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">{trialActive ? 'Free trial ends' : 'Current period ends'}</span><strong>{dateLabel(trialActive ? subscription?.trial_ends_at : subscription?.current_period_end)}</strong></div>
              {trialActive && <div className="rounded-xl bg-emerald-50 text-emerald-800 p-3 leading-relaxed">Your 3-day DriveLink Pro trial is active. No payment is taken during the trial. Choose a plan after it ends to continue.</div>}
              {inGrace && <div className="rounded-xl bg-amber-50 text-amber-800 p-3 leading-relaxed">Your subscription is in its 3-day grace period. Renew now to avoid interruption.</div>}
              {active && end - now <= 5 * 24 * 60 * 60 * 1000 && <div className="rounded-xl bg-amber-50 text-amber-800 p-3 leading-relaxed flex items-start gap-2"><Clock3 className="w-4 h-4 shrink-0 mt-0.5" /><span>Your subscription is nearing its renewal date ({dateLabel(subscription?.current_period_end)}). Renew for your selected plan to keep your access uninterrupted.</span></div>}
              {active && end - now > 5 * 24 * 60 * 60 * 1000 && <div className="rounded-xl bg-emerald-50 text-emerald-800 p-3 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>Your subscription is active. Renew before the end date to keep your access uninterrupted.</span></div>}
              {!active && !inGrace && !trialActive && <div className="rounded-xl bg-slate-50 text-slate-600 p-3">Subscribe or renew to keep your DriveLink account active.</div>}
            </div>
          )}
          <button onClick={startPayment} disabled={paying || loading || trialActive} className="mt-4 w-full h-12 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 disabled:opacity-50">
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {paying ? 'Connecting to NardoPay…' : trialActive ? 'Trial active — no payment due' : active || inGrace ? `Renew for ${selectedAmount.toFixed(2)}` : `Subscribe for ${selectedAmount.toFixed(2)}`}
            {!paying && <ExternalLink className="w-3.5 h-3.5" />}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">You will be redirected to NardoPay to complete your ${selectedPlan === 'yearly' ? 'annual' : 'monthly'} payment.</p>
        </section>

        <section className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold">Payment history</h2>
          </div>
          {payments.length === 0 ? <p className="text-xs text-slate-500 py-3">Your payments will appear here after checkout.</p> : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <div key={payment.reference} className="py-3 flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold">$ {Number(payment.amount).toFixed(2)} · {payment.payment_method || 'NardoPay'}</p><p className="text-[10px] text-slate-400 mt-0.5">{dateLabel(payment.paid_at || payment.created_at)}</p></div>
                  <span className={`text-[10px] font-bold capitalize ${payment.status === 'paid' ? 'text-emerald-700' : payment.status === 'pending' ? 'text-amber-700' : 'text-slate-500'}`}>{payment.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 px-1 text-[10px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Payments are verified with NardoPay before subscription access is extended. Renewals are manual; DriveLink will not charge you automatically.</span>
        </div>
      </main>
    </div>
  );
};
