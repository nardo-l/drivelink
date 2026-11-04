import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { StatusBadge } from '../components/common/Badge';
import { CarFront, MessageCircle, Eye, Bell, Plus, ChevronRight, ArrowUpRight, CircleAlert, Share2 } from 'lucide-react';

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
  const [performanceError, setPerformanceError] = useState('');
  const [performanceRetry, setPerformanceRetry] = useState(0);
  const [animatedRate, setAnimatedRate] = useState(0);

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

  useEffect(() => {
    if (!dealership.id) return;
    let active = true;
    setPerformanceLoading(true);
    setPerformanceError('');
    setAnimatedRate(0);
    const loadPerformance = async () => {
      try {
        let result = { visits: 0, enquiries: 0 };
        if (isLive) {
          result = await supabaseService.getDealershipPerformance(dealership.id, performancePeriod);
        } else {
          const since = Date.now() - performancePeriod * 24 * 60 * 60 * 1000;
          result = {
            visits: 0,
            enquiries: enquiries.filter(item => new Date(item.createdAt).getTime() >= since).length,
          };
        }
        if (active) setPerformance(result);
      } catch (error: any) {
        if (active) setPerformanceError(error?.message || "Couldn't load performance");
      } finally {
        if (active) setPerformanceLoading(false);
      }
    };
    void loadPerformance();
    return () => { active = false; };
  }, [dealership.id, performancePeriod, performanceRetry, isLive, enquiries]);

  const enquiryRate = performance.visits > 0
    ? Math.round((performance.enquiries / performance.visits) * 100)
    : 0;
  const ringRate = Math.min(100, Math.max(0, enquiryRate));
  useEffect(() => {
    if (performanceLoading || performanceError) return;
    const frame = window.requestAnimationFrame(() => setAnimatedRate(ringRate));
    return () => window.cancelAnimationFrame(frame);
  }, [ringRate, performanceLoading, performanceError]);

  const newLeads = enquiries.filter(e => e.stage === 'new').length;
  const soldCount = vehicles.filter(v => v.status === 'sold').length;
  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const recent = useMemo(() => [...enquiries].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,4), [enquiries]);
  const visits = dealership.storefrontViews || 0;
  const money = (v: number, currency: string) => `${currency === 'ZAR' ? 'R' : '$'}${v.toLocaleString()}`;
  const fullPublicUrl = `${window.location.origin}/showroom/${encodeURIComponent(dealership.slug)}`;
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="dl-workspace relative min-h-full flex flex-col text-[#171717]">
      <main className="flex-1 overflow-y-auto px-4 sm:px-7 pt-5 pb-[110px] w-full max-w-5xl mx-auto">
        <header className="!bg-transparent !backdrop-blur-0 !border-0 flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-xs text-[#777] font-medium">{greeting}</p>
            <button onClick={() => navigate('/app/settings')} className="flex items-center gap-1 text-xl font-extrabold tracking-tight text-left truncate">{dealership.name}<span className="text-[#f47716] text-xs">⌄</span></button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const shareData = { title: dealership.name, text: 'Explore vehicles from ' + dealership.name + '.', url: fullPublicUrl };
                if (typeof navigator !== 'undefined' && navigator.share) {
                  try { await navigator.share(shareData); } catch (error: any) {
                    if (error?.name !== 'AbortError') showToast('Could not share storefront.');
                  }
                  return;
                }
                try {
                  await navigator.clipboard.writeText(fullPublicUrl);
                  showToast('Storefront link copied');
                } catch {
                  showToast('Unable to copy storefront link');
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-3.5 text-sm font-semibold text-white transition-transform active:scale-95"
              aria-label="Share storefront"
            ><Share2 size={18}/><span>Share</span></button>
            <button onClick={() => navigate('/app/notifications')} aria-label="Notifications" className="relative w-11 h-11 rounded-full bg-white border border-[#ececec] flex items-center justify-center"><Bell size={19}/>{newLeads > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#f47716]"/>}</button>
          </div>
        </header>

        <section className="rounded-[24px] bg-white border border-[#ededed] p-4 flex items-center gap-4 mb-4">
          <div className="w-24 h-20 rounded-2xl bg-[#f1f1ef] overflow-hidden shrink-0 flex items-center justify-center">
            {vehicles[0]?.photos?.[0] ? <img src={vehicles[0].photos[0]} alt={vehicles[0].make} className="w-full h-full object-cover"/> : <CarFront size={34} className="text-[#aaa]"/>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#888]">Inventory overview</p>
            <div className="flex items-baseline gap-2"><strong className="text-4xl font-black tracking-tight">{loading ? '—' : vehicles.length}</strong><span className="text-xs text-[#777]">Total cars</span></div>
            <p className="text-[11px] text-[#777] mt-1">{availableCount} available · {soldCount} sold</p>
          </div>
          <button onClick={() => navigate('/app/vehicles')} className="text-[#f47716]"><ArrowUpRight size={20}/></button>
        </section>

        <section className="grid grid-cols-3 gap-2.5 mb-5">
          {[{label:'Store visits',value:visits.toLocaleString(),icon:Eye},{label:'Enquiries',value:enquiries.length.toString(),icon:MessageCircle},{label:'Cars sold',value:soldCount.toString(),icon:CarFront}].map(item => {const Icon=item.icon;return <div key={item.label} className="rounded-2xl bg-white border border-[#ededed] p-3 min-w-0"><Icon size={18} className="text-[#f47716] mb-2"/><p className="text-xl sm:text-2xl font-extrabold tabular-nums truncate">{loading?'—':item.value}</p><p className="text-[10px] sm:text-[11px] text-[#777] mt-1 leading-tight">{item.label}</p></div>;})}
        </section>

        <section className="rounded-[24px] bg-white border border-[#ededed] p-5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight">Performance overview</h2>
              <p className="text-xs text-[#888] mt-1">Based on recorded activity</p>
            </div>
            <label className="relative shrink-0">
              <span className="sr-only">Performance period</span>
              <select
                value={performancePeriod}
                onChange={event => setPerformancePeriod(Number(event.target.value) as 7 | 30 | 90)}
                className="appearance-none rounded-full border border-[#e8e8e8] bg-white pl-3 pr-8 py-2 text-xs font-semibold text-[#333] outline-none focus:border-[#f47716] focus:ring-2 focus:ring-orange-100"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
              <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#777]"/>
            </label>
          </div>

          {performanceError ? (
            <div role="alert" className="mt-5 rounded-2xl bg-[#fafafa] border border-[#eeeeee] p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[#777]">Couldn't load performance</p>
              <button type="button" onClick={() => setPerformanceRetry(value => value + 1)} className="text-xs font-bold text-[#f47716]">Retry</button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-5 min-w-0">
              <div className="w-24 h-24 shrink-0 relative flex items-center justify-center" aria-label={performanceLoading ? 'Loading enquiry rate' : (enquiryRate + '% enquiry rate')}>
                {performanceLoading ? (
                  <div className="w-24 h-24 rounded-full border-[9px] border-[#f0f0f0] animate-pulse"/>
                ) : (
                  <>
                    <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90" aria-hidden="true">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#eeeeee" strokeWidth="8"/>
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f47716" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - animatedRate / 100)} style={{ transition: 'stroke-dashoffset 600ms ease-out' }}/>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <strong className="text-[21px] leading-none font-extrabold tabular-nums">{enquiryRate}%</strong>
                      <span className="text-[9px] text-[#888] mt-1">Enquiry rate</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {performanceLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 w-3/4 rounded bg-[#eeeeee]"/>
                    <div className="h-3 w-full rounded bg-[#f2f2f2]"/>
                    <div className="h-6 w-20 rounded-full bg-[#f2f2f2]"/>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-extrabold leading-snug">Your dealership activity</h3>
                    <p className="text-xs text-[#777] leading-relaxed mt-1">{performance.enquiries.toLocaleString()} enquiries from {performance.visits.toLocaleString()} recorded visits.</p>
                    <span className="inline-flex mt-3 rounded-full bg-[#fff2e9] px-3 py-1.5 text-[10px] font-bold text-[#d9681b]">Last {performancePeriod} days</span>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-extrabold text-sm">Recent leads</h2><button onClick={()=>navigate('/app/enquiries')} className="text-xs font-bold text-[#f47716] flex items-center gap-1">See all <ChevronRight size={14}/></button></div>
          {recent.length ? <div className="bg-white border border-[#ededed] rounded-[20px] divide-y divide-[#f0f0f0]">{recent.map(lead=><button key={lead.id} onClick={()=>navigate('/app/enquiries')} className="w-full p-3 flex items-center gap-3 text-left"><span className="w-9 h-9 rounded-full bg-[#f2f2f0] flex items-center justify-center font-bold text-sm">{lead.buyerName.slice(0,1).toUpperCase()}</span><span className="flex-1 min-w-0"><strong className="block text-xs truncate">{lead.buyerName}</strong><span className="block text-[11px] text-[#888] truncate">{lead.message}</span></span><span className="text-[10px] text-[#999]">{new Date(lead.createdAt).toLocaleDateString()}</span></button>)}</div> : <div className="bg-white border border-dashed border-[#ddd] rounded-[20px] p-5 text-center"><MessageCircle className="mx-auto text-[#bbb] mb-2"/><p className="text-sm font-bold">No enquiries yet</p><p className="text-xs text-[#888] mt-1">New customer enquiries will appear here.</p></div>}
        </section>

        <section className="mb-3">
          <div className="flex items-center justify-between mb-3"><h2 className="font-extrabold text-sm">Garage snapshot</h2><button onClick={()=>navigate('/app/vehicles')} className="text-xs text-[#f47716] font-bold">View garage</button></div>
          {vehicles.slice(0,3).map(vehicle=><button key={vehicle.id} onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="w-full bg-white border border-[#ededed] rounded-2xl p-2.5 mb-2 flex items-center gap-3 text-left"><div className="w-16 h-14 rounded-xl overflow-hidden bg-[#f1f1ef] shrink-0">{vehicle.photos?.[0]&&<img src={vehicle.photos[0]} alt="" className="w-full h-full object-cover"/>}</div><span className="flex-1 min-w-0"><strong className="block text-xs truncate">{vehicle.year} {vehicle.make} {vehicle.model}</strong><span className="text-[11px] text-[#888]">{money(vehicle.price,vehicle.currency)}</span></span><StatusBadge status={vehicle.status} size="sm"/></button>)}
        </section>
        {loadError && <div role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-xs flex gap-2"><CircleAlert size={16}/>{loadError}</div>}
        <button onClick={()=>navigate('/app/vehicles/new')} className="dl-accent-button w-full rounded-full min-h-12 font-extrabold text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-orange-500/15"><Plus size={18}/> Add Vehicle</button>
      </main>
    </div>
  );
};
