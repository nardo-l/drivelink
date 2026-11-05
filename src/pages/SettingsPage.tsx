import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { CurrencyCode } from '../types';
import { notificationService } from '../services/notificationService';
import { ShowroomBrandingEditor } from '../components/ShowroomBrandingEditor';
import { Bell } from 'lucide-react';
import {
  Building2, Phone, MessageCircle, MapPin, Globe, ExternalLink,
  Save, Loader2,
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
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'default' : Notification.permission);

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
            setLogoUrl(live.logoUrl || '');
            setCoverUrl(live.coverUrl || '');
          }
        } catch (e) {
          console.warn('Could not fetch live dealership on mount in Settings:', e);
        }
      }
    };
    fetchDealership();
  }, []);

  React.useEffect(() => { notificationService.isPushEnabled().then(setPushEnabled).catch(() => setPushEnabled(false)); }, []);
  const toggleNotifications = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) { await notificationService.disablePush(current.id); setPushEnabled(false); showToast('Notifications turned off'); }
      else { await notificationService.enablePush(current.id, true); setPushEnabled(true); setPushPermission(Notification.permission); showToast('Notifications enabled'); }
    } catch (error: any) { setPushPermission(typeof Notification === 'undefined' ? 'default' : Notification.permission); showToast(error?.message || 'Could not update notification settings'); }
    finally { setPushBusy(false); }
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
      logoUrl,
      coverUrl,
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
          <div className="mb-4"><h2 className="text-sm font-bold text-[#292929]">Brand your showroom</h2><p className="mt-1 text-[11px] text-[#888]">Your logo and banner help buyers recognise your dealership.</p></div>
          <ShowroomBrandingEditor
            dealershipName={name}
            city={city}
            tagline={current.tagline || ''}
            logoUrl={logoUrl || null}
            bannerUrl={coverUrl || null}
            onChange={value => { setLogoUrl(value.logoUrl || ''); setCoverUrl(value.bannerUrl || ''); storageService.updateDealership({ logoUrl: value.logoUrl || '', coverUrl: value.bannerUrl || '' }); }}
          />
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

        <section className="rounded-2xl border border-[#E7E7E7] bg-white p-4 shadow-[0_2px_10px_rgba(20,20,20,0.025)]">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F4F4] text-[#242424]"><Bell size={18}/></div><div><h2 className="text-sm font-bold text-[#292929]">Notifications</h2><p className="mt-0.5 text-[11px] text-[#888]">Get alerts for new buyer enquiries and account updates.</p></div></div><button type="button" role="switch" aria-checked={pushEnabled} disabled={pushBusy || !notificationService.isPushSupported()} onClick={toggleNotifications} className={`relative h-7 w-12 shrink-0 rounded-full transition ${pushEnabled?'bg-[#0A0F1E]':'bg-[#D5D7DC]'} disabled:opacity-50`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${pushEnabled?'left-6':'left-1'}`}/></button></div>
          {!notificationService.isPushSupported() && <p className="mt-3 text-xs leading-5 text-[#777]">To receive notifications on iPhone, add DriveLink to your Home Screen using Safari’s Share menu, then choose “Add to Home Screen”.</p>}
          {pushPermission==='denied' && <p className="mt-3 text-xs leading-5 text-[#777]">Notifications are blocked by your browser. Open your browser’s site settings for DriveLink and allow notifications, then return here.</p>}
        </section>

        <button type="submit"
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F47716] text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(244,119,22,0.2)] transition hover:bg-[#E96B0C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="h-4 w-4" /> Save changes
        </button>
      </form>

    </div>
  );
};
