import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { StatusBadge } from '../components/common/Badge';
import { ShareModal } from '../components/common/ShareModal';
import { CarFront, MessageCircle, Eye, Bell, Plus, ChevronRight, RefreshCw, ArrowUpRight, CircleAlert } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [dealership, setDealership] = useState(() => storageService.getDealership());
  const [vehicles, setVehicles] = useState(() => storageService.getVehicles());
  const [enquiries, setEnquiries] = useState(() => storageService.getEnquiries());
  const [loading, setLoading] = useState(isSupabaseConfigured() && !storageService.isDemoModeActive());
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState('7d');
  const [shareOpen, setShareOpen] = useState(false);
  const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();

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

  const newLeads = enquiries.filter(e => e.stage === 'new').length;
  const soldCount = vehicles.filter(v => v.status === 'sold').length;
  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const recent = useMemo(() => [...enquiries].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,4), [enquiries]);
  const visits = dealership.storefrontViews || 0;
  const rate = visits > 0 ? Math.min(100, Math.round((enquiries.length / visits) * 100)) : 0;
  const money = (v: number, currency: string) => `${currency === 'ZAR' ? 'R' : '$'}${v.toLocaleString()}`;
  const fullPublicUrl = `${window.location.origin}/#/showroom/${dealership.slug}`;
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="dl-workspace relative min-h-full flex flex-col text-[#171717]">
      <main className="flex-1 overflow-y-auto px-4 sm:px-7 pt-5 pb-28 w-full max-w-5xl mx-auto">
        <header className="!bg-transparent !backdrop-blur-0 !border-0 flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-xs text-[#777] font-medium">{greeting}</p>
            <button onClick={() => navigate('/app/settings')} className="flex items-center gap-1 text-xl font-extrabold tracking-tight text-left truncate">{dealership.name}<span className="text-[#f47716] text-xs">⌄</span></button>
          </div>
          <button onClick={() => navigate('/app/notifications')} aria-label="Notifications" className="relative w-11 h-11 rounded-full bg-white border border-[#ececec] flex items-center justify-center"><Bell size={19}/>{newLeads > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#f47716]"/>}</button>
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

        <section className="bg-white border border-[#ededed] rounded-[22px] p-4 mb-5">
          <div className="flex items-center justify-between mb-4"><div><h2 className="font-extrabold text-sm">Performance overview</h2><p className="text-[11px] text-[#888] mt-0.5">Based on recorded activity</p></div><select aria-label="Performance period" value={period} onChange={e=>setPeriod(e.target.value)} className="!min-h-8 !rounded-full !px-3 !text-xs !w-auto"><option value="7d">7 days</option><option value="30d">30 days</option></select></div>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 shrink-0 rounded-full flex items-center justify-center" style={{background:`conic-gradient(#f47716 ${rate*3.6}deg,#eeeeec 0deg)`}}><div className="w-[76px] h-[76px] rounded-full bg-white flex flex-col items-center justify-center"><strong className="text-2xl">{visits ? `${rate}%` : '—'}</strong><span className="text-[9px] text-[#888]">Enquiry rate</span></div></div>
            <div className="flex-1 min-w-0"><p className="text-xs font-bold">Your dealership activity</p><p className="text-[11px] text-[#888] leading-relaxed mt-1">{visits ? `${enquiries.length} enquiries from ${visits.toLocaleString()} recorded visits.` : 'Visit and enquiry trends will appear here as your showroom receives activity.'}</p><div className="mt-3 flex gap-2"><span className="text-[10px] rounded-full bg-[#fff1e7] text-[#d95d08] px-2.5 py-1 font-bold">{period === '7d' ? 'Last 7 days' : 'Last 30 days'}</span></div></div>
          </div>
        </section>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-extrabold text-sm">Recent leads</h2><button onClick={()=>navigate('/app/enquiries')} className="text-xs font-bold text-[#f47716] flex items-center gap-1">See all <ChevronRight size={14}/></button></div>
          {recent.length ? <div className="bg-white border border-[#ededed] rounded-[20px] divide-y divide-[#f0f0f0]">{recent.map(lead=><button key={lead.id} onClick={()=>navigate('/app/enquiries')} className="w-full p-3 flex items-center gap-3 text-left"><span className="w-9 h-9 rounded-full bg-[#f2f2f0] flex items-center justify-center font-bold text-sm">{lead.buyerName.slice(0,1).toUpperCase()}</span><span className="flex-1 min-w-0"><strong className="block text-xs truncate">{lead.buyerName}</strong><span className="block text-[11px] text-[#888] truncate">{lead.message}</span></span><span className="text-[10px] text-[#999]">{new Date(lead.createdAt).toLocaleDateString()}</span></button>)}</div> : <div className="bg-white border border-dashed border-[#ddd] rounded-[20px] p-5 text-center"><MessageCircle className="mx-auto text-[#bbb] mb-2"/><p className="text-sm font-bold">No enquiries yet</p><p className="text-xs text-[#888] mt-1">New customer enquiries will appear here.</p></div>}
        </section>

        <section className="mb-3">
          <div className="flex items-center justify-between mb-3"><h2 className="font-extrabold text-sm">Garage snapshot</h2><button onClick={()=>navigate('/app/vehicles')} className="text-xs text-[#f47716] font-bold">View garage</button></div>
          {vehicles.slice(0,3).map(vehicle=><button key={vehicle.id} onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="w-full bg-white border border-[#ededed] rounded-2xl p-2.5 mb-2 flex items-center gap-3 text-left"><div className="w-16 h-14 rounded-xl overflow-hidden bg-[#f1f1ef] shrink-0">{vehicle.photos?.[0]&&<img src={vehicle.photos[0]} alt="" className="w-full h-full object-cover"/>}</div><span className="flex-1 min-w-0"><strong className="block text-xs truncate">{vehicle.year} {vehicle.make} {vehicle.model}</strong><span className="text-[11px] text-[#888]">{money(vehicle.price,vehicle.currency)}</span></span><StatusBadge status={vehicle.status} size="sm"/></button>)}
        </section>
        {loadError && <div role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-xs flex gap-2"><CircleAlert size={16}/>{loadError}<button onClick={load} className="ml-auto underline">Retry</button></div>}
        <button onClick={()=>navigate('/app/vehicles/new')} className="dl-accent-button w-full rounded-full min-h-12 font-extrabold text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-orange-500/15"><Plus size={18}/> Add Vehicle</button>
        <button onClick={load} disabled={loading} className="w-full text-center text-[11px] text-[#888] py-3 flex justify-center items-center gap-1"><RefreshCw size={12} className={loading?'animate-spin':''}/> Refresh data</button>
      </main>
      <BottomNav/>
      <ShareModal isOpen={shareOpen} onClose={()=>setShareOpen(false)} title={dealership.name} dealershipId={dealership.id} url={fullPublicUrl} description={`Explore vehicles from ${dealership.name}.`}/>
    </div>
  );
};
