/**
 * High-fidelity automotive imagery and graphics.
 * Generates crisp, realistic automotive vector renders matching the reference image.
 */

// Helper to encode SVG to clean data URI
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// Dealership Logo matching reference: cute blue sports car silhouette in white circle
export const DEFAULT_DEALER_LOGO = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1" />
    </filter>
  </defs>
  <circle cx="60" cy="60" r="58" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" filter="url(#shadow)" />
  <g transform="translate(18, 30)">
    <!-- Motion lines -->
    <path d="M4 14 Q 14 12 24 15" stroke="#93C5FD" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M0 24 Q 10 22 20 25" stroke="#BFDBFE" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Car body -->
    <path d="M 12 36 C 14 36, 17 28, 24 22 C 32 16, 44 14, 58 16 C 66 17, 72 23, 76 30 C 81 32, 84 35, 84 40 C 84 46, 80 48, 76 48 L 10 48 C 6 48, 4 44, 5 40 C 6 36, 9 36, 12 36 Z" fill="url(#blueGrad)" />
    <!-- Cabin window -->
    <path d="M 28 22 C 34 18, 44 17, 54 18 C 60 19, 66 23, 68 28 L 26 28 C 26 25, 27 23, 28 22 Z" fill="#93C5FD" opacity="0.9" />
    <path d="M 45 18 L 45 28" stroke="#1D4ED8" stroke-width="1.5" />
    <!-- Wheels -->
    <circle cx="24" cy="48" r="8" fill="#1E293B" />
    <circle cx="24" cy="48" r="4" fill="#E2E8F0" />
    <circle cx="68" cy="48" r="8" fill="#1E293B" />
    <circle cx="68" cy="48" r="4" fill="#E2E8F0" />
    <!-- Headlight glow -->
    <path d="M 80 36 L 86 38 L 80 40 Z" fill="#FDE047" />
  </g>
</svg>
`);

// Cute illustrated mascot car with "Let's get you online!" cloud
export const ONBOARDING_CAR_ILLUSTRATION = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180">
  <defs>
    <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
  </defs>
  <!-- Spark lines -->
  <line x1="205" y1="45" x2="220" y2="40" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" />
  <line x1="210" y1="60" x2="228" y2="60" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" />
  <line x1="205" y1="75" x2="222" y2="80" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" />
  
  <!-- Shadow -->
  <ellipse cx="120" cy="148" rx="85" ry="10" fill="#E2E8F0" opacity="0.7" />
  
  <!-- Car Body Main -->
  <g transform="translate(30, 40)">
    <!-- Cute Rounded Cabin -->
    <path d="M 35 48 C 38 25, 60 12, 95 12 C 130 12, 145 25, 150 48 Z" fill="url(#carBodyGrad)" />
    <!-- Windows -->
    <path d="M 45 44 C 47 28, 64 20, 90 20 L 90 44 Z" fill="#E0F2FE" />
    <path d="M 96 20 C 120 20, 136 28, 140 44 L 96 44 Z" fill="#E0F2FE" />
    <!-- Window highlight -->
    <path d="M 52 26 L 80 26" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8" />
    
    <!-- Lower Body -->
    <path d="M 10 52 C 10 44, 25 44, 35 48 L 152 48 C 162 44, 175 44, 175 56 C 175 74, 165 78, 155 78 L 25 78 C 15 78, 10 70, 10 52 Z" fill="url(#carBodyGrad)" />
    
    <!-- Big cute headlights -->
    <ellipse cx="166" cy="56" rx="6" ry="8" fill="#FEF08A" stroke="#EAB308" stroke-width="1.5" />
    <ellipse cx="18" cy="56" rx="5" ry="7" fill="#F87171" stroke="#DC2626" stroke-width="1" />
    
    <!-- Door handle -->
    <rect x="75" y="54" width="14" height="3" rx="1.5" fill="#0369A1" />
    
    <!-- Wheels -->
    <g transform="translate(35, 76)">
      <circle cx="0" cy="0" r="16" fill="#1E293B" />
      <circle cx="0" cy="0" r="9" fill="#94A3B8" />
      <circle cx="0" cy="0" r="4" fill="#0F172A" />
    </g>
    <g transform="translate(135, 76)">
      <circle cx="0" cy="0" r="16" fill="#1E293B" />
      <circle cx="0" cy="0" r="9" fill="#94A3B8" />
      <circle cx="0" cy="0" r="4" fill="#0F172A" />
    </g>
    <!-- Smiling grill detail -->
    <path d="M 155 68 Q 162 72 168 68" stroke="#0369A1" stroke-width="2" fill="none" stroke-linecap="round" />
  </g>
</svg>
`);

