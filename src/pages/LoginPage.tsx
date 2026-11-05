import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ArrowRight, Eye, EyeOff, Loader2, AlertCircle, Mail, LockKeyhole } from 'lucide-react';
import { MARKETING_CAR_IMAGES } from '../utils/marketingCarImages';
import { DriveLinkLogo } from '../components/common/DriveLinkLogo';

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

    try {
      const { user } = await supabaseService.signIn(email.trim(), password);
      if (!user) throw new Error('Sign in succeeded but no user data returned.');

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
        userId: user.id,
      });

      showToast('Signed in via Supabase! Welcome back.');
      if (dealershipId) {
        navigate('/app');
      } else {
        try { localStorage.setItem('drivelink_intro_completed_v1', 'true'); } catch {}
        showToast('Please complete your dealership setup.');
        navigate('/onboarding');
      }
    } catch (err: any) {
      console.error('Supabase login error:', err);
      setAuthError(err?.message || 'Invalid email or password. Please verify your Supabase credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dl-login-page">
      <div className="dl-login-ambient" aria-hidden="true" />
      <section className="dl-login-panel" aria-label="DriveLink dealer sign in">
        <div className="dl-login-hero">
          <img
            className="dl-login-car-image"
            src={MARKETING_CAR_IMAGES.hero}
            alt="Premium vehicle outside a modern dealership"
            fetchPriority="high"
          />
          <div className="dl-login-hero-shade" aria-hidden="true" />
          <div className="dl-login-brand"><DriveLinkLogo variant="light" size="md" showTagline /></div>

          <div className="dl-login-intro">
            <h1>Welcome back</h1>
            <p>Manage your vehicle inventory<br className="hidden sm:block" /> and buyer enquiries.</p>
            <span className="dl-login-rule" />
          </div>
        </div>

        <div className="dl-login-form-area">
          {authError && (
            <div role="alert" className="dl-login-error">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <p>{authError}</p>
                {isLive && <small>If you don&apos;t have an account yet, create one to set up your dealership.</small>}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="dl-login-form">
            <div className="dl-login-field">
              <span className="sr-only">Email address</span>
              <Mail size={23} aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
              />
            </div>

            <div className="dl-login-field">
              <span className="sr-only">Password</span>
              <LockKeyhole size={23} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="dl-login-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
              </button>
            </div>

            <button type="submit" disabled={loading} className="dl-login-submit">
              <span>{loading ? 'Signing in...' : 'Sign in to Dealership'}</span>
              {loading ? <Loader2 size={23} className="animate-spin" /> : <ArrowRight size={27} />}
            </button>
          </form>

          <div className="dl-login-signup">
            <span className="dl-login-signup-line" />
            <p>Don&apos;t have an account? <button onClick={() => { try { localStorage.setItem('drivelink_intro_completed_v1', 'true'); } catch {} navigate('/signup'); }}>Sign Up</button></p>
            <span className="dl-login-signup-line" />
          </div>
        </div>
      </section>
    </main>
  );
};
