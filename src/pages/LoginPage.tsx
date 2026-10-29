import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ONBOARDING_CAR_ILLUSTRATION } from '../utils/carVisuals';
import { ArrowLeft, Eye, EyeOff, Sparkles, Database, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (isLive) {
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
          // User exists in Supabase Auth but hasn't created a dealership yet
          showToast('Please complete your dealership setup.');
          navigate('/onboarding');
        }
      } catch (err: any) {
        console.error('Supabase login error:', err);
        setAuthError(err?.message || 'Invalid email or password. Please verify your Supabase credentials.');
      } finally {
        setLoading(false);
      }
    } else {
      // Local Demo mode fallback
      storageService.setDemoModeActive(true);
      showToast('Switched to Demo Mode with sample inventory');
      setLoading(false);
      navigate('/app');
    }
  };

  const handleEnableDemoMode = () => {
    storageService.setDemoModeActive(true);
    showToast('Activated Demo Mode (Sample Data)');
    navigate('/app');
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between px-6 py-6 bg-white text-slate-900">
      <div className="relative z-10 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Live</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              <Database className="w-3 h-3 text-slate-400" />
              <span>Local Demo</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleEnableDemoMode}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Explore Demo</span>
          </button>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center my-auto">
        <div className="w-36 h-24 mb-2 flex items-center justify-center">
          <img
            src={ONBOARDING_CAR_ILLUSTRATION}
            alt="Car mascot"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
          Welcome back
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Sign in to manage your vehicle inventory and buyer leads.
        </p>

        {authError && (
          <div className="w-full max-w-sm mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{authError}</p>
              {isLive && (
                <p className="text-[11px] text-rose-600/90 mt-1">
                  Tip: If your user doesn&apos;t exist in Supabase Auth yet, create an account using Onboarding or test with demo login.
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-3.5 mt-5 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dealer@example.com"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
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
        <p className="text-xs text-slate-500">
          Don&apos;t have a dealership yet?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-blue-600 font-semibold hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
};