// Showroom Cover Photo Representation: Modern glass architectural building with vehicle lineup
export const DEFAULT_STOREFRONT_COVER = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94A3B8" />
      <stop offset="40%" stop-color="#CBD5E1" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
  </defs>
  <!-- Sky -->
  <rect width="800" height="260" fill="url(#skyGrad)" />
  
  <!-- Modern Dealership Architecture -->
  <polygon points="120,40 680,20 680,240 120,260" fill="url(#glassGrad)" />
  <!-- Glass Mullions -->
  <g stroke="#475569" stroke-width="3" opacity="0.6">
    <line x1="220" y1="36" x2="220" y2="255" />
    <line x1="320" y1="32" x2="320" y2="250" />
    <line x1="420" y1="28" x2="420" y2="245" />
    <line x1="520" y1="24" x2="520" y2="242" />
    <line x1="620" y1="21" x2="620" y2="241" />
    <line x1="120" y1="130" x2="680" y2="110" />
    <line x1="120" y1="190" x2="680" y2="170" />
  </g>
  <!-- Architectural Canopy -->
  <polygon points="90,100 710,70 710,95 90,125" fill="#0F172A" />
  <!-- Signage on Building: "PRIME MOTORS" -->
  <text x="400" y="86" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="24" letter-spacing="4" text-anchor="middle">PRIME MOTORS</text>
  
  <!-- Tarmac Forecourt -->
  <polygon points="0,240 800,220 800,400 0,400" fill="#334155" />
  <line x1="0" y1="280" x2="800" y2="280" stroke="#64748B" stroke-dasharray="20 15" stroke-width="2" />
  
  <!-- Silhouettes of cars in forecourt -->
  <ellipse cx="250" cy="310" rx="90" ry="24" fill="#0284C7" opacity="0.85" />
  <ellipse cx="440" cy="320" rx="100" ry="26" fill="#E2E8F0" opacity="0.9" />
  <ellipse cx="640" cy="305" rx="85" ry="22" fill="#DC2626" opacity="0.8" />
  
  <!-- Warm ambient showroom interior lighting -->
  <rect x="230" y="140" width="80" height="90" fill="#FEF08A" opacity="0.25" filter="blur(8px)" />
  <rect x="430" y="130" width="80" height="90" fill="#FEF08A" opacity="0.2" filter="blur(8px)" />
