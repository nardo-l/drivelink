import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Vehicle } from '../types';
import { StatusBadge } from '../components/common/Badge';
import { ShareModal } from '../components/common/ShareModal';
import { EnquiryModal } from '../components/common/EnquiryModal';
import {
  ArrowLeft,
  Heart,
  Share2,
  MessageCircle,
  Phone,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  Gauge,
  Cpu,
  Leaf,
  Fuel,
  Palette,
  Check,
} from 'lucide-react';

interface PublicVehicleDetailPageProps {
  vehicleId: string;
}

export const PublicVehicleDetailPage: React.FC<PublicVehicleDetailPageProps> = ({ vehicleId }) => {
  const { navigate, showToast } = useNavigation();
  const [dealership, setDealership] = useState(() => storageService.getDealership());
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(() => storageService.getVehicleById(vehicleId));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isLive = isSupabaseConfigured();
    if (isLive && vehicleId) {
      setLoading(true);
      // Query only available vehicle as per database RLS policy
      supabaseService.getVehicleById(vehicleId, true)
        .then((liveVeh) => {
          if (liveVeh) {
            setVehicle(liveVeh);
          }
        })
        .catch((err: any) => console.warn('Supabase public vehicle fetch notice:', err))
        .finally(() => setLoading(false));
    }
  }, [vehicleId]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);

  // If vehicle does not exist or is not available, show unavailable state as per RLS
  if (!vehicle || vehicle.status !== 'available') {
    return (
      <div className="dl-public-vehicle min-h-full flex flex-col items-center justify-center p-6 text-center bg-white text-slate-900">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-950">Vehicle No Longer Available</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-xs">
          This vehicle has been sold, reserved, or removed from the public showroom.
        </p>
        <button
          onClick={() => navigate(`/showroom/${dealership.slug}`)}
          className="mt-6 px-6 py-2.5 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
        >
          Return to Showroom
        </button>
      </div>
    );
  }

  const photos = vehicle.photos && vehicle.photos.length > 0 ? vehicle.photos : [];

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const toggleFavorite = () => {
    setIsFavorited(!isFavorited);
    showToast(!isFavorited ? 'Vehicle saved to favorites' : 'Removed from favorites');
  };

  const cleanWhatsApp = dealership.whatsapp.replace(/\D/g, '');
  const whatsAppDirectUrl = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
    `Hi ${dealership.name}, I am interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} ($${vehicle.price.toLocaleString()}) on DriveLink. Is it available for viewing?`
  )}`;

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-white text-slate-900 pb-24">
      {/* Top Header matching Screen 06 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <button
          onClick={() => navigate(`/showroom/${dealership.slug}`)}
          className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors"
          aria-label="Back to showroom"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {/* Dealership Mini Avatar */}
          <button
            onClick={() => navigate(`/showroom/${dealership.slug}`)}
            className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50"
            title="View Showroom"
          >
            {dealership.logoUrl ? (
              <img src={dealership.logoUrl} alt={dealership.name} className="w-full h-full object-contain" />
            ) : (
              <span className="font-extrabold text-[10px] text-blue-600 uppercase">
                {dealership.name ? dealership.name.slice(0, 2) : 'DL'}
              </span>
            )}
          </button>

          {/* Heart / Favorite Button */}
          <button
            onClick={toggleFavorite}
            className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center transition-colors ${
              isFavorited ? 'text-rose-500 bg-rose-50 border-rose-200' : 'text-slate-600 hover:bg-slate-50'
            }`}
            aria-label="Favorite"
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hero Photo Gallery Carousel matching Screen 06 */}
      <div className="relative w-full aspect-16/11 bg-slate-100 overflow-hidden flex items-center justify-center select-none group">
        <img
          src={photos[activePhotoIndex]}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover transition-opacity duration-200"
        />

        {/* Arrow Navigation */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Carousel Pagination Dots matching Screen 06 */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActivePhotoIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  activePhotoIndex === i ? 'w-4 bg-white shadow-sm' : 'w-1.5 bg-white/60'
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Content Details */}
      <div className="px-5 py-4 flex flex-col gap-5 flex-1">
        {/* Price & Title Section matching Screen 06 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              ${vehicle.price.toLocaleString()}
            </h1>
            <p className="text-sm font-bold text-slate-700 mt-0.5">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>

          {/* Availability Status Pill matching Screen 06 */}
          <StatusBadge status={vehicle.status} size="md" />
        </div>

        {/* 6 Key Specifications Grid matching Screen 06 */}
        <div className="grid grid-cols-3 gap-2.5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
          {/* Year */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Year</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">{vehicle.year}</span>
          </div>

          {/* Mileage */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Mileage</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">
              {vehicle.mileageKm.toLocaleString()} km
            </span>
          </div>

          {/* Transmission */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Transmission</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">{vehicle.transmission}</span>
          </div>

          {/* Fuel */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Fuel</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">{vehicle.fuel}</span>
          </div>

          {/* Engine */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Engine</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">
              {vehicle.engineSize || '1.5 L'}
            </span>
          </div>

          {/* Colour */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Colour</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5">
              {vehicle.colour || 'White'}
            </span>
          </div>
        </div>

        {/* Import & Duty Status Badge (ZW & SA Market feature) */}
        {(vehicle.dutyStatus || vehicle.condition) && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-blue-950">
              {vehicle.condition || 'Ex-Japan Import'} · {vehicle.dutyStatus || 'Duty Paid & Registered'}
            </span>
          </div>
        )}

        {/* Description Section matching Screen 06 */}
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            Description
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {vehicle.description}
          </p>
        </div>

        {/* Key Features Chips */}
        {vehicle.features && vehicle.features.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Features & Highlights
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {vehicle.features.map((f, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px] flex items-center gap-1"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{f}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dealership Card on Vehicle Detail */}
        <div
          onClick={() => navigate(`/showroom/${dealership.slug}`)}
          className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {dealership.logoUrl ? (
              <img
                src={dealership.logoUrl}
                alt={dealership.name}
                className="w-9 h-9 rounded-full object-contain bg-white border border-slate-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase shrink-0">
                {dealership.name ? dealership.name.slice(0, 2) : 'DL'}
              </div>
            )}
            <div>
              <p className="font-bold text-xs text-slate-900">{dealership.name}</p>
              <p className="text-[11px] text-slate-500">{dealership.city} · View all inventory</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Sticky Bottom Action Bar matching Screen 06 */}
      <div className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        {/* Green WhatsApp Button matching Screen 06 */}
        <a
          href={whatsAppDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>WhatsApp</span>
        </a>

        {/* White Call Button matching Screen 06 */}
        <a
          href={`tel:${dealership.phone}`}
          className="h-12 px-5 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Phone className="w-4 h-4 text-slate-700" />
          <span>Call</span>
        </a>

        {/* Share Listing Button matching Screen 06 */}
        <button
          onClick={() => setIsShareOpen(true)}
          className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center transition-colors shrink-0"
          title="Share vehicle"
          aria-label="Share vehicle"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model} - ${dealership.name}`}
        url={window.location.href}
        description={`Available for $${vehicle.price.toLocaleString()} in ${dealership.city}.`}
      />

      {/* Enquiry Modal */}
      <EnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => setIsEnquiryOpen(false)}
        vehicle={vehicle}
      />
    </div>
  );
};
