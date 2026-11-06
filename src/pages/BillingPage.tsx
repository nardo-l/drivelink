import React from 'react';
import { Logo } from '../components/common/Logo';
import {
  ArrowLeft, Check, CreditCard, ExternalLink, Loader2, ShieldCheck,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  payment_method?: string;
  paynow_reference?: string | null;
};

type Plan = 'monthly' | 'yearly';

const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const money = (amount: number) => `$${Number(amount).toFixed(2)}`;

const paymentStatus = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'paid' || normalized === 'completed' || normalized === 'success') {
    return { label: 'Paid', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (normalized === 'failed') return { label: 'Failed', className: 'bg-rose-50 text-rose-700' };
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return { label: 'Cancelled', className: 'bg-slate-100 text-slate-600' };
  }
  return { label: 'Pending', className: 'bg-amber-50 text-amber-700' };
};

export const BillingPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState(false);
  const [checkingPaymentId, setCheckingPaymentId] = React.useState<string | null>(null);
  const [showAllPayments, setShowAllPayments] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<Plan>('yearly');
  const [error, setError] = React.useState('');
  const [checkoutId, setCheckoutId] = React.useState<string | null>(null);
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [paymentCheck, setPaymentCheck] = React.useState<'idle' | 'checking' | 'pending' | 'completed' | 'failed'>('idle');

  const loadStatus = React.useCallback(async (silent = false) => {
    if (!isSupabaseConfigured() || storageService.isDemoModeActive()) {
      setError('Subscription payments are available when DriveLink is connected to your account.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
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
    void loadStatus();
    const hashQuery = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(hashQuery);
    const checkout = params.get('checkout');
    const transaction = params.get('transaction_id') || params.get('transactionId');
    if (checkout) setCheckoutId(checkout);
    if (transaction) setTransactionId(transaction);
  }, [loadStatus]);

  const checkCheckout = React.useCallback(async () => {
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
        await loadStatus(true);
      } else if (data?.status === 'failed' || data?.status === 'cancelled') {
        setPaymentCheck('failed');
        await loadStatus(true);
      } else {
        setPaymentCheck('pending');
      }
    } catch {
      setPaymentCheck('pending');
    }
  }, [checkoutId, transactionId, loadStatus]);

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

  const startPayment = async () => {
    if (paying) return;
    setPaying(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'initiate', plan_code: selectedPlan },
      });
      if (invokeError) throw invokeError;
      if (!data?.url || !/^https:\/\//i.test(data.url)) {
        throw new Error(data?.error || 'NardoPay did not return a secure checkout link.');
      }
      window.location.assign(data.url);
    } catch (e: any) {
      setError(e?.message || 'Could not start your NardoPay payment.');
      setPaying(false);
    }
  };

  const checkHistoryPayment = async (payment: Payment) => {
    if (checkingPaymentId) return;
    setCheckingPaymentId(payment.id);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: {
          action: 'check',
          checkout_id: payment.id,
          transaction_id: payment.paynow_reference || undefined,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.status === 'failed' || data?.status === 'cancelled') {
        setPayments((current) => current.map((item) => item.id === payment.id
          ? { ...item, status: data.status } : item));
      }
      await loadStatus(true);
    } catch (e: any) {
      setError(e?.message || 'Could not check this payment with NardoPay. Please try again.');
    } finally {
      setCheckingPaymentId(null);
    }
  };

  const now = Date.now();
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime() : 0;
  const graceEnd = subscription?.grace_until
    ? new Date(subscription.grace_until).getTime() : 0;
  const trialEnd = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime() : 0;
  const trialActive = Boolean(subscription?.trial_used && trialEnd && now <= trialEnd && !periodEnd);
  const active = Boolean(periodEnd && now <= periodEnd);
  const inGrace = Boolean(periodEnd && now > periodEnd && graceEnd >= now);
  const accessEnd = trialActive ? trialEnd : inGrace ? graceEnd : periodEnd;
  const daysLeft = accessEnd ? Math.max(0, Math.ceil((accessEnd - now) / 86400000)) : 0;
  const expiringSoon = (active && daysLeft <= 5) || inGrace;
  const expired = Boolean(subscription && !active && !inGrace && !trialActive &&
    (subscription.status === 'expired' || (periodEnd > 0 && now > periodEnd)));
  const hasAccess = active || trialActive || inGrace;
  const statusLabel = hasAccess ? (expiringSoon ? 'Expiring soon' : 'Active') : expired ? 'Expired' : 'Not active';
  const statusTone = hasAccess
    ? expiringSoon ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
    : expired ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600';
  const isRenewal = active || inGrace;
  const progressStart = trialActive
    ? (subscription?.trial_started_at ? new Date(subscription.trial_started_at).getTime() : now)
    : (subscription?.current_period_start ? new Date(subscription.current_period_start).getTime() : now);
  const progress = accessEnd > progressStart
    ? Math.min(100, Math.max(0, ((now - progressStart) / (accessEnd - progressStart)) * 100))
    : 0;
  const visiblePayments = showAllPayments ? payments : payments.slice(0, 5);

  return (
    <div className="min-h-full flex flex-col bg-[#F7F8FA] text-[#0A0F1E]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#F7F8FA]/95 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto"><Logo variant="dark" size="sm" /></div>
        <button
          type="button"
          onClick={() => navigate('/app/settings')}
          aria-label="Back to settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0A0F1E] shadow-sm transition hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-base font-extrabold tracking-tight">Subscription &amp; billing</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">Manage your DriveLink access</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-2">
        <section className="rounded-[20px] bg-white p-5 shadow-[0_5px_22px_rgba(15,23,42,0.055)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Subscription status</p>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${statusTone}`}>
              {loading ? 'Checking…' : statusLabel}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-7 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your DriveLink access…
            </div>
          ) : hasAccess ? (
            <>
              <h2 className="mt-4 text-[22px] font-extrabold tracking-[-0.04em]">DriveLink Pro</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {trialActive
                  ? `Your free trial ends on ${dateLabel(subscription?.trial_ends_at)}`
                  : inGrace
                    ? 'Your renewal is overdue. Renew now to keep your workspace protected.'
                    : `Renews manually on ${dateLabel(subscription?.current_period_end)}`}
              </p>
              <div className="mt-5 flex items-end justify-between">
                <strong className="text-sm font-bold">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</strong>
                <span className="text-[10px] font-medium text-slate-400">Access period</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0A0F1E] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-[21px] font-extrabold tracking-[-0.04em]">
                'Your workspace is locked'
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Subscribe to unlock it. Your data is safe.
              </p>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-3 px-0.5 text-sm font-extrabold">Choose your plan</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedPlan('yearly')}
              aria-pressed={selectedPlan === 'yearly'}
              className={`relative min-w-0 rounded-[20px] border bg-white p-3.5 text-left transition-all duration-200 ease-out ${selectedPlan === 'yearly' ? 'border-[#0A0F1E] shadow-[0_8px_22px_rgba(15,23,42,0.10)] ring-1 ring-[#0A0F1E]' : 'border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.025)] hover:border-slate-300'}`}
            >
              <span className="absolute -top-2.5 left-3 rounded-full bg-[#0A0F1E] px-2 py-1 text-[8px] font-extrabold tracking-[0.08em] text-white">BEST VALUE</span>
              {selectedPlan === 'yearly' && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0F1E] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className="block text-[11px] font-semibold text-slate-500">Yearly</span>
              <span className="mt-2 flex items-baseline gap-1 whitespace-nowrap">
                <strong className="text-[25px] font-extrabold leading-none tracking-[-0.055em]">$2.67</strong>
                <span className="text-[10px] font-medium text-slate-500">/mo</span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">Billed $32 per year · Save 33%</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan('monthly')}
              aria-pressed={selectedPlan === 'monthly'}
              className={`relative min-w-0 rounded-[20px] border bg-white p-3.5 text-left transition-all duration-200 ease-out ${selectedPlan === 'monthly' ? 'border-[#0A0F1E] shadow-[0_8px_22px_rgba(15,23,42,0.10)] ring-1 ring-[#0A0F1E]' : 'border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.025)] hover:border-slate-300'}`}
            >
              {selectedPlan === 'monthly' && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0F1E] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className="block text-[11px] font-semibold text-slate-500">Monthly</span>
              <span className="mt-2 flex items-baseline gap-1 whitespace-nowrap">
                <strong className="text-[25px] font-extrabold leading-none tracking-[-0.055em]">$3.99</strong>
                <span className="text-[10px] font-medium text-slate-500">/mo</span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">Billed every 30 days</span>
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
            {error}
          </div>
        )}

        <div className="-mx-5 px-5 pt-1">
          <button
            type="button"
            onClick={startPayment}
            disabled={paying || loading}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0A0F1E] px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(10,15,30,0.16)] transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {paying ? 'Connecting to NardoPay…' : `${isRenewal ? 'Renew now' : 'Subscribe now'} · ${selectedPlan === 'yearly' ? '$32' : '$3.99'}`}
            {!paying && <ExternalLink className="h-3.5 w-3.5" />}
          </button>
          <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">
            You'll be redirected to NardoPay to pay {selectedPlan === 'yearly' ? '$32' : '$3.99'} with EcoCash or another available method.
          </p>
        </div>

        {checkoutId && (
          <section className="rounded-[20px] border border-amber-100 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-extrabold">
              {paymentCheck === 'checking' ? 'Checking your payment…' : paymentCheck === 'failed' ? 'Payment was not completed' : 'Waiting for payment confirmation'}
            </p>
            <p className="mt-1 leading-relaxed">
              {paymentCheck === 'failed'
                ? 'The payment was declined or cancelled. You can start a new checkout when ready.'
                : 'NardoPay is processing your checkout. Your subscription will activate only after the payment is verified.'}
            </p>
            <button
              type="button"
              onClick={checkCheckout}
              disabled={paymentCheck === 'checking'}
              className="mt-3 rounded-full bg-[#0A0F1E] px-4 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {paymentCheck === 'checking' ? 'Checking…' : "I've paid — check my payment"}
            </button>
          </section>
        )}

        {paymentCheck === 'completed' && (
          <div role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            Payment confirmed. Your DriveLink subscription is active.
          </div>
        )}

        <section className="rounded-[20px] bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.045)]">
          <h2 className="mb-1 text-sm font-extrabold">Payment history</h2>
          {loading && payments.length === 0 ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : payments.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-400">No payments yet</p>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {visiblePayments.map((payment) => {
                  const status = paymentStatus(payment.status);
                  const isPending = status.label === 'Pending';
                  const checking = checkingPaymentId === payment.id;
                  return (
                    <div key={payment.id || payment.reference} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#0A0F1E]">
                          {money(payment.amount)} <span className="font-medium text-slate-400">· {payment.payment_method || 'NardoPay'}</span>
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">{dateLabel(payment.paid_at || payment.created_at)}</p>
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => void checkHistoryPayment(payment)}
                            disabled={Boolean(checkingPaymentId)}
                            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 disabled:opacity-50"
                          >
                            {checking && <Loader2 className="h-3 w-3 animate-spin" />}
                            {checking ? 'Checking…' : 'Check status'}
                          </button>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                        {isPending && <p className="mt-1 text-[9px] text-amber-700">Waiting for payment</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {payments.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllPayments((value) => !value)}
                  className="mt-2 w-full border-t border-slate-100 pt-3 text-center text-[11px] font-bold text-slate-600"
                >
                  {showAllPayments ? 'Show less' : 'View all payments'}
                </button>
              )}
            </>
          )}
        </section>

        <div className="flex items-start gap-2 px-1 pb-1 text-[10px] leading-relaxed text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Payments are verified with NardoPay before access is extended. Renewals are manual; DriveLink will never charge you automatically.</span>
        </div>

      </main>
    </div>
  );
};