</svg>
`);

// Realistic Vehicle Render: 2019 Toyota Aqua (Pearl White)
export const CAR_AQUA_WHITE = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradAqua" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="50%" stop-color="#F1F5F9" />
      <stop offset="85%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <linearGradient id="windshieldAqua" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="60%" stop-color="#334155" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Background gradient studio card -->
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  
  <!-- Ground Shadow -->
  <ellipse cx="300" cy="318" rx="240" ry="22" fill="#0F172A" opacity="0.15" />
  <ellipse cx="300" cy="315" rx="210" ry="14" fill="#0F172A" opacity="0.25" />
  
  <!-- Main Vehicle Silhouette (Toyota Aqua Hatchback 3/4 view) -->
  <g transform="translate(30, 30)">
    <!-- Roof and Cabin -->
    <path d="M 140 120 C 180 80, 260 60, 360 62 C 410 63, 440 95, 460 125 Z" fill="url(#windshieldAqua)" />
    <!-- Pillars -->
    <path d="M 230 65 L 245 125 L 235 125 L 220 66 Z" fill="#E2E8F0" />
    <path d="M 330 62 L 335 125 L 345 125 L 340 63 Z" fill="#0F172A" />
    <!-- Rear window tint -->
    <path d="M 145 120 C 175 85, 220 70, 225 68 L 240 124 Z" fill="#0F172A" opacity="0.85" />
    <!-- Front windshield -->
    <path d="M 345 64 C 385 68, 435 95, 455 124 L 348 124 Z" fill="url(#windshieldAqua)" />
    <!-- Interior silhouette headrests -->
    <ellipse cx="310" cy="95" rx="10" ry="14" fill="#0F172A" opacity="0.6" />
    <ellipse cx="380" cy="98" rx="10" ry="14" fill="#0F172A" opacity="0.5" />

    <!-- Hood & Front Fender -->
    <path d="M 450 125 C 475 130, 510 150, 525 185 C 525 210, 505 235, 470 240 L 95 240 C 60 235, 45 200, 50 160 C 55 135, 95 125, 145 122 Z" fill="url(#bodyGradAqua)" stroke="#CBD5E1" stroke-width="1.5" />
    
    <!-- Character Lines -->
    <path d="M 120 155 Q 300 165 480 150" stroke="#94A3B8" stroke-width="2" fill="none" opacity="0.7" />
    <path d="M 140 215 Q 300 218 450 205" stroke="#94A3B8" stroke-width="2.5" fill="none" opacity="0.5" />
    <!-- Door Cut Lines -->
    <path d="M 240 125 L 235 235" stroke="#94A3B8" stroke-width="1.5" fill="none" />
    <path d="M 345 125 L 340 235" stroke="#94A3B8" stroke-width="1.5" fill="none" />
    <!-- Door handles -->
    <rect x="250" y="150" width="18" height="6" rx="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
    <rect x="355" y="150" width="18" height="6" rx="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

    <!-- Headlight (Modern Projector) -->
    <path d="M 465 145 C 500 155, 520 170, 515 190 C 495 185, 465 170, 460 155 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5" />
    <circle cx="490" cy="168" r="9" fill="#0284C7" opacity="0.7" />
    <circle cx="490" cy="168" r="5" fill="#FFFFFF" />
    
    <!-- Toyota Oval Emblem on Grill -->
    <ellipse cx="505" cy="195" rx="10" ry="7" fill="#0F172A" />
    <ellipse cx="505" cy="195" rx="8" ry="5" fill="#E2E8F0" stroke="#0F172A" stroke-width="1" />
    <ellipse cx="505" cy="195" rx="4" ry="2.5" fill="#0F172A" />
    
    <!-- Front Lower Grill / Fog lights -->
    <path d="M 460 210 Q 500 212 515 225 L 455 228 Z" fill="#1E293B" />
    
    <!-- Tail Light -->
    <path d="M 55 150 C 65 155, 75 180, 65 200 L 50 185 Z" fill="#EF4444" stroke="#DC2626" stroke-width="1" />
    
    <!-- Wheels & Arches -->
    <!-- Rear Wheel -->
    <circle cx="150" cy="235" r="48" fill="#0F172A" />
    <circle cx="150" cy="235" r="32" fill="#475569" stroke="#94A3B8" stroke-width="3" />
    <!-- Alloy spokes -->
    <circle cx="150" cy="235" r="10" fill="#E2E8F0" />
    <line x1="150" y1="205" x2="150" y2="265" stroke="#CBD5E1" stroke-width="4" />
    <line x1="120" y1="235" x2="180" y2="235" stroke="#CBD5E1" stroke-width="4" />
    <line x1="128" y1="213" x2="172" y2="257" stroke="#CBD5E1" stroke-width="4" />
    <line x1="172" y1="213" x2="128" y2="257" stroke="#CBD5E1" stroke-width="4" />

    <!-- Front Wheel -->
    <circle cx="410" cy="235" r="48" fill="#0F172A" />
    <circle cx="410" cy="235" r="32" fill="#475569" stroke="#94A3B8" stroke-width="3" />
    <!-- Alloy spokes -->
    <circle cx="410" cy="235" r="10" fill="#E2E8F0" />
    <line x1="410" y1="205" x2="410" y2="265" stroke="#CBD5E1" stroke-width="4" />
    <line x1="380" y1="235" x2="440" y2="235" stroke="#CBD5E1" stroke-width="4" />
    <line x1="388" y1="213" x2="432" y2="257" stroke="#CBD5E1" stroke-width="4" />
    <line x1="432" y1="213" x2="388" y2="257" stroke="#CBD5E1" stroke-width="4" />
  </g>
</svg>
`);

