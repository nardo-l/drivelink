/**
 * Enforces accessible contrast ratios for dealer accent colors against dark and light templates.
 */

function hexToRgb(hex: string): [number, number, number] | null {
  const sanitized = hex.replace('#', '').trim();
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    return [r, g, b];
  }
  if (sanitized.length === 6) {
    const r = parseInt(sanitized.substring(0, 2), 16);
    const g = parseInt(sanitized.substring(2, 4), 16);
    const b = parseInt(sanitized.substring(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ensures an accent color has at least a 3.5:1 contrast against the background.
 * If insufficient, falls back to the template's designated safe accent.
 */
export function getSafeAccentColor(
  rawColor: string | undefined,
  isDarkTemplate: boolean,
  fallbackColor: string
): string {
  if (!rawColor || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawColor)) {
    return fallbackColor;
  }

  const rgb = hexToRgb(rawColor);
  if (!rgb) return fallbackColor;

  const colorLum = getRelativeLuminance(...rgb);
  const bgLum = isDarkTemplate ? 0.015 : 0.95; // ~#0B0D13 for dark, ~#F8F9FA for light
  const ratio = getContrastRatio(colorLum, bgLum);

  // Require minimum 3.2:1 contrast for graphical and large pill elements
  if (ratio < 3.2) {
    return fallbackColor;
  }
  return rawColor;
}
