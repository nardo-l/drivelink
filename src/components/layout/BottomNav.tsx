import React from 'react';
import { Home, CarFront, UsersRound, LayoutGrid } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { storageService } from '../../services/storage';

export const BottomNav: React.FC = () => {
  const { currentPath, navigate } = useNavigation();
  const enquiries = storageService.getEnquiries();
  const newEnquiriesCount = enquiries.filter((enquiry) => enquiry.stage === 'new').length;

  const navItems = [
    { label: 'Home', path: '/app', icon: Home },
    { label: 'Garage', path: '/app/vehicles', icon: CarFront },
    { label: 'Leads', path: '/app/enquiries', icon: UsersRound, badge: newEnquiriesCount },
    { label: 'More', path: '/app/more', icon: LayoutGrid },
  ];

  const normalizedPath = currentPath.replace(/\\/+$/, '') || '/';
  const isItemActive = (path: string) => {
    if (path === '/app') return normalizedPath === '/app';
    if (path === '/app/vehicles') return normalizedPath === path || normalizedPath.startsWith(`${path}/`);
    if (path === '/app/enquiries') return normalizedPath === path || normalizedPath.startsWith(`${path}/`);
    // Analytics, settings, billing, notifications and support live under More.
    return [
      '/app/more',
      '/app/analytics',
      '/app/settings',
      '/app/storefront',
      '/app/billing',
      '/app/notifications',
      '/app/support',
    ].some((morePath) => normalizedPath === morePath || normalizedPath.startsWith(`${morePath}/`));
  };

  return (
    <nav
      aria-label="Main navigation"
      className="dl-bottom-nav fixed z-40 flex items-center"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isItemActive(item.path);

        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            className={`dl-bottom-nav-item ${isActive ? 'is-active' : ''}`}
          >
            <span className="dl-bottom-nav-icon-wrap">
              <Icon aria-hidden="true" className="dl-bottom-nav-icon" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="dl-bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </span>
            <span className="dl-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
