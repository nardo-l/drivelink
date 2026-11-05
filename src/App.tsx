import React from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { DeviceFrame } from './components/layout/DeviceFrame';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingFlow } from './pages/ConversationalOnboardingFlow';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { VehiclesListPage } from './pages/VehiclesListPage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';
import { AddEditVehiclePage } from './pages/AddEditVehiclePage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { MorePage } from './pages/MorePage';
import { SupportPage } from './pages/SupportPage';
import { BillingPage } from './pages/BillingPage';
import { PaywallPage } from './pages/PaywallPage';
import { supabase } from './lib/supabase';
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicShowroomPage } from './pages/PublicShowroomPage';
import { PublicVehicleDetailPage } from './pages/PublicVehicleDetailPage';
import { PublicStorefrontContactPage } from './pages/PublicStorefrontContactPage';
import { isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';
import { storageService } from './services/storage';
import { Check } from 'lucide-react';
import { BottomNav } from './components/layout/BottomNav';

function AppContent() {
  const { currentPath, navigate, toast, showToast } = useNavigation();
  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [subscriptionState, setSubscriptionState] = React.useState<'checking' | 'trial' | 'active' | 'expired' | 'unverified' | 'setup'>('checking');
  const [trialEndsAt, setTrialEndsAt] = React.useState<string | null>(null);
  const [accessEndsAt, setAccessEndsAt] = React.useState<string | null>(null);
  const [subscriptionServerNow, setSubscriptionServerNow] = React.useState(Date.now());
  const verifySubscription = React.useCallback(async () => {
    setSubscriptionState('checking');
    try {
      const { data, error } = await supabase.functions.invoke('drivelink-payments', { body: { action: 'status' } });
      if (error) throw error;
      const subscription = data?.subscription;
      const now = data?.server_now ? new Date(data.server_now).getTime() : Date.now();
      setSubscriptionServerNow(now);
      const trialValid = subscription?.status === 'trial' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now;
      const paidValid = subscription?.status === 'active' && subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > now;
      setTrialEndsAt(subscription?.trial_ends_at || null);
      setAccessEndsAt(trialValid ? subscription.trial_ends_at : paidValid ? subscription.current_period_end : null);
      setSubscriptionState(trialValid ? 'trial' : paidValid ? 'active' : 'expired');
    } catch (error) {
      console.warn('Subscription access verification failed:', error);
      setSubscriptionState('unverified');
    }
  }, []);
  React.useEffect(() => {
    const timer = window.setInterval(() => setSubscriptionServerNow(value => value + 60000), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const isDemo = storageService.isDemoModeActive();
  const isConfigured = isSupabaseConfigured();
  const previewQuery = typeof window !== 'undefined' ? `${window.location.search}&${window.location.hash.split('?')[1] || ''}` : '';
  const forceNotificationsPreview = import.meta.env.DEV && new URLSearchParams(previewQuery).get('onboarding') === 'notifications';

  // Restore authenticated Supabase session on page refresh
  React.useEffect(() => {
    if (isConfigured && !isDemo) {
      supabaseService.getSession().then(async (session) => {
        if (session?.user) {
          try {
            const liveDealer = await supabaseService.getCurrentDealership();
            if (liveDealer) {
              storageService.saveDealership(liveDealer);
              await verifySubscription();
            } else {
              setSubscriptionState('setup');
            }
            storageService.setUserSession({
              isLoggedIn: true,
              email: session.user.email || '',
              dealershipId: liveDealer?.id || '',
              userId: session.user.id,
            });
          } catch (err) {
            console.warn('Session restoration error:', err);
            storageService.clearSession();
          }
        } else {
          // No active Supabase session; ensure unauthenticated state
          storageService.clearSession();
          setSubscriptionState('setup');
        }
        setSessionChecked(true);
      }).catch((err) => {
        console.warn('Session check failed:', err);
        storageService.clearSession();
        setSessionChecked(true);
      });

      const sub = supabaseService.onAuthStateChange(async (session) => {
        if (session?.user) {
          try {
            const liveDealer = await supabaseService.getCurrentDealership();
            if (liveDealer) {
              storageService.saveDealership(liveDealer);
              await verifySubscription();
            } else {
              setSubscriptionState('setup');
            }
            storageService.setUserSession({
              isLoggedIn: true,
              email: session.user.email || '',
              dealershipId: liveDealer?.id || '',
              userId: session.user.id,
            });
          } catch (err) {
            console.warn('Auth change error:', err);
          }
        } else {
          storageService.clearSession();
          setSubscriptionState('setup');
          setTrialEndsAt(null);
          setAccessEndsAt(null);
        }
      });

      return () => {
        sub.unsubscribe();
      };
    } else {
      setSessionChecked(true);
    }
  }, [isConfigured, isDemo, verifySubscription]);

  React.useEffect(() => {
    const current = storageService.getUserSession();
    if (isConfigured && !isDemo && sessionChecked && current.isLoggedIn && current.dealershipId) {
      void verifySubscription();
    }
  }, [currentPath, sessionChecked, isConfigured, isDemo, verifySubscription]);

  React.useEffect(() => {
    if (!accessEndsAt || !['trial', 'active'].includes(subscriptionState)) return;
    const delay = new Date(accessEndsAt).getTime() - Date.now() + 1000;
    if (delay <= 0) {
      void verifySubscription();
      return;
    }
    const timer = window.setTimeout(() => void verifySubscription(), delay);
    return () => window.clearTimeout(timer);
  }, [accessEndsAt, subscriptionState, verifySubscription]);

  // Route matching logic
  const renderRoute = () => {
    // Resolve live auth before deciding between intro, setup and the dashboard.
    const isLive = isConfigured && !isDemo;
    const session = storageService.getUserSession();
    const isProtectedRoute = currentPath.startsWith('/app');
    if (forceNotificationsPreview) return <OnboardingFlow />;
    if (isLive && !sessionChecked) {
      return <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-gray-500">Loading your Drive Link account…</div>;
    }

    if (currentPath === '/welcome') return <WelcomePage />;

    // Public landing page stays separate from the current onboarding flow.
    // Returning dealers with a completed setup go straight to their dashboard.
    if (currentPath === '/' || currentPath === '') {
      if (isLive && session.isLoggedIn && session.dealershipId) { console.info('[DriveLink onboarding] Get notified skipped: redirected (existing dealership session).'); return <DashboardPage />; }
      if (isLive && session.isLoggedIn && !session.dealershipId) return <OnboardingFlow />;
      return <WelcomePage />;
    }

    // Sign-up and onboarding continue to use the current six-slide flow.
    if (currentPath === '/signup' || currentPath === '/onboarding') {
      if (isLive && session.isLoggedIn && session.dealershipId) { console.info('[DriveLink onboarding] Get notified skipped: redirected (existing dealership session).'); return <DashboardPage />; }
      return <OnboardingFlow />;
    }

    if (currentPath === '/login') {
      if (isLive && session.isLoggedIn) { if (session.dealershipId) { console.info('[DriveLink onboarding] Get notified skipped: redirected (existing dealership session).'); return <DashboardPage />; } return <OnboardingFlow />; }
      return <LoginPage />;
    }

    if (isProtectedRoute && isLive && !session.isLoggedIn) return <LoginPage />;
    if (isProtectedRoute && isLive && session.isLoggedIn && !session.dealershipId) return <OnboardingFlow />;

    // 5. Dealer Dashboard / Screen 03
    if (currentPath === '/app') {
      return <DashboardPage />;
    }

    // Analytics: live dealership metrics
    if (currentPath === '/app/analytics') {
      return <AnalyticsPage />;
    }

    if (currentPath.match(/^\/app\/vehicles\/[^/]+\/edit$/)) {
      const vehicleId = currentPath.split('/')[3];
      return <AddEditVehiclePage vehicleId={vehicleId} />;
    }

    const vehicleDetailMatchApp = currentPath.match(/^\/app\/vehicles\/([^/]+)$/);
    if (vehicleDetailMatchApp && !['new'].includes(vehicleDetailMatchApp[1])) {
      return <VehicleDetailPage vehicleId={vehicleDetailMatchApp[1]} />;
    }

    // 6. Inventory: Add new vehicle / Screen 04
    if (currentPath === '/app/vehicles/new') {
      return <AddEditVehiclePage />;
    }

    // 7. Inventory: Edit specific vehicle
    if (currentPath.startsWith('/app/vehicles/')) {
      const vehicleId = currentPath.replace('/app/vehicles/', '');
      return <AddEditVehiclePage vehicleId={vehicleId} />;
    }

    // 8. Inventory: All vehicles list
    if (currentPath === '/app/vehicles') {
      return <VehiclesListPage />;
    }

    // 9. Enquiries CRM
    if (currentPath === '/app/enquiries') {
      return <EnquiriesPage />;
    }

    if (currentPath === '/app/support') {
      return <SupportPage />;
    }

    if (currentPath === '/app/notifications') {
      return <NotificationsPage />;
    }

    if (currentPath === '/app/billing') {
      return <BillingPage />;
    }

    if (currentPath === '/app/more') {
      return <MorePage />;
    }

    // 10. Settings & Storefront configuration
    if (currentPath === '/app/settings' || currentPath === '/app/storefront') {
      return <SettingsPage />;
    }

    // Public dealership inventory browsing and contact routes
    const showroomBrowseMatch = currentPath.match(/^\/showroom\/([^/]+)\/browse\/?$/);
    if (showroomBrowseMatch) {
      return <PublicShowroomPage slug={decodeURIComponent(showroomBrowseMatch[1])} />;
    }

    const showroomContactMatch = currentPath.match(/^\/showroom\/([^/]+)\/contact\/?$/);
    if (showroomContactMatch) {
      return <PublicStorefrontContactPage slug={decodeURIComponent(showroomContactMatch[1])} />;
    }

    // 11. Public Vehicle Details: /showroom/:slug/vehicle/:id / Screen 06
    const vehicleDetailMatch = currentPath.match(/^\/showroom\/([^/]+)\/vehicle\/([^/]+)/);
    if (vehicleDetailMatch) {
      return <PublicVehicleDetailPage slug={decodeURIComponent(vehicleDetailMatch[1])} vehicleId={vehicleDetailMatch[2]} />;
    }

    // 12. Public Showroom: /showroom/:slug / Screen 05
    const showroomMatch = currentPath.match(/^\/showroom\/([^/]+)/);
    if (showroomMatch) {
      return <PublicShowroomPage slug={showroomMatch[1]} />;
    }

    // Vanity public showroom URLs: /dealership-slug, /dealership-slug/browse, /dealership-slug/contact
    const vanityVehicleMatch = currentPath.match(/^\/([^/]+)\/vehicle\/([^/]+)\/?$/);
    if (vanityVehicleMatch) {
      return <PublicVehicleDetailPage slug={decodeURIComponent(vanityVehicleMatch[1])} vehicleId={vanityVehicleMatch[2]} />;
    }
    const vanityBrowseMatch = currentPath.match(/^\/([^/]+)\/browse\/?$/);
    if (vanityBrowseMatch) {
      return <PublicShowroomPage slug={decodeURIComponent(vanityBrowseMatch[1])} />;
    }
    const vanityContactMatch = currentPath.match(/^\/([^/]+)\/contact\/?$/);
    if (vanityContactMatch) {
      return <PublicStorefrontContactPage slug={decodeURIComponent(vanityContactMatch[1])} />;
    }
    const vanityShowroomMatch = currentPath.match(/^\/([^/]+)\/?$/);
    if (vanityShowroomMatch) {
      return <PublicShowroomPage slug={decodeURIComponent(vanityShowroomMatch[1])} />;
    }

    // Fallback: Welcome page
    return <WelcomePage />;
  };

  const currentSession = storageService.getUserSession();
  const dealerAppRoute = currentSession.isLoggedIn && !!currentSession.dealershipId && (currentPath.startsWith('/app') || ['/', '/login', '/signup', '/onboarding'].includes(currentPath));
  const trialRemainingMs = trialEndsAt ? new Date(trialEndsAt).getTime() - subscriptionServerNow : null;
  const trialDaysLeft = trialRemainingMs !== null ? Math.ceil(trialRemainingMs / 86400000) : null;
  const trialHoursLeft = trialRemainingMs !== null ? Math.max(0, Math.floor(trialRemainingMs / 3600000)) : 0;
  const trialMinutesLeft = trialRemainingMs !== null ? Math.max(0, Math.floor((trialRemainingMs % 3600000) / 60000)) : 0;
  const paidDaysLeft = accessEndsAt ? Math.ceil((new Date(accessEndsAt).getTime() - subscriptionServerNow) / 86400000) : null;
  const forcePaywall = !forceNotificationsPreview && isConfigured && !isDemo && dealerAppRoute && currentSession.isLoggedIn && !!currentSession.dealershipId && subscriptionState === 'expired';
  const blockUntilVerified = !forceNotificationsPreview && isConfigured && !isDemo && dealerAppRoute && currentSession.isLoggedIn && !!currentSession.dealershipId && ['checking', 'unverified'].includes(subscriptionState);

  return (
    <DeviceFrame>

      {!forcePaywall && !blockUntilVerified && dealerAppRoute && (
        (subscriptionState === 'trial' && trialRemainingMs !== null && trialRemainingMs > 0 && trialRemainingMs <= 2 * 86400000) ||
        (subscriptionState === 'active' && paidDaysLeft !== null && paidDaysLeft > 0 && paidDaysLeft <= 5)
      ) && <div className={`sticky top-0 z-30 flex min-h-[40px] items-center justify-center gap-2 border-b border-[#e5e7eb] px-3 py-2 text-center text-[11px] font-medium text-[#0A0F1E] ${subscriptionState === 'trial' && trialRemainingMs !== null && trialRemainingMs <= 6 * 3600000 ? 'bg-[#fff8eb]' : 'bg-[#f3f4f6]'}`} style={{paddingTop:'max(8px, env(safe-area-inset-top))'}}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${subscriptionState === 'trial' && trialRemainingMs !== null && trialRemainingMs <= 6 * 3600000 ? 'bg-amber-500' : 'bg-[#0A0F1E]'}`} />
        <span>{subscriptionState === 'trial'
          ? trialRemainingMs! <= 6 * 3600000
            ? 'Your free trial ends today'
            : trialRemainingMs! < 86400000
              ? `Free trial ends in ${trialHoursLeft}h ${trialMinutesLeft}m`
              : `${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left in your free trial`
          : `Pro renews in ${paidDaysLeft} days ·`}</span>
        <button onClick={() => navigate('/app/billing')} className="shrink-0 font-extrabold underline underline-offset-2">{subscriptionState === 'trial' ? 'View plans' : 'Renew'}</button>
      </div>}
      {forcePaywall || (blockUntilVerified && subscriptionState === 'unverified') ? <PaywallPage /> : blockUntilVerified ? <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6 text-center text-sm text-gray-500">Verifying your DriveLink subscription…</div> : renderRoute()}
      {!forcePaywall && !blockUntilVerified && (['/app', '/app/vehicles', '/app/enquiries', '/app/more'].includes(currentPath) || (currentPath === '/' && storageService.getUserSession().isLoggedIn && !!storageService.getUserSession().dealershipId)) && <BottomNav />}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </DeviceFrame>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
}
