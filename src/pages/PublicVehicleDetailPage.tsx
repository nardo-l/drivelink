import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ChevronLeft,ChevronRight,MapPin,Phone,Share2,X,CheckCircle2} from 'lucide-react';
import {useNavigation} from '../context/NavigationContext';
import {supabaseService} from '../services/supabaseService';
import {storageService} from '../services/storage';
import {isSupabaseConfigured} from '../lib/supabase';
import type {Dealership,Vehicle} from '../types';

interface PublicVehicleDetailPageProps{vehicleId:string;slug?:string;}
export const PublicVehicleDetailPage:React.FC<PublicVehicleDetailPageProps>=({vehicleId,slug})=>{
 const {navigate,showToast}=useNavigation();const [dealer,setDealer]=useState<Dealership|null>(null),[vehicle,setVehicle]=useState<Vehicle|null>(null),[loading,setLoading]=useState(true),[photoIndex,setPhotoIndex]=useState(0),[fullscreen,setFullscreen]=useState(false);
 const touch=useRef<number|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{if(isSupabaseConfigured()){const foundDealer=slug?await supabaseService.getDealershipBySlug(slug):null;const foundVehicle=await supabaseService.getVehicleById(vehicleId,true);if(!active)return;if(foundDealer&&foundVehicle&&foundVehicle.dealershipId===foundDealer.id&&foundVehicle.status!=='draft'){setDealer(foundDealer);setVehicle(foundVehicle);}else{setDealer(foundDealer);setVehicle(null);}}else{const localDealer=storageService.getDealership();const localVehicle=storageService.getVehicleById(vehicleId);if(localDealer.slug===slug&&localVehicle?.dealershipId===localDealer.id&&localVehicle.status!=='draft'){setDealer(localDealer);setVehicle(localVehicle);}}}catch{if(active){setDealer(null);setVehicle(null);}}finally{if(active)setLoading(false);}};void load();return()=>{active=false;};},[vehicleId,slug]);
 useEffect(()=>{if(!dealer||!vehicle)return;const title=vehicle.year+' '+vehicle.make+' '+vehicle.model;document.title=title+' | '+dealer.name;const setMeta=(key:string,value:string)=>{let el=document.querySelector('meta[property="'+key+'"]') as HTMLMetaElement|null;if(!el){el=document.createElement('meta');el.setAttribute('property',key);document.head.appendChild(el);}el.content=value;};setMeta('og:title',title+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:vehicle.currency||dealer.currency,maximumFractionDigits:0}).format(vehicle.price));setMeta('og:description','View this vehicle at '+dealer.name);if(vehicle.photos?.[0])setMeta('og:image',vehicle.photos[0]);return()=>{document.title=dealer.name+' | Cars available';};},[dealer,vehicle]);
 if(loading)return <div className="dl-store-loading">Loading vehicle…</div>;
 if(!dealer||!vehicle)return <div className="dl-store-loading"><h1>Vehicle unavailable</h1><p>This vehicle may have been sold or removed.</p><button onClick={()=>navigate('/showroom/'+(slug||''))}>Return to showroom</button></div>;
 const photos=vehicle.photos||[],money=new Intl.NumberFormat('en-US',{style:'currency',currency:vehicle.currency||dealer.currency,maximumFractionDigits:0}).format(vehicle.price);
 const message='Hi, I\'m interested in the '+vehicle.year+' '+vehicle.make+' '+vehicle.model+' listed at '+money+'. Is it still available?';
 const waNumber=(dealer.whatsapp||dealer.phone||'').replace(/\D/g,'');const wa=waNumber?'https://wa.me/'+waNumber+'?text='+encodeURIComponent(message):'';
 const prev=()=>setPhotoIndex(i=>(i-1+photos.length)%photos.length),next=()=>setPhotoIndex(i=>(i+1)%photos.length);
 const share=async()=>{const url=window.location.href;if(navigator.share){try{await navigator.share({title:vehicle.year+' '+vehicle.make+' '+vehicle.model,text:money,url});}catch{}}else{await navigator.clipboard?.writeText(url);showToast('Vehicle link copied');}};
 const specs=[['Year',String(vehicle.year)],['Mileage',vehicle.mileageKm.toLocaleString()+' km'],['Transmission',vehicle.transmission],['Fuel',vehicle.fuel],['Colour',vehicle.colour],['Condition',vehicle.condition]].filter((x):x is [string,string]=>Boolean(x[1]));
 const dealerInitials=dealer.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return <main className="dl-public-showroom dl-public-detail">
  <header className="dl-pd-header"><button onClick={()=>navigate('/showroom/'+dealer.slug)} aria-label="Back to showroom"><ArrowLeft/></button><div className="dl-ps-brand">{dealer.logoUrl?<img src={dealer.logoUrl} alt=""/>:<span>{dealerInitials}</span>}<div><strong>{dealer.name}</strong><small>{[dealer.city,dealer.country].filter(Boolean).join(', ')}</small></div></div><button onClick={share} aria-label="Share vehicle"><Share2/></button></header>
  <section className="dl-pd-gallery" onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(touch.current===null)return;const dx=e.changedTouches[0].clientX-touch.current;if(Math.abs(dx)>45&&photos.length>1)(dx<0?next:prev)();touch.current=null;}}>
   {photos[photoIndex]?<img src={photos[photoIndex]} alt={vehicle.year+' '+vehicle.make+' '+vehicle.model} onClick={()=>setFullscreen(true)}/>:<div className="dl-pd-no-photo"><span>Vehicle photo</span></div>}
   {photos.length>1&&<><button className="dl-pd-prev" onClick={prev} aria-label="Previous photo"><ChevronLeft/></button><button className="dl-pd-next" onClick={next} aria-label="Next photo"><ChevronRight/></button></>}<span className="dl-pd-counter">{photos.length?photoIndex+1:0}/{photos.length}</span>
  </section>
  <section className="dl-pd-content">
   <div className="dl-pd-title"><div><p>{vehicle.year} · {vehicle.mileageKm.toLocaleString()} km</p><h1>{vehicle.make} {vehicle.model}</h1></div><strong>{money}</strong></div>
   <div className="dl-pd-meta"><span className={'dl-pd-status '+vehicle.status}>{vehicle.status==='available'?'Available':vehicle.status==='reserved'?'Reserved':vehicle.status==='sold'?'Sold':'Unavailable'}</span><span><MapPin size={13}/>{[dealer.city,dealer.country].filter(Boolean).join(', ')}</span></div>
   <section className="dl-pd-section"><h2>Vehicle details</h2><div className="dl-pd-specs">{specs.map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div></section>
   {vehicle.description&&<section className="dl-pd-section"><h2>Description</h2><p>{vehicle.description}</p></section>}
   {!!vehicle.features?.length&&<section className="dl-pd-section"><h2>Features</h2><div className="dl-pd-features">{vehicle.features.map(x=><span key={x}><CheckCircle2 size={13}/>{x}</span>)}</div></section>}
   <button className="dl-pd-dealer" onClick={()=>navigate('/showroom/'+dealer.slug)}>{dealer.logoUrl?<img src={dealer.logoUrl} alt=""/>:<span>{dealerInitials}</span>}<div><strong>{dealer.name}</strong><small>View showroom</small></div><ChevronRight/></button>
  </section>
  <div className="dl-pd-actions">{wa&&<a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}{dealer.phone&&<a className="secondary" href={'tel:'+dealer.phone}><Phone size={16}/>Call</a>}</div>
  {fullscreen&&<div className="dl-pd-fullscreen" onClick={()=>setFullscreen(false)}><button onClick={()=>setFullscreen(false)} aria-label="Close photo"><X/></button>{photos[photoIndex]&&<img src={photos[photoIndex]} alt="Fullscreen vehicle"/>}{photos.length>1&&<><button className="prev" onClick={e=>{e.stopPropagation();prev();}}><ChevronLeft/></button><button className="next" onClick={e=>{e.stopPropagation();next();}}><ChevronRight/></button></>}</div>}
 </main>;
};
