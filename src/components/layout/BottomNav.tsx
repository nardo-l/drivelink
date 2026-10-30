import React from 'react';
import { Home, Car, MessageSquare, Settings, BarChart3 } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { storageService } from '../../services/storage';

export const BottomNav: React.FC = () => {
  const { currentPath, navigate } = useNavigation();
  const enquiries = storageService.getEnquiries();
  const newEnquiriesCount = enquiries.filter((e) => e.stage === 'new').length;

  const navItems = [
    { label: 'Home', path: '/app', icon: Home },
    { label: 'Inventory', path: '/app/vehicles', icon: Car },
    { label: 'Leads', path: '/app/enquiries', icon: MessageSquare, badge: newEnquiriesCount },
    { label: 'Analytics', path: '/app/analytics', icon: BarChart3 },
    { label: 'Profile', path: '/app/settings', icon: Settings },
  ];

  return (
    <nav aria-label="Main navigation" className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/[0.06] px-2 pt-2 pb-safe flex items-center justify-around shrink-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.path === '/app' ? currentPath === '/app' : currentPath.startsWith(item.path);
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[58px] min-h-[48px] px-2 py-1 relative rounded-xl transition-colors ${isActive ? 'text-black' : 'text-[#a1a1a8] hover:text-[#55565c]'}`}
          >
            <span className="relative">
              <Icon className={`w-[19px] h-[19px] ${isActive ? 'stroke-[2.4]' : 'stroke-[1.7]'}`} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-black text-white font-bold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </span>
            <span className={`text-[9px] mt-1 tracking-wide ${isActive ? 'font-extrabold' : 'font-semibold'}`}>{item.label}</span>
            {isActive && <span className="absolute top-0 w-5 h-[2px] rounded-full bg-black" />}
          </button>
        );
      })}
    </nav>
  );
};