// Realistic Vehicle Render: 2021 Honda Fit (Midnight Navy / Dark Metallic)
export const CAR_FIT_NAVY = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradFit" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="90%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="fitGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  <ellipse cx="300" cy="318" rx="240" ry="22" fill="#0F172A" opacity="0.2" />
  
  <g transform="translate(30, 30)">
    <!-- Cabin Bubble -->
    <path d="M 130 120 C 170 70, 270 55, 370 58 C 420 60, 450 90, 470 125 Z" fill="url(#fitGlass)" />
    <!-- Pillars -->
    <path d="M 235 60 L 245 125 L 235 125 L 225 61 Z" fill="#1E293B" />
    <path d="M 335 58 L 340 125 L 348 125 L 345 59 Z" fill="#1E293B" />
    
    <!-- Body -->
    <path d="M 460 125 C 485 130, 520 155, 530 190 C 530 215, 510 235, 475 240 L 95 240 C 60 235, 45 200, 50 160 C 55 130, 95 120, 135 122 Z" fill="url(#bodyGradFit)" />
    
    <!-- Metallic Highlights -->
    <path d="M 120 150 Q 300 162 480 148" stroke="#64748B" stroke-width="2" fill="none" opacity="0.6" />
    
    <!-- Headlight -->
    <path d="M 470 145 C 505 155, 525 170, 520 190 C 500 185, 470 170, 465 155 Z" fill="#F1F5F9" opacity="0.9" />
    <circle cx="495" cy="168" r="8" fill="#38BDF8" opacity="0.8" />
    
    <!-- Wheels -->
    <circle cx="150" cy="235" r="48" fill="#0F172A" />
    <circle cx="150" cy="235" r="32" fill="#64748B" stroke="#CBD5E1" stroke-width="2" />
    <circle cx="150" cy="235" r="10" fill="#E2E8F0" />
    
    <circle cx="410" cy="235" r="48" fill="#0F172A" />
    <circle cx="410" cy="235" r="32" fill="#64748B" stroke="#CBD5E1" stroke-width="2" />
    <circle cx="410" cy="235" r="10" fill="#E2E8F0" />
  </g>
</svg>
`);

// Realistic Vehicle Render: 2020 Mazda CX-5 (Soul Red Crystal)
export const CAR_CX5_RED = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradRed" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#DC2626" />
      <stop offset="45%" stop-color="#B91C1C" />
      <stop offset="85%" stop-color="#991B1B" />
      <stop offset="100%" stop-color="#7F1D1D" />
    </linearGradient>
  </defs>
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  <ellipse cx="300" cy="320" rx="245" ry="24" fill="#0F172A" opacity="0.2" />
  
  <g transform="translate(30, 25)">
    <!-- High SUV Roofline -->
    <path d="M 120 115 C 160 65, 270 50, 380 54 C 430 55, 465 85, 480 120 Z" fill="#0F172A" opacity="0.95" />
    
    <!-- Bold Mazda Kodo design body -->
    <path d="M 470 120 C 500 125, 535 150, 545 185 C 545 220, 520 245, 480 250 L 90 250 C 50 245, 35 205, 40 160 C 45 125, 85 115, 125 115 Z" fill="url(#bodyGradRed)" stroke="#B91C1C" stroke-width="2" />
    
    <!-- Mazda signature grill wing chrome -->
    <path d="M 490 190 Q 520 205 540 195" stroke="#F8FAFC" stroke-width="3" fill="none" />
    
    <!-- Slim sharp LED headlights -->
    <path d="M 480 150 L 535 165 L 515 178 Z" fill="#F8FAFC" opacity="0.95" />
    
    <!-- Chrome window surround -->
    <path d="M 130 115 C 170 65, 270 52, 380 56 C 425 58, 455 85, 470 118" stroke="#E2E8F0" stroke-width="2.5" fill="none" />
    
    <!-- SUV Cladding and High Ground Clearance Wheels -->
    <circle cx="145" cy="245" r="52" fill="#0F172A" />
    <circle cx="145" cy="245" r="35" fill="#334155" stroke="#94A3B8" stroke-width="3" />
    <circle cx="145" cy="245" r="12" fill="#E2E8F0" />
    
    <circle cx="420" cy="245" r="52" fill="#0F172A" />
    <circle cx="420" cy="245" r="35" fill="#334155" stroke="#94A3B8" stroke-width="3" />
    <circle cx="420" cy="245" r="12" fill="#E2E8F0" />
  </g>
</svg>
`);

