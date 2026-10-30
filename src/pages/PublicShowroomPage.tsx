import React, { useState, useMemo, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { StatusBadge } from '../components/common/Badge';
import { ShareModal } from '../components/common/ShareModal';
import { EnquiryModal } from '../components/common/EnquiryModal';
import type { Dealership, Vehicle } from '../types';
import {
  MapPin,
  Search,
  Phone,
  MessageCircle,
  Share2,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Check,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';

interface PublicShowroomPageProps {
  slug?: string;
  previewDealership?: Dealership;
  previewVehicles?: Vehicle[];
}

export const PublicShowroomPage: React.FC<PublicShowroomPageProps> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate, showToast } = useNavigation();
  const [dealership, setDealership] = useState<Dealership>(() => previewDealership || storageService.getDealership());
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>(() =>
    previewVehicles || storageService.getVehicles().filter((v) => v.status === 'available')
  );

  useEffect(() => {
    if (!previewDealership && isSupabaseConfigured() && slug) {
      supabaseService.getDealershipBySlug(slug).then((dealer) => {
        if (dealer) {
          setDealership(dealer);
          // Query only available vehicles as permitted by public RLS policy
          supabaseService.getVehicles(dealer.id, true).then((vehList) => {
            if (vehList) {
              setAllVehicles(vehList.filter((v) => v.status === 'available'));
            }
          });
          supabaseService.incrementStorefrontViews(dealer.slug).catch((err) => console.warn('Storefront view tracking failed:', err));
        }
      }).catch((err) => console.warn('Supabase showroom load fallback:', err));
    }
  }, [slug, previewDealership]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('All');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);

  // Filter vehicles: strictly 'available' only in public storefront
  const filteredVehicles = useMemo(() => {
    return allVehicles.filter((v) => {
      // Public visitors must not see reserved, sold, or draft vehicles
      if (v.status !== 'available') return false;

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullString = `${v.year} ${v.make} ${v.model} ${v.colour || ''} ${v.condition || ''}`.toLowerCase();
        if (!fullString.includes(query)) return false;
      }

      // Filter make
      if (selectedMake !== 'All' && v.make !== selectedMake) return false;

      // Filter transmission
      if (selectedTransmission !== 'All' && v.transmission !== selectedTransmission) return false;

      // Filter year
      if (selectedYear !== 'All') {
        if (selectedYear === '2022+' && v.year < 2022) return false;
        if (selectedYear === '2020-2021' && (v.year < 2020 || v.year > 2021)) return false;
        if (selectedYear === 'pre-2020' && v.year >= 2020) return false;
      }

      return true;
    });
  }, [allVehicles, searchQuery, selectedMake, selectedTransmission, selectedYear]);

  const makes = ['All', 'Toyota', 'Honda', 'Mazda', 'Ford', 'Mercedes-Benz'];

  const cleanWhatsAppNumber = dealership.whatsapp.replace(/\D/g, '');
  const whatsAppDirectUrl = `https://wa.me/${cleanWhatsAppNumber}?text=${encodeURIComponent(
    `Hello ${dealership.name}, I'm browsing your showroom on DriveLink and have an enquiry.`
  )}`;

  return (
    <div className="dl-public-storefront relative min-h-full flex flex-col justify-between bg-white text-slate-900 pb-12">
      {/* Top Cover Banner matching Screen 05 */}
      <div className="relative w-full h-44 sm:h-52 bg-slate-800 overflow-hidden">
        {dealership.coverUrl ? (
          <img
            src={dealership.coverUrl}
            alt={dealership.name}
            className="w-full h-full object-cover opacity-90"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
            <span className="text-white/20 text-3xl font-black tracking-widest uppercase">
              {dealership.name || 'Showroom'}
            </span>
          </div>
        )}
        {/* Subtle Dark Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Share Button on Top Right */}
        <button
          onClick={() => setIsShareOpen(true)}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md backdrop-blur-xs transition-colors z-20"
          title="Share showroom"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Playful Sticker Badge in upper right matching Screen 05 */}
        <div className="absolute top-12 right-4 z-20">
          <div className="bg-[#FFEDD5] border border-orange-300 text-slate-900 px-3 py-1 rounded-xl shadow-md rotate-3 font-handwritten text-sm sm:text-base font-bold flex items-center gap-1">
            <span>{dealership.stickerText || 'Good cars brighter days'}</span>
            <Sparkles className="w-3.5 h-3.5 text-orange-500 fill-orange-400" />
          </div>
        </div>
      </div>

      {/* Profile Header with Overlapping Logo Avatar matching Screen 05 */}
      <div className="relative px-5 pt-0 pb-4 -mt-10 z-20">
        <div className="flex items-end justify-between mb-2">
          {/* Circular Overlapping Logo Avatar */}
          <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg ring-4 ring-white shrink-0 overflow-hidden flex items-center justify-center">
            {dealership.logoUrl ? (
              <img
                src={dealership.logoUrl}
                alt={dealership.name}
                className="w-full h-full object-contain rounded-full"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-blue-600 text-white font-extrabold text-xl flex items-center justify-center uppercase">
                {dealership.name
                  ? dealership.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                  : 'DL'}
              </div>
            )}
          </div>

          {/* Trust Badge */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Seller</span>
          </div>
        </div>

        {/* Business Title & Location matching Screen 05 */}
        <div className="flex items-center gap-1.5 mt-1">
          <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">
            {dealership.name}
          </h1>
          {dealership.isVerified && (
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
          )}
        </div>

        {/* Location Pin */}
        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{dealership.city}</span>
        </div>

        {/* Bio / Description */}
        <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
          {dealership.bio}
        </p>

        {/* WhatsApp & Call Action Row matching Screen 05 */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {/* Green WhatsApp Button */}
          <a
            href={whatsAppDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>WhatsApp</span>
          </a>

          {/* White Call Button */}
          <a
            href={`tel:${dealership.phone}`}
            className="h-11 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Phone className="w-4 h-4 text-slate-700" />
            <span>Call</span>
          </a>
        </div>
      </div>

      {/* Search Bar matching Screen 05 */}
      <div className="px-5 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vehicles..."
            className="w-full h-10 pl-9 pr-3 text-xs font-medium rounded-full bg-slate-100 border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Quick Filter Dropdowns matching Screen 05 */}
      <div className="px-5 mb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Make Filter */}
        <div className="relative shrink-0">
          <select
            value={selectedMake}
            onChange={(e) => setSelectedMake(e.target.value)}
            className="h-8 pl-3 pr-7 text-[11px] font-semibold text-slate-700 rounded-full border border-slate-200 bg-white hover:border-slate-300 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="All">Make ▾</option>
            {makes.slice(1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Transmission Filter */}
        <div className="relative shrink-0">
          <select
            value={selectedTransmission}
            onChange={(e) => setSelectedTransmission(e.target.value)}
            className="h-8 pl-3 pr-7 text-[11px] font-semibold text-slate-700 rounded-full border border-slate-200 bg-white hover:border-slate-300 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="All">Transmission ▾</option>
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Year Filter */}
        <div className="relative shrink-0">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-8 pl-3 pr-7 text-[11px] font-semibold text-slate-700 rounded-full border border-slate-200 bg-white hover:border-slate-300 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="All">Year ▾</option>
            <option value="2022+">2022+</option>
            <option value="2020-2021">2020 - 2021</option>
            <option value="pre-2020">Before 2020</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 2-Column Vehicle Grid matching Screen 05 */}
      <div className="px-5 flex-1">
        {filteredVehicles.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <p className="text-sm font-semibold text-slate-700">No vehicles match filters</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search or filter options</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedMake('All');
                setSelectedTransmission('All');
                setSelectedYear('All');
              }}
              className="mt-3 text-xs font-semibold text-blue-600 underline"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredVehicles.map((vehicle) => {
              const isSold = vehicle.status === 'sold';
              return (
                <div
                  key={vehicle.id}
                  onClick={() => navigate(`/showroom/${dealership.slug}/vehicle/${vehicle.id}`)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col overflow-hidden group"
                >
                  {/* Photo Container with SOLD badge overlay */}
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden flex items-center justify-center">
                    <img
                      src={vehicle.photos[0]}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Bold Black "SOLD" Badge overlay on corner if sold */}
                    {isSold && (
                      <div className="absolute top-2 right-2 bg-black/90 text-white font-extrabold text-[10px] tracking-wider px-2 py-0.5 rounded shadow-sm">
                        SOLD
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
                    <div>
                      {/* Price matching Screen 05 */}
                      <p className="font-extrabold text-sm text-slate-950">
                        ${vehicle.price.toLocaleString()}
                      </p>

                      {/* Year, Make, Model */}
                      <p className="font-bold text-xs text-slate-800 truncate mt-0.5">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>

                      {/* Specs String matching Screen 05 */}
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {(vehicle.mileageKm / 1000).toFixed(0)}k km ·{' '}
                        {vehicle.transmission === 'Automatic' ? 'Auto' : 'Manual'} ·{' '}
                        {vehicle.fuel}
                      </p>
                    </div>

                    {/* Status Pill on Bottom */}
                    <div className="pt-2 mt-auto">
                      <StatusBadge status={vehicle.status} size="sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dealership Footer & Hours */}
      <footer className="mt-10 px-5 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
        <p className="font-bold text-slate-700">{dealership.name}</p>
        <p className="mt-0.5">{dealership.address || 'Enterprise Road, Harare'}</p>
        <p className="mt-1 text-[11px] text-slate-400">Powered by DriveLink Dealerships</p>
      </footer>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={dealership.name}
        url={window.location.href}
        description={`Browse verified cars from ${dealership.name} in ${dealership.city}.`}
      />

      {/* General Enquiry Modal */}
      <EnquiryModal isOpen={isEnquiryOpen} onClose={() => setIsEnquiryOpen(false)} />
    </div>
  );
};
