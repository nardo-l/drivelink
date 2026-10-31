import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, CarFront, MoreVertical, Pencil, Trash2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Vehicle, VehicleStatus } from '../types';
import { BottomNav } from '../components/layout/BottomNav';
import { StatusBadge } from '../components/common/Badge';

const filters: {id: VehicleStatus|'all';label:string}[] = [
  {id:'all',label:'All'},{id:'available',label:'Available'},{id:'reserved',label:'Reserved'},{id:'sold',label:'Sold'}
];

export const VehiclesListPage: React.FC = () => {
  const {navigate,showToast}=useNavigation();
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [filter,setFilter]=useState<VehicleStatus|'all'>('all');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [menuId,setMenuId]=useState<string|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<Vehicle|null>(null);

  const load=async()=>{setLoading(true);setError('');try{setVehicles(await storageService.getVehiclesAsync());}catch(e:any){setVehicles([]);setError(e?.message||'Could not load your garage.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const counts=useMemo(()=>({all:vehicles.length,available:vehicles.filter(v=>v.status==='available').length,reserved:vehicles.filter(v=>v.status==='reserved').length,sold:vehicles.filter(v=>v.status==='sold').length}),[vehicles]);
  const visible=useMemo(()=>vehicles.filter(v=>(filter==='all'||v.status===filter)&&`${v.year} ${v.make} ${v.model} ${v.colour||''}`.toLowerCase().includes(search.toLowerCase().trim())),[vehicles,filter,search]);
  const updateStatus=async(vehicle:Vehicle,status:VehicleStatus)=>{try{await storageService.updateVehicleAsync(vehicle.id,{status});setVehicles(items=>items.map(v=>v.id===vehicle.id?{...v,status}:v));showToast(`Vehicle marked ${status}`);}catch(e:any){showToast(e?.message||'Could not update vehicle status.');}};
  const remove=async()=>{if(!deleteTarget)return;try{await storageService.deleteVehicleAsync(deleteTarget.id);setVehicles(items=>items.filter(v=>v.id!==deleteTarget.id));showToast('Vehicle deleted');}catch(e:any){showToast(e?.message||'Could not delete vehicle.');}finally{setDeleteTarget(null);}};
  const price=(v:Vehicle)=>`${v.currency==='ZAR'?'R':'$'}${v.price.toLocaleString()}`;

  return <div className="dl-workspace min-h-full flex flex-col">
    <header className="sticky top-0 z-20 !bg-white/95 border-b border-[#eee] px-4 sm:px-7 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-[.16em] text-[#999] font-extrabold">Inventory management</p><h1 className="text-2xl font-black mt-1">Garage</h1><p className="text-xs text-[#888] mt-0.5">Your vehicle inventory</p></div>
        <button onClick={()=>navigate('/app/vehicles/new')} aria-label="Add vehicle" className="w-11 h-11 rounded-full dl-accent-button flex items-center justify-center shadow-md shadow-orange-500/20"><Plus size={22}/></button>
      </div>
    </header>
    <main className="flex-1 px-4 sm:px-7 py-4 pb-28 max-w-5xl w-full mx-auto">
      <div className="relative mb-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vehicles..." className="w-full !rounded-full !pl-11 !pr-4 !bg-white !text-sm"/></div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
        {filters.map(tab=><button key={tab.id} onClick={()=>setFilter(tab.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter===tab.id?'bg-[#171717] text-white':'bg-white border border-[#e9e9e9] text-[#777]'}`}>{tab.label} <span className={filter===tab.id?'text-white/65':'text-[#aaa]'}>({counts[tab.id]})</span></button>)}
      </div>
      <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold text-[#777]">{visible.length} vehicles</p><button onClick={load} disabled={loading} className="text-xs font-semibold text-[#888] flex items-center gap-1"><RefreshCw size={13} className={loading?'animate-spin':''}/> Refresh</button></div>
      {error&&<div role="alert" className="bg-red-50 text-red-700 rounded-xl p-3 text-xs mb-3">{error}<button onClick={load} className="ml-2 underline font-bold">Retry</button></div>}
      {loading?<div className="space-y-3">{[1,2,3].map(n=><div key={n} className="h-36 rounded-2xl bg-white animate-pulse border border-[#eee]"/>)}</div>:visible.length===0?<div className="rounded-3xl bg-white border border-dashed border-[#ddd] text-center px-6 py-14"><CarFront className="mx-auto text-[#bbb]" size={30}/><h2 className="font-extrabold mt-3">{vehicles.length?'No matching vehicles':'Your garage is empty'}</h2><p className="text-xs text-[#888] mt-1">{vehicles.length?'Try another search or filter.':'Add your first vehicle to start building your inventory.'}</p><button onClick={()=>navigate('/app/vehicles/new')} className="dl-accent-button rounded-full px-5 py-3 text-xs font-extrabold mt-4"><Plus size={14} className="inline mr-1"/> Add vehicle</button></div>:<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visible.map(vehicle=><article key={vehicle.id} className="relative rounded-[22px] bg-white border border-[#ececec] p-3 flex gap-3 min-w-0">
          <button onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="w-[116px] sm:w-36 h-[112px] rounded-2xl overflow-hidden bg-[#f0f0ee] shrink-0">{vehicle.photos?.[0]?<img src={vehicle.photos[0]} alt={`${vehicle.make} ${vehicle.model}`} className="w-full h-full object-cover"/>:<CarFront className="m-auto text-[#bbb]"/>}</button>
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-start justify-between gap-1"><span className="text-[10px] font-bold text-[#888]">{vehicle.year} · {vehicle.mileageKm.toLocaleString()} km</span><StatusBadge status={vehicle.status} size="sm"/></div>
            <button onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="block text-left font-extrabold text-sm leading-snug mt-1 truncate">{vehicle.make} {vehicle.model}</button>
            <p className="text-lg font-black tracking-tight mt-1">{price(vehicle)}</p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-[#999]"><span>{vehicle.transmission}</span><span>·</span><span>{vehicle.fuel}</span></div>
            <div className="flex items-center gap-1.5 mt-2">
              <button onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="text-[10px] font-bold text-[#f47716]">View listing</button>
              <span className="text-[#ddd]">·</span>
              <button onClick={()=>navigate(`/app/vehicles/${vehicle.id}`)} className="text-[10px] font-bold text-[#777]">Edit</button>
            </div>
          </div>
          <div className="relative">
            <button onClick={()=>setMenuId(menuId===vehicle.id?null:vehicle.id)} aria-label="Vehicle actions" className="w-8 h-8 rounded-full hover:bg-[#f5f5f5] flex items-center justify-center"><MoreVertical size={17}/></button>
            {menuId===vehicle.id&&<div className="absolute right-0 top-9 z-20 w-44 bg-white border border-[#e8e8e8] rounded-xl shadow-xl p-1">
              <button onClick={()=>{setMenuId(null);navigate(`/app/vehicles/${vehicle.id}`);}} className="w-full text-left p-2.5 text-xs rounded-lg hover:bg-[#f6f6f6]"><Pencil size={13} className="inline mr-2"/>Edit listing</button>
              {(['available','reserved','sold'] as VehicleStatus[]).filter(s=>s!==vehicle.status).map(s=><button key={s} onClick={()=>{setMenuId(null);void updateStatus(vehicle,s);}} className="w-full text-left p-2.5 text-xs rounded-lg hover:bg-[#f6f6f6]">Mark {s}</button>)}
              <button onClick={()=>{setMenuId(null);setDeleteTarget(vehicle);}} className="w-full text-left p-2.5 text-xs text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13} className="inline mr-2"/>Delete vehicle</button>
            </div>}
          </div>
        </article>)}
      </div>}
    </main>
    {deleteTarget&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white p-5"><h2 className="font-extrabold text-lg">Delete this vehicle?</h2><p className="text-xs text-[#777] mt-2">This will remove {deleteTarget.year} {deleteTarget.make} {deleteTarget.model} from your garage.</p><div className="flex gap-2 mt-5"><button onClick={()=>setDeleteTarget(null)} className="flex-1 rounded-full border border-[#ddd] py-3 text-xs font-bold">Cancel</button><button onClick={()=>void remove()} className="flex-1 rounded-full bg-red-600 text-white py-3 text-xs font-bold">Delete</button></div></div></div>}
    <BottomNav/>
  </div>;
};
