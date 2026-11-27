import React, { useState } from 'react';
import { Heart, CarFront } from 'lucide-react';
import type { Vehicle } from '../../types';
import './VehicleCard.css';

interface VehicleCardProps {
  vehicle: Vehicle;
  price: string;
  href: string;
  eager?: boolean;
  className?: string;
  onVehicleClick?: (vehicleId: string) => void;
  showInventoryExtras?: boolean;
  saved?: boolean;
  onToggleSaved?: (vehicleId: string) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle, price, href, eager = false, className = '', onVehicleClick,
  showInventoryExtras = false, saved = false, onToggleSaved,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || 'Vehicle';
  const statusLabel = vehicle.status === 'available' ? 'Available'
    : vehicle.status === 'reserved' ? 'Reserved'
    : vehicle.status === 'sold' ? 'Sold' : 'Unavailable';
  const displayPrice = price && price.trim() ? price : 'Price on request';
  const hasPhoto = Boolean(vehicle.photos?.[0]) && !imageFailed;
  const cardClass = [
    'dl-vehicle-card',
    className,
    showInventoryExtras && vehicle.status === 'sold' ? 'is-sold' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={cardClass} data-vehicle-status={vehicle.status}>
      <a
        className="dl-vehicle-card__link"
        href={href}
        aria-label={title + ', ' + displayPrice + ', ' + statusLabel}
        onClick={event => {
          if (onVehicleClick && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            onVehicleClick(vehicle.id);
          }
        }}
      >
        <div className="dl-vehicle-card__media">
          {hasPhoto ? (
            <img
              className="dl-vehicle-card__image"
              src={vehicle.photos[0]}
              alt={title}
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={eager ? 'high' : 'auto'}
              decoding="async"
              width={1200}
              height={1500}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="dl-vehicle-card__fallback" aria-hidden="true">
              <CarFront size={58} strokeWidth={1.35} />
            </div>
          )}
        </div>
        <strong className="dl-vehicle-card__price">{displayPrice}</strong>
        <span className="dl-vehicle-card__name">{title}</span>
      </a>

      {showInventoryExtras && (vehicle.status === 'reserved' || vehicle.status === 'sold') && (
        <span className={'dl-vehicle-card__status' + (vehicle.status === 'sold' ? ' is-sold' : ' is-reserved')}>
          {statusLabel}
        </span>
      )}

      {showInventoryExtras && onToggleSaved && (
        <button
          type="button"
          className={'dl-vehicle-card__save' + (saved ? ' is-saved' : '')}
          aria-label={(saved ? 'Remove ' : 'Save ') + title + (saved ? ' from saved vehicles' : ' to saved vehicles')}
          aria-pressed={saved}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSaved(vehicle.id);
          }}
        >
          <Heart size={20} fill={saved ? 'currentColor' : 'none'} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </article>
  );
};

export default VehicleCard;
