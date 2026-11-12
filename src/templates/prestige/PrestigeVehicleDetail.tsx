import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  X,
  Calendar,
  Gauge,
  Fuel,
  Settings2,
  Palette,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { TemplateVehicleDetailProps } from '../types';
import './PrestigeTemplate.css';

export const PrestigeVehicleDetail: React.FC<TemplateVehicleDetailProps> = ({
  dealer,
  vehicle,
  onBack,
  onShare,
  onVehicleClick,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const touch = useRef<number | null>(null);

  const photos = vehicle.photos || [];
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: vehicle.currency || dealer.currency,
    maximumFractionDigits: 0,
  }).format(vehicle.price);

  const message = `Hi, I'm interested in the ${title} listed at ${money}. Is it still available?`;
  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : '';

  const prev = () => setPhotoIndex(i => (i - 1 + photos.length) % photos.length);
  const next = () => setPhotoIndex(i => (i + 1) % photos.length);

  const specs = [
    { label: 'Year', value: vehicle.year ? String(vehicle.year) : '', Icon: Calendar },
    {
      label: 'Mileage',
      value: vehicle.mileageKm != null ? `${Number(vehicle.mileageKm).toLocaleString()} km` : '',
      Icon: Gauge,
    },
    { label: 'Transmission', value: vehicle.transmission || '', Icon: Settings2 },
    { label: 'Fuel', value: vehicle.fuel || '', Icon: Fuel },
    { label: 'Colour', value: vehicle.colour || '', Icon: Palette },
    { label: 'Condition', value: vehicle.condition || '', Icon: ShieldCheck },
  ].filter(x => Boolean(x.value));

  const isSold = vehicle.status === 'sold';

  return (
    <div className="dl-tpl-prestige pt-detail-view">
      {/* Top Gallery */}
      <div
        className="pt-gallery-box"
        onTouchStart={e => {
          touch.current = e.touches[0].clientX;
        }}
        onTouchEnd={e => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40 && photos.length > 1) {
            (dx < 0 ? next : prev)();
          }
          touch.current = null;
        }}
      >
        {photos[photoIndex] ? (
          <img
            src={photos[photoIndex]}
            alt={`${title} photo ${photoIndex + 1}`}
            onClick={() => setFullscreen(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <span>Vehicle photo unavailable</span>
          </div>
        )}

        <div className="pt-gallery-nav">
          <button
            type="button"
            className="pt-icon-btn"
            onClick={onBack}
            aria-label="Back to showroom"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="pt-icon-btn"
            onClick={onShare}
            aria-label="Share vehicle"
          >
            <Share2 size={18} />
          </button>
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 pt-icon-btn"
              onClick={prev}
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 pt-icon-btn"
              onClick={next}
              aria-label="Next photo"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <span className="pt-gallery-counter">
          {photos.length ? photoIndex + 1 : 0}/{photos.length}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-5 max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className={`pt-card-status ${vehicle.status}`}>
              {vehicle.status}
            </span>
            <span className="text-2xl font-black text-[#A78BFA]">{money}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {title}
          </h1>
        </div>

        {/* Specs Grid */}
        {specs.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider font-bold text-[#8E95A5] mb-3">
              Vehicle Overview
            </h2>
            <div className="pt-specs-grid">
              {specs.map(({ label, value, Icon }) => (
                <div key={label} className="pt-spec-item">
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} className="text-[#A78BFA]" />
                    <small>{label}</small>
                  </div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {vehicle.description && (
          <section className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
            <h2 className="text-xs uppercase tracking-wider font-bold text-[#8E95A5]">
              Description
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {expanded || vehicle.description.length <= 160
                ? vehicle.description
                : `${vehicle.description.slice(0, 160)}…`}
            </p>
            {vehicle.description.length > 160 && (
              <button
                type="button"
                className="text-xs font-bold text-[#A78BFA] pt-1"
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? 'Read less' : 'Read more'}
              </button>
            )}
          </section>
        )}

        {/* Features */}
        {vehicle.features && vehicle.features.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider font-bold text-[#8E95A5]">
              Features & Highlights
            </h2>
            <div className="flex flex-wrap gap-2">
              {vehicle.features.map(f => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200"
                >
                  <CheckCircle2 size={13} className="text-[#10B981]" />
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Dealer Identity Card */}
        <section className="p-4 rounded-2xl bg-[#141824] border border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {dealer.logoUrl ? (
              <img
                src={dealer.logoUrl}
                alt={dealer.name}
                className="w-12 h-12 rounded-xl object-cover border border-white/15"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white/10 grid place-items-center text-sm font-bold text-white">
                {dealer.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <strong className="block text-sm font-bold text-white">
                {dealer.name}
              </strong>
              <small className="flex items-center gap-1 text-[11px] text-[#8E95A5]">
                <MapPin size={12} />
                {[dealer.city, dealer.country].filter(Boolean).join(', ') || 'Showroom'}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-[#A78BFA] hover:underline"
            onClick={onBack}
          >
            Showroom
          </button>
        </section>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D13]/95 backdrop-blur-md border-t border-white/10 p-3 px-4 flex gap-3">
        {isSold ? (
          <button
            type="button"
            className="w-full min-h-[48px] rounded-full bg-white/10 text-white font-bold text-sm"
            onClick={onBack}
          >
            View More Available Vehicles
          </button>
        ) : (
          <>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-h-[48px] rounded-full bg-[#10B981] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageCircle size={18} />
                WhatsApp Enquiry
              </a>
            )}
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="w-12 min-h-[48px] rounded-full bg-white/10 border border-white/15 text-white flex items-center justify-center"
                aria-label="Call dealership"
              >
                <Phone size={18} />
              </a>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Photo Modal */}
      {fullscreen && photos[photoIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-center items-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10"
            onClick={() => setFullscreen(false)}
            aria-label="Close photo"
          >
            <X size={22} />
          </button>
          <img
            src={photos[photoIndex]}
            alt="Fullscreen view"
            className="max-h-[85vh] max-w-[95vw] object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default PrestigeVehicleDetail;
