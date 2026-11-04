import React, { useEffect, useRef, useState } from 'react';
import './ConversationalOnboardingFlow.css';
import { ArrowLeft, ArrowRight, Check, Copy, Car, Truck, Bus, Crown, Eye, EyeOff, Link2, Loader2, MessageCircle, CreditCard, BarChart3, Users, Lock } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { OnboardingState, SellerType } from '../types';
import { toE164 } from '../utils/phoneUtils';
import { MARKETING_CAR_IMAGES } from '../utils/marketingCarImages';
import { notificationService } from '../services/notificationService';
import { Bell, MessageSquare, Eye as EyeIcon, CreditCard as CreditCardIcon } from 'lucide-react';

const TOTAL = 8;
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


export const OnboardingFlow: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [data, setData] = useState<OnboardingState>(() => {
    try {
      const raw = localStorage.getItem('drivelink_onboarding_v1');
      if (!raw) return initialState();
      const saved = JSON.parse(raw);
      if (saved.flowVersion === 2 && saved.currentStep >= 1 && saved.currentStep <= TOTAL) {
        return { ...initialState(), ...saved, account: { ...initialState().account, ...saved.account, password: '' } };
      }
      // Legacy drafts must re-authenticate first; a live session is advanced to setup below.
      return { ...initialState(), ...saved, currentStep: 1, account: { ...initialState().account, ...saved.account, password: '' } };
    } catch { return initialState(); }
  });
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [introDone, setIntroDone] = useState(() => {
    try { return localStorage.getItem('drivelink_intro_completed_v1') === 'true'; } catch { return false; }
  });
  const [introStep, setIntroStep] = useState(0);
  const introSlides = [
    { title: 'Your dealership, online.', body: 'Turn your cars into customers with a single powerful link.' },
    { title: 'Turn your stock into a showroom.', body: 'Showcase your vehicles beautifully and keep your listings up to date.' },
    { title: 'Get more WhatsApp enquiries.', body: 'Let buyers reach you instantly with one tap.' },
    { title: 'Everything buyers need, in one link.', body: 'Photos, specs, price, location and WhatsApp — all in one place.' },
    { title: 'Keep your showroom looking sharp.', body: 'Customise your link, match your brand and track your results.' },
    { title: 'Launch your showroom in minutes.', body: 'Join dealers in Zimbabwe and South Africa building smarter with Drive Link.' },
  ];
  const finishIntro = () => {
    try { localStorage.setItem('drivelink_intro_completed_v1', 'true'); } catch {}
    setIntroDone(true);
    update({ currentStep: 1 });
  };
  const advanceIntro = () => introStep === introSlides.length - 1 ? finishIntro() : setIntroStep(value => Math.min(value + 1, introSlides.length - 1));
  useEffect(() => {
    let active = true;
    supabaseService.getCurrentUser().then(async user => {
      if (!active || !user) return;
      const dealer = await supabaseService.getCurrentDealership();
      if (!active) return;
      if (dealer) {
        storageService.saveDealership(dealer);
        storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: dealer.id, userId: user.id });
        navigate('/app');
      } else {
        try { localStorage.setItem('drivelink_intro_completed_v1', 'true'); } catch {}
        setIntroDone(true);
        setData(prev => ({ ...prev, currentStep: prev.currentStep <= 1 ? 2 : prev.currentStep }));
        storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: '', userId: user.id });
      }
    }).catch(error => console.warn('Could not restore onboarding session:', error));
    return () => { active = false; };
  }, []);
  const introTouchStart = useRef<number | null>(null);
  const handleIntroTouchStart = (event: React.TouchEvent<HTMLElement>) => { introTouchStart.current = event.changedTouches[0]?.clientX ?? null; };
  const handleIntroTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (introTouchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - introTouchStart.current;
    introTouchStart.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) advanceIntro();
    else setIntroStep(value => Math.max(0, value - 1));
  };


  const step = data.currentStep || 1;
  const countryCode = data.contact.country === 'South Africa' ? '+27' : '+263';
  const update = (patch: Partial<OnboardingState>) => setData(prev => ({ ...prev, ...patch }));
  const updateContact = (patch: Partial<OnboardingState['contact']>) => setData(prev => ({ ...prev, contact: { ...prev.contact, ...patch } }));
  const updateShowroom = (patch: Partial<OnboardingState['showroom']>) => setData(prev => ({ ...prev, showroom: { ...prev.showroom, ...patch } }));

  useEffect(() => {
    if (data.isCompleted) { storageService.clearOnboardingState(); return; }
    storageService.saveOnboardingState({ ...data, currentStep: step, isCompleted: false } as OnboardingState);
    try {
      const draft = JSON.parse(localStorage.getItem('drivelink_onboarding_v1') || '{}');
      localStorage.setItem('drivelink_onboarding_v1', JSON.stringify({ ...draft, flowVersion: 2 }));
    } catch {}
  }, [data]);
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
  const back = () => { if (step === 1) { try { localStorage.removeItem('drivelink_intro_completed_v1'); } catch {} setIntroDone(false); setIntroStep(5); } else setStep(step - 1); };
  const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.showroom.handle);
  const validWhatsapp = data.contact.whatsappNumber.replace(/[^0-9]/g, '').length >= 7;
  const continueStep = () => {
    setError('');
    if (step === 2 && !data.sellerType) return setError('Choose the type of vehicles you sell.');
    if (step === 3 && (!data.contact.city.trim() || !data.contact.country)) return setError('Enter your country and city.');
    if (step === 4 && (!data.showroom.businessName.trim() || !validWhatsapp)) return setError('Enter your dealership name and a valid WhatsApp number.');
    if (step === 5 && (!validSlug || available !== true)) return setError('Choose a valid, available showroom link.');
    setStep(step + 1);
  };


  const finish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data.account.email.includes('@') || data.account.password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.'); return;
    }
    if (!isSupabaseConfigured()) { setError('Account creation requires a configured connection.'); return; }
    setBusy(true); setError('');
    try {
      const existingUser = await supabaseService.getCurrentUser();
      if (!existingUser) {
        const auth = await supabaseService.signUp(data.account.email.trim(), data.account.password);
        if (!auth.session || !auth.user) {
          setError('Check your email to confirm your account, then sign in to continue setting up your dealership.');
          return;
        }
      }
      const user = await supabaseService.getCurrentUser();
      if (!user) throw new Error('Your account was created. Please sign in to continue setup.');
      storageService.setUserSession({ isLoggedIn: true, email: user.email || data.account.email, dealershipId: '', userId: user.id });
      setStep(2);
    } catch (e: any) {
      setError(e?.message || 'We could not create your account. Please try again.');
    } finally { setBusy(false); }
  };

  const finishExistingSession = async () => {
    setBusy(true); setError('');
    try {
      const user = await supabaseService.getCurrentUser();
      if (!user) throw new Error('Please sign in to finish your setup.');
      const existing = await supabaseService.getCurrentDealership();
      if (existing) {
        storageService.saveDealership(existing);
        storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: existing.id, userId: user.id });
        navigate('/app');
        return;
      }
      const dealer = await supabaseService.createDealership({
        name: data.showroom.businessName.trim(),
        slug: data.showroom.handle.trim(),
        country: data.contact.country,
        city: data.contact.city.trim(),
        address: data.contact.address.trim(),
        phone: toE164(countryCode, data.contact.whatsappNumber) || '',
        whatsapp: toE164(countryCode, data.contact.whatsappNumber) || '',
        email: user.email || data.account.email.trim(),
        currency: data.contact.country === 'South Africa' ? 'ZAR' : 'USD',
        template: 'signature',
        dealershipType: data.sellerType,
        bio: '',
        tagline: data.showroom.businessName.trim(),
        isPublished: true,
      });
      storageService.saveDealership(dealer);
      storageService.setUserSession({ isLoggedIn: true, email: user.email || data.account.email, dealershipId: dealer.id, userId: user.id });
      update({ currentStep: 7 });
      showToast('Your 3-day DriveLink Pro trial is active!');
    } catch (e: any) {
      const message = String(e?.message || '');
      if (String(e?.code || '') === '23505' || message.toLowerCase().includes('duplicate key')) {
        setError('That showroom link is already in use. Go back and choose another.');
      } else {
        setError(message || 'We could not save your dealership. Please try again.');
      }
    } finally { setBusy(false); }
  };



  const renderIntroVisual = () => {
    if (introStep === 0) return <div className="di-hero-visual"><img src={MARKETING_CAR_IMAGES.hero} alt="Premium vehicle in a dealership setting" /><div className="di-brand-mark"><span className="di-brand-symbol" aria-hidden="true"><svg viewBox="0 0 40 40" role="img"><path fill="currentColor" fillRule="evenodd" d="M5 4h15c10 0 16 6 16 16S30 36 20 36H5V4zm9 8v16h6c5 0 8-3 8-8s-3-8-8-8h-6z"/></svg></span><span>DRIVE LINK</span><small>CARS. CONNECTIONS. SALES.</small></div></div>;
    if (introStep === 1) return <div className="di-stack-visual">
      {[{name:'Toyota Fortuner',meta:'2022 | 2.8 GD-6 | SUV',price:'US$48,900',img:MARKETING_CAR_IMAGES.hero},{name:'VW Polo',meta:'2023 | 1.0 TSI | Hatchback',price:'US$21,500',img:MARKETING_CAR_IMAGES.hondaFit},{name:'BMW 320i',meta:'2021 | 2.0 | Sedan',price:'US$32,900',img:MARKETING_CAR_IMAGES.showroom}].map((v,i)=><div className={'di-listing di-listing-'+i} key={v.name}><img src={v.img} alt="" /><span><b>{v.name}</b><small>{v.meta}</small><strong>{v.price}</strong></span><ArrowRight size={16}/></div>)}
    </div>;
    if (introStep === 2) return <div className="di-phone-visual"><div className="di-phone-screen"><img src={MARKETING_CAR_IMAGES.showroom} alt="Vehicle detail preview" /><b>Toyota Hilux</b><small>2023 | 2.8 GD-6 | 4x4</small><strong>US$45,000</strong><div className="di-phone-actions"><span>View details</span><span><MessageCircle size={14}/> Chat on WhatsApp</span></div></div><div className="di-notification"><MessageCircle size={24}/><span><b>New enquiry <small>now</small></b><em>Hi, I'm interested in the Hilux. Is it still available?</em></span></div></div>;
    if (introStep === 3) return <div className="di-detail-visual"><img src={MARKETING_CAR_IMAGES.showroom} alt="Vehicle preview" /><div className="di-detail-card"><b>Mercedes-Benz GLC</b><small>2022 | 2.0 | SUV</small><strong>US$42,900</strong><div className="di-spec-grid"><span>◉ Mileage<br/><b>42 000 km</b></span><span>⌖ Location<br/><b>Harare, ZW</b></span><span>▧ Photos<br/><b>12 photos</b></span><span>▤ Key details<br/><b>Petrol | Auto</b></span></div><div className="di-whatsapp"><MessageCircle size={17}/> Enquire on WhatsApp <ArrowRight size={15}/></div></div></div>;
    if (introStep === 4) return <div className="di-showroom-visual"><div className="di-showroom-screen"><div className="di-mini-brand">D　DRIVE LINK <span>☰</span></div><div className="di-showroom-hero" style={{ backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.76),rgba(0,0,0,.04)),url("${MARKETING_CAR_IMAGES.hero}")` }}><b>Quality cars.<br/>Driven by trust.</b><small>New & pre-owned vehicles across Zimbabwe & South Africa.</small></div><div className="di-car-thumbs">{[MARKETING_CAR_IMAGES.hero,MARKETING_CAR_IMAGES.showroom,MARKETING_CAR_IMAGES.hondaFit].map((img,i)=><img key={i} src={img} alt="Vehicle thumbnail"/>)}</div><div className="di-categories"><span>All</span><span>SUV</span><span>Sedan</span><span>Bakkie</span><span>Hatchback</span></div></div><div className="di-analytics"><small>This month　⌄</small><div><span><b>1,248</b>Visits</span><span><b>320</b>Enquiries</span><span><b>27</b>Leads</span></div></div></div>;
    return <div className="di-share-visual"><div className="di-public-card"><div className="di-public-logo">D</div><b>Elite Motors Harare</b><small>Quality Vehicles. Trusted Deals.</small><span><Car size={15}/> View Our Vehicles <ArrowRight size={14}/></span><span><MessageCircle size={15}/> WhatsApp Us <ArrowRight size={14}/></span><span>▣ Visit Our Store <ArrowRight size={14}/></span></div><div className="di-share-link"><Link2 size={17}/><span>drivelink.co/elite-motors</span><Copy size={17}/></div></div>;
  };

  if (!introDone) return <main className="di-onboarding">
    <section className="di-onboarding-phone" aria-label={'Drive Link introduction, screen ' + (introStep + 1) + ' of 6'} onTouchStart={handleIntroTouchStart} onTouchEnd={handleIntroTouchEnd}>
      <button className="di-skip" onClick={finishIntro}>Skip <ArrowRight size={14}/></button>
      <div className="di-slide" key={introStep}>
        <div className="di-visual-wrap">{renderIntroVisual()}</div>
        <div className="di-copy"><h1>{introSlides[introStep].title}</h1><p>{introSlides[introStep].body}</p></div>
      </div>
      <div className="di-bottom">
        <div className="di-dots" aria-label={'Step ' + (introStep + 1) + ' of 6'}>{introSlides.map((slide,i)=><button key={slide.title} aria-label={'Go to introduction screen ' + (i + 1)} aria-current={i===introStep?'step':undefined} onClick={()=>setIntroStep(i)} className={i===introStep?'active':''}/>)}</div>
        <button className="di-continue" onClick={advanceIntro}>{introStep===5?'Get started':'Continue'} <ArrowRight size={17}/></button>
        {(introStep === 0 || introStep === 5) && <p className="di-signin">Already have an account? <button onClick={()=>navigate("/login")}>Sign in</button></p>}
        {introStep>0&&<button className="di-back" onClick={()=>setIntroStep(value=>Math.max(0,value-1))}><ArrowLeft size={15}/> Back</button>}
      </div>
    </section>
  </main>;

  const share = async () => {
    const url = `${window.location.origin}/showroom/${data.showroom.handle}`;
    const message = encodeURIComponent(`View our vehicles at ${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  };
  const continueWithoutNotifications = async () => {
    try { await notificationService.dismissOnboardingPrompt(storageService.getUserSession().dealershipId); }
    catch (e) { console.warn('Could not save notification prompt dismissal:', e); }
    setStep(8);
  };
  const enableOnboardingNotifications = async () => {
    setBusy(true); setError('');
    try { await notificationService.enablePush(storageService.getUserSession().dealershipId, true); setStep(8); }
    catch (e: any) { setError(e?.message || 'Could not enable notifications. You can try again in Settings.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (step !== 7 || !notificationService.isPushSupported()) return;
    if (Notification.permission === 'granted') {
      void notificationService.enablePush(storageService.getUserSession().dealershipId, false).then(() => setStep(8)).catch(err => console.warn('Existing notification permission could not be registered:', err));
    } else if (Notification.permission === 'denied') {
      void continueWithoutNotifications();
    }
  }, [step]);

  const copyShowroomLink = async () => {
    const url = `${window.location.origin}/showroom/${data.showroom.handle}`;
    try { await navigator.clipboard.writeText(url); showToast('Showroom link copied'); }
    catch { setError('Could not copy the link. Please copy it from the address shown.'); }
  };

  return <main className="min-h-[100dvh] bg-white px-4 py-5 text-[#0A0A0A] sm:py-8">
    <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col rounded-[28px] bg-white px-1 py-3 sm:min-h-[780px] sm:px-5">
      <header className="mb-7 flex items-center justify-between">
        <button type="button" onClick={back} aria-label="Go back" className="flex h-10 items-center gap-2 rounded-full px-2 text-sm font-medium text-gray-600 hover:bg-gray-50" disabled={step===6||step===7}>
          {step!==6 && step!==7 && <><ArrowLeft size={17}/> Back</>}
        </button>
        <span className="text-xs font-medium text-gray-500">{step===6?'DriveLink Pro':step===7?'Notifications':step===8?'Ready':`Setup ${step} of 5`}</span>
      </header>
      {step <= 5 && <div className="mb-8 flex items-center justify-center gap-2" aria-label={`Setup step ${step} of 5`}>
        {Array.from({length:5},(_,i)=><span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i+1===step?'w-7 bg-[#0A0A0A]':i+1<step?'w-2 bg-[#0A0A0A]':'w-2 bg-gray-200'}`} />)}
      </div>}

      {step === 1 && <form onSubmit={finish} className="di-setup-screen flex flex-1 flex-col">
        <div className="mb-9 text-center"><div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white"><Link2 size={24}/></div><h1 className="text-[30px] font-bold leading-tight tracking-tight">Create your account.</h1><p className="mt-2 text-sm leading-6 text-gray-500">Set up your Drive Link account to build your dealership showroom.</p></div>
        <div className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Email address</span><input type="email" autoComplete="email" required className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-black focus:ring-2 focus:ring-gray-100" value={data.account.email} onChange={e=>update({account:{...data.account,email:e.target.value}})} placeholder="you@example.com"/></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Password</span><div className="relative"><input type={showPassword?'text':'password'} autoComplete="new-password" minLength={6} required className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 pr-12 text-sm outline-none focus:border-black focus:ring-2 focus:ring-gray-100" value={data.account.password} onChange={e=>update({account:{...data.account,password:e.target.value}})} placeholder="At least 6 characters"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-4 top-3.5 text-gray-500">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        </div>
        {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy||!data.account.email.includes('@')||data.account.password.length<6} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">{busy?<><Loader2 size={17} className="animate-spin"/> Creating account…</>:<>Continue <ArrowRight size={17}/></>}</button>
        <p className="mt-5 text-center text-sm text-gray-500">Already have an account? <button type="button" onClick={()=>navigate('/login')} className="font-semibold text-black underline underline-offset-4">Sign in</button></p>
      </form>}

      {step === 2 && <section className="flex flex-1 flex-col">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">What kind of vehicles do you sell?</h1><p className="mt-2 text-sm leading-6 text-gray-500">Choose the option that best describes your business.</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[{id:'dealership',title:'Cars',Icon:Car},{id:'importer',title:'Trucks & SUVs',Icon:Truck},{id:'independent',title:'Commercial vehicles',Icon:Bus},{id:'broker',title:'Luxury cars',Icon:Crown}].map(({id,title,Icon})=><button type="button" key={id} onClick={()=>update({sellerType:id as SellerType})} aria-pressed={data.sellerType===id} className={`flex min-h-[132px] flex-col items-center justify-center gap-4 rounded-[20px] border p-4 text-sm font-semibold transition ${data.sellerType===id?'border-black bg-gray-50 ring-1 ring-black':'border-[#E5E7EB] bg-white hover:border-gray-400'}`}><Icon size={34} strokeWidth={1.6}/>{title}</button>)}
        </div>
        {error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={continueStep} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white">Continue <ArrowRight size={17}/></button>
      </section>}

      {step === 3 && <section className="flex flex-1 flex-col">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Where is your dealership?</h1><p className="mt-2 text-sm leading-6 text-gray-500">Set the location buyers will see on your showroom.</p>
        <div className="mt-8 space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Country</span><select className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-black" value={data.contact.country} onChange={e=>{const country=e.target.value as 'Zimbabwe'|'South Africa';updateContact({country,phoneCountryCode:country==='Zimbabwe'?'+263':'+27',whatsappCountryCode:country==='Zimbabwe'?'+263':'+27'});}}><option>Zimbabwe</option><option>South Africa</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">City / town</span><input aria-invalid={!data.contact.city.trim()} className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-black" value={data.contact.city} onChange={e=>updateContact({city:e.target.value})} placeholder="e.g. Harare"/>{!data.contact.city.trim()&&<span className="mt-1 block text-xs text-gray-500">Enter the city where buyers can find you.</span>}</label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Area or street <span className="font-normal text-gray-400">· optional</span></span><input className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-black" value={data.contact.address} onChange={e=>updateContact({address:e.target.value})} placeholder="e.g. Avondale"/></label>
        </div>
        {error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={continueStep} disabled={!data.contact.city.trim()} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight size={17}/></button>
      </section>}

      {step === 4 && <section className="flex flex-1 flex-col">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Tell buyers about your dealership.</h1><p className="mt-2 text-sm leading-6 text-gray-500">Add your business name and WhatsApp contact.</p>
        <div className="mt-8 space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Dealership name</span><input aria-invalid={!data.showroom.businessName.trim()} className="h-12 w-full rounded-[15px] border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-black" value={data.showroom.businessName} onChange={e=>updateShowroom({businessName:e.target.value})} placeholder="e.g. Moyo Motors"/>{!data.showroom.businessName.trim()&&<span className="mt-1 block text-xs text-gray-500">Your dealership name is required.</span>}</label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">WhatsApp number</span><div className="flex h-12 overflow-hidden rounded-[15px] border border-[#E5E7EB] focus-within:border-black"><span className="flex items-center border-r border-[#E5E7EB] px-3 text-sm text-gray-500">{countryCode}</span><input type="tel" autoComplete="tel" aria-invalid={!validWhatsapp} className="min-w-0 flex-1 px-3 text-sm outline-none" value={data.contact.whatsappNumber} onChange={e=>updateContact({whatsappNumber:e.target.value})} placeholder="77 123 4567"/></div>{!validWhatsapp&&<span className="mt-1 block text-xs text-gray-500">Enter a valid WhatsApp number.</span>}</label>
        </div>
        {error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={continueStep} disabled={!data.showroom.businessName.trim()||!validWhatsapp} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight size={17}/></button>
      </section>}

      {step === 5 && <section className="flex flex-1 flex-col">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Choose your showroom link.</h1><p className="mt-2 text-sm leading-6 text-gray-500">This is the link you will share with buyers.</p>
        <label className="mt-8 block"><span className="mb-2 block text-xs font-semibold text-gray-700">Your public link</span><div className="flex h-12 items-center overflow-hidden rounded-[15px] border border-[#E5E7EB] px-3 focus-within:border-black"><span className="whitespace-nowrap text-xs text-gray-500">drivelink.co/</span><input aria-label="Showroom link name" className="h-full min-w-0 flex-1 px-2 text-sm outline-none" value={data.showroom.handle} onChange={e=>updateShowroom({handle:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/--+/g,'-').replace(/^-|-$/g,'')})} placeholder="moyo-motors"/></div></label>
        <div className="mt-4 rounded-[15px] border border-[#E5E7EB] p-4 text-sm" aria-live="polite">{checking?<span className="flex items-center gap-2 text-gray-500"><Loader2 size={15} className="animate-spin"/> Checking availability…</span>:available===true?<span className="text-gray-800">✓ This link is available</span>:available===false?<span className="text-red-600">This link is unavailable. Try another.</span>:<span className="text-gray-500">Use at least 3 letters, numbers or hyphens.</span>}</div>
        {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={()=>setStep(6)} disabled={checking||!validSlug||available!==true} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight size={17}/></button>
      </section>}

      {step === 6 && <section className="dl-pro-paywall">
        <header className="dl-pro-header">
          <div className="dl-pro-brand"><svg viewBox="0 0 64 34" aria-hidden="true"><path d="M3 25c8-1 10-10 19-12 7-2 15 0 22 1 6 1 9 4 15 4M8 25h47M20 12l5-7c2-3 5-4 9-3l14 3 8 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="18" cy="26" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="49" cy="26" r="4" fill="none" stroke="currentColor" strokeWidth="2"/></svg><span>DriveLink</span></div>
          <button type="button" className="dl-pro-close" aria-label="Back to showroom link" onClick={()=>setStep(5)}><span aria-hidden="true">×</span></button>
        </header>
        <div className="dl-pro-hero"><img src={MARKETING_CAR_IMAGES.hero} alt="Premium vehicle outside a modern dealership"/><div className="dl-pro-hero-shade"/></div>
        <div className="dl-pro-intro"><h1>Upgrade to<br/>DriveLink Pro</h1><p>Unlock more features and grow your dealership online.</p></div>
        <div className="dl-pro-timeline">
          <div className="dl-pro-timeline-line"/>
          <div className="dl-pro-step is-current"><div className="dl-pro-step-icon"><Crown size={24} fill="currentColor"/></div><div className="dl-pro-step-copy"><strong>3-Day Free Trial</strong><span>Try all premium features for free.</span></div></div>
          <div className="dl-pro-step"><div className="dl-pro-step-icon is-outline"><CreditCard size={23}/></div><div className="dl-pro-step-copy"><strong>Then $3.99 / month</strong><span>After 3 days, continue with DriveLink Pro for $3.99 per month. No payment is taken today.</span></div></div>
        </div>
        <div className="dl-pro-features">
          <div><Car size={21}/><span>Online Dealership Showroom</span></div>
          <div><BarChart3 size={21}/><span>Advanced Analytics &amp; Insights</span></div>
          <div><Users size={21}/><span>Manage Buyer Leads</span></div>
          <div><MessageCircle size={21}/><span>WhatsApp Enquiries</span></div>
          <div><Car size={21}/><span>Vehicle Inventory Management</span></div>
        </div>
        {error&&<p role="alert" className="dl-pro-error">{error}</p>}
        <div className="dl-pro-price-card"><div className="dl-pro-price"><strong>$3.99</strong><span>/ month</span><em>Premium Plan</em></div><button type="button" disabled={busy} onClick={finishExistingSession}>{busy?<><Loader2 size={19} className="animate-spin"/> Activating your trial…</>:<>Start 3-Day Free Trial <ArrowRight size={22}/></>}</button><p><Lock size={13}/> No credit card required for free trial</p></div>
      </section>}

      {step === 7 && <section className="dl-notify-screen di-setup-screen flex flex-1 flex-col" aria-label="Get notified">
        <div className="dl-notify-bell"><Bell size={21} strokeWidth={1.8}/></div>
        <h1>Get notified</h1>
        <p className="dl-notify-subtitle">Know the moment a buyer enquires about one of your cars.</p>
        {notificationService.isPushSupported() ? <div className="dl-notify-preview" aria-hidden="true">
          <div className="dl-notify-phone"/>
          <div className="dl-notify-card dl-notify-card-one"><span className="dl-notify-icon"><MessageSquare size={16}/></span><span className="dl-notify-copy"><b>New enquiry</b><small>Tendai asked about your Toyota Aqua</small></span><time>2m</time></div>
          <div className="dl-notify-card dl-notify-card-two"><span className="dl-notify-icon"><EyeIcon size={16}/></span><span className="dl-notify-copy"><b>Showroom link viewed</b><small>12 people viewed your showroom today</small></span><time>1h</time></div>
          <div className="dl-notify-card dl-notify-card-three"><span className="dl-notify-icon"><CreditCardIcon size={16}/></span><span className="dl-notify-copy"><b>Subscription reminder</b><small>Your plan renews in 5 days</small></span><time>2h</time></div>
        </div> : <div className="dl-notify-ios"><div className="dl-notify-ios-icon"><Bell size={25}/></div><b>To get notifications on iPhone, add DriveLink to your Home Screen</b><ol><li>Tap the Share icon in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Open DriveLink from your Home Screen.</li></ol></div>}
        {error&&<p role="alert" className="dl-notify-error">{error}</p>}
        <div className="dl-notify-actions">
          {notificationService.isPushSupported() && <button type="button" disabled={busy} onClick={enableOnboardingNotifications}>{busy?<><Loader2 size={17} className="animate-spin"/> Enabling…</>:<>Turn on notifications <ArrowRight size={18}/></>}</button>}
          <button type="button" className="dl-notify-skip" onClick={continueWithoutNotifications}>Not right now</button>
        </div>
      </section>}

      {step === 8 && <section className="di-setup-screen flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white"><Check size={32}/></div>
        <h1 className="text-[30px] font-bold tracking-tight">Your DriveLink Pro trial is active.</h1><p className="mt-3 max-w-xs text-sm leading-6 text-gray-500">You have 3 days of full access. When your trial ends, you can subscribe for $3.99 per month through EcoCash. No payment is taken today.</p>
        <div className="mt-8 flex w-full items-center gap-3 rounded-[16px] border border-[#E5E7EB] p-4 text-left"><Link2 size={18} className="shrink-0 text-gray-500"/><span className="min-w-0 flex-1 truncate text-sm font-medium">drivelink.co/{data.showroom.handle}</span><button type="button" onClick={copyShowroomLink} aria-label="Copy showroom link" className="rounded-full p-2 hover:bg-gray-100"><Copy size={17}/></button></div>
        <button type="button" onClick={share} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#E5E7EB] text-sm font-semibold"><MessageCircle size={17}/> Share on WhatsApp</button>
        <button type="button" onClick={()=>navigate('/app')} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white">Go to dashboard <ArrowRight size={17}/></button>
      </section>}
    </section>
  </main>;
};
