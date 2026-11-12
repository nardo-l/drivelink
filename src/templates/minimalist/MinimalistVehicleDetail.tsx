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
  Check,
} from 'lucide-react';
import type { TemplateVehicleDetailProps } from '../types';
import './MinimalistTemplate.css';

export const MinimalistVehicleDetail: React.FC<TemplateVehicleDetailProps> = ({
  dealer,
  vehicle,
  onBack,
  onShare,
  onWhatsAppClick,
  onVehicleClick,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const touch = useRef<number | null>(null);

  const photos = vehicle.photos || [];
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const money = !vehicle.price || Number(vehicle.price) <= 0 ? 'Price on request' : new Intl.NumberFormat('en-US', { style: 'currency', currency: vehicle.currency || dealer.currency, maximumFractionDigits: 0 }).format(vehicle.price);

  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');

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
    <div className="dl-tpl-minimalist mn-detail-view pb-24">
      {/* Top Gallery */}
      <div
        className="mn-gallery-box"
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
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span>Vehicle photo unavailable</span>
          </div>
        )}

        <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
          <button
            type="button"
            className="mn-icon-btn shadow-md"
            onClick={onBack}
            aria-label="Back to showroom"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="mn-icon-btn shadow-md"
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
              className="absolute left-3 top-1/2 -translate-y-1/2 mn-icon-btn shadow-md"
              onClick={prev}
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 mn-icon-btn shadow-md"
              onClick={next}
              aria-label="Next photo"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <span className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold">
          {photos.length ? photoIndex + 1 : 0}/{photos.length}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className={`mn-status-tag ${vehicle.status}`}>
              {vehicle.status}
            </span>
            <span className="text-2xl font-black text-gray-900">{money}</span>
          </div>
          <h1 className="text-2xl font-black text-gray-950 leading-tight">
            {title}
          </h1>
        </div>

        {/* Specs Overview */}
        {specs.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-gray-400 mb-3">
              Overview
            </h2>
            <div className="mn-specs-list">
              {specs.map(({ label, value, Icon }) => (
                <div key={label} className="mn-spec-tile">
                  <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                    <Icon size={14} />
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
          <section className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-gray-400">
              Details
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {expanded || vehicle.description.length <= 160
                ? vehicle.description
                : `${vehicle.description.slice(0, 160)}…`}
            </p>
            {vehicle.description.length > 160 && (
              <button
                type="button"
                className="text-xs font-extrabold text-gray-900 underline pt-1"
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
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-gray-400">
              Features
            </h2>
            <div className="flex flex-wrap gap-2">
              {vehicle.features.map(f => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-800"
                >
                  <Check size={13} className="text-emerald-600" />
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Dealership Card */}
        <section className="p-4 rounded-2xl border border-gray-200 bg-white flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            {dealer.logoUrl ? (
              <img
                src={dealer.logoUrl}
                alt={dealer.name}
                className="w-12 h-12 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-100 grid place-items-center text-sm font-bold text-gray-800">
                {dealer.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <strong className="block text-sm font-bold text-gray-900">
                {dealer.name}
              </strong>
              <small className="flex items-center gap-1 text-[11px] text-gray-500">
                <MapPin size={12} />
                {[dealer.city, dealer.country].filter(Boolean).join(', ') || 'Showroom'}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-gray-900 underline"
            onClick={onBack}
          >
            Showroom
          </button>
        </section>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 px-4 flex gap-3 shadow-lg">
        {isSold ? (
          <button
            type="button"
            className="w-full min-h-[48px] rounded-full bg-gray-100 text-gray-900 font-bold text-sm"
            onClick={onBack}
          >
            View More Available Vehicles
          </button>
        ) : (
          <>
            {waNumber && <button type="button" onClick={onWhatsAppClick} className="flex-1 min-h-[48px] rounded-full bg-[#10B981] text-white font-bold text-sm flex items-center justify-center gap-2 shadow"><MessageCircle size={18} /> WhatsApp Enquiry</button>}
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="w-12 min-h-[48px] rounded-full bg-gray-100 border border-gray-200 text-gray-900 flex items-center justify-center"
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

export default MinimalistVehicleDetail;
