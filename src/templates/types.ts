import type { Dealership, Vehicle } from '../types';

export type TemplateId =
  | 'prestige'
  | 'minimalist'
  | 'street'
  | 'luxury'
  | 'adventure'
  | 'tech'
  | 'lifestyle'
  | 'gallery';

export interface TemplateShowroomProps {
  dealer: Dealership;
  vehicles: Vehicle[];
  showPoweredBy: boolean;
  onVehicleClick: (vehicleId: string) => void;
  onContactClick: () => void;
  onWhatsAppClick: () => void;
  onShare: () => void;
  isPreview?: boolean;
  initialTab?: 'home' | 'inventory' | 'saved' | 'contact';
}

export interface TemplateVehicleDetailProps {
  dealer: Dealership;
  vehicle: Vehicle;
  allVehicles?: Vehicle[];
  showPoweredBy?: boolean;
  onBack: () => void;
  onShare: () => void;
  onWhatsAppClick: () => void;
  onVehicleClick: (vehicleId: string) => void;
}

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  isAvailable: boolean;
  theme: {
    isDark: boolean;
    primaryBg: string;
    cardBg: string;
    textPrimary: string;
    textMuted: string;
    defaultAccent: string;
  };
  Component: React.LazyExoticComponent<React.ComponentType<TemplateShowroomProps>>;
  DetailComponent: React.LazyExoticComponent<React.ComponentType<TemplateVehicleDetailProps>>;
}
