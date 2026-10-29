import React from 'react';
import { VehicleStatus } from '../../types';

interface BadgeProps {
  status: VehicleStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status, size = 'sm', className = '' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-3.5 py-1.5',
  };

  switch (status) {
    case 'available':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 ${sizeClasses[size]} ${className}`}
        >
          Available
        </span>
      );
    case 'reserved':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 ${sizeClasses[size]} ${className}`}
        >
          Reserved
        </span>
      );
    case 'sold':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 ${sizeClasses[size]} ${className}`}
        >
          Sold
        </span>
      );
    case 'draft':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200 ${sizeClasses[size]} ${className}`}
        >
          Draft
        </span>
      );
    default:
      return null;
  }
};
