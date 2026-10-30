import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, MapPin, Phone, ImagePlus, CarFront, Link2, CheckCircle2, Loader2, Upload, X, Mail, MessageCircle, Store, Ship, UserRound, Briefcase, Globe2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { OnboardingState, SellerType, Dealership, CurrencyCode } from '../types';
import { toE164 } from '../utils/phoneUtils';

const initialState = (): OnboardingState => ({
  currentStep: 1,
  account: { businessName: '', email: '', password: '', handle: '' },
  sellerType: 'dealership',
  showroom: { businessName: '', handle: '', isPublished: true },
  contact: { country: 'Zimbabwe', city: '', address: '', whatsappCountryCode: '+263', whatsappNumber: '', whatsappSameAsPhone: true, phoneCountryCode: '+263', phoneNumber: '', description: '' },
  branding: { logoFile: null, logoPreview: null, coverFile: null, coverPreview: null },
  template: 'signature',
  firstVehicle: { make: '', model: '', year: '', price: '', currency: 'USD', mileageKm: '', transmission: 'Automatic', fuel: 'Petrol', condition: 'Excellent', status: 'available', description: '', photos: [], isDraft: false, isSkipped: true },
  isCompleted: false,
});

const dataUrlToFile = (dataUrl: string, name: string) => { const [meta, encoded] = dataUrl.split(','); const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg'; const binary = atob(encoded); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return new File([bytes], name + (mime.includes('png') ? '.png' : '.jpg'), { type: mime }); };

const compressImage = (file: File, maxWidth = 1400, quality = 0.72) => new Promise<string>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    let scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) { URL.revokeObjectURL(url); reject(new Error('Image processing is unavailable.')); return; }
    let output = '';
    let currentQuality = quality;
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      output = canvas.toDataURL('image/jpeg', currentQuality);
      if (output.length < 460000) break;
      currentQuality = Math.max(0.38, currentQuality - 0.08);
      scale *= 0.85;
    }
    URL.revokeObjectURL(url);
    resolve(output);
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
  image.src = url;
});

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'my-dealership';

const sellerOptions: { id: SellerType; title: string; detail: string; icon: React.ElementType }[] = [
  { id: 'dealership', title: 'Car dealership', detail: 'A business selling multiple vehicles.', icon: Building2 },
  { id: 'importer', title: 'Vehicle importer', detail: 'You source vehicles from other countries.', icon: Ship },
  { id: 'independent', title: 'Independent seller', detail: 'You sell vehicles privately or on a small scale.', icon: UserRound },
  { id: 'broker', title: 'Car broker', detail: 'You connect vehicle buyers and sellers.', icon: Briefcase },
];

