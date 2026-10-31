import React from 'react';
import {UserRound,ChartNoAxesCombined,UsersRound,CreditCard,Bell,Settings,LifeBuoy,LogOut,ChevronRight,Building2} from 'lucide-react';
import {useNavigation} from '../context/NavigationContext';
import {storageService} from '../services/storage';
import {BottomNav} from '../components/layout/BottomNav';
import {supabaseService} from '../services/supabaseService';
import {isSupabaseConfigured} from '../lib/supabase';

export const MorePage:React.FC=()=>{
 const {navigate,showToast}=useNavigation();const dealer=storageService.getDealership();
 const signOut=async()=>{try{if(isSupabaseConfigured()&&!storageService.isDemoModeActive())await supabaseService.signOut();storageService.clearSession();navigate('/login');}catch(e:any){showToast(e?.message||'Could not sign out.');}};
 const items=[{label:'Analytics',detail:'Track visits and vehicle performance',icon:ChartNoAxesCombined,path:'/app/analytics'},{label:'Team',detail:'Manage dealership access',icon:UsersRound,path:'/app/settings'},{label:'Subscription',detail:'Your DriveLink plan',icon:CreditCard,path:'/app/billing'},{label:'Notifications',detail:'Enquiry and account updates',icon:Bell,path:'/app/notifications'},{label:'Settings',detail:'Business details and preferences',icon:Settings,path:'/app/settings'},{label:'Help & Support',detail:'Get help with your account',icon:LifeBuoy,path:'/app/settings'}];
 return <div className="dl-workspace min-h-full flex flex-col"><main className="flex-1 px-4 sm:px-7 pt-6 pb-28 max-w-4xl w-full mx-auto">
  <div className="mb-5"><p className="text-[10px] uppercase tracking-[.16em] text-[#999] font-extrabold">Account</p><h1 className="text-2xl font-black mt-1">More</h1></div>
  <button onClick={()=>navigate('/app/settings')} className="w-full rounded-[24px] bg-white border border-[#ececec] p-4 flex items-center gap-3 text-left mb-5"><div className="w-14 h-14 rounded-full bg-[#f0f0ee] flex items-center justify-center overflow-hidden">{dealer.logoUrl?<img src={dealer.logoUrl} alt="" className="w-full h-full object-cover"/>:<Building2 className="text-[#777]"/>}</div><span className="flex-1 min-w-0"><strong className="block text-sm truncate">{dealer.name}</strong><span className="text-xs text-[#888]">Dealer account · {dealer.city||dealer.country}</span></span><ChevronRight size={18} className="text-[#aaa]"/></button>
  <div className="rounded-[22px] bg-white border border-[#ececec] divide-y divide-[#f0f0f0]">{items.map(item=>{const Icon=item.icon;return <button key={item.label} onClick={()=>navigate(item.path)} className="w-full p-4 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-xl bg-[#f5f5f3] flex items-center justify-center"><Icon size={18}/></span><span className="flex-1"><strong className="block text-sm">{item.label}</strong><span className="block text-[11px] text-[#999] mt-0.5">{item.detail}</span></span><ChevronRight size={17} className="text-[#bbb]"/></button>})}</div>
  <button onClick={signOut} className="w-full mt-5 rounded-full bg-[#fff0eb] text-[#c64d32] py-3.5 text-sm font-extrabold"><LogOut size={16} className="inline mr-2"/>Sign out</button>
 </main><BottomNav/></div>;
};
