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
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicShowroomPage } from './pages/PublicShowroomPage';
import { PublicVehicleDetailPage } from './pages/PublicVehicleDetailPage';
import { PublicStorefrontBrowsePage } from './pages/PublicStorefrontBrowsePage';
import { PublicStorefrontContactPage } from './pages/PublicStorefrontContactPage';
import { isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';
import { storageService } from './services/storage';
import { Check } from 'lucide-react';

function AppContent() {
  const { currentPath, navigate, toast, showToast } = useNavigation();
  const [sessionChecked, setSessionChecked] = React.useState(false);
  const isDemo = storageService.isDemoModeActive();
  const isConfigured = isSupabaseConfigured();

  // Restore authenticated Supabase session on page refresh
  React.useEffect(() => {
    if (isConfigured && !isDemo) {
      supabaseService.getSession().then(async (session) => {
        if (session?.user) {
          try {
            const liveDealer = await supabaseService.getCurrentDealership();
            if (liveDealer) {
              storageService.saveDealership(liveDealer);
            }
            storageService.setUserSession({
              isLoggedIn: true,
              email: session.user.email || '',
              dealershipId: liveDealer?.id || '',
            });
          } catch (err) {
            console.warn('Session restoration error:', err);
          }
        } else {
          // No active Supabase session; ensure unauthenticated state
          storageService.clearSession();
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
            }
            storageService.setUserSession({
              isLoggedIn: true,
              email: session.user.email || '',
              dealershipId: liveDealer?.id || '',
            });
          } catch (err) {
            console.warn('Auth change error:', err);
          }
        } else {
          storageService.clearSession();
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
    if (isLive && !sessionChecked) {
      return <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-gray-500">Loading your Drive Link account…</div>;
    }

    if (currentPath === '/welcome') return <WelcomePage />;

    // The six-slide introduction and the required setup are one flow.
    if (currentPath === '/' || currentPath === '' || currentPath === '/signup' || currentPath === '/onboarding') {
      if (isLive && session.isLoggedIn && session.dealershipId) return <DashboardPage />;
      return <OnboardingFlow />;
    }

    if (currentPath === '/login') {
      if (isLive && session.isLoggedIn) return session.dealershipId ? <DashboardPage /> : <OnboardingFlow />;
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
      return <PublicStorefrontBrowsePage slug={decodeURIComponent(showroomBrowseMatch[1])} />;
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
      return <PublicStorefrontBrowsePage slug={decodeURIComponent(vanityBrowseMatch[1])} />;
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

      {renderRoute()}

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
