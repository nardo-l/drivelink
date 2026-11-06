import { name, tagline } from '../../config/brand';
import React from 'react';

export interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'md' | 'sm';
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  showTagline = false,
  className = '',
}) => {
  const color = variant === 'light' ? '#FFFFFF' : '#0A0F1E';
  return (
    <span
      className={`dl-logo dl-logo-${size} ${className}`.trim()}
      style={{ color }}
      role="img"
      aria-label={showTagline ? `${name} Dealer Portal` : name}
    >
      <svg className="dl-logo-mark" viewBox="0 0 72 28" aria-hidden="true" focusable="false">
        <path d="M3 19c8-9 17-9 27-9 7-6 15-7 22-3l12 8 5 1" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 20h57" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="dl-logo-wordmark">{name}</span>
      {showTagline && <span className="dl-logo-tagline">{tagline}</span>}
    </span>
  );
};
