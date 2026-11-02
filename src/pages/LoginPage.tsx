import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isLive = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (!isLive) {
      setAuthError('Sign in is temporarily unavailable because the backend is not configured. Please try again later.');
      setLoading(false);
      return;
    }

    {
      try {
        const { user } = await supabaseService.signIn(email.trim(), password);
        if (!user) {
          throw new Error('Sign in succeeded but no user data returned.');
        }

        let dealershipId = '';
        try {
          const liveDealer = await supabaseService.getCurrentDealership();
          if (liveDealer) {
            dealershipId = liveDealer.id;
            storageService.saveDealership(liveDealer);
          }
        } catch (dealerErr) {
          console.warn('Error fetching user dealership on login:', dealerErr);
        }

        storageService.setUserSession({
          isLoggedIn: true,
          email: user.email || email.trim(),
          dealershipId,
        });

        showToast('Signed in via Supabase! Welcome back.');

        if (dealershipId) {
          navigate('/app');
        } else {
          showToast('Please complete your dealership setup.');
          navigate('/onboarding');
        }
      } catch (err: any) {
        console.error('Supabase login error:', err);
        setAuthError(err?.message || 'Invalid email or password. Please verify your Supabase credentials.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between overflow-hidden px-6 py-6 text-slate-900">
      <img
        src="https://cimyerrelscqjiwqvnnn.supabase.co/storage/v1/object/public/drivelink-assets/image%202.jfif"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-white/40" aria-hidden="true" />

      <div className="relative z-10 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-slate-800 transition-colors -ml-2 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white/85 border border-emerald-200 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center my-auto w-full max-w-md mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
          Welcome back
        </h1>
        <p className="text-xs text-slate-700 mt-1 max-w-xs">
          Sign in to manage your vehicle inventory and buyer leads.
        </p>

        {authError && (
          <div className="w-full mt-3 p-3 rounded-xl bg-rose-50/95 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{authError}</p>
              {isLive && (
                <p className="text-[11px] text-rose-600/90 mt-1">
                  If you don&apos;t have an account yet, create one to set up your dealership.
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-3.5 mt-5 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dealer@example.com"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white/90 text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-white/90 text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-3 rounded-full bg-slate-950 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to Dealership</span>
            )}
          </button>
        </form>
      </div>

      <div className="relative z-10 pt-4 text-center">
        <p className="inline-block rounded-full bg-white/70 px-4 py-2 text-xs text-slate-700 backdrop-blur-sm">
          Don&apos;t have a dealership yet?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-blue-700 font-semibold hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
};
