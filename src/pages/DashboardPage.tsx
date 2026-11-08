import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { StatusBadge } from '../components/common/Badge';
import { PerformanceSection } from '../components/dashboard/PerformanceSection';
import { TrialUpgradeCard } from '../components/dashboard/TrialUpgradeCard';
import { planService } from '../services/planService';
import { Bell, CarFront, ChevronRight, Eye, MessageCircle, Plus, Share2, ArrowUpRight } from 'lucide-react';
import { absoluteUrl, legacyName, name } from '../config/brand';
import './DashboardPage.css';

type SubscriptionStatus = {
  status: string;
  plan: 'free' | 'pro';
  pro_trial_ends_at: string | null;
  current_period_end: string | null;
  maxVehicles: number | null;
};

export const DashboardPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();
  const [dealership, setDealership] = useState(() => isLive ? { ...storageService.getDealership(), name: 'Your dealership', slug: '' } : storageService.getDealership());
  const [vehicles, setVehicles] = useState(() => isLive ? [] : storageService.getVehicles());
  const [enquiries, setEnquiries] = useState(() => isLive ? [] : storageService.getEnquiries());
  const [loading, setLoading] = useState(isLive);
  const [loadError, setLoadError] = useState('');
  const [performancePeriod, setPerformancePeriod] = useState<7 | 30 | 90>(7);
  const [performance, setPerformance] = useState({ visits: 0, enquiries: 0 });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const markPerformanceLoaded = useCallback(() => setPerformanceLoading(false), []);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const serverClock = useRef({ serverMs: Date.now(), monotonicMs: window.performance.now() });
  const [brandNoticeVisible, setBrandNoticeVisible] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      await planService.getMyPlan(); // server-side downgrade reconciliation runs before inventory is loaded
      const [d, v, e] = await Promise.all([
        storageService.getDealershipAsync(),
        storageService.getVehiclesAsync(),
        storageService.getEnquiriesAsync(),
      ]);
      setDealership(d); setVehicles(v); setEnquiries(e);
    } catch (error: any) {
      setLoadError(error?.message || 'We could not load your dealership data.');
      if (isLive) { setVehicles([]); setEnquiries([]); }
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!isLive) return;
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .select('brand_notice_dismissed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active && !error) setBrandNoticeVisible(!data?.brand_notice_dismissed_at);
    })();
    return () => { active = false; };
  }, [isLive]);

  const dismissBrandNotice = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { showToast('Could not save this notice. Try again.'); return; }
    const { error } = await supabase.from('user_onboarding_progress').upsert({
      user_id: user.id,
      brand_notice_dismissed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) { showToast('Could not save this notice. Try again.'); return; }
    setBrandNoticeVisible(false);
  };

  const refreshSubscription = async () => {
    if (!isLive) return null;
    const snapshot = await planService.getMyPlan();
    const value: SubscriptionStatus = {
      status: snapshot.subscription_status || 'inactive',
      plan: snapshot.plan,
      pro_trial_ends_at: snapshot.pro_trial_ends_at,
      current_period_end: snapshot.current_period_end,
      maxVehicles: snapshot.config[snapshot.plan].maxVehicles,
    };
    serverClock.current = { serverMs: Date.now(), monotonicMs: window.performance.now() };
    setSubscription(value);
    return value;
  };

  useEffect(() => {
    if (!isLive) return;
    const sync = () => { if (document.visibilityState === 'visible') void refreshSubscription().catch(() => undefined); };
    void refreshSubscription().catch(() => undefined);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [isLive]);



  const newLeads = enquiries.filter(e => e.stage === 'new').length;
  const soldCount = vehicles.filter(v => v.status === 'sold').length;
  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const reservedCount = vehicles.filter(v => v.status === 'reserved').length;
  const recent = useMemo(() => [...enquiries].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,3), [enquiries]);
  const latestVehicle = vehicles[0];
  const fullPublicUrl = absoluteUrl(`/showroom/${encodeURIComponent(dealership.slug)}`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const periodStats = [
    { label: 'Store visits', value: performance.visits, icon: Eye },
    { label: 'Enquiries', value: performance.enquiries, icon: MessageCircle, action: () => navigate('/app/enquiries') },
    { label: 'Cars sold', value: soldCount, icon: CarFront },
  ];

  return (
    <div className="dl-workspace dl-dashboard relative min-h-full flex flex-col text-[#0A0F1E]">
      <main className="dl-dashboard-main flex-1 px-4 sm:px-7 pt-5 pb-[calc(120px+env(safe-area-inset-bottom))] w-full max-w-5xl mx-auto">
        <header className="dl-dashboard-header flex items-center justify-between gap-3 mb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="dl-dealer-avatar shrink-0">
              {dealership.logoUrl ? <img src={dealership.logoUrl} alt="" /> : <span>{dealership.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#858d99] font-medium">{greeting}</p>
              <button onClick={() => navigate('/app/settings')} className="block max-w-[48vw] truncate text-left text-[16px] font-extrabold tracking-tight">{dealership.name}</button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={async () => {
              const shareData = { title: dealership.name, text: 'Explore vehicles from ' + dealership.name + '.', url: fullPublicUrl };
              if (typeof navigator !== 'undefined' && navigator.share) {
                try { await navigator.share(shareData); } catch (error: any) { if (error?.name !== 'AbortError') showToast('Could not share showroom.'); }
                return;
              }
              try { await navigator.clipboard.writeText(fullPublicUrl); showToast('Showroom link copied'); }
              catch { showToast('Unable to copy showroom link'); }
            }} className="dl-share-pill"><Share2 size={15}/><span>Share</span></button>
            <button onClick={() => navigate('/app/notifications')} aria-label="Notifications" className="dl-bell-button"><Bell size={19}/>{newLeads > 0 && <span className="dl-notification-dot"/>}</button>
          </div>
        </header>

        {brandNoticeVisible && <aside className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-xs text-[#303846]" role="status"><p className="min-w-0 flex-1"><strong>{legacyName} is now {name}.</strong> Same app, same showroom link.</p><button type="button" onClick={() => void dismissBrandNotice()} aria-label="Dismiss brand update notice" className="shrink-0 rounded-full px-2 py-1 font-bold text-[#667085]">Dismiss</button></aside>}

        <TrialUpgradeCard subscription={subscription} vehicleCount={vehicles.filter(vehicle => vehicle.status !== 'hidden').length} maxVehicles={subscription?.maxVehicles ?? 3} serverNow={serverClock.current.serverMs + (window.performance.now() - serverClock.current.monotonicMs)} onUpgrade={() => navigate('/app/upgrade')}/>
        {loading ? <div className="dl-skeleton-card h-[104px] mb-4"/> : vehicles.length === 0 ? (
          <section className="dl-empty-inventory mb-4">
            <div className="dl-empty-icon"><CarFront size={22}/></div><div className="min-w-0 flex-1"><h2>Add your first vehicle</h2><p>It goes live on your showroom link right away</p></div>
            <button onClick={() => navigate('/app/vehicles/new')} aria-label="Add vehicle"><Plus size={20}/></button>
          </section>
        ) : (
          <button onClick={() => navigate('/app/vehicles')} className="dl-inventory-card mb-4">
            <div className="dl-inventory-photo">{latestVehicle?.photos?.[0] ? <img src={latestVehicle.photos[0]} alt={latestVehicle.make}/> : <CarFront size={30}/>}</div>
            <div className="min-w-0 flex-1 text-left"><p className="text-[10px] font-bold uppercase tracking-wide text-[#858d99]">Inventory overview</p><div className="flex items-baseline gap-2"><strong className="text-[34px] leading-none font-black tabular-nums">{vehicles.length}</strong><span className="text-[11px] text-[#737c89]">vehicles</span></div><p className="mt-1 text-[10px] text-[#7e8793]">{availableCount} available · {reservedCount} reserved</p></div>
            <ArrowUpRight size={18} className="text-[#0A0F1E]"/>
          </button>
        )}

        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-extrabold">At a glance</h2><span className="text-[10px] text-[#929aa5]">Last {performancePeriod} days</span></div>
          <div className="grid grid-cols-3 gap-2">
            {periodStats.map(item=>{const Icon=item.icon;return <button key={item.label} onClick={item.action} className="dl-stat-card text-left"><Icon size={16}/><strong>{loading||performanceLoading?'—':item.value.toLocaleString()}</strong><span>{item.label}</span></button>;})}
          </div>
        </section>

        <PerformanceSection
          dealershipId={dealership.id || ''}
          period={performancePeriod}
          isLive={isLive}
          enquiries={isLive ? undefined : enquiries}
          showroomUrl={fullPublicUrl}
          onPeriodChange={setPerformancePeriod}
          onData={setPerformance}
          onInitialLoadComplete={markPerformanceLoaded}
        />

        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-extrabold">Recent enquiries</h2><button onClick={()=>navigate('/app/enquiries')} className="text-[10px] font-bold text-[#4c5562]">See all <ChevronRight size={13} className="inline"/></button></div>
          {recent.length ? <div className="dl-recent-card">{recent.map(item=><button key={item.id} onClick={()=>navigate('/app/enquiries')} className="dl-recent-row"><span className="dl-recent-avatar">{item.buyerName.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong>{item.buyerName}</strong><small>{item.message}</small></span><span className="dl-recent-date">{new Date(item.createdAt).toLocaleDateString()}</span></button>)}</div> : <div className="dl-recent-empty"><MessageCircle size={19}/><p>No enquiries yet</p><small>New customer enquiries will appear here.</small></div>}
        </section>

        {!loading && vehicles.length > 0 && <section className="mb-4"><div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-extrabold">Garage snapshot</h2><button onClick={()=>navigate('/app/vehicles')} className="text-[10px] font-bold text-[#4c5562]">View garage</button></div>{vehicles.slice(0,2).map(vehicle=><button key={vehicle.id} onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="dl-garage-row"><span className="dl-garage-photo">{vehicle.photos?.[0]&&<img src={vehicle.photos[0]} alt=""/>}</span><span className="min-w-0 flex-1"><strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong><small>{vehicle.currency==='ZAR'?'R':'$'}{vehicle.price.toLocaleString()}</small></span><StatusBadge status={vehicle.status} size="sm"/></button>)}</section>}
        {loadError && <div role="alert" className="mb-4 rounded-xl bg-[#fff1f0] text-[#b42318] p-3 text-xs">{loadError}</div>}
        <button onClick={()=>navigate('/app/vehicles/new')} className="dl-add-vehicle"><Plus size={17}/> Add vehicle</button>
      </main>
    </div>
  );
};
