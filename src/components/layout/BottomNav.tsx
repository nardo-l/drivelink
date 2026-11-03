import React from 'react';
import { Home, Car, MessageCircle, MoreVertical } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

type Tab = { label: string; path: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };

const tabs: Tab[] = [
  { label: 'Home', path: '/app', icon: Home },
  { label: 'Garage', path: '/app/vehicles', icon: Car },
  { label: 'Enquiries', path: '/app/enquiries', icon: MessageCircle },
];

export const BottomNav: React.FC = () => {
  const { currentPath, navigate } = useNavigation();
  const isActive = (path: string) => path === '/app'
    ? currentPath === '/app'
    : currentPath === path || currentPath.startsWith(path + '/');
  const moreActive = isActive('/app/more');

  return (
    <nav
      aria-label="Dealer navigation"
      className="fixed z-[70] flex items-center gap-[10px]"
      style={{
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        width: 'calc(100% - 32px)',
        maxWidth: '420px',
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex h-16 min-w-0 flex-1 items-center rounded-full border border-[#EFEFEF] bg-white p-1 shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-150 active:scale-95 ${active ? 'bg-[#ECE8E6] text-[#111111]' : 'bg-transparent text-gray-500'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[11px] font-medium leading-4">{label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => navigate('/app/more')}
        aria-label="More"
        aria-current={moreActive ? 'page' : undefined}
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#EFEFEF] shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-colors duration-150 active:scale-95 ${moreActive ? 'bg-[#ECE8E6] text-[#111111]' : 'bg-white text-gray-500'}`}
      >
        <MoreVertical size={22} strokeWidth={moreActive ? 2.4 : 1.8} />
      </button>
    </nav>
  );
};
