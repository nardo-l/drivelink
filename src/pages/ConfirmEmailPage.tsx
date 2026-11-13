import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { name } from '../config/brand';

// Keep this key outside the drivelink_* prefix: App.tsx calls storageService.clearAppUserData on startup when a new unconfirmed signup has no session, and that cleanup removes every drivelink_* key.
const PENDING_EMAIL_KEY = 'lotle_pending_confirmation_email_v1';
const RESEND_COOLDOWN_SECONDS = 60;

function readPendingEmail(): string {
  try { return localStorage.getItem(PENDING_EMAIL_KEY) || ''; } catch { return ''; }
}

export const ConfirmEmailPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [email, setEmail] = useState(readPendingEmail);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!email) {
      supabaseService.getCurrentUser().then(user => {
        if (user?.email) {
          setEmail(user.email);
          try { localStorage.setItem(PENDING_EMAIL_KEY, user.email); } catch {}
        }
      }).catch(() => {});
    }
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (!isSupabaseConfigured()) { setError('Email confirmation is temporarily unavailable. Please try again later.'); return; }
    if (!email.trim() || !/^\d{6}$/.test(token.trim())) { setError('Enter the 6-digit code from your confirmation email.'); return; }
    setLoading(true);
    try {
      await supabaseService.verifySignupOtp(email.trim(), token.trim());
      try { localStorage.removeItem(PENDING_EMAIL_KEY); } catch {}
      setSuccess('Email confirmed. Taking you to your dealership setup…');
      window.setTimeout(() => navigate('/onboarding'), 350);
    } catch (err: any) {
      const message = String(err?.message || '').toLowerCase();
      setError(message.includes('expired') ? 'That code has expired. Request a new code and try again.' : 'That code is incorrect. Check the email and enter the latest 6-digit code.');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Enter the email address used to create your account first.'); return; }
    if (cooldown > 0) return;
    setResending(true);
    try {
      await supabaseService.resendConfirmationEmail(email.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setSuccess('A new confirmation code was sent. Check your inbox and spam folder.');
    } catch (err: any) {
      setError(err?.message || 'We could not resend the code. Please wait a moment and try again.');
    } finally { setResending(false); }
  };

  return <main className="min-h-[100dvh] bg-[#f7f8fa] px-5 py-8 text-[#0A0F1E]">
    <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col justify-center rounded-[28px] bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-800"><Mail size={25} /></div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirm your email</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Check your inbox</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Enter the 6-digit code we sent to finish creating your {name} account.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-xs font-bold text-slate-700">Email address<input className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900" type="email" value={email} onChange={event => { setEmail(event.target.value); try { localStorage.setItem(PENDING_EMAIL_KEY, event.target.value); } catch {} }} autoComplete="email" required /></label>
        <label className="block text-xs font-bold text-slate-700">6-digit code<input className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-slate-900" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required /></label>
        {error && <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        {success && <div role="status" className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{success}</div>}
        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-sm font-bold text-white disabled:opacity-60">{loading ? <><Loader2 size={17} className="animate-spin" /> Verifying…</> : <>Verify email <ArrowRight size={17} /></>}</button>
      </form>
      <button type="button" onClick={resend} disabled={resending || cooldown > 0} className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-700 disabled:text-slate-400">{resending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
      <button type="button" onClick={() => navigate('/login')} className="mt-6 text-center text-xs font-semibold text-slate-400 hover:text-slate-700">Back to sign in</button>
    </section>
  </main>;
};

export { PENDING_EMAIL_KEY };
