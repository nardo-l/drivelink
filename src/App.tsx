import React from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { DeviceFrame } from './components/layout/DeviceFrame';
import { WelcomePage } from './pages/WelcomePage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingFlow } from './pages/OnboardingFlow';
import { DashboardPage } from './pages/DashboardPage';
import { VehiclesListPage } from './pages/VehiclesListPage';
import { AddEditVehiclePage } from './pages/AddEditVehiclePage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicShowroomPage } from './pages/PublicShowroomPage';
import { PublicVehicleDetailPage } from './pages/PublicVehicleDetailPage';
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
    // 1. Welcome / Screen 01
    if (currentPath === '/' || currentPath === '') {
      return <WelcomePage />;
    }

    // 2. Signup / Screen 02
    if (currentPath === '/signup') {
      return <SignupPage />;
    }

    // 3. Login
    if (currentPath === '/login') {
      return <LoginPage />;
    }

    // 4. Onboarding setup wizard
    if (currentPath === '/onboarding') {
      return <OnboardingFlow />;
    }

    // Route Protection: enforce real Supabase session for /app routes
    const isLive = isConfigured && !isDemo;
    const session = storageService.getUserSession();
    const isProtectedRoute = currentPath.startsWith('/app');

    if (isProtectedRoute && isLive && !session.isLoggedIn) {
      return <LoginPage />;
    }

    // 5. Dealer Dashboard / Screen 03
    if (currentPath === '/app') {
      return <DashboardPage />;
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

    // 10. Settings & Storefront configuration
    if (currentPath === '/app/settings' || currentPath === '/app/storefront') {
      return <SettingsPage />;
    }

    // 11. Public Vehicle Details: /showroom/:slug/vehicle/:id / Screen 06
    const vehicleDetailMatch = currentPath.match(/^\/showroom\/([^/]+)\/vehicle\/([^/]+)/);
    if (vehicleDetailMatch) {
      return <PublicVehicleDetailPage vehicleId={vehicleDetailMatch[2]} />;
    }

    // 12. Public Showroom: /showroom/:slug / Screen 05
    const showroomMatch = currentPath.match(/^\/showroom\/([^/]+)/);
    if (showroomMatch) {
      return <PublicShowroomPage slug={showroomMatch[1]} />;
    }

    // Fallback: Welcome page
    return <WelcomePage />;
  };

  const handleExitDemoMode = () => {
    storageService.setDemoModeActive(false);
    showToast('Exited Demo Mode. Connected to live Supabase.');
    navigate('/login');
  };

  return (
    <DeviceFrame>
      {/* Top Banner when Demo Mode is explicitly active on a configured backend */}
      {isConfigured && isDemo && (
        <div className="bg-amber-500 text-slate-950 px-3 py-1.5 text-[11px] font-bold flex items-center justify-between border-b border-amber-600/30 sticky top-0 z-40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            <span>Demo Mode (Local Mock Data)</span>
          </div>
          <button
            onClick={handleExitDemoMode}
            className="px-2 py-0.5 rounded bg-slate-950 text-white font-semibold text-[10px] hover:bg-slate-800 transition-colors"
          >
            Exit Demo
          </button>
        </div>
      )}

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
