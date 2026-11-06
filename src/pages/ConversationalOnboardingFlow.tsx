import React, { useEffect, useRef, useState } from 'react';
import { Select } from '../components/common/Select';
import './ConversationalOnboardingFlow.css';
import { ArrowLeft, ArrowRight, Check, Copy, Car, Truck, Bus, Crown, Eye, EyeOff, Link2, Loader2, MessageCircle, CreditCard, BarChart3, Users } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { OnboardingState, SellerType } from '../types';
import { toE164 } from '../utils/phoneUtils';
import { MARKETING_CAR_IMAGES } from '../utils/marketingCarImages';
import { DriveLinkLogo } from '../components/common/DriveLinkLogo';
import { notificationService } from '../services/notificationService';
import { ShowroomBrandingEditor } from '../components/ShowroomBrandingEditor';
import { Bell, MessageSquare, Eye as EyeIcon, CreditCard as CreditCardIcon } from 'lucide-react';

const TOTAL = 9;
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


const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 15000): Promise<T> => {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('TRIAL_ACTIVATION_TIMEOUT')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
};

export const OnboardingFlow: React.FC<{ forceNewAccount?: boolean }> = ({ forceNewAccount = false }) => {
  const { navigate, showToast } = useNavigation();
  const previewQuery = typeof window !== 'undefined' ? `${window.location.search}&${window.location.hash.split('?')[1] || ''}` : '';
  const forceNotificationsPreview = import.meta.env.DEV && new URLSearchParams(previewQuery).get('onboarding') === 'notifications';
  // Onboarding state is hydrated exclusively from the authenticated user's database row.
  const [data, setData] = useState<OnboardingState>(() => initialState());
  const [progressReady, setProgressReady] = useState(false);
  const [notificationsDismissedAt, setNotificationsDismissedAt] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const activationInFlight = useRef(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [introDone, setIntroDone] = useState(false);
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
    setIntroDone(true);
    update({ currentStep: 1 });
  };
  const advanceIntro = () => introStep === introSlides.length - 1 ? finishIntro() : setIntroStep(value => Math.min(value + 1, introSlides.length - 1));
  useEffect(() => {
    if (forceNotificationsPreview) {
      setIntroDone(true);
      setData(prev => ({ ...prev, currentStep: 7, isCompleted: false }));
      setProgressReady(true);
      console.info('[DriveLink onboarding] Get notified shown: dev preview query parameter.');
      return;
    }
    if (forceNewAccount) {
      // /signup is deliberately independent of any currently authenticated account.
      setProgressReady(true);
      return;
    }
    let active = true;
    const restore = async () => {
      try {
        const user = await supabaseService.getCurrentUser();
        if (!active) return;
        if (!user) { setProgressReady(true); return; }
        await storageService.syncUserScope(user.id);
        if (!active) return;
        const dealer = await supabaseService.getCurrentDealership();
        if (!active) return;
        if (dealer) {
          storageService.saveDealership(dealer);
          storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: dealer.id, userId: user.id });
          console.info('[DriveLink onboarding] Existing dealership found during server session restore.');
          window.location.assign('/app');
          return;
        }
        storageService.setUserSession({ isLoggedIn: true, email: user.email || '', dealershipId: '', userId: user.id });
        const { data: progress, error: progressError } = await supabase
          .from('user_onboarding_progress')
          .select('onboarding_step,draft,intro_completed,notifications_prompt_dismissed_at,onboarding_completed_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (progressError) throw progressError;
        if (!active) return;
        if (progress) {
          const savedDraft = (progress.draft || {}) as Partial<OnboardingState>;
          setData({
            ...initialState(),
            ...savedDraft,
            currentStep: progress.onboarding_completed_at ? 9 : Math.max(2, Math.min(TOTAL, (progress.onboarding_step ?? 0) + 2)),
            account: { ...initialState().account, email: user.email || '' },
            branding: { ...initialState().branding, ...(savedDraft.branding || {}) },
            isCompleted: Boolean(progress.onboarding_completed_at),
          });
          setIntroDone(Boolean(progress.intro_completed));
          setNotificationsDismissedAt(progress.notifications_prompt_dismissed_at || null);
        } else {
          setData({ ...initialState(), currentStep: 2, account: { ...initialState().account, email: user.email || '' } });
          setIntroDone(false);
          setNotificationsDismissedAt(null);
        }
        setProgressReady(true);
      } catch (error) {
        console.warn('Could not restore account onboarding progress:', error);
        if (active) setProgressReady(true);
      }
    };
    void restore();
    return () => { active = false; };
  }, [forceNewAccount, forceNotificationsPreview]);
  useEffect(() => {
    if (data.currentStep !== 7 || typeof window === 'undefined' || forceNotificationsPreview) return;
    if (notificationsDismissedAt) {
      console.info('[DriveLink onboarding] Get notified skipped: dismissed for this account.');
      setData(prev => ({ ...prev, currentStep: 8 }));
    } else {
      console.info('[DriveLink onboarding] Get notified shown: this account has not dismissed the prompt.');
    }
  }, [data.currentStep, forceNotificationsPreview, notificationsDismissedAt]);

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
  React.useEffect(() => {
    if (step !== 8) return;
    const previousOverflow = document.body.style.overflow;
    document.documentElement.classList.add('dl-pro-active');
    document.body.classList.add('dl-pro-active');
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('dl-pro-active');
      document.body.classList.remove('dl-pro-active');
      document.body.style.overflow = previousOverflow;
    };
  }, [step]);

  const countryCode = data.contact.country === 'South Africa' ? '+27' : '+263';
  const update = (patch: Partial<OnboardingState>) => setData(prev => ({ ...prev, ...patch }));
  const updateContact = (patch: Partial<OnboardingState['contact']>) => setData(prev => ({ ...prev, contact: { ...prev.contact, ...patch } }));
  const updateShowroom = (patch: Partial<OnboardingState['showroom']>) => setData(prev => ({ ...prev, showroom: { ...prev.showroom, ...patch } }));

  useEffect(() => {
    if (!progressReady || forceNewAccount || forceNotificationsPreview) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const user = await supabaseService.getCurrentUser();
        if (!active || !user) return;
        const draft = {
          sellerType: data.sellerType,
          showroom: data.showroom,
          contact: data.contact,
          branding: data.branding,
          template: data.template,
          firstVehicle: data.firstVehicle,
        };
        const { error: saveError } = await supabase
          .from('user_onboarding_progress')
          .upsert({
            user_id: user.id,
            onboarding_step: Math.max(0, step - 2),
            draft,
            intro_completed: introDone,
            notifications_prompt_dismissed_at: notificationsDismissedAt,
            onboarding_completed_at: data.isCompleted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        if (saveError) throw saveError;
      } catch (error) {
        console.warn('Could not save account onboarding progress:', error);
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [data, introDone, notificationsDismissedAt, progressReady, step, forceNewAccount, forceNotificationsPreview]);
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

  const setStep = (next: number) => { update({ currentStep: Math.max(1, Math.min(TOTAL, next)), ...(next === 9 ? { isCompleted: true } : {}) }); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const back = () => { if (step === 1) { setIntroDone(false); setIntroStep(5); } else setStep(step - 1); };
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
      // Never reuse a session from a different account when the user chooses Sign Up.
      const previousSession = await supabaseService.getSession();
      if (previousSession?.user) await supabaseService.signOut();
      await storageService.clearAppUserData();
      const auth = await supabaseService.signUp(data.account.email.trim(), data.account.password);
      if (!auth.session || !auth.user) {
        setError('Check your email to confirm your account, then sign in to continue setting up your dealership.');
        return;
      }
      const user = auth.user;
      await storageService.syncUserScope(user.id);
      storageService.setUserSession({ isLoggedIn: true, email: user.email || data.account.email, dealershipId: '', userId: user.id });
      const initialDraft = {
        sellerType: data.sellerType,
        showroom: data.showroom,
        contact: data.contact,
        branding: data.branding,
        template: data.template,
        firstVehicle: data.firstVehicle,
      };
      const { error: progressError } = await supabase.from('user_onboarding_progress').upsert({
        user_id: user.id,
        onboarding_step: 0,
        draft: initialDraft,
        intro_completed: introDone,
        notifications_prompt_dismissed_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (progressError) throw progressError;
      // A hard reload drops any state held by the previous account's React tree.
      window.location.assign('/onboarding');
    } catch (e: any) {
      setError(e?.message || 'We could not create your account. Please try again.');
    } finally { setBusy(false); }
  };

  const finishExistingSession = async () => {
    if (activationInFlight.current || busy) return;
    if (brandingBusy) { setError('Your showroom images are still uploading. Please wait a moment.'); return; }
    activationInFlight.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await withTimeout((async () => {
        const user = await supabaseService.getCurrentUser();
        if (!user) throw new Error('Please sign in to finish your setup.');

        let dealer = await supabaseService.getCurrentDealership();
        if (!dealer) {
          dealer = await supabaseService.createDealership({
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
        }

        // This database function is atomic and idempotent. It returns the original
        // trial dates on retries and marks onboarding complete in the same transaction.
        const { data: activation, error: activationError } = await supabase.rpc('activate_dealership_trial');
        if (activationError) throw activationError;
        if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
          throw new Error('Trial activation returned an invalid response.');
        }
        const activationResult = activation as {
          status?: string;
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          onboarding_completed_at?: string | null;
          is_active?: boolean;
        };
        const activationNow = activationResult.onboarding_completed_at
          ? new Date(activationResult.onboarding_completed_at).getTime()
          : Date.now();
        const activationTrialValid = (activationResult.status === 'trial' || activationResult.status === 'trialing') &&
          !!activationResult.trial_ends_at && new Date(activationResult.trial_ends_at).getTime() > activationNow;
        const activationPaidValid = activationResult.status === 'active' && activationResult.is_active === true;
        const activationExpiredTrial = activationResult.status === 'expired' &&
          !!activationResult.trial_started_at && !!activationResult.trial_ends_at;
        if (!activationTrialValid && !activationPaidValid && !activationExpiredTrial) {
          throw new Error('Trial activation did not return a valid subscription state.');
        }

        if ((activationTrialValid || activationPaidValid) && (data.branding.logoPreview || data.branding.coverPreview)) {
          dealer = await supabaseService.updateDealership(dealer.id, {
            ...(data.branding.logoPreview ? { logoUrl: data.branding.logoPreview } : {}),
            ...(data.branding.coverPreview ? { coverUrl: data.branding.coverPreview } : {}),
          });
        }

        // Re-read authoritative subscription status before leaving onboarding.
        const { data: statusData, error: statusError } = await supabase.functions.invoke('drivelink-payments', {
          body: { action: 'status' },
        });
        if (statusError) throw statusError;
        const subscription = statusData?.subscription;
        const serverNow = statusData?.server_now ? new Date(statusData.server_now).getTime() : Date.now();
        const trialValid = (subscription?.status === 'trial' || subscription?.status === 'trialing') &&
          subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > serverNow;
        const paidValid = subscription?.status === 'active' &&
          subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > serverNow;
        const expiredTrial = subscription?.status === 'expired' &&
          !!subscription?.trial_started_at && !!subscription?.trial_ends_at;
        if (!trialValid && !paidValid && !expiredTrial) {
          throw new Error('The server has not confirmed the trial or subscription state yet.');
        }

        const refreshedDealer = await supabaseService.getCurrentDealership();
        if (!refreshedDealer || refreshedDealer.id !== dealer.id) {
          throw new Error('Could not refresh the dealership session after trial activation.');
        }
        return { user, dealer: refreshedDealer };
      })());

      storageService.saveDealership(result.dealer);
      storageService.setUserSession({
        isLoggedIn: true,
        email: result.user.email || data.account.email,
        dealershipId: result.dealer.id,
        userId: result.user.id,
      });

      if (notificationsDismissedAt) {
        void notificationService.dismissOnboardingPrompt(result.dealer.id).catch(err =>
          console.warn('Could not persist notification prompt dismissal:', err)
        );
      } else if ('Notification' in window && Notification.permission === 'granted' && notificationService.isPushSupported()) {
        void notificationService.enablePush(result.dealer.id, false).catch(err =>
          console.warn('Could not register the approved push subscription after dealership setup:', err)
        );
      }
      await supabase.from('user_onboarding_progress').upsert({
        user_id: result.user.id,
        onboarding_step: 7,
        draft: {
          sellerType: data.sellerType,
          showroom: data.showroom,
          contact: data.contact,
          branding: data.branding,
          template: data.template,
          firstVehicle: data.firstVehicle,
        },
        intro_completed: true,
        notifications_prompt_dismissed_at: notificationsDismissedAt,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Force a fresh app boot so the access gate cannot reuse pre-activation state.
      window.location.assign('/app');
    } catch (e: any) {
      console.error('[DriveLink onboarding] Trial activation failed:', e);
      setError("Couldn't start your trial. Check your connection and try again.");
    } finally {
      activationInFlight.current = false;
      setBusy(false);
    }
  };


  const renderIntroVisual = () => {
    if (introStep === 0) return <div className="di-hero-visual"><img src={MARKETING_CAR_IMAGES.hero} alt="Premium vehicle in a dealership setting" /><div className="di-brand-mark"><DriveLinkLogo variant="light" size="md"/></div></div>;
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
    setNotificationsDismissedAt(new Date().toISOString());
    console.info('[DriveLink onboarding] Get notified skipped: dismissed by this account.');
    setStep(8);
  };
  const enableOnboardingNotifications = async () => {
    setBusy(true); setError('');
    try {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'denied') {
        setNotificationsDismissedAt(new Date().toISOString());
        console.info('[DriveLink onboarding] Get notified skipped: denied for this account.');
        setStep(8);
        return;
      }
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      setNotificationsDismissedAt(null);
      setStep(8);
    } catch (e: any) { setError(e?.message || 'Could not enable notifications. You can try again in Settings.'); }
    finally { setBusy(false); }
  };
  const copyShowroomLink = async () => {
    const url = `${window.location.origin}/showroom/${data.showroom.handle}`;
    try { await navigator.clipboard.writeText(url); showToast('Showroom link copied'); }
    catch { setError('Could not copy the link. Please copy it from the address shown.'); }
  };

  return <main className={step === 8 ? 'dl-pro-page' : step === 6 ? 'sb-onboarding-page' : 'min-h-[100dvh] bg-white px-4 py-5 text-[#0A0A0A] sm:py-8'}>
    <section className={step === 8 ? 'dl-pro-page-inner' : step === 6 ? 'sb-onboarding-shell' : 'mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col rounded-[28px] bg-white px-1 py-3 sm:min-h-[780px] sm:px-5'}>
      {step < 7 && <header className="mb-7 flex items-center justify-between">
        <button type="button" onClick={back} aria-label="Go back" className="flex h-10 items-center gap-2 rounded-full px-2 text-sm font-medium text-gray-600 hover:bg-gray-50" disabled={step===7}>
          {step!==7 && <><ArrowLeft size={17}/> Back</>}
        </button>
        <span className="text-xs font-medium text-gray-500">{step===6?'Brand your showroom':step===7?'Notifications':step===8?'DriveLink Pro':step===9?'Ready':`Setup ${step} of 5`}</span>
      </header>}
      {step <= 5 && <div className="mb-8 flex items-center justify-center gap-2" aria-label={`Setup step ${step} of 5`}>
        {Array.from({length:5},(_,i)=><span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i+1===step?'w-7 bg-[#0A0A0A]':i+1<step?'w-2 bg-[#0A0A0A]':'w-2 bg-gray-200'}`} />)}
      </div>}

      {step === 1 && <form onSubmit={finish} className="di-setup-screen flex flex-1 flex-col">
        <div className="mb-7 flex justify-center"><DriveLinkLogo variant="dark" size="sm" showTagline /></div><div className="mb-9 text-center"><div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white"><Link2 size={24}/></div><h1 className="text-[30px] font-bold leading-tight tracking-tight">Create your account.</h1><p className="mt-2 text-sm leading-6 text-gray-500">Set up your Drive Link account to build your dealership showroom.</p></div>
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
          <div className="block"><span className="mb-2 block text-xs font-semibold text-gray-700">Country</span><Select name="country" aria-label="Country" value={data.contact.country} title="Choose country" options={[{value:'Zimbabwe',label:'Zimbabwe'},{value:'South Africa',label:'South Africa'}]} onChange={value=>{const country=value as 'Zimbabwe'|'South Africa';updateContact({country,phoneCountryCode:country==='Zimbabwe'?'+263':'+27',whatsappCountryCode:country==='Zimbabwe'?'+263':'+27'});}}/></div>
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

      {step === 6 && <section className="sb-onboarding-screen">
        <div className="sb-stage-progress"><span>Step 2 of 4</span><div><i className="is-done"/><i className="is-current"/><i/><i/></div></div>
        <div className="sb-screen-heading"><h1>Brand your showroom</h1><p>Add your logo and banner so buyers recognise your dealership.</p></div>
        <ShowroomBrandingEditor dealershipName={data.showroom.businessName} city={data.contact.city} logoUrl={data.branding.logoPreview || null} bannerUrl={data.branding.coverPreview || null} onChange={value => update({ branding: { ...data.branding, logoPreview: value.logoUrl, coverPreview: value.bannerUrl } })} onUploadingChange={setBrandingBusy}/>
        {error && <p role="alert" className="sb-inline-error">{error}</p>}
        <div className="sb-onboarding-actions">
          <button type="button" disabled={busy || brandingBusy || (!data.branding.logoPreview && !data.branding.coverPreview)} onClick={() => setStep(7)}>{brandingBusy ? <><Loader2 size={17} className="animate-spin"/> Uploading…</> : <>Continue <ArrowRight size={18}/></>}</button>
          <button type="button" onClick={() => setStep(7)}>Skip for now</button>
        </div>
      </section>}

      {step === 8 && <section className="dl-pro-paywall">
        <header className="dl-pro-header">
          <div className="dl-pro-brand"><DriveLinkLogo variant="light" size="md"/></div>
          <button type="button" className="dl-pro-close" aria-label="Back to notifications" onClick={()=>setStep(7)}><span aria-hidden="true">×</span></button>
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
        <footer className="dl-pro-sticky-footer">
          <button type="button" disabled={busy || brandingBusy} onClick={finishExistingSession}>{busy?<><Loader2 size={19} className="animate-spin"/> Activating your trial…</>:<>{error?'Retry':'Start 3-day free trial'} <ArrowRight size={20}/></>}</button>
          <p>No payment is taken today. Then $3.99/month.</p>
        </footer>
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

      {step === 9 && <section className="di-setup-screen flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white"><Check size={32}/></div>
        <h1 className="text-[30px] font-bold tracking-tight">Your DriveLink Pro trial is active.</h1><p className="mt-3 max-w-xs text-sm leading-6 text-gray-500">You have 3 days of full access. When your trial ends, you can subscribe for $3.99 per month through EcoCash. No payment is taken today.</p>
        <div className="mt-8 flex w-full items-center gap-3 rounded-[16px] border border-[#E5E7EB] p-4 text-left"><Link2 size={18} className="shrink-0 text-gray-500"/><span className="min-w-0 flex-1 truncate text-sm font-medium">drivelink.co/{data.showroom.handle}</span><button type="button" onClick={copyShowroomLink} aria-label="Copy showroom link" className="rounded-full p-2 hover:bg-gray-100"><Copy size={17}/></button></div>
        <button type="button" onClick={share} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#E5E7EB] text-sm font-semibold"><MessageCircle size={17}/> Share on WhatsApp</button>
        <button type="button" onClick={()=>navigate('/app')} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white">Go to dashboard <ArrowRight size={17}/></button>
      </section>}
    </section>
  </main>;
};
