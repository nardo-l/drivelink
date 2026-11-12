import { name, supportWhatsApp } from '../config/brand';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
 ArrowLeft,Building2,Store,Image,UserRound,Phone,MapPin,Clock3,CreditCard,Bell,Headset,
 FileText,Shield,LogOut,Trash2,ChevronRight,Copy,Check,Upload,Loader2,MessageCircle,
 Globe,Mail,X,CheckCircle2,AlertTriangle,ExternalLink,Smartphone,Sparkles
} from 'lucide-react';
import {useNavigation} from '../context/NavigationContext';
import {storageService} from '../services/storage';
import {supabaseService} from '../services/supabaseService';
import {notificationService} from '../services/notificationService';
import {isSupabaseConfigured, supabase} from '../lib/supabase';
import {planService} from '../services/planService';
import type {Dealership, StorefrontTemplate, Vehicle} from '../types';
import { TemplatePickerSheet } from '../components/dashboard/TemplatePickerSheet';
import './SettingsPage.css';
import { usePwaInstall } from '../context/PwaInstallContext';

type SheetKey='profile'|'branding'|'name'|'slug'|'contact'|'location'|'hours'|'terms'|'privacy'|'logout'|'delete'|null;
type DealerDraft=Pick<Dealership,'name'|'city'|'address'|'phone'|'whatsapp'>;

const APP_VERSION='0.0.0';

