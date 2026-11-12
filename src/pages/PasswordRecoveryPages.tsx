import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

const AuthCard: React.FC<{ children: React.ReactNode }> = ({ children }) => <main className="min-h-[100dvh] bg-[#f7f8fa] px-5 py-8 text-[#0A0F1E]"><section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col justify-center rounded-[28px] bg-white p-7 shadow-sm sm:p-9">{children}</section></main>;

export const ForgotPasswordPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await supabaseService.requestPasswordReset(email.trim()); setSent(true); }
    catch (err: any) { setError(err?.message || 'We could not send a reset email. Please try again.'); }
    finally { setLoading(false); }
  };

  return <AuthCard>
    <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-800"><KeyRound size={25} /></div>
    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Password recovery</p>
    <h1 className="text-3xl font-extrabold tracking-tight">Reset your password</h1>
    {sent ? <><div className="mt-6 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />Check your inbox for a password reset link.</div><button type="button" onClick={() => navigate('/login')} className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">Back to sign in</button></> : <><p className="mt-3 text-sm leading-6 text-slate-500">Enter your account email and we’ll send you a secure reset link.</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-xs font-bold text-slate-700">Email address<input className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>{error && <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}<button type="submit" disabled={loading || !isSupabaseConfigured()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-sm font-bold text-white disabled:opacity-60">{loading ? <><Loader2 size={17} className="animate-spin" /> Sending…</> : 'Send reset link'}</button></form></>}
    <button type="button" onClick={() => navigate('/login')} className="mt-6 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-700"><ArrowLeft size={14} /> Back to sign in</button>
  </AuthCard>;
};

export const ResetPasswordPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password.length < 6) { setError('Use a password of at least 6 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setLoading(true);
    try { await supabaseService.updatePassword(password); setDone(true); }
    catch (err: any) { setError(err?.message || 'This reset link is invalid or expired. Request a new one and try again.'); }
    finally { setLoading(false); }
  };

  return <AuthCard>
    <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-800"><KeyRound size={25} /></div>
    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Password recovery</p>
    <h1 className="text-3xl font-extrabold tracking-tight">Choose a new password</h1>
    {done ? <><div className="mt-6 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />Your password was updated successfully.</div><button type="button" onClick={() => navigate('/login')} className="mt-8 h-12 w-full rounded-full bg-slate-950 text-sm font-bold text-white">Sign in</button></> : <form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-xs font-bold text-slate-700">New password<input className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><label className="block text-xs font-bold text-slate-700">Confirm new password<input className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>{error && <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}<button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-sm font-bold text-white disabled:opacity-60">{loading ? <><Loader2 size={17} className="animate-spin" /> Updating…</> : 'Update password'}</button></form>}
  </AuthCard>;
};
