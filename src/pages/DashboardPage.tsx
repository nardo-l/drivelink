import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { StatusBadge } from '../components/common/Badge';
import { Bell, CarFront, ChevronRight, Eye, MessageCircle, Plus, RefreshCw, Share2, ArrowUpRight } from 'lucide-react';
import './DashboardPage.css';

type SubscriptionStatus = {
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_until: string | null;
};

export const DashboardPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();
  const [dealership, setDealership] = useState(() => isLive ? { ...storageService.getDealership(), name: 'Your dealership', slug: '' } : storageService.getDealership());
  const [vehicles, setVehicles] = useState(() => isLive ? [] : storageService.getVehicles());
  const [enquiries, setEnquiries] = useState(() => isLive ? [] : storageService.getEnquiries());
  const [loading, setLoading] = useState(isLive);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [performancePeriod, setPerformancePeriod] = useState<7 | 30 | 90>(7);
  const [performance, setPerformance] = useState({ visits: 0, enquiries: 0 });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState('');
  const [performanceRetry, setPerformanceRetry] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const serverClock = useRef({ serverMs: Date.now(), monotonicMs: window.performance.now() });
  const [subscriptionNow, setSubscriptionNow] = useState(Date.now());
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const expiryCheck = useRef(false);
  const pullStart = useRef<number | null>(null);
  const touchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.currentTarget.scrollTop === 0) pullStart.current = event.touches[0]?.clientY ?? null;
  };
  const touchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = pullStart.current;
    pullStart.current = null;
    const end = event.changedTouches[0]?.clientY;
    if (start !== null && end !== undefined && end - start > 85 && !refreshing) void refreshDashboard();
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
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

  const refreshSubscription = async () => {
    if (!isLive) return null;
    const { data, error } = await supabase.functions.invoke('drivelink-payments', { body: { action: 'status' } });
    if (error) throw error;
    const serverMs = data?.server_now ? new Date(data.server_now).getTime() : serverClock.current.serverMs + (window.performance.now() - serverClock.current.monotonicMs);
    serverClock.current = { serverMs, monotonicMs: window.performance.now() };
    setSubscription(data?.subscription || null);
    setSubscriptionNow(serverMs);
    return data?.subscription || null;
  };

  useEffect(() => {
    if (!isLive) return;
    let timer: number | undefined;
    const tick = () => setSubscriptionNow(serverClock.current.serverMs + (window.performance.now() - serverClock.current.monotonicMs));
    const sync = async () => { try { await refreshSubscription(); } catch { tick(); } };
    const restart = () => {
      if (timer !== undefined) window.clearInterval(timer);
      tick();
      if (document.visibilityState === 'visible') {
        timer = window.setInterval(tick, 1000);
        void sync();
      }
    };
    void sync();
    if (document.visibilityState === 'visible') timer = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') restart();
      else if (timer !== undefined) window.clearInterval(timer);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', restart);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', restart);
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive || !subscription?.trial_ends_at || subscription.status !== 'trial') return;
    const trialEnd = new Date(subscription.trial_ends_at).getTime();
    if (subscriptionNow < trialEnd || expiryCheck.current) return;
    expiryCheck.current = true;
    setSubscriptionLoading(true);
    refreshSubscription().then(latest => {
      if (latest && (latest.status === 'expired' || (latest.status !== 'trial' && latest.status !== 'active' && latest.status !== 'grace_period'))) {
        navigate('/app/billing');
      } else {
        expiryCheck.current = false;
      }
    }).catch(() => { expiryCheck.current = false; }).finally(() => setSubscriptionLoading(false));
  }, [isLive, subscription, subscriptionNow]);

  const refreshDashboard = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([load(), refreshSubscription().catch(() => null)]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!dealership.id) return;
    let active = true;
    setPerformanceLoading(true);
    setPerformanceError('');
    const loadPerformance = async () => {
      try {
        let result = { visits: 0, enquiries: 0 };
        if (isLive) result = await supabaseService.getDealershipPerformance(dealership.id, performancePeriod);
        else {
          const since = Date.now() - performancePeriod * 24 * 60 * 60 * 1000;
          result = { visits: 0, enquiries: enquiries.filter(item => new Date(item.createdAt).getTime() >= since).length };
        }
        if (active) setPerformance(result);
      } catch (error: any) {
        if (active) setPerformanceError(error?.message || "Couldn't load performance");
      } finally { if (active) setPerformanceLoading(false); }
    };
    void loadPerformance();
    return () => { active = false; };
  }, [dealership.id, performancePeriod, performanceRetry, isLive, enquiries]);

  const newLeads = enquiries.filter(e => e.stage === 'new').length;
  const soldCount = vehicles.filter(v => v.status === 'sold').length;
  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const reservedCount = vehicles.filter(v => v.status === 'reserved').length;
  const recent = useMemo(() => [...enquiries].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,3), [enquiries]);
  const latestVehicle = vehicles[0];
  const fullPublicUrl = `${window.location.origin}/showroom/${encodeURIComponent(dealership.slug)}`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const periodLabel = `Last ${performancePeriod} days`;
  const periodStats = [
    { label: 'Store visits', value: performance.visits, icon: Eye },
    { label: 'Enquiries', value: performance.enquiries, icon: MessageCircle, action: () => navigate('/app/enquiries') },
    { label: 'Cars sold', value: soldCount, icon: CarFront },
  ];
  const maxBar = Math.max(1, performance.visits, performance.enquiries);
  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'grace_period';

  return (
    <div className="dl-workspace dl-dashboard relative min-h-full flex flex-col text-[#0A0F1E]">
      <main className="dl-dashboard-main flex-1 overflow-y-auto px-4 sm:px-7 pt-5 pb-[calc(120px+env(safe-area-inset-bottom))] w-full max-w-5xl mx-auto" onTouchStart={touchStart} onTouchEnd={touchEnd}>
        {refreshing && <div className="flex justify-center pb-3 text-[10px] font-semibold text-[#7d8591]"><RefreshCw size={13} className="mr-2 animate-spin"/>Refreshing dashboard</div>}
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

        {loading ? <div className="dl-skeleton-card h-[138px] mb-4"/> : null}
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
          <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-extrabold">At a glance</h2><span className="text-[10px] text-[#929aa5]">{periodLabel}</span></div>
          <div className="grid grid-cols-3 gap-2">
            {periodStats.map(item=>{const Icon=item.icon;return <button key={item.label} onClick={item.action} className="dl-stat-card text-left"><Icon size={16}/><strong>{loading||performanceLoading?'—':item.value.toLocaleString()}</strong><span>{item.label}</span></button>;})}
          </div>
        </section>

        <section className="dl-performance-card mb-4">
          <div className="flex items-start justify-between gap-3"><div><h2>Performance</h2><p>Showroom activity over time</p></div><select aria-label="Performance period" value={performancePeriod} onChange={e=>setPerformancePeriod(Number(e.target.value) as 7|30|90)}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></div>
          {performanceLoading ? <div className="mt-6 space-y-4 animate-pulse"><div className="h-3 rounded bg-[#eef0f3]"/><div className="h-3 w-3/4 rounded bg-[#eef0f3]"/></div> : performanceError ? <div className="dl-performance-empty"><p>Couldn't load activity.</p><button onClick={()=>setPerformanceRetry(x=>x+1)}>Retry</button></div> : performance.visits===0&&performance.enquiries===0 ? <div className="dl-performance-empty"><p>No activity yet. Share your showroom link to start getting visitors</p><button onClick={async()=>{try{await navigator.clipboard.writeText(fullPublicUrl);showToast('Showroom link copied');}catch{showToast('Unable to copy showroom link');}}}>Share link</button></div> : <div className="dl-bars mt-5"><div className="dl-bar-row"><span>Visits</span><div><i style={{width:(performance.visits/maxBar*100)+'%'}}/></div><strong>{performance.visits.toLocaleString()}</strong></div><div className="dl-bar-row is-light"><span>Enquiries</span><div><i style={{width:(performance.enquiries/maxBar*100)+'%'}}/></div><strong>{performance.enquiries.toLocaleString()}</strong></div></div>}
        </section>

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
