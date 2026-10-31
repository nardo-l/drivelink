import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Car, Truck, Bus, Crown, TrendingUp, Users, Star, Rocket, Upload, X, Eye, EyeOff, MapPin, Link2, Loader2, Share2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OnboardingState, SellerType, Dealership, Vehicle } from '../types';
import { toE164 } from '../utils/phoneUtils';

const TOTAL = 9;
const ORANGE = '#FF7417';
const initialState = (): OnboardingState => ({
  currentStep: 1,
  account: { businessName: '', email: '', password: '', handle: '' },
  sellerType: 'dealership',
  showroom: { businessName: '', handle: '', isPublished: true },
  contact: { country: 'Zimbabwe', city: 'Harare', address: '', whatsappCountryCode: '+263', whatsappNumber: '', whatsappSameAsPhone: true, phoneCountryCode: '+263', phoneNumber: '', description: '' },
  branding: { logoPreview: null, coverPreview: null },
  template: 'signature',
  firstVehicle: { make: '', model: '', year: new Date().getFullYear(), price: '', currency: 'USD', mileageKm: '', transmission: 'Automatic', fuel: 'Petrol', condition: 'Local Pre-owned', status: 'available', description: '', photos: [], isSkipped: true },
  isCompleted: false,
});

const inputClass = 'w-full h-12 rounded-2xl border border-[#E7E7E5] bg-white px-4 text-sm text-[#171717] outline-none transition focus:border-[#FF7417] focus:ring-2 focus:ring-orange-100';
const labelClass = 'mb-2 block text-xs font-semibold text-[#444]';

