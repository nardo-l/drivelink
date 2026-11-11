import { name, pageTitle, homeTitle, updateBrandMetadata } from './config/brand';
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
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicShowroomPage } from './pages/PublicShowroomPage';
import { PublicVehicleDetailPage } from './pages/PublicVehicleDetailPage';
import { PublicStorefrontContactPage } from './pages/PublicStorefrontContactPage';
import { isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';
import { storageService } from './services/storage';
import { Check } from 'lucide-react';
import { BottomNav } from './components/layout/BottomNav';
import { NotificationPermissionPrompt } from './components/layout/NotificationPermissionPrompt';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PwaInstallProvider } from './context/PwaInstallContext';

function LegacyStorefrontRedirect({ slug }: { slug: string }) {
  const { navigate } = useNavigation();
  React.useEffect(() => { navigate('/' + encodeURIComponent(slug)); }, [navigate, slug]);
  return null;
}

function AppContent() {
  const safeDashboard = () => <ErrorBoundary label="dashboard"><DashboardPage /></ErrorBoundary>;
  const { currentPath, toast } = useNavigation();
  React.useEffect(() => {
    const page = currentPath === '/' || currentPath === '' ? homeTitle : currentPath.split('/').filter(Boolean).slice(-1)[0]?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || name;
    updateBrandMetadata({ title: currentPath === '/' || currentPath === '' ? homeTitle : pageTitle(page) });
  }, [currentPath]);
  const [sessionChecked, setSessionChecked] = React.useState(false);
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
            await storageService.syncUserScope(session.user.id);
            const liveDealer = await supabaseService.getCurrentDealership();
            if (liveDealer) {
              storageService.saveDealership(liveDealer);
            } else {
              storageService.clearCachedDealership();
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
          // No active Supabase session; clear all account-scoped device data.
          await storageService.clearAppUserData();
        }
        setSessionChecked(true);
      }).catch((err) => {
        console.warn('Session check failed:', err);
        storageService.clearSession();
        setSessionChecked(true);
      });

      const sub = supabaseService.onAuthStateChange(async (session) => {
        // Gate protected screens while account-scoped data and in-memory page state are replaced.
        setSessionChecked(false);
        if (session?.user) {
          try {
            await storageService.syncUserScope(session.user.id);
            const liveDealer = await supabaseService.getCurrentDealership();
            if (liveDealer) {
              storageService.saveDealership(liveDealer);
            } else {
              storageService.clearCachedDealership();
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
          setSessionChecked(true);
        } else {
          // Sign-out must not leave another account's dealership or records on-device.
          await storageService.clearAppUserData();
          setSessionChecked(true);
        }
      });

      return () => {
        sub.unsubscribe();
      };
    } else {
      setSessionChecked(true);
    }
  }, [isConfigured, isDemo]);

  // Route matching logic
  const renderRoute = () => {
    // Resolve live auth before deciding between intro, setup and the dashboard.
    const isLive = isConfigured && !isDemo;
    const session = storageService.getUserSession();
    const isProtectedRoute = currentPath.startsWith('/app');
    if (forceNotificationsPreview) return <OnboardingFlow />;
    if (isLive && !sessionChecked) {
      return <div className="min-h-[100dvh] bg-[#f4f4f3] px-5 py-8" aria-label="Loading account">
        <div className="mx-auto w-full max-w-[520px] animate-pulse space-y-5">
          <div className="h-10 w-36 rounded-xl bg-gray-200" />
          <div className="h-28 rounded-2xl bg-white" />
          <div className="grid grid-cols-2 gap-3"><div className="h-28 rounded-2xl bg-white"/><div className="h-28 rounded-2xl bg-white"/></div>
          <div className="h-44 rounded-2xl bg-white" />
        </div>
      </div>;
    }

    if (currentPath === '/welcome') return <WelcomePage />;

    // Public landing page stays separate from the current onboarding flow.
    // Returning dealers with a completed setup go straight to their dashboard.
    if (currentPath === '/' || currentPath === '') {
      if (isLive && session.isLoggedIn && session.dealershipId) { console.info('[${name} onboarding] Get notified skipped: redirected (existing dealership session).'); return safeDashboard(); }
      if (isLive && session.isLoggedIn && !session.dealershipId) return <OnboardingFlow />;
      return <WelcomePage />;
    }

    // Sign-up and onboarding continue to use the current six-slide flow.
    if (currentPath === '/signup') {
      // Explicit sign-up always creates a separate account, even if another user is signed in.
      return <OnboardingFlow forceNewAccount />;
    }

    if (currentPath === '/onboarding') {
      if (isLive && session.isLoggedIn && session.dealershipId) { console.info(`[${name} onboarding] Get notified skipped: redirected (existing dealership session).`); return safeDashboard(); }
      return <OnboardingFlow />;
    }

    if (currentPath === '/login') {
      // Keep the sign-in form available so a different account can replace the
      // currently active session and restore its own server-side onboarding.
      return <LoginPage />;
    }

    if (isProtectedRoute && isLive && !session.isLoggedIn) return <LoginPage />;
    if (isProtectedRoute && isLive && session.isLoggedIn && !session.dealershipId) return <OnboardingFlow />;

    // 5. Dealer Dashboard / Screen 03
    if (currentPath === '/app') {
      return safeDashboard();
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

    if (currentPath === '/app/upgrade') {
      return <PaywallPage />;
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
    const showroomBrowseMatch = currentPath.match(/^\/showroom\/([^/]+)\/(?:cars|browse)\/?$/);
    if (showroomBrowseMatch) {
      return <LegacyStorefrontRedirect slug={decodeURIComponent(showroomBrowseMatch[1])} />;
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
      return <LegacyStorefrontRedirect slug={decodeURIComponent(showroomMatch[1])} />;
    }

    // Vanity public showroom URLs: /dealership-slug, /dealership-slug/browse, /dealership-slug/contact
    const vanityVehicleMatch = currentPath.match(/^\/([^/]+)\/vehicle\/([^/]+)\/?$/);
    if (vanityVehicleMatch) {
      return <PublicVehicleDetailPage slug={decodeURIComponent(vanityVehicleMatch[1])} vehicleId={vanityVehicleMatch[2]} />;
    }
    const vanityBrowseMatch = currentPath.match(/^\/([^/]+)\/(?:cars|browse)\/?$/);
    if (vanityBrowseMatch) {
      return <LegacyStorefrontRedirect slug={decodeURIComponent(vanityBrowseMatch[1])} />;
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


  return (
    <DeviceFrame>

      <ErrorBoundary label={`${currentPath || 'home'} page`}>{renderRoute()}</ErrorBoundary>
      <NotificationPermissionPrompt />
      {(['/app', '/app/vehicles', '/app/enquiries', '/app/more'].includes(currentPath) || (currentPath === '/' && storageService.getUserSession().isLoggedIn && !!storageService.getUserSession().dealershipId)) && <BottomNav />}

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
    <ErrorBoundary label="application">
      <PwaInstallProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </PwaInstallProvider>
    </ErrorBoundary>
  );
}
