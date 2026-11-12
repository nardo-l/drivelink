import React from 'react';
import type { TemplateDefinition, TemplateId } from './types';

// Lazy-load Phase 1 template implementations
const PrestigeShowroom = React.lazy(() => import('./prestige/PrestigeTemplate'));
const PrestigeDetail = React.lazy(() => import('./prestige/PrestigeVehicleDetail'));

const MinimalistShowroom = React.lazy(() => import('./minimalist/MinimalistTemplate'));
const MinimalistDetail = React.lazy(() => import('./minimalist/MinimalistVehicleDetail'));

export const TEMPLATES_REGISTRY: Record<TemplateId, TemplateDefinition> = {
  prestige: {
    id: 'prestige',
    name: 'Prestige',
    tagline: 'Cinematic. Bold. Premium.',
    description: 'Moody dark aesthetics, glowing accents, and high-impact hero vehicle spotlight.',
    badge: '1. Prestige',
    isAvailable: true,
    theme: {
      isDark: true,
      primaryBg: '#0B0D13',
      cardBg: '#141824',
      textPrimary: '#FFFFFF',
      textMuted: '#8E95A5',
      defaultAccent: '#7C3AED',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
    tagline: 'Clean. Spacious. Focused.',
    description: 'Airy light theme, crisp typography, and refined modern cards that highlight inventory.',
    badge: '2. Minimalist',
    isAvailable: true,
    theme: {
      isDark: false,
      primaryBg: '#F8F9FA',
      cardBg: '#FFFFFF',
      textPrimary: '#111827',
      textMuted: '#6B7280',
      defaultAccent: '#111827',
    },
    Component: MinimalistShowroom,
    DetailComponent: MinimalistDetail,
  },
  street: {
    id: 'street',
    name: 'Street',
    tagline: 'Bold. Energetic. Youthful.',
    description: 'Dynamic crimson red accents, speed slashes, and performance-driven layout.',
    badge: '3. Street',
    isAvailable: false,
    theme: {
      isDark: true,
      primaryBg: '#0A0A0E',
      cardBg: '#17171C',
      textPrimary: '#FFFFFF',
      textMuted: '#9CA3AF',
      defaultAccent: '#EF4444',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
  luxury: {
    id: 'luxury',
    name: 'Luxury',
    tagline: 'Elegant. Sophisticated. Exclusive.',
    description: 'Warm obsidian and champagne gold tones with refined editorial serif typography.',
    badge: '4. Luxury',
    isAvailable: false,
    theme: {
      isDark: true,
      primaryBg: '#0D0C0B',
      cardBg: '#1C1917',
      textPrimary: '#FAF5EE',
      textMuted: '#A8A29E',
      defaultAccent: '#D97706',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
  adventure: {
    id: 'adventure',
    name: 'Adventure',
    tagline: 'Rugged. Outdoor. Bold.',
    description: 'Warm outdoor earth tones, trail-ready bakkie styling, and terrain categories.',
    badge: '5. Adventure',
    isAvailable: false,
    theme: {
      isDark: true,
      primaryBg: '#10151A',
      cardBg: '#1A2129',
      textPrimary: '#F3F4F6',
      textMuted: '#94A3B8',
      defaultAccent: '#EA580C',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
  tech: {
    id: 'tech',
    name: 'Tech',
    tagline: 'Modern. Smart. Innovative.',
    description: 'Electric blue cyberpunk glow, glassmorphic stat chips, and EV-inspired styling.',
    badge: '6. Tech',
    isAvailable: false,
    theme: {
      isDark: true,
      primaryBg: '#070D18',
      cardBg: '#0E1A2D',
      textPrimary: '#F0F9FF',
      textMuted: '#7DD3FC',
      defaultAccent: '#0284C7',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
  lifestyle: {
    id: 'lifestyle',
    name: 'Lifestyle',
    tagline: 'Inspirational. Aspirational. Premium.',
    description: 'Warm sunset ambiance, friendly expressive script headlines, and family-first focus.',
    badge: '7. Lifestyle',
    isAvailable: false,
    theme: {
      isDark: false,
      primaryBg: '#FDFBF7',
      cardBg: '#FFFFFF',
      textPrimary: '#1C1917',
      textMuted: '#78716C',
      defaultAccent: '#F59E0B',
    },
    Component: MinimalistShowroom,
    DetailComponent: MinimalistDetail,
  },
  gallery: {
    id: 'gallery',
    name: 'Gallery',
    tagline: 'Visual. Immersive. Modern.',
    description: 'Visual masonry 2x2 grid letting high-resolution automotive imagery take center stage.',
    badge: '8. Gallery',
    isAvailable: false,
    theme: {
      isDark: true,
      primaryBg: '#09090B',
      cardBg: '#18181B',
      textPrimary: '#FAFAFA',
      textMuted: '#A1A1AA',
      defaultAccent: '#FFFFFF',
    },
    Component: PrestigeShowroom,
    DetailComponent: PrestigeDetail,
  },
};

export const TEMPLATES_LIST: TemplateDefinition[] = Object.values(TEMPLATES_REGISTRY);

/**
 * Resolves a template definition by id.
 * Returns null if the template is not recognized, not yet available,
 * or is a legacy value ('signature', 'inventory_first', 'independent'),
 * signaling fallback to the classic default showroom.
 */
export function resolveTemplate(templateId?: string | null): TemplateDefinition | null {
  if (!templateId) return null;
  const normalized = templateId.toLowerCase().trim() as TemplateId;
  const def = TEMPLATES_REGISTRY[normalized];
  if (def && def.isAvailable) {
    return def;
  }
  return null;
}