export const OnboardingFlow: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [data, setData] = useState<OnboardingState>(() => {
    const saved = storageService.getOnboardingState();
    return saved.isCompleted ? saved : { ...saved, currentStep: 1, account: { ...saved.account, password: '' } };
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [vehicleFiles, setVehicleFiles] = useState<File[]>([]);
  const [emailPending, setEmailPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const finalizing = useRef(false);
  const step = data.currentStep;

  useEffect(() => { storageService.saveOnboardingState(data); }, [data]);

  const showroomSlug = useMemo(() => slugify(data.showroom.businessName || data.account.businessName), [data.showroom.businessName, data.account.businessName]);
  const [availableSlug, setAvailableSlug] = useState(showroomSlug);
  const showroomUrl = `${window.location.origin}/showroom/${availableSlug}`;

  useEffect(() => {
    let active = true;
    const findSlug = async () => {
      let candidate = showroomSlug;
      let suffix = 2;
      for (let attempt = 0; attempt < 25; attempt++) {
        if (await supabaseService.checkHandleAvailability(candidate)) break;
        candidate = `${showroomSlug}-${suffix++}`;
      }
      if (active) setAvailableSlug(candidate);
    };
    findSlug().catch(() => { if (active) setAvailableSlug(showroomSlug); });
    return () => { active = false; };
  }, [showroomSlug]);

  const patch = (section: keyof OnboardingState, values: any) => {
    setData(previous => ({ ...previous, [section]: { ...(previous[section] as any), ...values } }));
  };
  const go = (next: number) => {
    setError('');
    setData(previous => ({ ...previous, currentStep: next }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finishSetup = async () => {
    if (finalizing.current) return;
    finalizing.current = true;
    setSubmitting(true);
    setError('');
    try {
      const user = await supabaseService.getCurrentUser();
      if (!user) throw new Error('Your account session is not ready yet. Please sign in again.');
      let dealer = await supabaseService.getCurrentDealership();
      const phone = toE164(data.contact.phoneCountryCode, data.contact.phoneNumber);
      const whatsapp = data.contact.whatsappSameAsPhone ? phone : toE164(data.contact.whatsappCountryCode, data.contact.whatsappNumber);
      const country = data.contact.country;
      let finalSlug = dealer?.slug || availableSlug;
      if (!dealer) {
        let suffix = 2;
        for (let attempt = 0; attempt < 25; attempt++) {
          if (await supabaseService.checkHandleAvailability(finalSlug)) break;
          finalSlug = `${showroomSlug}-${suffix++}`;
        }
      }
      dealer = await supabaseService.createDealership({
        name: data.showroom.businessName.trim(),
        slug: finalSlug,
        dealershipType: data.sellerType,
        country,
        city: data.contact.city.trim(),
        address: data.contact.address.trim(),
        phone: phone || whatsapp || '',
        whatsapp: whatsapp || phone || '',
        email: user.email || data.account.email,
        currency: country === 'South Africa' ? 'ZAR' : 'USD',
        template: 'signature',
        bio: data.contact.description.trim(),
        tagline: data.showroom.businessName.trim(),
        isPublished: true,
        isVerified: false,
      });
      const assets: Partial<Dealership> = {};
      const restoredLogo = logoFile || (data.branding.logoPreview?.startsWith('data:') ? dataUrlToFile(data.branding.logoPreview, 'dealership-logo') : null);
      const restoredBanner = bannerFile || (data.branding.coverPreview?.startsWith('data:') ? dataUrlToFile(data.branding.coverPreview, 'dealership-banner') : null);
      if (restoredLogo) assets.logoUrl = await supabaseService.uploadDealershipAsset(dealer.id, restoredLogo, 'logo');
      if (restoredBanner) assets.coverUrl = await supabaseService.uploadDealershipAsset(dealer.id, restoredBanner, 'cover');
      if (Object.keys(assets).length) dealer = await supabaseService.updateDealership(dealer.id, assets);

      if (!data.firstVehicle.isSkipped && data.firstVehicle.make.trim() && data.firstVehicle.model.trim()) {
        const restoredVehicleFiles = vehicleFiles.length ? vehicleFiles : data.firstVehicle.photos.filter(photo => photo.startsWith('data:')).map((photo, index) => dataUrlToFile(photo, `vehicle-${index + 1}`));
        const photos = await Promise.all(restoredVehicleFiles.map(file => supabaseService.uploadVehiclePhoto(dealer!.id, file)));
        await supabaseService.createVehicle({
          dealershipId: dealer.id,
          make: data.firstVehicle.make.trim(),
          model: data.firstVehicle.model.trim(),
          year: Number(data.firstVehicle.year) || new Date().getFullYear(),
          price: Number(data.firstVehicle.price) || 0,
          currency: data.firstVehicle.currency,
          mileageKm: Number(data.firstVehicle.mileageKm) || 0,
          transmission: data.firstVehicle.transmission,
          fuel: data.firstVehicle.fuel,
          condition: data.firstVehicle.condition,
          dutyStatus: 'Duty Paid & Registered',
          status: data.firstVehicle.status,
          description: data.firstVehicle.description,
          photos,
          features: [],
        }, dealer.id);
      }

      storageService.saveDealership(dealer);
      storageService.setUserSession({ isLoggedIn: true, email: user.email || data.account.email, dealershipId: dealer.id, userId: user.id });
      setData(previous => ({ ...previous, currentStep: 8, isCompleted: true, showroom: { ...previous.showroom, handle: dealer!.slug } }));
      storageService.saveOnboardingState({ ...data, currentStep: 8, isCompleted: true, showroom: { ...data.showroom, handle: dealer.slug } });
      setEmailPending(false);
      showToast('Your dealership is ready!');
    } catch (err: any) {
      setError(err?.message || 'We could not finish setting up your dealership. Please try again.');
      finalizing.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured() || storageService.isDemoModeActive() || step !== 7 || data.isCompleted) return;
    supabaseService.getSession().then(session => {
      if (session?.user) finishSetup();
    }).catch(() => {});
  }, [step]);

  const chooseImage = (file: File | undefined, kind: 'logo' | 'banner') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Each image must be smaller than 5 MB.'); return; }
    compressImage(file, kind === 'logo' ? 700 : 1500).then(preview => {
      if (kind === 'logo') { setLogoFile(file); patch('branding', { logoPreview: preview }); }
      else { setBannerFile(file); patch('branding', { coverPreview: preview }); }
      setError('');
    }).catch(() => setError('We could not process that image. Please choose another one.'));
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data.account.email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (data.account.password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (!isSupabaseConfigured()) { setError('Account creation is currently unavailable. Please try again later.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await supabaseService.signUp(data.account.email.trim(), data.account.password);
      if (result.session) await finishSetup();
      else { setEmailPending(true); setSubmitting(false); }
    } catch (err: any) {
      setError(err?.message || 'We could not create your account. Please try again.');
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured()) { setError('Account creation is currently unavailable.'); return; }
    setSubmitting(true);
    setError('');
    try { await supabaseService.signInWithGoogle(); }
    catch (err: any) { setError(err?.message || 'Google sign-up could not start.'); setSubmitting(false); }
  };

  const nextFromBusiness = () => {
    if (!data.showroom.businessName.trim()) { setError('Please enter your dealership name.'); return; }
    if (!data.contact.phoneNumber.trim()) { setError('Please enter a phone number customers can reach.'); return; }
    go(5);
  };

  const nextFromVehicle = () => {
    if (!data.firstVehicle.isSkipped && (!data.firstVehicle.make.trim() || !data.firstVehicle.model.trim())) {
      setError('Please enter the vehicle make and model, or choose to add a car later.');
      return;
    }
    go(6);
  };

  const back = () => go(Math.max(1, step - 1));
  const progress = step <= 7 ? step : 8;
  const isSuccess = data.isCompleted && step === 8;

  const bubble = (children: React.ReactNode, icon?: React.ReactNode) => (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center shrink-0">{icon || <MessageCircle className="w-4 h-4" />}</div>
      <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-slate-50 border border-slate-200 p-4 text-sm text-slate-800 leading-relaxed">{children}</div>
    </div>
  );

  const field = (label: string, value: string | number, onChange: (value: string) => void, placeholder: string, type = 'text') => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5" />
    </label>
  );

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-950 px-4 py-5 sm:px-6">
      <div className="max-w-xl mx-auto min-h-[calc(100vh-40px)] flex flex-col">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => step > 1 && !isSuccess ? back() : navigate('/')} className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center" aria-label="Go back"><ArrowLeft className="w-4 h-4" /></button>
            <div className="flex items-center gap-2 font-extrabold tracking-tight"><span className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center text-sm">D</span> DriveLink</div>
            <span className="text-xs text-slate-400 tabular-nums">{isSuccess ? 'Ready' : `${progress}/8`}</span>
          </div>
          {!isSuccess && <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-slate-950 rounded-full transition-all" style={{ width: `${(progress / 8) * 100}%` }} /></div>}
        </header>

        <section className="flex-1 flex flex-col justify-center gap-5 pb-8">
          {step === 1 && <>
            {bubble(<><p className="font-bold text-base mb-1">Welcome to DriveLink 👋</p><p>Let's get your dealership online so customers can discover your vehicles and contact you directly. I'll ask a few quick questions along the way.</p></>)}
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3"><Store className="w-5 h-5" /><p className="font-bold text-sm">A showroom that works for your business</p></div>
              <p className="text-xs text-slate-500 leading-relaxed">Create your dealership profile, add vehicles and get a link you can share with customers.</p>
            </div>
            <button onClick={() => go(2)} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm flex items-center justify-center gap-2">Let's get started <ArrowRight className="w-4 h-4" /></button>
          </>}

          {step === 2 && <>
            {bubble(<>To get started, what best describes the business you're setting up?</>)}
            <div className="grid gap-2">
              {sellerOptions.map(option => { const Icon = option.icon; const selected = data.sellerType === option.id; return <button key={option.id} onClick={() => { setData(p => ({ ...p, sellerType: option.id })); setError(''); }} className={`w-full p-4 rounded-2xl bg-white border text-left flex items-center gap-3 ${selected ? 'border-slate-950 ring-1 ring-slate-950' : 'border-slate-200'}`}><span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-5 h-5" /></span><span className="flex-1"><span className="block text-sm font-bold">{option.title}</span><span className="block text-xs text-slate-500 mt-0.5">{option.detail}</span></span>{selected && <CheckCircle2 className="w-5 h-5" />}</button>; })}
            </div>
            <button onClick={() => go(3)} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Continue <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}

          {step === 3 && <>
            {bubble(<>Thanks! Where is your dealership based? This helps nearby customers know where to find you.</>, <MapPin className="w-4 h-4" />)}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Country</span><select value={data.contact.country} onChange={e => patch('contact', { country: e.target.value, phoneCountryCode: e.target.value === 'South Africa' ? '+27' : '+263', whatsappCountryCode: e.target.value === 'South Africa' ? '+27' : '+263' })} className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-sm"><option>Zimbabwe</option><option>South Africa</option></select></label>
              {field('City or town', data.contact.city, v => patch('contact', { city: v }), 'e.g. Harare')}
              {field('Area / suburb', data.contact.address, v => patch('contact', { address: v }), 'e.g. Borrowdale (optional)')}
            </div>
            <button onClick={() => data.contact.city.trim() ? go(4) : setError('Please tell us which city or town your dealership is in.')} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Continue <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}

          {step === 4 && <>
            {bubble(<>Great. Now let's put a face to your business. What is your dealership called, and how can customers reach you?</>, <Building2 className="w-4 h-4" />)}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              {field('Dealership name', data.showroom.businessName, v => { patch('showroom', { businessName: v }); patch('account', { businessName: v }); }, 'e.g. Moyo Motors')}
              {field('Phone number', data.contact.phoneNumber, v => patch('contact', { phoneNumber: v }), 'Your business contact number', 'tel')}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={data.contact.whatsappSameAsPhone} onChange={e => patch('contact', { whatsappSameAsPhone: e.target.checked, whatsappNumber: e.target.checked ? data.contact.phoneNumber : data.contact.whatsappNumber })} /> WhatsApp uses the same number</label>
              {!data.contact.whatsappSameAsPhone && field('WhatsApp number', data.contact.whatsappNumber, v => patch('contact', { whatsappNumber: v }), 'WhatsApp number', 'tel')}
              {field('Short business description (optional)', data.contact.description, v => patch('contact', { description: v }), 'Tell customers a little about your dealership')}
              <div className="grid grid-cols-2 gap-3">
                <label className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col gap-2 cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={e => chooseImage(e.target.files?.[0], 'logo')} /><span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><ImagePlus className="w-4 h-4" /></span><span className="text-xs font-bold">Dealership logo</span><span className="text-[10px] text-slate-500">{logoFile?.name || 'Upload image'}</span>{data.branding.logoPreview && <img src={data.branding.logoPreview} className="w-16 h-16 object-contain rounded-lg" alt="Logo preview" />}</label>
                <label className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col gap-2 cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={e => chooseImage(e.target.files?.[0], 'banner')} /><span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><ImagePlus className="w-4 h-4" /></span><span className="text-xs font-bold">Showroom banner</span><span className="text-[10px] text-slate-500">{bannerFile?.name || 'Upload image'}</span>{data.branding.coverPreview && <img src={data.branding.coverPreview} className="w-full h-16 object-cover rounded-lg" alt="Banner preview" />}</label>
              </div>
            </div>
            <button onClick={nextFromBusiness} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Continue <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}

          {step === 5 && <>
            {bubble(<>Your dealership profile is coming together! Would you like to add your first car now, or would you rather do that later from your dashboard?</>, <CarFront className="w-4 h-4" />)}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { patch('firstVehicle', { isSkipped: false }); go(5); }} className="rounded-2xl border border-slate-950 bg-white p-4 text-left"><CarFront className="w-6 h-6 mb-3" /><span className="block font-bold text-sm">Add my first car</span><span className="text-xs text-slate-500">Add details and photos</span></button>
              <button onClick={() => { patch('firstVehicle', { isSkipped: true }); go(6); }} className="rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="block text-2xl mb-3">⏰</span><span className="block font-bold text-sm">I'll do it later</span><span className="text-xs text-slate-500">Add cars from your dashboard</span></button>
            </div>
            {!data.firstVehicle.isSkipped && <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="font-bold text-sm">Tell us about the car</p>
              <div className="grid grid-cols-2 gap-3">{field('Make', data.firstVehicle.make, v => patch('firstVehicle', { make: v }), 'e.g. Toyota')}{field('Model', data.firstVehicle.model, v => patch('firstVehicle', { model: v }), 'e.g. Aqua')}</div>
              <div className="grid grid-cols-2 gap-3">{field('Year', data.firstVehicle.year, v => patch('firstVehicle', { year: v ? Number(v) : '' }), '2020', 'number')}{field('Price', data.firstVehicle.price, v => patch('firstVehicle', { price: v ? Number(v) : '' }), '8500', 'number')}</div>
              <div className="grid grid-cols-2 gap-3">{field('Mileage (km)', data.firstVehicle.mileageKm, v => patch('firstVehicle', { mileageKm: v ? Number(v) : '' }), '65000', 'number')}<label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Currency</span><select value={data.firstVehicle.currency} onChange={e => patch('firstVehicle', { currency: e.target.value as CurrencyCode })} className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-sm"><option value="USD">USD</option><option value="ZAR">ZAR</option></select></label></div>
              <div className="grid grid-cols-2 gap-3"><label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Transmission</span><select value={data.firstVehicle.transmission} onChange={e => patch('firstVehicle', { transmission: e.target.value as any })} className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-sm"><option>Automatic</option><option>Manual</option></select></label><label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Fuel</span><select value={data.firstVehicle.fuel} onChange={e => patch('firstVehicle', { fuel: e.target.value as any })} className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-sm"><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option></select></label></div>
              <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Vehicle photos</span><input type="file" accept="image/*" multiple onChange={async e => { const files = Array.from(e.target.files || []).slice(0, 5); setVehicleFiles(files); try { const photos = await Promise.all(files.map(file => compressImage(file, 1200, 0.68))); patch('firstVehicle', { photos }); } catch { setError('One or more vehicle photos could not be processed.'); } }} className="w-full text-xs" /><span className="block text-[10px] text-slate-500 mt-1">{vehicleFiles.length} photo(s) selected</span></label>
            </div>}
            <button onClick={nextFromVehicle} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Continue <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}

          {step === 6 && <>
            {bubble(<>Your showroom will have its own shareable web address. We'll automatically create a link using your dealership name, so customers can open your page and see your available vehicles.</>, <Link2 className="w-4 h-4" />)}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 mb-2">Your showroom link will look like this</p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2"><Globe2 className="w-4 h-4 text-slate-500 shrink-0" /><p className="text-sm font-bold break-all">{showroomUrl}</p></div>
              <p className="text-xs text-slate-500 mt-3">You can share this link on WhatsApp, Facebook, Instagram or anywhere your customers find you. You can manage your showroom from your dashboard.</p>
            </div>
            <button onClick={() => go(7)} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Continue <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}

          {step === 7 && !emailPending && <>
            {bubble(<>Almost there! Create your DriveLink account to save your dealership profile and manage your showroom. You can continue with Google or use your email.</>, <UserRound className="w-4 h-4" />)}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              <button onClick={handleGoogle} disabled={submitting} className="w-full h-12 rounded-xl border border-slate-200 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"><span className="font-black">G</span> Continue with Google</button>
              <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="h-px bg-slate-200 flex-1" />OR WITH EMAIL<span className="h-px bg-slate-200 flex-1" /></div>
              <form onSubmit={handleSignup} className="space-y-3">
                {field('Email address', data.account.email, v => patch('account', { email: v }), 'you@example.com', 'email')}
                {field('Password', data.account.password, v => patch('account', { password: v }), 'At least 8 characters', 'password')}
                <button type="submit" disabled={submitting} className="w-full h-12 rounded-xl bg-slate-950 text-white font-bold text-sm disabled:opacity-60">{submitting ? 'Creating account…' : 'Create my account'}</button>
              </form>
              <p className="text-center text-xs text-slate-500">Already have an account? <button onClick={() => navigate('/login')} className="font-bold text-slate-950 underline">Log in</button></p>
            </div>
          </>}

          {step === 7 && emailPending && <>
            {bubble(<>We've sent a confirmation link to <strong>{data.account.email}</strong>. Open that email, confirm your address, then come back here and continue.</>)}
            <button onClick={async () => { const session = await supabaseService.getSession(); if (session?.user) finishSetup(); else setError('We have not received confirmation yet. Please open the email link first.'); }} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">I've confirmed my email</button>
            <button onClick={async () => { try { await supabaseService.resendConfirmationEmail(data.account.email); showToast('Confirmation email sent again.'); } catch (e: any) { setError(e?.message || 'Could not resend confirmation.'); } }} className="text-xs font-semibold text-slate-600">Resend confirmation email</button>
          </>}

          {step === 8 && isSuccess && <>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-9 h-9" /></div>
            <div className="text-center"><p className="text-xs uppercase tracking-widest font-bold text-emerald-700">Setup complete</p><h1 className="text-2xl font-extrabold mt-2">Your dealership is ready!</h1><p className="text-sm text-slate-500 mt-2">{data.showroom.businessName} is now set up on DriveLink.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500 mb-2">Your showroom link</p><p className="font-bold text-sm break-all">{window.location.origin}/showroom/{data.showroom.handle || showroomSlug}</p><button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/showroom/${data.showroom.handle || showroomSlug}`).then(() => showToast('Showroom link copied'))} className="mt-3 text-xs font-bold underline">Copy link</button></div>
            <button onClick={() => navigate('/app')} className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-sm">Go to dashboard <ArrowRight className="inline w-4 h-4 ml-1" /></button>
          </>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-xs">{error}</div>}
          {submitting && step !== 7 && <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Setting up your dealership…</div>}
        </section>
        <footer className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">Your details are saved as you go. You can finish setting up your inventory from your dashboard.</footer>
      </div>
    </main>
  );
};