export const OnboardingFlow: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [data, setData] = useState<OnboardingState>(() => {
    const saved = storageService.getOnboardingState();
    return saved && saved.currentStep >= 1 && saved.currentStep <= TOTAL ? saved : initialState();
  });
  const [goals, setGoals] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [vehicleFiles, setVehicleFiles] = useState<File[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const step = data.currentStep || 1;
  const countryCode = data.contact.country === 'South Africa' ? '+27' : '+263';
  const update = (patch: Partial<OnboardingState>) => setData(prev => ({ ...prev, ...patch }));
  const updateContact = (patch: Partial<OnboardingState['contact']>) => setData(prev => ({ ...prev, contact: { ...prev.contact, ...patch } }));
  const updateShowroom = (patch: Partial<OnboardingState['showroom']>) => setData(prev => ({ ...prev, showroom: { ...prev.showroom, ...patch } }));
  const updateVehicle = (patch: Partial<OnboardingState['firstVehicle']>) => setData(prev => ({ ...prev, firstVehicle: { ...prev.firstVehicle, ...patch } }));

  useEffect(() => { storageService.saveOnboardingState(data); }, [data]);
  useEffect(() => {
    const slug = data.showroom.handle.trim();
    if (!slug || slug.length < 3) { setAvailable(null); setChecking(false); return; }
    let active = true;
    setChecking(true);
    const timer = window.setTimeout(() => {
      supabaseService.checkHandleAvailability(slug).then(v => { if (active) setAvailable(v); }).catch(() => { if (active) setAvailable(false); }).finally(() => { if (active) setChecking(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [data.showroom.handle]);

  const setStep = (next: number) => { update({ currentStep: Math.max(1, Math.min(TOTAL, next)) }); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const back = () => step === 1 ? navigate('/') : setStep(step - 1);
  const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.showroom.handle);

  const continueStep = () => {
    setError('');
    if (step === 2 && !data.sellerType) return setError('Choose the type of vehicles you sell.');
    if (step === 3 && !data.contact.city.trim()) return setError('Enter your city or town.');
    if (step === 4 && goals.length === 0) return setError('Choose at least one goal.');
    if (step === 5 && !data.showroom.businessName.trim()) return setError('Enter your business name.');
    if (step === 6 && (!validSlug || available !== true)) return setError('Choose a valid, available showroom link.');
    if (step === 7 && !data.firstVehicle.isSkipped && (!data.firstVehicle.make.trim() || !data.firstVehicle.model.trim())) return setError('Enter the vehicle make and model, or skip this step.');
    setStep(step + 1);
  };

  const uploadImage = (file: File, kind: 'logo' | 'vehicle') => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Each image must be smaller than 5MB.'); return; }
    if (kind === 'logo') { setLogoFile(file); update({ branding: { ...data.branding, logoPreview: URL.createObjectURL(file) } }); }
    else {
      const next = [...vehicleFiles, file].slice(0, 10);
      setVehicleFiles(next);
      updateVehicle({ photos: next.map(f => URL.createObjectURL(f)), isSkipped: false });
    }
    setError('');
  };

  const finish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data.account.businessName.trim() || !data.account.email.includes('@') || data.account.password.length < 6) {
      setError('Enter your full name, a valid email and a password of at least 6 characters.'); return;
    }
    if (!isSupabaseConfigured()) { setError('DriveLink account creation requires a configured Supabase connection.'); return; }
    setBusy(true); setError('');
    try {
      const auth = await supabaseService.signUp(data.account.email.trim(), data.account.password);
      if (!auth.session) {
        setError('Check your email to confirm your account, then return and sign in to finish creating your showroom.');
        setBusy(false); return;
      }
      const user = auth.user;
      if (!user) throw new Error('Account was created, but no user session was returned.');
      let dealer = await supabaseService.createDealership({
        name: data.showroom.businessName.trim(),
        slug: data.showroom.handle.trim(),
        country: data.contact.country,
        city: data.contact.city.trim(),
        address: data.contact.address.trim(),
        phone: toE164(countryCode, data.contact.whatsappNumber) || '',
        whatsapp: toE164(countryCode, data.contact.whatsappNumber) || '',
        email: user.email || data.account.email.trim(),
        currency: data.contact.country === 'South Africa' ? 'ZAR' : 'USD',
        template: data.template,
        dealershipType: data.sellerType,
        bio: data.contact.description || '',
        tagline: data.showroom.businessName.trim(),
        isPublished: true,
      });
      if (logoFile) {
        const logoUrl = await supabaseService.uploadDealershipAsset(dealer.id, logoFile, 'logo');
        dealer = await supabaseService.updateDealership(dealer.id, { logoUrl });
      }
      if (!data.firstVehicle.isSkipped && data.firstVehicle.make.trim() && data.firstVehicle.model.trim()) {
        const photos = await Promise.all(vehicleFiles.map(file => supabaseService.uploadVehiclePhoto(dealer.id, file)));
        await supabaseService.createVehicle({
          dealershipId: dealer.id, make: data.firstVehicle.make.trim(), model: data.firstVehicle.model.trim(),
          year: Number(data.firstVehicle.year) || new Date().getFullYear(), price: Number(data.firstVehicle.price) || 0,
          currency: data.firstVehicle.currency, mileageKm: Number(data.firstVehicle.mileageKm) || 0,
          transmission: data.firstVehicle.transmission, fuel: data.firstVehicle.fuel, condition: data.firstVehicle.condition,
          dutyStatus: 'Duty status not specified', status: 'available', description: data.firstVehicle.description || '',
          photos, features: [],
        }, dealer.id);
      }
      storageService.saveDealership(dealer);
      storageService.setUserSession({ isLoggedIn: true, email: user.email || data.account.email, dealershipId: dealer.id, userId: user.id });
      update({ currentStep: 9, isCompleted: true });
      showToast('Your DriveLink dealership is ready!');
    } catch (e: any) {
      setError(e?.message || 'We could not finish setting up your dealership. Please try again.');
    } finally { setBusy(false); }
  };

  const finishExistingSession = async () => {
    setBusy(true); setError('');
    try {
      const user = await supabaseService.getCurrentUser();
      if (!user) throw new Error('Please sign in to finish your setup.');
      let dealer = await supabaseService.createDealership({
        name: data.showroom.businessName.trim(), slug: data.showroom.handle.trim(),
        country: data.contact.country, city: data.contact.city.trim(), address: data.contact.address.trim(),
        phone: toE164(countryCode, data.contact.whatsappNumber) || '', whatsapp: toE164(countryCode, data.contact.whatsappNumber) || '',
        email: user.email || '', currency: data.contact.country === 'South Africa' ? 'ZAR' : 'USD',
        template: 'signature', dealershipType: data.sellerType, bio: data.contact.description || '',
        tagline: data.showroom.businessName.trim(), isPublished: true,
      });
      if (logoFile) {
        const logoUrl = await supabaseService.uploadDealershipAsset(dealer.id, logoFile, 'logo');
        dealer = await supabaseService.updateDealership(dealer.id, { logoUrl });
      }
      if (!data.firstVehicle.isSkipped && data.firstVehicle.make && data.firstVehicle.model) {
        const photos = await Promise.all(vehicleFiles.map(file => supabaseService.uploadVehiclePhoto(dealer.id, file)));
        await supabaseService.createVehicle({
          dealershipId: dealer.id, make: data.firstVehicle.make, model: data.firstVehicle.model,
          year: Number(data.firstVehicle.year) || new Date().getFullYear(), price: Number(data.firstVehicle.price) || 0,
          currency: data.firstVehicle.currency, mileageKm: Number(data.firstVehicle.mileageKm) || 0,
          transmission: data.firstVehicle.transmission, fuel: data.firstVehicle.fuel, condition: data.firstVehicle.condition,
          dutyStatus: 'Duty status not specified', status: 'available', description: data.firstVehicle.description || '', photos, features: [],
        }, dealer.id);
      }
      storageService.saveDealership(dealer);
      storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: dealer.id, userId: user.id });
      update({ currentStep: 9, isCompleted: true });
    } catch (e: any) { setError(e?.message || 'Could not finish setup.'); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const url = `${window.location.origin}/showroom/${data.showroom.handle}`;
    if (navigator.share) { try { await navigator.share({ title: data.showroom.businessName, url }); } catch {} }
    else { await navigator.clipboard.writeText(url); showToast('Showroom link copied'); }
  };

  const card = (selected: boolean) => `rounded-2xl border p-4 text-left transition-all ${selected ? 'border-[#FF7417] bg-orange-50/50 ring-1 ring-[#FF7417]' : 'border-[#E7E7E5] bg-white hover:border-gray-300'}`;
  const primary = 'h-12 w-full rounded-full bg-[#FF7417] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#ed650b] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2';
  const footer = <div className="mt-auto pt-6">{error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}{step < 8 ? <button type="button" className={primary} onClick={continueStep}>Continue <ArrowRight size={17}/></button> : null}</div>;

  return <div className="min-h-screen bg-[#F5F5F3] px-4 py-5 text-[#171717] sm:py-8">
    <div className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[460px] flex-col rounded-[30px] bg-white px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,.09)] sm:min-h-[780px] sm:px-8">
      {step !== 1 && step !== 9 && <header className="mb-6 flex items-center justify-between">
        <button onClick={back} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"><ArrowLeft size={20}/></button>
        <span className="text-xs font-semibold tabular-nums text-gray-500">{step}/9</span>
      </header>}
      {step === 1 && <div className="mb-6 flex justify-end text-xs text-gray-500">1/9</div>}
      {step !== 9 && <div className="mb-7 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#FF7417] transition-all" style={{width:`${step/9*100}%`}}/></div>}

      {step === 1 && <section className="flex flex-1 flex-col">
        <div className="mb-8 mt-5 flex items-center justify-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF7417] text-white"><Link2 size={24}/></span><span className="text-3xl font-black tracking-tight">DriveLink</span></div>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight">Get your dealership online.</h1>
        <p className="mt-4 max-w-xs text-sm leading-6 text-gray-600">Showcase your cars, get more leads and grow your business.</p>
        <div className="relative my-auto flex min-h-[260px] items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-50 via-white to-gray-100">
          <div className="absolute -right-16 top-5 h-48 w-48 rounded-full bg-orange-100"/><img src="/cars/rav4-silver.png" onError={e => { e.currentTarget.style.display='none'; }} alt="Featured vehicle" className="relative z-10 max-h-[260px] w-full object-contain drop-shadow-xl"/>
          <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-gray-600">Your showroom. Your brand.</div>
        </div>
        <button className={primary + ' mt-7'} onClick={() => setStep(2)}>Get Started <ArrowRight size={17}/></button>
        <p className="mt-4 text-center text-xs text-gray-500">Already have an account? <button onClick={() => navigate('/login')} className="font-bold underline">Sign in</button></p>
      </section>}

      {step === 2 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">What kind of vehicles do you sell?</h1><p className="mt-2 text-sm text-gray-500">Select the category that best describes your business.</p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          {[{id:'dealership',title:'Cars',Icon:Car},{id:'importer',title:'Trucks & SUVs',Icon:Truck},{id:'independent',title:'Commercial Vehicles',Icon:Bus},{id:'broker',title:'Luxury Cars',Icon:Crown}].map(({id,title,Icon})=><button key={id} onClick={()=>update({sellerType:id as SellerType})} className={card(data.sellerType===id)+' min-h-[150px] flex flex-col items-center justify-center gap-4'}><Icon size={42} strokeWidth={1.5}/><span className="text-sm font-semibold">{title}</span>{data.sellerType===id&&<span className="absolute sr-only">Selected</span>}</button>)}
        </div>{footer}
      </section>}

      {step === 3 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">Where are you located?</h1><p className="mt-2 text-sm text-gray-500">Select your country, city and area.</p>
        <div className="mt-8 space-y-5">
          <label className="block"><span className={labelClass}>Country</span><select className={inputClass} value={data.contact.country} onChange={e=>{const c=e.target.value as 'Zimbabwe'|'South Africa';updateContact({country:c,phoneCountryCode:c==='Zimbabwe'?'+263':'+27',whatsappCountryCode:c==='Zimbabwe'?'+263':'+27'});}}><option>Zimbabwe</option><option>South Africa</option></select></label>
          <label className="block"><span className={labelClass}>City / Town</span><input className={inputClass} value={data.contact.city} onChange={e=>updateContact({city:e.target.value})} placeholder="e.g. Harare"/></label>
          <label className="block"><span className={labelClass}>Area (optional)</span><input className={inputClass} value={data.contact.address} onChange={e=>updateContact({address:e.target.value})} placeholder="e.g. Avondale"/></label>
        </div>{footer}
      </section>}

      {step === 4 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">What would you like to achieve?</h1><p className="mt-2 text-sm text-gray-500">Choose your main goal.</p>
        <div className="mt-7 space-y-3">
          {[{id:'sell',title:'Sell more cars',Icon:TrendingUp},{id:'leads',title:'Get more enquiries',Icon:Users},{id:'brand',title:'Build my brand',Icon:Star},{id:'grow',title:'Grow my business',Icon:Rocket}].map(({id,title,Icon})=><button key={id} onClick={()=>setGoals(g=>g.includes(id)?g.filter(v=>v!==id):[...g,id])} className={card(goals.includes(id))+' flex w-full items-center gap-4'}><Icon size={22}/><span className="flex-1 text-left text-sm font-semibold">{title}</span>{goals.includes(id)&&<Check size={19} color={ORANGE}/>}</button>)}
        </div>{footer}
      </section>}

      {step === 5 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">Tell us about your business.</h1><p className="mt-2 text-sm text-gray-500">Add your logo and social links (optional).</p>
        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-7">{data.branding.logoPreview?<img src={data.branding.logoPreview} className="h-16 w-16 rounded-xl object-cover" alt="Logo preview"/>:<Upload size={28} className="text-gray-500"/>}<span className="mt-2 text-sm font-bold">Upload Logo</span><span className="text-xs text-gray-500">PNG, JPG (max 5MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&uploadImage(e.target.files[0],'logo')}/></label>
          <label><span className={labelClass}>WhatsApp Number</span><input className={inputClass} value={data.contact.whatsappNumber} onChange={e=>updateContact({whatsappNumber:e.target.value})} placeholder={countryCode+' 77 123 4567'} /></label>
          <label><span className={labelClass}>Instagram link (optional)</span><input className={inputClass} value={data.contact.description} onChange={e=>updateContact({description:e.target.value})} placeholder="https://instagram.com/yourbusiness"/></label>
        </div>{footer}
      </section>}

      {step === 6 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">Choose your showroom link.</h1><p className="mt-2 text-sm text-gray-500">This will be your public dealership URL.</p>
        <label className="mt-9 block"><span className={labelClass}>Your showroom URL</span><div className="flex items-center rounded-2xl border border-gray-200 px-3"><span className="whitespace-nowrap text-xs text-gray-500">drivelink.co.zw/</span><input className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" value={data.showroom.handle} onChange={e=>updateShowroom({handle:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/--+/g,'-')})} placeholder="yourname"/></div></label>
        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-xs">{checking?<span className="flex items-center gap-2 text-gray-500"><Loader2 size={14} className="animate-spin"/> Checking availability…</span>:available===true?<span className="font-semibold text-green-700">✓ This link is available</span>:available===false?<span className="text-red-600">This link is unavailable. Try another.</span>:<span className="text-gray-500">Use 3+ letters, numbers or hyphens.</span>}</div>{footer}
      </section>}

      {step === 7 && <section className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">Add your first car.</h1><p className="mt-2 text-sm text-gray-500">Upload a vehicle or skip this step and add later.</p>
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-8"><Car size={30} className="text-gray-500"/><span className="mt-3 text-sm font-bold">Upload Photos</span><span className="mt-1 text-xs text-gray-500">PNG, JPG, WebP (max 5MB each)</span><input type="file" accept="image/*" multiple className="hidden" onChange={e=>Array.from(e.target.files||[]).forEach(f=>uploadImage(f,'vehicle'))}/></label>
        {vehicleFiles.length>0&&<div className="mt-3 flex gap-2 overflow-x-auto">{vehicleFiles.map((f,i)=><div key={i} className="relative"><img src={URL.createObjectURL(f)} className="h-16 w-20 rounded-lg object-cover" alt="Vehicle"/><button onClick={()=>{const files=vehicleFiles.filter((_,n)=>n!==i);setVehicleFiles(files);updateVehicle({photos:files.map(v=>URL.createObjectURL(v))});}} className="absolute -right-1 -top-1 rounded-full bg-black p-1 text-white"><X size={12}/></button></div>)}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label><span className={labelClass}>Make</span><input className={inputClass} value={data.firstVehicle.make} onChange={e=>updateVehicle({make:e.target.value,isSkipped:false})} placeholder="Toyota"/></label>
          <label><span className={labelClass}>Model</span><input className={inputClass} value={data.firstVehicle.model} onChange={e=>updateVehicle({model:e.target.value,isSkipped:false})} placeholder="Fortuner"/></label>
          <label><span className={labelClass}>Year</span><input type="number" className={inputClass} value={data.firstVehicle.year} onChange={e=>updateVehicle({year:Number(e.target.value),isSkipped:false})}/></label>
          <label><span className={labelClass}>Price</span><input type="number" className={inputClass} value={data.firstVehicle.price} onChange={e=>updateVehicle({price:Number(e.target.value),isSkipped:false})} placeholder="45000"/></label>
          <label><span className={labelClass}>Currency</span><select className={inputClass} value={data.firstVehicle.currency} onChange={e=>updateVehicle({currency:e.target.value as 'USD'|'ZAR'})}><option>USD</option><option>ZAR</option></select></label>
          <label><span className={labelClass}>Mileage (km)</span><input type="number" className={inputClass} value={data.firstVehicle.mileageKm} onChange={e=>updateVehicle({mileageKm:Number(e.target.value),isSkipped:false})}/></label>
        </div>
        <button className="mt-4 text-center text-xs font-semibold underline text-gray-600" onClick={()=>{updateVehicle({isSkipped:true});setVehicleFiles([]);}}>Skip for now</button>{footer}
      </section>}

      {step === 8 && <form onSubmit={finish} className="flex flex-1 flex-col">
        <h1 className="text-2xl font-extrabold leading-tight">Create your account.</h1><p className="mt-2 text-sm text-gray-500">Save your progress and manage your dealership.</p>
        <div className="mt-7 space-y-4">
          <label><span className={labelClass}>Full Name</span><input className={inputClass} value={data.account.businessName} onChange={e=>update({account:{...data.account,businessName:e.target.value}})} placeholder="Your full name" required/></label>
          <label><span className={labelClass}>Email Address</span><input type="email" className={inputClass} value={data.account.email} onChange={e=>update({account:{...data.account,email:e.target.value}})} placeholder="you@example.com" required/></label>
          <label><span className={labelClass}>Create Password</span><div className="relative"><input type={showPassword?'text':'password'} className={inputClass+' pr-12'} value={data.account.password} onChange={e=>update({account:{...data.account,password:e.target.value}})} placeholder="At least 6 characters" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-3 text-gray-500">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        </div>
        <button disabled={busy} className={primary+' mt-auto'}>{busy?<><Loader2 className="animate-spin" size={17}/> Creating your dealership…</>:<>Create Account <ArrowRight size={17}/></>}</button>
        <p className="mt-4 text-center text-xs text-gray-500">Already have an account? <button type="button" onClick={()=>navigate('/login')} className="font-bold underline">Sign in</button></p>
        {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      </form>}

      {step === 9 && <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FF7417] text-white shadow-lg shadow-orange-200"><Check size={42}/></div>
        <h1 className="text-3xl font-extrabold">You're all set!</h1><p className="mt-3 max-w-xs text-sm leading-6 text-gray-500">Your dealership is ready. Start managing your inventory and share your link.</p>
        {data.branding.logoPreview&&<img src={data.branding.logoPreview} alt="Dealership logo" className="mt-6 h-16 w-16 rounded-2xl object-cover"/>}
        <div className="mt-8 w-full space-y-3"><button className={primary} onClick={()=>navigate('/app')}>View my showroom <ArrowRight size={17}/></button><button className="h-12 w-full rounded-full border border-gray-200 text-sm font-bold" onClick={()=>navigate('/app/vehicles/new')}>Add another car</button><button className="flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold" onClick={share}><Share2 size={17}/> Share my link</button></div>
      </section>}
    </div>
  </div>;
};