// Realistic Vehicle Render: 2022 Toyota RAV4 (Silver Metallic / White)
export const CAR_RAV4_SILVER = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradRAV4" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="40%" stop-color="#F1F5F9" />
      <stop offset="80%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <linearGradient id="blackRoof" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
  </defs>
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  <ellipse cx="300" cy="322" rx="250" ry="22" fill="#0F172A" opacity="0.2" />
  
  <g transform="translate(30, 25)">
    <!-- Dual-tone black roof -->
    <path d="M 125 105 C 170 60, 280 48, 385 52 C 435 54, 465 85, 480 115 Z" fill="url(#blackRoof)" />
    <!-- Roof rails -->
    <line x1="160" y1="52" x2="360" y2="50" stroke="#0F172A" stroke-width="4" stroke-linecap="round" />
    
    <!-- Angular RAV4 Body -->
    <path d="M 470 115 C 500 120, 535 145, 545 180 C 545 220, 520 245, 480 250 L 90 250 C 50 245, 35 205, 40 160 C 45 125, 85 105, 125 105 Z" fill="url(#bodyGradRAV4)" stroke="#CBD5E1" stroke-width="2" />
    
    <!-- Octagonal wheel arches (signature RAV4) -->
    <polygon points="90,250 110,205 180,205 200,250" fill="#1E293B" />
    <polygon points="365,250 385,205 455,205 475,250" fill="#1E293B" />
    
    <!-- RAV4 bold hexagonal front grill -->
    <polygon points="490,170 540,175 535,215 480,210" fill="#1E293B" />
    <circle cx="510" cy="190" r="10" fill="#0284C7" opacity="0.7" />
    
    <!-- Wheels -->
    <circle cx="145" cy="245" r="48" fill="#0F172A" />
    <circle cx="145" cy="245" r="32" fill="#475569" stroke="#E2E8F0" stroke-width="3" />
    
    <circle cx="420" cy="245" r="48" fill="#0F172A" />
    <circle cx="420" cy="245" r="32" fill="#475569" stroke="#E2E8F0" stroke-width="3" />
  </g>
</svg>
`);

// Realistic Vehicle Render: 2021 Ford Ranger Wildtrak (Glacier White Double Cab)
export const CAR_RANGER_WHITE = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradRanger" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="50%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
  </defs>
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  <ellipse cx="300" cy="324" rx="255" ry="24" fill="#0F172A" opacity="0.22" />
  
  <g transform="translate(25, 20)">
    <!-- Double Cab Cabin -->
    <path d="M 180 110 C 210 65, 300 55, 390 58 C 430 60, 460 90, 475 120 Z" fill="#0F172A" opacity="0.9" />
    <!-- Rear load bin -->
    <path d="M 45 150 L 180 148 L 180 250 L 45 250 Z" fill="url(#bodyGradRanger)" stroke="#CBD5E1" stroke-width="2" />
    <!-- Sports Bar on Bin -->
    <path d="M 175 110 L 195 110 L 210 150" stroke="#0F172A" stroke-width="6" fill="none" />
    
    <!-- Front cab & bonnet -->
    <path d="M 470 120 C 500 125, 545 145, 555 180 C 555 220, 530 250, 480 250 L 180 250 L 180 120 Z" fill="url(#bodyGradRanger)" stroke="#CBD5E1" stroke-width="2" />
    
    <!-- Bold Wildtrak grill with "RANGER" lettering -->
    <rect x="490" y="170" width="55" height="35" rx="4" fill="#1E293B" />
    <text x="517" y="192" fill="#E2E8F0" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="9" text-anchor="middle">RANGER</text>
    
    <!-- Heavy Duty All-Terrain Wheels -->
    <circle cx="130" cy="245" r="55" fill="#0F172A" />
    <circle cx="130" cy="245" r="35" fill="#334155" stroke="#D97706" stroke-width="2" />
    
    <circle cx="420" cy="245" r="55" fill="#0F172A" />
    <circle cx="420" cy="245" r="35" fill="#334155" stroke="#D97706" stroke-width="2" />
  </g>
</svg>
`);

