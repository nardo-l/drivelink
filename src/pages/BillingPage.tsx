import React from 'react';
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
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
};
type Payment = {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
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
  const [error, setError] = React.useState('');

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

  React.useEffect(() => { loadStatus(); }, [loadStatus]);

  const startPayment = async () => {
    setPaying(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('drivelink-payments', {
        body: { action: 'initiate' },
      });
      if (invokeError) throw invokeError;
      if (!data?.redirectUrl) throw new Error(data?.error || 'Paynow did not return a checkout link.');
      window.location.assign(data.redirectUrl);
    } catch (e: any) {
      setError(e?.message || 'Could not start your EcoCash payment.');
      setPaying(false);
    }
  };

  const now = Date.now();
  const end = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
  const graceEnd = subscription?.grace_until ? new Date(subscription.grace_until).getTime() : 0;
  const inGrace = Boolean(end && now > end && graceEnd >= now);
  const active = Boolean(end && now <= end);
  const statusLabel = active ? 'Active' : inGrace ? 'Grace period' : 'Not active';
  const statusTone = active ? 'text-emerald-700 bg-emerald-50' : inGrace ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';

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
            <span className="text-xs font-semibold text-white/65">DriveLink monthly plan</span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10">ECOCASH</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-black tracking-tight">$3.99</span>
            <span className="text-sm text-white/60 pb-1">/ 30 days</span>
          </div>
          <p className="text-xs text-white/65 mt-2">Pay securely through Paynow using EcoCash. Renew manually each month.</p>
          <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
            <span className="text-xs text-white/65">Subscription status</span>
            <span className="text-xs font-bold">{loading ? 'Checking…' : statusLabel}</span>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

        <section className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold">Your subscription</h2>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusTone}`}>{loading ? 'Loading' : statusLabel}</span>
          </div>
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Current period ends</span><strong>{dateLabel(subscription?.current_period_end)}</strong></div>
              {inGrace && <div className="rounded-xl bg-amber-50 text-amber-800 p-3 leading-relaxed">Your subscription is in its 3-day grace period. Renew now to avoid interruption.</div>}
              {active && <div className="rounded-xl bg-emerald-50 text-emerald-800 p-3 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>Your subscription is active. Renew before the end date to keep your access uninterrupted.</span></div>}
              {!active && !inGrace && <div className="rounded-xl bg-slate-50 text-slate-600 p-3">Subscribe or renew to keep your DriveLink account active.</div>}
            </div>
          )}
          <button onClick={startPayment} disabled={paying || loading} className="mt-4 w-full h-12 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 disabled:opacity-50">
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {paying ? 'Connecting to Paynow…' : active || inGrace ? 'Renew for $3.99' : 'Subscribe for $3.99'}
            {!paying && <ExternalLink className="w-3.5 h-3.5" />}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">You will be redirected to Paynow. Select EcoCash to complete payment.</p>
        </section>

        <section className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold">Payment history</h2>
            <button onClick={loadStatus} disabled={loading} aria-label="Refresh payment history" className="p-2 rounded-full hover:bg-slate-100"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
          {payments.length === 0 ? <p className="text-xs text-slate-500 py-3">Your payments will appear here after checkout.</p> : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <div key={payment.reference} className="py-3 flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold">$ {Number(payment.amount).toFixed(2)} · EcoCash</p><p className="text-[10px] text-slate-400 mt-0.5">{dateLabel(payment.paid_at || payment.created_at)}</p></div>
                  <span className={`text-[10px] font-bold capitalize ${payment.status === 'paid' ? 'text-emerald-700' : payment.status === 'pending' ? 'text-amber-700' : 'text-slate-500'}`}>{payment.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 px-1 text-[10px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Payments are verified directly with Paynow before subscription access is extended. EcoCash renewals are manual; DriveLink will not charge you automatically.</span>
        </div>
      </main>
    </div>
  );
};
