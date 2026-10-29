import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { StatusBadge } from '../components/common/Badge';
import { ShareModal } from '../components/common/ShareModal';
import {
  Bell,
  Car,
  MessageSquare,
  BarChart3,
  Copy,
  Share2,
  ChevronRight,
  Plus,
  ExternalLink,
  Check,
  Database,
  RefreshCw,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [dealership, setDealership] = useState(() => storageService.getDealership());
  const [vehicles, setVehicles] = useState(() => storageService.getVehicles());
  const [enquiries, setEnquiries] = useState(() => storageService.getEnquiries());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();

  // If Supabase is configured, sync fresh data in background
  useEffect(() => {
    if (isLive) {
      storageService.getDealershipAsync().then(setDealership).catch(() => {});
      storageService.getVehiclesAsync().then(setVehicles).catch(() => {});
      storageService.getEnquiriesAsync().then(setEnquiries).catch(() => {});
    }
  }, [isLive]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      const d = await storageService.getDealershipAsync();
      const v = await storageService.getVehiclesAsync();
      const e = await storageService.getEnquiriesAsync();
      setDealership(d);
      setVehicles(v);
      setEnquiries(e);
      showToast(isLive ? 'Synced with Supabase database' : 'Refreshed local data');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const storefrontUrl = `drivelink.app/${dealership.slug}`;
  const fullPublicUrl = `${window.location.origin}/#/showroom/${dealership.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(fullPublicUrl);
    setCopied(true);
    showToast('Showroom link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Summary counts
  const totalVehicles = vehicles.length;
  const totalEnquiries = enquiries.length;
  const storefrontViews = dealership.storefrontViews || 1892;

  // Display top 4 recent vehicles matching Screen 03
  const displayedVehicles = vehicles.slice(0, 4);

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-[#F8F9FA] text-slate-900">
      {/* Scrollable Content */}
      <div className="flex-1 px-5 pt-5 pb-24 overflow-y-auto">
        {/* Dealership Header matching Screen 03 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={dealership.logoUrl}
              alt={dealership.name}
              className="w-11 h-11 rounded-full object-contain bg-white shadow-xs border border-slate-200/80 p-0.5"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-extrabold text-slate-950 tracking-tight leading-tight">
                  {dealership.name}
                </h1>
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Supabase</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                    <span>Demo Mode</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Good morning! Here&apos;s your overview.
              </p>
            </div>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-slate-700 transition-colors relative border border-transparent hover:border-slate-200"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* Notification Dropdown Drawer */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">Recent Alerts</span>
                  <span className="text-[10px] text-slate-400">2 unread</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100/60 text-xs">
                    <p className="font-semibold text-slate-900">New WhatsApp Inquiry</p>
                    <p className="text-[11px] text-slate-600">
                      Tendai Moyo asked about 2019 Toyota Aqua.
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <p className="font-semibold text-slate-900">Showroom Milestone</p>
                    <p className="text-[11px] text-slate-600">
                      Your link reached 1,892 verified visits this month.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3 Summary Cards matching Screen 03 */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {/* Vehicles Card */}
          <button
            onClick={() => navigate('/app/vehicles')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex flex-col items-start gap-1 hover:border-blue-200 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Car className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-medium text-slate-500 mt-1">Vehicles</span>
            <span className="text-xl font-extrabold text-slate-950 tabular-nums">
              {totalVehicles}
            </span>
          </button>

          {/* Enquiries Card */}
          <button
            onClick={() => navigate('/app/enquiries')}
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex flex-col items-start gap-1 hover:border-purple-200 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-medium text-slate-500 mt-1">Enquiries</span>
            <span className="text-xl font-extrabold text-slate-950 tabular-nums">
              {totalEnquiries}
            </span>
          </button>

          {/* Views Card */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex flex-col items-start gap-1 text-left">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-medium text-slate-500 mt-1">Storefront views</span>
            <span className="text-xl font-extrabold text-slate-950 tabular-nums">
              {storefrontViews.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Storefront Link Card matching Screen 03 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-xs mb-6">
          <p className="text-xs font-semibold text-slate-700 mb-2">Your storefront link</p>
          <div className="flex items-center justify-between gap-2">
            {/* Link preview with copy icon */}
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={() => navigate(`/showroom/${dealership.slug}`)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 truncate underline decoration-blue-300 underline-offset-2 flex items-center gap-1"
                title="Preview public showroom"
              >
                <span>{storefrontUrl}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="text-slate-400 hover:text-slate-700 p-1 shrink-0 transition-colors"
                title="Copy link"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Black Share Button matching Screen 03 */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="py-1.5 px-3.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* "Your vehicles" Section matching Screen 03 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-slate-950 tracking-tight">Your vehicles</h2>
            <button
              onClick={() => navigate('/app/vehicles')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              See all
            </button>
          </div>

          {/* Vehicle List Rows */}
          <div className="flex flex-col gap-2.5">
            {displayedVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => navigate(`/app/vehicles/${vehicle.id}`)}
                className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
              >
                {/* Thumbnail */}
                <div className="w-14 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={vehicle.photos[0]}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Make, Model & Price */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="text-xs font-bold text-slate-950 mt-0.5">
                    ${vehicle.price.toLocaleString()}
                  </p>
                </div>

                {/* Status Pill matching Screen 03 */}
                <StatusBadge status={vehicle.status} size="sm" />

                {/* Chevron */}
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Add Vehicle Action Button (+) matching Screen 03 */}
      <button
        onClick={() => navigate('/app/vehicles/new')}
        className="sticky bottom-20 self-end mr-5 -mt-14 z-30 w-13 h-13 rounded-full bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center shadow-xl shadow-slate-950/30 active:scale-95 transition-all"
        title="Add vehicle"
        aria-label="Add vehicle"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <BottomNav />

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={dealership.name}
        url={fullPublicUrl}
        description={`Explore quality verified vehicles in Harare / Sandton from ${dealership.name}.`}
      />
    </div>
  );
};
