import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { CurrencyCode } from '../types';
import { BottomNav } from '../components/layout/BottomNav';
import {
  CreditCard,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Globe,
  ExternalLink,
  Save,
  LogOut,
  ShieldCheck,
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
  const [logoUrl, setLogoUrl] = useState<string>(current.logoUrl || '');
  const [coverUrl, setCoverUrl] = useState<string>(current.coverUrl || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  React.useEffect(() => {
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
        showToast('Logo uploaded successfully!');
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
        showToast('Showroom cover uploaded successfully!');
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
      template: current.template || 'signature',
      logoUrl: logoUrl || undefined,
      coverUrl: coverUrl || undefined,
    });
    showToast('Settings saved successfully!');
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

  const publicStoreUrl = `${window.location.origin}/showroom/${encodeURIComponent(slug || current.slug)}`;

  const handleCopyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(publicStoreUrl);
      showToast('Store link copied');
    } catch {
      showToast('Could not copy link. Please copy it from the address field.');
    }
  };

  return (
    <div className="relative flex min-h-full flex-col bg-[#F4F5F6] text-[#292929]">
      <header className="border-b border-[#E7E7E7] bg-white px-5 pb-5 pt-5">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-white">
            <Building2 className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F47716]">DriveLink</p>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-[#242424]">Store Profile</h1>
            <p className="mt-0.5 text-xs text-[#777777]">Manage how buyers see your dealership.</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 pb-28">
        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Dealership details</h2>
          </div>
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Dealership name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="mb-4 h-11 w-full rounded-xl border border-[#E4E4E4] bg-white px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Location</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City or area"
              className="h-11 w-full rounded-xl border border-[#E4E4E4] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#292929]">Store logo</h2>
              <p className="mt-0.5 text-[11px] text-[#888]">Your dealership identity</p>
            </div>
            {isUploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-[#F47716]" />}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8E8E8] bg-[#F7F7F7]">
              {logoUrl ? <img src={logoUrl} alt="Current dealership logo" className="h-full w-full object-contain" /> :
                <span className="text-lg font-extrabold text-[#777]">{name ? name.slice(0, 2).toUpperCase() : 'DL'}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 text-xs font-bold text-[#333] transition hover:bg-[#F8F8F8]">
                <Upload className="h-3.5 w-3.5" /> Change logo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadLogo} disabled={isUploadingLogo} className="hidden" />
              </label>
              <p className="mt-1.5 text-[10px] text-[#999]">PNG, JPG or WebP · Up to 5MB</p>
            </div>
          </div>
          {logoError && <p className="mt-2 text-xs text-rose-600">{logoError}</p>}
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#292929]">Banner image</h2>
              <p className="mt-0.5 text-[11px] text-[#888]">The main image buyers see on your store</p>
            </div>
            {isUploadingCover && <Loader2 className="h-4 w-4 animate-spin text-[#F47716]" />}
          </div>
          <div className="relative aspect-[16/5] w-full overflow-hidden rounded-xl border border-[#E8E8E8] bg-[#F1F1F1]">
            {coverUrl ? <img src={coverUrl} alt="Current store banner" className="h-full w-full object-cover" /> :
              <div className="flex h-full flex-col items-center justify-center gap-1 text-[#999]"><ImageIcon className="h-6 w-6" /><span className="text-[11px]">No banner image yet</span></div>}
            {isUploadingCover && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
          </div>
          <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 text-xs font-bold text-[#333] transition hover:bg-[#F8F8F8]">
            <Upload className="h-3.5 w-3.5" /> Change banner
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadCover} disabled={isUploadingCover} className="hidden" />
          </label>
          <p className="mt-1.5 text-[10px] text-[#999]">Recommended 1200 × 400px · Up to 5MB</p>
          {coverError && <p className="mt-2 text-xs text-rose-600">{coverError}</p>}
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Contact details</h2>
          </div>
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Phone number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263..."
            className="mb-4 h-11 w-full rounded-xl border border-[#E4E4E4] px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <div className="mb-1.5 flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-[#F47716]" />
            <label className="text-xs font-semibold text-[#555]">WhatsApp contact</label>
          </div>
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+263..."
            className="h-11 w-full rounded-xl border border-[#E4E4E4] px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <p className="mt-1.5 text-[10px] text-[#999]">Buyers can use this number to contact your dealership on WhatsApp.</p>
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Store link</h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E7E7E7] bg-[#F8F8F8] p-2">
            <span className="min-w-0 flex-1 truncate px-1 text-xs text-[#666]">{publicStoreUrl}</span>
            <button type="button" onClick={handleCopyStoreLink} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-[#333] shadow-sm ring-1 ring-[#E7E7E7] transition hover:bg-[#F1F1F1]">
              <ExternalLink className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <p className="mt-2 text-[10px] text-[#999]">Share this link so buyers can view your dealership and available cars.</p>
        </section>

        <button type="submit" disabled={isUploadingLogo || isUploadingCover}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F47716] text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(244,119,22,0.2)] transition hover:bg-[#E96B0C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="h-4 w-4" /> Save changes
        </button>
      </form>

      <nav aria-label="Main navigation" className="sticky bottom-0 z-40 flex shrink-0 items-center justify-around border-t border-white/10 bg-[#252525] px-2 pb-safe pt-2 text-white shadow-[0_-5px_18px_rgba(0,0,0,0.08)]">
        {[
          { label: 'Home', path: '/app', icon: Home },
          { label: 'Garage', path: '/app/vehicles', icon: CarFront },
          { label: 'Enquiries', path: '/app/enquiries', icon: UsersRound },
          { label: 'Analytics', path: '/app/analytics', icon: ChartNoAxesCombined },
          { label: 'Store/Profile', path: '/app/settings', icon: Store },
        ].map((item) => {
          const Icon = item.icon;
          const selected = item.path === '/app/settings';
          return <button key={item.label} type="button" onClick={() => navigate(item.path)} aria-current={selected ? 'page' : undefined}
            className="relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-white/75 transition hover:text-white">
            {selected && <span className="absolute -top-2 h-[3px] w-7 rounded-full bg-[#F47716]" />}
            <Icon className={`h-[19px] w-[19px] ${selected ? 'text-white' : ''}`} strokeWidth={selected ? 2.3 : 1.8} />
            <span className={`whitespace-nowrap text-[9px] ${selected ? 'font-bold text-white' : 'font-medium'}`}>{item.label}</span>
          </button>;
        })}
      </nav>
    </div>
  );
};import {
  Building2, Phone, MessageCircle, MapPin, Globe, ExternalLink,
  Save, Loader2, Upload, Image as ImageIcon, Home, CarFront,
  UsersRound, ChartNoAxesCombined, Store,
} from 'lucide-react';e } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { CurrencyCode } from '../types';
import { BottomNav } from '../components/layout/BottomNav';
import {
  CreditCard,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Globe,
  ExternalLink,
  Save,
  LogOut,
  ShieldCheck,
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
  const [logoUrl, setLogoUrl] = useState<string>(current.logoUrl || '');
  const [coverUrl, setCoverUrl] = useState<string>(current.coverUrl || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  React.useEffect(() => {
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
        showToast('Logo uploaded successfully!');
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
        showToast('Showroom cover uploaded successfully!');
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
      template: current.template || 'signature',
      logoUrl: logoUrl || undefined,
      coverUrl: coverUrl || undefined,
    });
    showToast('Settings saved successfully!');
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

  const publicStoreUrl = `${window.location.origin}/showroom/${encodeURIComponent(slug || current.slug)}`;

  const handleCopyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(publicStoreUrl);
      showToast('Store link copied');
    } catch {
      showToast('Could not copy link. Please copy it from the address field.');
    }
  };

  return (
    <div className="relative flex min-h-full flex-col bg-[#F4F5F6] text-[#292929]">
      <header className="border-b border-[#E7E7E7] bg-white px-5 pb-5 pt-5">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-white">
            <Building2 className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F47716]">DriveLink</p>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-[#242424]">Store Profile</h1>
            <p className="mt-0.5 text-xs text-[#777777]">Manage how buyers see your dealership.</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 pb-28">
        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Dealership details</h2>
          </div>
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Dealership name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="mb-4 h-11 w-full rounded-xl border border-[#E4E4E4] bg-white px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Location</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City or area"
              className="h-11 w-full rounded-xl border border-[#E4E4E4] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#292929]">Store logo</h2>
              <p className="mt-0.5 text-[11px] text-[#888]">Your dealership identity</p>
            </div>
            {isUploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-[#F47716]" />}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8E8E8] bg-[#F7F7F7]">
              {logoUrl ? <img src={logoUrl} alt="Current dealership logo" className="h-full w-full object-contain" /> :
                <span className="text-lg font-extrabold text-[#777]">{name ? name.slice(0, 2).toUpperCase() : 'DL'}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 text-xs font-bold text-[#333] transition hover:bg-[#F8F8F8]">
                <Upload className="h-3.5 w-3.5" /> Change logo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadLogo} disabled={isUploadingLogo} className="hidden" />
              </label>
              <p className="mt-1.5 text-[10px] text-[#999]">PNG, JPG or WebP · Up to 5MB</p>
            </div>
          </div>
          {logoError && <p className="mt-2 text-xs text-rose-600">{logoError}</p>}
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#292929]">Banner image</h2>
              <p className="mt-0.5 text-[11px] text-[#888]">The main image buyers see on your store</p>
            </div>
            {isUploadingCover && <Loader2 className="h-4 w-4 animate-spin text-[#F47716]" />}
          </div>
          <div className="relative aspect-[16/5] w-full overflow-hidden rounded-xl border border-[#E8E8E8] bg-[#F1F1F1]">
            {coverUrl ? <img src={coverUrl} alt="Current store banner" className="h-full w-full object-cover" /> :
              <div className="flex h-full flex-col items-center justify-center gap-1 text-[#999]"><ImageIcon className="h-6 w-6" /><span className="text-[11px]">No banner image yet</span></div>}
            {isUploadingCover && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
          </div>
          <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 text-xs font-bold text-[#333] transition hover:bg-[#F8F8F8]">
            <Upload className="h-3.5 w-3.5" /> Change banner
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadCover} disabled={isUploadingCover} className="hidden" />
          </label>
          <p className="mt-1.5 text-[10px] text-[#999]">Recommended 1200 × 400px · Up to 5MB</p>
          {coverError && <p className="mt-2 text-xs text-rose-600">{coverError}</p>}
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Contact details</h2>
          </div>
          <label className="mb-1.5 block text-xs font-semibold text-[#555]">Phone number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263..."
            className="mb-4 h-11 w-full rounded-xl border border-[#E4E4E4] px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <div className="mb-1.5 flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-[#F47716]" />
            <label className="text-xs font-semibold text-[#555]">WhatsApp contact</label>
          </div>
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+263..."
            className="h-11 w-full rounded-xl border border-[#E4E4E4] px-3 text-sm outline-none transition focus:border-[#F47716] focus:ring-2 focus:ring-[#F47716]/10" />
          <p className="mt-1.5 text-[10px] text-[#999]">Buyers can use this number to contact your dealership on WhatsApp.</p>
        </section>

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#F47716]" />
            <h2 className="text-sm font-bold text-[#292929]">Store link</h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E7E7E7] bg-[#F8F8F8] p-2">
            <span className="min-w-0 flex-1 truncate px-1 text-xs text-[#666]">{publicStoreUrl}</span>
            <button type="button" onClick={handleCopyStoreLink} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-[#333] shadow-sm ring-1 ring-[#E7E7E7] transition hover:bg-[#F1F1F1]">
              <ExternalLink className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <p className="mt-2 text-[10px] text-[#999]">Share this link so buyers can view your dealership and available cars.</p>
        </section>

        <button type="submit" disabled={isUploadingLogo || isUploadingCover}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F47716] text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(244,119,22,0.2)] transition hover:bg-[#E96B0C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="h-4 w-4" /> Save changes
        </button>
      </form>

      <nav aria-label="Main navigation" className="sticky bottom-0 z-40 flex shrink-0 items-center justify-around border-t border-white/10 bg-[#252525] px-2 pb-safe pt-2 text-white shadow-[0_-5px_18px_rgba(0,0,0,0.08)]">
        {[
          { label: 'Home', path: '/app', icon: Home },
          { label: 'Garage', path: '/app/vehicles', icon: CarFront },
          { label: 'Enquiries', path: '/app/enquiries', icon: UsersRound },
          { label: 'Analytics', path: '/app/analytics', icon: ChartNoAxesCombined },
          { label: 'Store/Profile', path: '/app/settings', icon: Store },
        ].map((item) => {
          const Icon = item.icon;
          const selected = item.path === '/app/settings';
          return <button key={item.label} type="button" onClick={() => navigate(item.path)} aria-current={selected ? 'page' : undefined}
            className="relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-white/75 transition hover:text-white">
            {selected && <span className="absolute -top-2 h-[3px] w-7 rounded-full bg-[#F47716]" />}
            <Icon className={`h-[19px] w-[19px] ${selected ? 'text-white' : ''}`} strokeWidth={selected ? 2.3 : 1.8} />
            <span className={`whitespace-nowrap text-[9px] ${selected ? 'font-bold text-white' : 'font-medium'}`}>{item.label}</span>
          </button>;
        })}
      </nav>
    </div>
  );
};
