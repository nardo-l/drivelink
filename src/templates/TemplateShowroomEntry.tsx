import React, { Suspense } from 'react';
import { resolveTemplate } from './registry';
import { TemplateSkeleton } from './common/TemplateSkeleton';
import type { Dealership, Vehicle } from '../types';

interface TemplateShowroomEntryProps {
  dealer: Dealership;
  vehicles: Vehicle[];
  showPoweredBy: boolean;
  onVehicleClick: (vehicleId: string) => void;
  onContactClick: () => void;
  onShare: () => void;
  initialTab?: 'home' | 'inventory' | 'saved' | 'contact';
  fallbackComponent: React.ReactNode;
}

/**
 * Dispatches to the active template if recognized and available.
 * Gracefully falls back to fallbackComponent (classic showroom) if template is
 * unrecognized, legacy ('signature', 'inventory_first', 'independent'), or null.
 */
export const TemplateShowroomEntry: React.FC<TemplateShowroomEntryProps> = ({
  dealer,
  vehicles,
  showPoweredBy,
  onVehicleClick,
  onContactClick,
  onShare,
  initialTab,
  fallbackComponent,
}) => {
  const activeTemplate = resolveTemplate(dealer.template);

  if (!activeTemplate) {
    return <>{fallbackComponent}</>;
  }

  const Component = activeTemplate.Component;
  return (
    <Suspense fallback={<TemplateSkeleton isDark={activeTemplate.theme.isDark} />}>
      <Component
        dealer={dealer}
        vehicles={vehicles}
        showPoweredBy={showPoweredBy}
        onVehicleClick={onVehicleClick}
        onContactClick={onContactClick}
        onShare={onShare}
        initialTab={initialTab}
      />
    </Suspense>
  );
};
