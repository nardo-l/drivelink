import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, runBackendDiagnostic, BackendDiagnosticResult } from '../lib/supabase';
import { Dealership, StorefrontTemplate, CurrencyCode } from '../types';
import { BottomNav } from '../components/layout/BottomNav';
import {
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Globe,
  Palette,
  ExternalLink,
  Save,
  RotateCcw,
  LogOut,
  ShieldCheck,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Check,
  XCircle,
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const current = storageService.getDealership();

  const [diagnostic, setDiagnostic] = useState<BackendDiagnosticResult | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const loadDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const result = await runBackendDiagnostic(storageService.isDemoModeActive());
      setDiagnostic(result);
    } catch (e) {
      console.error('Error running backend diagnostic:', e);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const [name, setName] = useState(current.name);
  const [slug, setSlug] = useState(current.slug);
  const [city, setCity] = useState(current.city);
  const [address, setAddress] = useState(current.address || '');
  const [phone, setPhone] = useState(current.phone);
  const [whatsapp, setWhatsapp] = useState(current.whatsapp);
  const [email, setEmail] = useState(current.email);
  const [currency, setCurrency] = useState<CurrencyCode>(current.currency || 'USD');
  const [bio, setBio] = useState(current.bio);
  const [stickerText, setStickerText] = useState(current.stickerText || 'Good cars brighter days');
  const [template, setTemplate] = useState<StorefrontTemplate>(current.template || 'signature');
  const [logoUrl, setLogoUrl] = useState<string>(current.logoUrl || '');
  const [coverUrl, setCoverUrl] = useState<string>(current.coverUrl || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  React.useEffect(() => {
    loadDiagnostic();
    const fetchDealership = async () => {
      if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
        try {
          const live = await supabaseService.getCurrentDealership();
          if (live) {
            storageService.saveDealership(live);
            setName(live.name || '');
            setSlug(live.slug || '');
            setCity(live.city || '');
            setAddress(live.address || '');
            setPhone(live.phone || '');
            setWhatsapp(live.whatsapp || '');
            setEmail(live.email || '');
            setCurrency(live.currency || 'USD');
            setBio(live.bio || '');
            setStickerText(live.stickerText || 'Good cars brighter days');
            setTemplate(live.template || 'signature');
            if (live.logoUrl) setLogoUrl(live.logoUrl);
            if (live.coverUrl) setCoverUrl(live.coverUrl);
          }
        } catch (e) {
          console.warn('Could not fetch live dealership on mount in Settings:', e);
        }
      }
    };
    fetchDealership();
  }, []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Please select a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo file size must be less than 5MB.');
      return;
    }
    setLogoError(null);

    // 1. Immediate local preview
    const localPreview = URL.createObjectURL(file);
    setLogoUrl(localPreview);
    setIsUploadingLogo(true);

    try {
      if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
        const publicUrl = await supabaseService.uploadDealershipAsset(current.id, file, 'logo');
        URL.revokeObjectURL(localPreview);
        setLogoUrl(publicUrl);
        storageService.updateDealership({ logoUrl: publicUrl });
        showToast('Logo uploaded to Supabase Storage!');
      } else {
        storageService.updateDealership({ logoUrl: localPreview });
        showToast('Logo updated');
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setLogoError(err?.message || 'Logo upload failed');
      showToast(err?.message || 'Logo upload failed');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setCoverError('Please select a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverError('Cover banner file size must be less than 5MB.');
      return;
    }
    setCoverError(null);

    // 1. Immediate local preview
    const localPreview = URL.createObjectURL(file);
    setCoverUrl(localPreview);
    setIsUploadingCover(true);

    try {
      if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
        const publicUrl = await supabaseService.uploadDealershipAsset(current.id, file, 'cover');
        URL.revokeObjectURL(localPreview);
        setCoverUrl(publicUrl);
        storageService.updateDealership({ coverUrl: publicUrl });
        showToast('Showroom cover uploaded to Supabase Storage!');
      } else {
        storageService.updateDealership({ coverUrl: localPreview });
        showToast('Cover updated');
      }
    } catch (err: any) {
      console.error('Cover upload error:', err);
      setCoverError(err?.message || 'Cover banner upload failed');
      showToast(err?.message || 'Cover upload failed');
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await storageService.updateDealershipAsync({
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      city,
      address,
      phone,
      whatsapp,
      email,
      currency,
      bio,
      stickerText,
      template,
      logoUrl: logoUrl || undefined,
      coverUrl: coverUrl || undefined,
    });
    showToast('Settings saved successfully!');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all vehicles, enquiries, and settings to original demo data?')) {
      storageService.resetToDemo();
      showToast('Demo data reset to fresh state');
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseService.signOut();
      } catch (err) {
        console.warn('Supabase sign out notice:', err);
      }
    }
    storageService.setUserSession({
      isLoggedIn: false,
      email: '',
      dealershipId: '',
    });
    showToast('Signed out of dealership');
    navigate('/');
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-[#F8F9FA] text-slate-900">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-slate-950 tracking-tight">
            Dealership Settings
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            Manage showroom preferences and profile
          </p>
        </div>

        <button
          onClick={() => navigate(`/showroom/${current.slug}`)}
          className="h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>View Showroom</span>
        </button>
      </div>

      {/* Main Body */}
      <form onSubmit={handleSave} className="flex-1 px-5 py-4 overflow-y-auto pb-24 flex flex-col gap-5">
        {/* Storefront Layout Template Selection */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-xs text-slate-900">Storefront Template</h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              {
                id: 'signature',
                title: 'Signature (Default)',
                desc: 'Image-led 2-column mobile cards, hero showroom banner, and vibrant WhatsApp CTAs.',
              },
              {
                id: 'inventory_first',
                title: 'Inventory First',
                desc: 'Dense vehicle listings prioritizing mileage, duty clearance, and specs.',
              },
              {
                id: 'independent',
                title: 'Independent Curator',
                desc: 'Personal seller profile with hand-picked featured stock.',
              },
            ].map((item) => (
              <label
                key={item.id}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  template === item.id
                    ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={template === item.id}
                  onChange={() => setTemplate(item.id as StorefrontTemplate)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-bold text-xs text-slate-900">{item.title}</p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Showroom Branding (Logo & Cover Uploads) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-600" />
              <h2 className="font-bold text-xs text-slate-900">Showroom Branding</h2>
            </div>
            {(isUploadingLogo || isUploadingCover) && (
              <span className="text-[10px] text-blue-600 flex items-center gap-1 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Uploading to Supabase...</span>
              </span>
            )}
          </div>

          {/* Dealership Logo */}
          <div className="flex flex-col gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Dealership Logo
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-2xs relative">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center uppercase">
                    {name ? name.slice(0, 2) : 'DL'}
                  </div>
                )}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="h-8 px-3 rounded-lg bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>{logoUrl ? 'Change logo' : 'Upload logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleUploadLogo}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        storageService.updateDealership({ logoUrl: undefined });
                        showToast('Logo removed');
                      }}
                      className="text-xs text-rose-600 font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Recommended: 500 × 500 px. Uploads to Supabase Storage bucket `dealership-assets`.
                </p>
                {logoError && (
                  <p className="text-[11px] text-rose-600 font-medium">{logoError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Showroom Cover Banner */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              Showroom Cover Banner
            </label>
            <div className="relative w-full aspect-3/1 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 text-center p-3">
                  <ImageIcon className="w-5 h-5 mb-1 text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-300">
                    No custom cover banner set
                  </span>
                </div>
              )}
              {isUploadingCover && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1.5 text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-semibold">Uploading to Supabase...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="h-8 px-3 rounded-lg bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors">
                <Upload className="w-3 h-3" />
                <span>{coverUrl ? 'Change cover' : 'Upload cover banner'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadCover}
                  disabled={isUploadingCover}
                  className="hidden"
                />
              </label>

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl('');
                    storageService.updateDealership({ coverUrl: undefined });
                    showToast('Cover removed');
                  }}
                  className="text-xs text-rose-600 font-semibold hover:underline"
                >
                  Remove banner
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Recommended: 1200 × 400 px (3:1 ratio). Max 5MB.
            </p>
            {coverError && (
              <p className="text-[11px] text-rose-600 font-medium">{coverError}</p>
            )}
          </div>
        </div>

        {/* Business Profile Details */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-xs text-slate-900">Business Profile</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dealership Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Public Handle (URL slug)
            </label>
            <div className="flex items-center h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <span className="text-slate-400 select-none mr-1">drivelink.app/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="flex-1 bg-transparent font-semibold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sticker Text (Cover Badge)
            </label>
            <input
              type="text"
              value={stickerText}
              onChange={(e) => setStickerText(e.target.value)}
              placeholder="Good cars brighter days"
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none font-handwritten text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bio / Showroom Pitch
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Contact & Location */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-xs text-slate-900">Contact & Market</h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Number *
              </label>
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Call Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location Display
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none font-semibold"
              >
                <option value="USD">USD ($) - Zimbabwe</option>
                <option value="ZAR">ZAR (R) - South Africa</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Yard Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="14 Enterprise Road, Harare"
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Supabase Backend Connection Diagnostic Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-800" />
              <h2 className="font-bold text-xs text-slate-900">Backend Diagnostic</h2>
            </div>

            {diagnostic && (
              <span
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  diagnostic.state === 'authenticated'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : diagnostic.state === 'connected'
                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                    : diagnostic.state === 'configured_unverified'
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : diagnostic.state === 'demo_mode'
                    ? 'text-purple-700 bg-purple-50 border-purple-200'
                    : 'text-slate-600 bg-slate-100 border-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    diagnostic.state === 'authenticated'
                      ? 'bg-emerald-500 animate-pulse'
                      : diagnostic.state === 'connected'
                      ? 'bg-blue-500'
                      : diagnostic.state === 'configured_unverified'
                      ? 'bg-amber-500'
                      : diagnostic.state === 'demo_mode'
                      ? 'bg-purple-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span>{diagnostic.statusLabel}</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {diagnostic?.description || 'Evaluating Supabase connectivity...'}
          </p>

          {/* Diagnostic breakdown table */}
          {diagnostic && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[11px] flex flex-col gap-2 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Host:</span>
                <span className="font-semibold text-slate-800 text-[10px]">
                  {diagnostic.host || 'Not configured'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Session:</span>
                <span className="font-semibold text-slate-800 text-[10px]">
                  {diagnostic.isAuthenticated ? diagnostic.userEmail : 'Unauthenticated'}
                </span>
              </div>

              <div className="pt-1 border-t border-slate-200/60 flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tables (RLS):</span>
                  <span className="font-semibold text-slate-800">
                    {diagnostic.tables.dealerships && diagnostic.tables.vehicles && diagnostic.tables.enquiries ? (
                      <span className="text-emerald-700 font-bold">✓ dealerships, vehicles, enquiries</span>
                    ) : (
                      <span className="text-amber-700">Check schema</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">vehicle-photos:</span>
                  <span className="font-semibold">
                    {diagnostic.storageBuckets.vehiclePhotos ? (
                      <span className="text-emerald-700">✓ Ready</span>
                    ) : (
                      <span className="text-amber-700">
                        {diagnostic.storageBuckets.vehiclePhotosError || 'Missing bucket'}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">dealership-assets:</span>
                  <span className="font-semibold">
                    {diagnostic.storageBuckets.dealershipAssets ? (
                      <span className="text-emerald-700">✓ Ready</span>
                    ) : (
                      <span className="text-amber-700">
                        {diagnostic.storageBuckets.dealershipAssetsError || 'Missing bucket'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Run test button */}
          <button
            type="button"
            onClick={loadDiagnostic}
            disabled={isRunningDiagnostic}
            className="w-full py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isRunningDiagnostic ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                <span>Testing Supabase connection...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Run Connection Test</span>
              </>
            )}
          </button>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full h-12 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>

        {/* Demo Controls / Reset & Sign Out */}
        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleResetData}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Demo Data</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </form>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