// Realistic Vehicle Render: 2020 Mercedes-Benz C200 AMG Line (Obsidian Black)
export const CAR_MERC_BLACK = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <defs>
    <linearGradient id="bodyGradMerc" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="50%" stop-color="#0F172A" />
      <stop offset="90%" stop-color="#020617" />
      <stop offset="100%" stop-color="#000000" />
    </linearGradient>
  </defs>
  <rect width="600" height="380" rx="16" fill="#F8FAFC" />
  <ellipse cx="300" cy="318" rx="245" ry="22" fill="#0F172A" opacity="0.25" />
  
  <g transform="translate(30, 30)">
    <!-- Low sleek luxury coupe-sedan greenhouse -->
    <path d="M 120 120 C 170 70, 270 55, 380 58 C 430 60, 465 90, 480 125 Z" fill="#020617" />
    <!-- Chrome trim line -->
    <path d="M 125 120 C 175 70, 270 56, 380 59 C 428 61, 460 90, 475 124" stroke="#E2E8F0" stroke-width="2" fill="none" opacity="0.9" />
    
    <!-- Long Hood Sedan Body -->
    <path d="M 470 125 C 505 130, 540 155, 550 185 C 550 215, 520 238, 480 240 L 80 240 C 45 235, 35 200, 40 165 C 45 130, 80 120, 120 122 Z" fill="url(#bodyGradMerc)" />
    
    <!-- Diamond radiator grill + 3-pointed star -->
    <ellipse cx="525" cy="185" rx="14" ry="18" fill="#1E293B" stroke="#94A3B8" stroke-width="1.5" />
    <circle cx="525" cy="185" r="9" fill="#020617" stroke="#E2E8F0" stroke-width="1.5" />
    <line x1="525" y1="176" x2="525" y2="185" stroke="#E2E8F0" stroke-width="1.5" />
    <line x1="525" y1="185" x2="517" y2="191" stroke="#E2E8F0" stroke-width="1.5" />
    <line x1="525" y1="185" x2="533" y2="191" stroke="#E2E8F0" stroke-width="1.5" />
    
    <!-- Wheels: Multi-spoke AMG Alloy -->
    <circle cx="140" cy="235" r="48" fill="#0F172A" />
    <circle cx="140" cy="235" r="32" fill="#334155" stroke="#CBD5E1" stroke-width="2" />
    <circle cx="420" cy="235" r="48" fill="#0F172A" />
    <circle cx="420" cy="235" r="32" fill="#334155" stroke="#CBD5E1" stroke-width="2" />
  </g>
</svg>
`);

// Detailed multi-angle car gallery shots (Front, Rear, Interior, Cockpit)
export const CAR_INTERIOR_SHOT = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <rect width="600" height="380" fill="#0F172A" />
  <!-- Windshield view looking out at sunny horizon -->
  <path d="M 80 40 L 520 40 L 560 170 L 40 170 Z" fill="#93C5FD" opacity="0.4" />
  <!-- Steering Wheel -->
  <circle cx="210" cy="240" r="75" fill="none" stroke="#334155" stroke-width="20" />
  <circle cx="210" cy="240" r="28" fill="#1E293B" stroke="#64748B" stroke-width="2" />
  <!-- Digital Cockpit Display -->
  <rect x="290" y="140" width="130" height="70" rx="8" fill="#020617" stroke="#475569" stroke-width="2" />
  <text x="355" y="175" fill="#38BDF8" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="14" text-anchor="middle">READY · HYBRID</text>
  <text x="355" y="195" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" text-anchor="middle">52,000 KM</text>
  <!-- Center Console Screen -->
  <rect x="430" y="120" width="120" height="85" rx="8" fill="#020617" stroke="#475569" stroke-width="2" />
  <text x="490" y="165" fill="#22C55E" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="12" text-anchor="middle">NAVIGATION</text>
</svg>
`);

export const CAR_REAR_SHOT = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
  <rect width="600" height="380" fill="#F8FAFC" />
  <ellipse cx="300" cy="325" rx="220" ry="20" fill="#0F172A" opacity="0.2" />
  <!-- Rear Hatch View -->
  <path d="M 160 100 C 220 70, 380 70, 440 100 L 480 250 L 120 250 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="2" />
  <!-- Rear glass -->
  <path d="M 180 110 L 420 110 L 445 170 L 155 170 Z" fill="#0F172A" opacity="0.9" />
  <!-- Rear wiper -->
  <line x1="300" y1="165" x2="350" y2="135" stroke="#334155" stroke-width="3" stroke-linecap="round" />
  <!-- Tail lights -->
  <polygon points="135,175 165,175 160,220 130,210" fill="#EF4444" />
  <polygon points="465,175 435,175 440,220 470,210" fill="#EF4444" />
  <!-- Registration plate frame -->
  <rect x="240" y="210" width="120" height="32" rx="4" fill="#FFFFFF" stroke="#0F172A" stroke-width="2" />
  <text x="300" y="232" fill="#0F172A" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="14" text-anchor="middle">DRIVELINK</text>
</svg>
`);
