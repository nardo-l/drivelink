import React from 'react';
import { Home, Car, MessageSquare, Settings } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { storageService } from '../../services/storage';

export const BottomNav: React.FC = () => {
  const { currentPath, navigate } = useNavigation();
  const enquiries = storageService.getEnquiries();
  const newEnquiriesCount = enquiries.filter((e) => e.stage === 'new').length;

  const navItems = [
    { label: 'Home', path: '/app', icon: Home },
    { label: 'Vehicles', path: '/app/vehicles', icon: Car },
    { label: 'Enquiries', path: '/app/enquiries', icon: MessageSquare, badge: newEnquiriesCount },
    { label: 'Settings', path: '/app/settings', icon: Settings },
  ];

  return (
    <nav className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 py-2 flex items-center justify-around shrink-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === '/app'
            ? currentPath === '/app'
            : currentPath.startsWith(item.path);

        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 relative transition-colors ${
              isActive ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 text-slate-950 stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </div>
            <span className={`text-[11px] mt-1 ${isActive ? 'font-semibold text-slate-900' : 'font-medium'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
