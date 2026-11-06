import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ChevronLeft,ChevronRight,MapPin,Phone,Share2,X,CheckCircle2,CalendarDays,Gauge,Settings2,Fuel,Palette,BadgeCheck,MessageCircle} from 'lucide-react';
import {useNavigation} from '../context/NavigationContext';
import {supabaseService} from '../services/supabaseService';
import {storageService} from '../services/storage';
import {isSupabaseConfigured} from '../lib/supabase';
import type {Dealership,Vehicle} from '../types';
import './PublicShowroomPage.css';

interface PublicVehicleDetailPageProps{vehicleId:string;slug?:string;}
export const PublicVehicleDetailPage:React.FC<PublicVehicleDetailPageProps>=({vehicleId,slug})=>{
 const {navigate,showToast}=useNavigation();
 const [dealer,setDealer]=useState<Dealership|null>(null),[vehicle,setVehicle]=useState<Vehicle|null>(null),[loading,setLoading]=useState(true);
 const [photoIndex,setPhotoIndex]=useState(0),[fullscreen,setFullscreen]=useState(false),[expanded,setExpanded]=useState(false);
 const touch=useRef<number|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{if(isSupabaseConfigured()){const foundDealer=slug?await supabaseService.getDealershipBySlug(slug):null;const foundVehicle=await supabaseService.getVehicleById(vehicleId,true);if(!active)return;if(foundDealer&&foundVehicle&&foundVehicle.dealershipId===foundDealer.id&&foundVehicle.status!=='draft'){setDealer(foundDealer);setVehicle(foundVehicle);}else{setDealer(foundDealer);setVehicle(null);}}else{const localDealer=storageService.getDealership();const localVehicle=storageService.getVehicleById(vehicleId);if(localDealer.slug===slug&&localVehicle?.dealershipId===localDealer.id&&localVehicle.status!=='draft'){setDealer(localDealer);setVehicle(localVehicle);}}}catch{if(active){setDealer(null);setVehicle(null);}}finally{if(active)setLoading(false);}};void load();return()=>{active=false;};},[vehicleId,slug]);
 useEffect(()=>{if(!dealer||!vehicle)return;const title=vehicle.year+' '+vehicle.make+' '+vehicle.model;document.title=title+' | '+dealer.name;const setMeta=(key:string,value:string)=>{let el=document.querySelector('meta[property="'+key+'"]') as HTMLMetaElement|null;if(!el){el=document.createElement('meta');el.setAttribute('property',key);document.head.appendChild(el);}el.content=value;};setMeta('og:title',title+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:vehicle.currency||dealer.currency,maximumFractionDigits:0}).format(vehicle.price));setMeta('og:description','View this vehicle at '+dealer.name);if(vehicle.photos?.[0])setMeta('og:image',vehicle.photos[0]);return()=>{document.title=dealer.name+' | Cars available';};},[dealer,vehicle]);
 if(loading)return <div className="dl-store-loading">Loading vehicle…</div>;
 if(!dealer||!vehicle)return <div className="dl-store-loading"><h1>Vehicle unavailable</h1><p>This vehicle may have been sold or removed.</p><button onClick={()=>navigate('/'+(slug||''))}>Return to showroom</button></div>;
 const photos=vehicle.photos||[],money=new Intl.NumberFormat('en-US',{style:'currency',currency:vehicle.currency||dealer.currency,maximumFractionDigits:0}).format(vehicle.price);
 const title=[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ');
 const message="Hi, I'm interested in the "+title+' listed at '+money+'. Is it still available?';
 const waNumber=(dealer.whatsapp||dealer.phone||'').replace(/\\D/g,'');
 const wa=waNumber?'https://wa.me/'+waNumber+'?text='+encodeURIComponent(message):'';
 const prev=()=>setPhotoIndex(i=>(i-1+photos.length)%photos.length),next=()=>setPhotoIndex(i=>(i+1)%photos.length);
 const share=async()=>{const url=window.location.href;if(navigator.share){try{await navigator.share({title,text:money,url});}catch{}}else{await navigator.clipboard?.writeText(url);showToast('Vehicle link copied');}};
 const dealerInitials=dealer.name.split(/\\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const specs=[
  {label:'Year',value:vehicle.year?String(vehicle.year):'',Icon:CalendarDays},
  {label:'Mileage',value:vehicle.mileageKm!=null&&vehicle.mileageKm!==''?Number(vehicle.mileageKm).toLocaleString()+' km':'',Icon:Gauge},
  {label:'Transmission',value:vehicle.transmission||'',Icon:Settings2},
  {label:'Fuel',value:vehicle.fuel||'',Icon:Fuel},
  {label:'Colour',value:vehicle.colour||'',Icon:Palette},
  {label:'Condition',value:vehicle.condition||'',Icon:BadgeCheck}
 ].filter(x=>Boolean(x.value));
 const sold=vehicle.status==='sold';
 return <main className="dl-public-showroom dl-public-detail">
  <section className="dl-pd-gallery" onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(touch.current===null)return;const dx=e.changedTouches[0].clientX-touch.current;if(Math.abs(dx)>45&&photos.length>1)(dx<0?next:prev)();touch.current=null;}}>
   {photos[photoIndex]?<img src={photos[photoIndex]} alt={title+' photo '+(photoIndex+1)} onClick={()=>setFullscreen(true)} draggable={false}/>:<div className="dl-pd-no-photo"><span>Vehicle photo unavailable</span></div>}
   <div className="dl-pd-top-actions"><button onClick={()=>navigate('/'+dealer.slug)} aria-label="Back to showroom"><ArrowLeft/></button><button onClick={share} aria-label="Share vehicle"><Share2/></button></div>
   {photos.length>1&&<><button className="dl-pd-prev" onClick={prev} aria-label="Previous photo"><ChevronLeft/></button><button className="dl-pd-next" onClick={next} aria-label="Next photo"><ChevronRight/></button></>}
   <span className="dl-pd-counter">{photos.length?photoIndex+1:0}/{photos.length}</span>
  </section>
  <section className="dl-pd-content">
   <div className="dl-pd-heading">
    <h1>{title}</h1>
    <strong className="dl-pd-price">{money}</strong>
    <span className={'dl-pd-status '+vehicle.status}>{sold?'Sold':vehicle.status==='reserved'?'Reserved':vehicle.status==='available'?'Available':'Unavailable'}</span>
   </div>
   {!!specs.length&&<section className="dl-pd-section"><h2>Vehicle overview</h2><div className="dl-pd-specs">{specs.map(({label,value,Icon})=><div key={label}><Icon size={16}/><small>{label}</small><strong>{value}</strong></div>)}</div></section>}
   {vehicle.description&&<section className="dl-pd-section"><h2>About this vehicle</h2><p className={'dl-pd-description'+(expanded?' expanded':'')}>{vehicle.description}</p>{vehicle.description.length>150&&<button className="dl-pd-readmore" onClick={()=>setExpanded(v=>!v)}>{expanded?'Read less':'Read more'}</button>}</section>}
   {!!vehicle.features?.length&&<section className="dl-pd-section"><h2>Features</h2><div className="dl-pd-features">{vehicle.features.map(x=><span key={x}>{x}</span>)}</div></section>}
   <section className="dl-pd-dealer">
    {dealer.logoUrl?<img src={dealer.logoUrl} alt={dealer.name+' logo'}/>:<span className="dl-pd-dealer-initials">{dealerInitials}</span>}
    <div className="dl-pd-dealer-info"><strong>{dealer.name}</strong><small><MapPin size={12}/>{[dealer.city,dealer.country].filter(Boolean).join(', ')||'Location not specified'}</small></div>
    <button onClick={()=>navigate('/'+dealer.slug)}>View showroom <ChevronRight size={15}/></button>
   </section>
  </section>
  <div className="dl-pd-actions">
   {sold?<button className="dl-pd-similar" onClick={()=>navigate('/'+dealer.slug)}>See similar cars</button>:<>
    {wa&&<a className="dl-pd-whatsapp" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={19}/>WhatsApp</a>}
    {dealer.phone&&<a className="dl-pd-call" href={'tel:'+dealer.phone} aria-label="Call dealer"><Phone size={18}/></a>}
   </>}
  </div>
  {fullscreen&&<div className="dl-pd-fullscreen" onClick={()=>setFullscreen(false)}><button onClick={()=>setFullscreen(false)} aria-label="Close photo"><X/></button><span className="dl-pd-fullscreen-counter">{photos.length?photoIndex+1:0}/{photos.length}</span>{photos[photoIndex]&&<img src={photos[photoIndex]} alt="Fullscreen vehicle"/>}{photos.length>1&&<><button className="prev" onClick={e=>{e.stopPropagation();prev();}} aria-label="Previous photo"><ChevronLeft/></button><button className="next" onClick={e=>{e.stopPropagation();next();}} aria-label="Next photo"><ChevronRight/></button></>}</div>}
 </main>;
};