export const SettingsPage:React.FC=()=>{
 const {navigate,showToast}=useNavigation();
 const {openInstall,isInstalled,canInstall,isIos}=usePwaInstall();
 const [dealer,setDealer]=useState<Dealership>(()=>storageService.getDealership());
 const [sheet,setSheet]=useState<SheetKey>(null);
 const [draft,setDraft]=useState<DealerDraft>(()=>({name:dealer.name,city:dealer.city,address:dealer.address||'',phone:dealer.phone,whatsapp:dealer.whatsapp}));
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState<'logo'|'banner'|null>(null);
 const [uploadError,setUploadError]=useState('');
 const [pushEnabled,setPushEnabled]=useState(false);
 const [pushBusy,setPushBusy]=useState(false);
 const [permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'default':Notification.permission);
 const [planStatus,setPlanStatus]=useState('Checking plan…');
 const [deleteText,setDeleteText]=useState('');
 const [copied,setCopied]=useState(false);
 const [slugDraft,setSlugDraft]=useState(dealer.slug);
 const [slugAvailability,setSlugAvailability]=useState<'idle'|'checking'|'available'|'taken'>('idle');
 const logoInput=useRef<HTMLInputElement>(null),bannerInput=useRef<HTMLInputElement>(null);
 const initials=useMemo(()=>dealer.name.trim().split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'DL',[dealer.name]);
 const showroomUrl=typeof window!=='undefined'?`${window.location.origin}/${encodeURIComponent(dealer.slug)}`:'';
 const [showTemplatePicker, setShowTemplatePicker] = useState(false);
 const [vehicles, setVehicles] = useState<Vehicle[]>([]);
 const templateLabel = useMemo(() => {
   if (dealer.template === 'prestige') return 'Prestige (Cinematic Dark)';
   if (dealer.template === 'minimalist') return 'Minimalist (Spacious Light)';
   return 'Classic (Default)';
 }, [dealer.template]);

 useEffect(()=>{let live=true;(async()=>{try{const [latest, vList]=await Promise.all([storageService.getDealershipAsync(), storageService.getVehiclesAsync().catch(()=>[])]);if(live){setDealer(latest);setVehicles(vList);setDraft({name:latest.name,city:latest.city,address:latest.address||'',phone:latest.phone,whatsapp:latest.whatsapp});}}catch(e){console.warn('Settings profile refresh failed',e);}})();return()=>{live=false;};},[]);
 useEffect(()=>{let active=true;Promise.all([notificationService.isPushEnabled(),notificationService.getPreferences(dealer.id)]).then(([subscribed,prefs])=>{if(active)setPushEnabled(Boolean(subscribed&&prefs.push_enabled));}).catch(()=>{if(active)setPushEnabled(false);});planService.getMyPlan().then(snapshot=>setPlanStatus(snapshot.plan==='pro'?(snapshot.subscription_status==='active'?'Lotlé Pro':'Pro trial'):'Free plan')).catch(()=>setPlanStatus('Plan details unavailable'));return()=>{active=false;};},[dealer.id]);

 const saveProfile=async(patch:Partial<DealerDraft>)=>{
  setSaving(true);
  try{const updated=await storageService.updateDealershipAsync(patch);setDealer(updated);setDraft({name:updated.name,city:updated.city,address:updated.address||'',phone:updated.phone,whatsapp:updated.whatsapp});setSheet(null);showToast('Saved');}
  catch(error){showToast(error instanceof Error?error.message:'Could not save changes. Your edits are still here.');}
  finally{setSaving(false);}
 };
 const saveSheet=async()=>{if(sheet==='profile')return saveProfile(draft);if(sheet==='name')return saveProfile({name:draft.name});if(sheet==='contact')return saveProfile({phone:draft.phone,whatsapp:draft.whatsapp});if(sheet==='location')return saveProfile({city:draft.city,address:draft.address});};
 useEffect(()=>{if(sheet!=='slug')return;const clean=slugDraft.toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');if(clean.length<3){setSlugAvailability('idle');return;}setSlugAvailability('checking');let active=true;const timer=window.setTimeout(()=>{supabaseService.checkHandleAvailability(clean).then(ok=>{if(active)setSlugAvailability(ok?'available':'taken');}).catch(()=>{if(active)setSlugAvailability('taken');});},300);return()=>{active=false;window.clearTimeout(timer);};},[slugDraft,sheet]);
 const saveSlug=async()=>{if(slugAvailability!=='available')return;setSaving(true);try{const updated=await supabaseService.updateDealershipSlug(slugDraft);setDealer(updated);storageService.saveDealership(updated);setSheet(null);showToast('Showroom link updated');}catch(error){showToast(error instanceof Error?error.message:'Could not update your showroom link.');}finally{setSaving(false);}};
 const copyLink=async()=>{try{await navigator.clipboard.writeText(showroomUrl);setCopied(true);showToast('Showroom link copied');window.setTimeout(()=>setCopied(false),1800);}catch{showToast('Could not copy the showroom link');}};
 const togglePush=async()=>{if(pushBusy)return;setPushBusy(true);try{if(pushEnabled){await notificationService.disablePush(dealer.id);setPushEnabled(false);showToast('Saved');}else{await notificationService.enablePush(dealer.id,true);setPushEnabled(true);setPermission(typeof Notification==='undefined'?'default':Notification.permission);showToast('Saved');}}catch(error){setPermission(typeof Notification==='undefined'?'default':Notification.permission);showToast(error instanceof Error?error.message:'Could not update notifications.');}finally{setPushBusy(false);}};
 const uploadAsset=async(kind:'logo'|'banner',file?:File)=>{
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){showToast('Choose a JPG, PNG or WebP image.');return;}
  if(file.size>10*1024*1024){showToast('Image must be smaller than 10 MB.');return;}
  setUploading(kind);setUploadError('');
  try{const url=await supabaseService.uploadShowroomBrandingAsset(file,kind);const updated={...dealer,...(kind==='logo'?{logoUrl:url}:{coverUrl:url})};setDealer(updated);storageService.saveDealership(updated);showToast('Saved');setSheet(null);}
  catch(error){const message=error instanceof Error?error.message:'Upload failed. Your previous image is unchanged.';setUploadError(message);showToast(message.replace(/\s*\[[A-Z0-9_]+\]$/,''));}
  finally{setUploading(null);}
 };
 const signOut=async()=>{setSaving(true);try{if(isSupabaseConfigured())await supabaseService.signOut();await storageService.clearAppUserData();window.location.assign('/login');}catch(error){showToast(error instanceof Error?error.message:'Could not sign out.');setSaving(false);setSheet(null);}};
 const requestDeletion=()=>{if(deleteText.trim()!=='DELETE')return;const msg=encodeURIComponent(`Hi ${name} Support, I would like to request deletion of my account and dealership data. Dealership: '+dealer.name+'. Please guide me through the verification process.`);window.open('https://wa.me/'+supportWhatsApp+'?text='+msg,'_blank','noopener,noreferrer');setSheet(null);setDeleteText('');};
 const Row=({icon:Icon,label,value,onClick,danger=false}:any)=><button type="button" className={'dl-settings-row'+(danger?' is-danger':'')} onClick={onClick}><span className="dl-settings-row-icon"><Icon size={17}/></span><span className="dl-settings-row-copy"><strong>{label}</strong>{value&&<small>{value}</small>}</span><ChevronRight className="dl-settings-chevron" size={17}/></button>;
 const openSheet=(key:SheetKey)=>{setDraft({name:dealer.name,city:dealer.city,address:dealer.address||'',phone:dealer.phone,whatsapp:dealer.whatsapp});setSlugDraft(dealer.slug);setSlugAvailability('idle');setSheet(key);};
 return <div className="dl-settings-page">
  <header className="dl-settings-header"><button type="button" onClick={()=>navigate('/app/more')} aria-label="Back" className="dl-settings-back"><ArrowLeft size={18}/></button><h1>Settings</h1></header>
  <main className="dl-settings-main">
   <section className="dl-settings-profile">
    <div className="dl-settings-profile-top">
     {dealer.logoUrl?<img className="dl-settings-logo" src={dealer.logoUrl} alt={dealer.name+' logo'}/>:<span className="dl-settings-logo dl-settings-initials">{initials}</span>}
     <div className="dl-settings-profile-info"><strong>{dealer.name}</strong><small>{dealer.city||'Location not set'}{dealer.country?', '+dealer.country:''}</small></div>
     <button type="button" onClick={()=>openSheet('profile')} className="dl-settings-edit">Edit</button>
    </div>
    <button type="button" className="dl-settings-copy" onClick={()=>openSheet('slug')}>Edit showroom link</button>
    <button type="button" className="dl-settings-copy" onClick={copyLink}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied':'Copy showroom link'}</button>
   </section>

   <section className="dl-settings-group"><h2>Showroom</h2>
    <Row icon={Sparkles} label="Showroom template" value={templateLabel} onClick={()=>setShowTemplatePicker(true)}/>
    <Row icon={Image} label="Dealership branding" value="Update your logo and showroom banner" onClick={()=>openSheet('branding')}/>
    <Row icon={Store} label="Dealership name" value={dealer.name} onClick={()=>openSheet('name')}/>
    <Row icon={Phone} label="Phone and WhatsApp number" value={dealer.phone||dealer.whatsapp||'Add contact numbers'} onClick={()=>openSheet('contact')}/>
    <Row icon={MapPin} label="Location" value={[dealer.city,dealer.address].filter(Boolean).join(' · ')||'Add dealership location'} onClick={()=>openSheet('location')}/>
    <Row icon={Clock3} label="Opening hours" value="Not set" onClick={()=>openSheet('hours')}/>
   </section>

   <section className="dl-settings-group"><h2>Subscription</h2>
    <Row icon={CreditCard} label="Plan" value={planStatus} onClick={()=>navigate('/app/upgrade?reason=general')}/>
    <Row icon={ExternalLink} label="Manage billing" value="Plans and payment history" onClick={()=>navigate('/app/billing')}/>
   </section>

   <section className="dl-settings-group"><h2>App</h2><Row icon={isInstalled?Check:Smartphone} label="Install app" value={isInstalled?"Installed":canInstall||isIos?"Add Lotlé to your device":"Install or add to your Home Screen"} onClick={()=>{if(!isInstalled)openInstall();}}/></section>

   <section className="dl-settings-group"><h2>Notifications</h2>
    <div className="dl-settings-toggle-row"><span className="dl-settings-row-icon"><Bell size={17}/></span><span className="dl-settings-row-copy"><strong>Push notifications</strong><small>{permission==='denied'?'Blocked':pushEnabled?'On':'Off'} · Manage your Lotlé alerts</small></span><button type="button" role="switch" aria-checked={pushEnabled} disabled={pushBusy||!notificationService.isPushSupported()} onClick={togglePush} className={'dl-settings-switch'+(pushEnabled?' active':'')}><span/></button></div>
    <button type="button" onClick={()=>navigate('/app/notifications')} className="dl-settings-help flex w-full items-center justify-between text-left">Manage notification categories and quiet hours <ChevronRight size={15}/></button>
    {permission==='denied'&&<p className="dl-settings-help">Notifications are blocked by your browser. Open your browser or device Settings → Site settings → Notifications, allow {name}, then return here and switch notifications on.</p>}
    {!notificationService.isPushSupported()&&<div className="dl-settings-help">This browser does not currently support push notifications. <button type="button" onClick={openInstall} className="font-bold underline">Install Lotlé</button> or use a supported browser.</div>}
   </section>

   <section className="dl-settings-group"><h2>Support</h2>
    <Row icon={Headset} label="Contact support" value="Chat with the {name} team" onClick={()=>window.open('https://wa.me/'+supportWhatsApp,'_blank','noopener,noreferrer')}/>
    <Row icon={FileText} label="Terms" value="Terms of service" onClick={()=>openSheet('terms')}/>
    <Row icon={Shield} label="Privacy" value="Privacy information" onClick={()=>openSheet('privacy')}/>
   </section>

   <section className="dl-settings-group dl-settings-account"><h2>Account</h2><Row icon={LogOut} label="Log out" onClick={()=>openSheet('logout')} danger/></section>
   <button type="button" className="dl-settings-delete-link" onClick={()=>openSheet('delete')}>Delete account</button>
   <p className="dl-settings-version">{name} · Version {APP_VERSION}</p>
  </main>

  {sheet&&<div className="dl-settings-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving&&!uploading)setSheet(null);}}>
   <section className="dl-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="dl-settings-sheet-title">
    <div className="dl-settings-sheet-handle"/>
    <div className="dl-settings-sheet-heading"><h2 id="dl-settings-sheet-title">{({profile:'Edit dealership profile',branding:'Dealership branding',name:'Dealership name',slug:'Edit showroom link',contact:'Contact numbers',location:'Dealership location',hours:'Opening hours',terms:'Terms',privacy:'Privacy',logout:'Log out?',delete:'Delete account'} as Record<string,string>)[sheet]}</h2><button type="button" onClick={()=>setSheet(null)} aria-label="Close" disabled={saving||!!uploading}><X size={18}/></button></div>
    {(sheet==='profile'||sheet==='name'||sheet==='contact'||sheet==='location')&&<div className="dl-settings-sheet-body">
     {(sheet==='profile'||sheet==='name')&&<label>Dealership name<input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} maxLength={90}/></label>}
     {(sheet==='profile'||sheet==='contact')&&<><label>Phone number<input type="tel" value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))} placeholder="+263…"/></label><label>WhatsApp number<input type="tel" value={draft.whatsapp} onChange={e=>setDraft(v=>({...v,whatsapp:e.target.value}))} placeholder="+263…"/></label></>}
     {(sheet==='profile'||sheet==='location')&&<><label>City or area<input value={draft.city} onChange={e=>setDraft(v=>({...v,city:e.target.value}))} placeholder="e.g. Bulawayo"/></label><label>Street address <span>Optional</span><input value={draft.address} onChange={e=>setDraft(v=>({...v,address:e.target.value}))} placeholder="Street or business address"/></label></>}
     <button type="button" className="dl-settings-primary" disabled={saving||!draft.name.trim()&&(sheet==='profile'||sheet==='name')} onClick={()=>void saveSheet()}>{saving?<Loader2 className="spin" size={16}/>:null}Save changes</button>
    </div>}
    {sheet==='slug'&&<div className="dl-settings-sheet-body">
     <label>Showroom link <span>lotle.link/</span><input value={slugDraft} onChange={e=>setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''))} maxLength={63} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></label>
     <p className="dl-settings-note">{slugAvailability==='checking'?'Checking availability…':slugAvailability==='available'?'lotle.link/'+slugDraft+' is available':slugAvailability==='taken'?'That link is taken or reserved. Try another.':'Use at least 3 letters or numbers. Letters, numbers and hyphens only.'}</p>
     <button type="button" className="dl-settings-primary" disabled={saving||slugAvailability!=='available'} onClick={()=>void saveSlug()}>{saving?<Loader2 className="spin" size={16}/>:null}Save showroom link</button>
    </div>}
    {sheet==='branding'&&<div className="dl-settings-sheet-body dl-settings-branding">
     <div className="dl-settings-showroom-preview">
      <div className="dl-settings-showroom-head">{dealer.logoUrl?<img src={dealer.logoUrl} alt=""/>:<b>{initials}</b>}<span><strong>{dealer.name}</strong><small>{dealer.city||dealer.country}</small></span></div>
      <div className="dl-settings-showroom-hero" style={dealer.coverUrl?{backgroundImage:'linear-gradient(90deg,#fff 0%,#fff 34%,rgba(255,255,255,.88) 58%,rgba(255,255,255,0) 82%),linear-gradient(0deg,#fff,transparent 38%),url("'+dealer.coverUrl+'")'}:undefined}>
       <strong>{dealer.tagline?.trim() && dealer.tagline.trim() !== 'Quality vehicles. Fair prices.' ? dealer.tagline.trim() : 'Find your next car.'}</strong><small>0 cars available · {dealer.city||dealer.country}</small><span>Browse inventory</span>
      </div>
      <small className="dl-settings-preview-caption">Live showroom preview</small>
     </div>
     <div className="dl-settings-brand-preview"><span>Logo</span>{dealer.logoUrl?<img src={dealer.logoUrl} alt="Dealership logo"/>:<b>{initials}</b>}<button type="button" onClick={()=>logoInput.current?.click()} disabled={!!uploading}>{uploading==='logo'?<Loader2 className="spin" size={15}/>:<Upload size={15}/>} Upload logo</button><input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadAsset('logo',e.target.files?.[0])}/><small>Upload your dealership logo. Square or circular logos work best. JPG, PNG or WebP · Max 10 MB</small></div>
     <div className="dl-settings-brand-preview dl-settings-banner-preview"><span>Showroom banner</span>{dealer.coverUrl?<img src={dealer.coverUrl} alt="Showroom banner"/>:<div className="dl-settings-banner-empty">No banner uploaded</div>}<button type="button" onClick={()=>bannerInput.current?.click()} disabled={!!uploading}>{uploading==='banner'?<Loader2 className="spin" size={15}/>:<Upload size={15}/>} Upload banner</button><input ref={bannerInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadAsset('banner',e.target.files?.[0])}/><small>This wide image appears at the top of your showroom. JPG, PNG or WebP · Max 10 MB</small></div>
    </div>}
    {sheet==='branding'&&uploadError&&<p role="alert" className="px-1 text-xs text-[#475467]">{uploadError.replace(/\s*\[([A-Z0-9_]+)\]$/,'')}<small className="mt-1 block text-[10px] text-[#98A2B3]">{uploadError.match(/\[([A-Z0-9_]+)\]$/)?.[1]?`Code: ${uploadError.match(/\[([A-Z0-9_]+)\]$/)?.[1]}`:''}</small></p>}
    {sheet==='hours'&&<div className="dl-settings-sheet-body"><p className="dl-settings-note">Opening hours are not currently stored in the dealership profile, so there is no safe way to save them here yet. This screen leaves your existing dealership data unchanged.</p><button type="button" className="dl-settings-primary" onClick={()=>setSheet(null)}>Got it</button></div>}
    {(sheet==='terms'||sheet==='privacy')&&<div className="dl-settings-sheet-body"><p className="dl-settings-note">{sheet==='terms'?'The Terms page is not currently connected in this app.':'The Privacy page is not currently connected in this app.'} Contact support if you need a copy of the current policy.</p><a className="dl-settings-primary" href={'https://wa.me/'+supportWhatsApp} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Contact support</a></div>}
    {sheet==='logout'&&<div className="dl-settings-sheet-body"><p className="dl-settings-note">You’ll be signed out of this {name} account on this device.</p><button type="button" className="dl-settings-primary" disabled={saving} onClick={()=>void signOut()}>{saving?<Loader2 className="spin" size={16}/>:null}Log out</button><button type="button" className="dl-settings-secondary" onClick={()=>setSheet(null)}>Cancel</button></div>}
    {sheet==='delete'&&<div className="dl-settings-sheet-body"><div className="dl-settings-warning"><AlertTriangle size={18}/> Account deletion requires identity verification by {name} Support. This will open a request; it will not delete your account immediately.</div><label>Type DELETE to confirm your request<input value={deleteText} onChange={e=>setDeleteText(e.target.value)} autoComplete="off" placeholder="DELETE"/></label><button type="button" className="dl-settings-danger" disabled={deleteText.trim()!=='DELETE'} onClick={requestDeletion}>Continue to support</button></div>}
   </section>
  </div>}
   {showTemplatePicker && (
    <TemplatePickerSheet
      dealer={dealer}
      vehicles={vehicles}
      currentTemplate={dealer.template}
      onSelect={async (newTemplate) => {
        const updated = await storageService.updateDealershipAsync({ template: newTemplate });
        setDealer(updated);
        showToast('Showroom template updated');
      }}
      onClose={() => setShowTemplatePicker(false)}
    />
   )}
 </div>;
};
