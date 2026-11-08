import { name, supportWhatsApp } from '../config/brand';
import React, { useEffect, useState } from 'react';
import { planService } from '../services/planService';
import { ArrowLeft, Headset, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { BottomNav } from '../components/layout/BottomNav';

const SUPPORT_PHONE = '+' + supportWhatsApp;
const SUPPORT_TEL = `tel:+${supportWhatsApp}`;
const SUPPORT_WHATSAPP = `https://wa.me/${supportWhatsApp}`;

export const SupportPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [supportLevel, setSupportLevel] = useState<'standard'|'priority'>('standard');
  useEffect(() => { void planService.getMyPlan().then(snapshot => setSupportLevel(snapshot.config[snapshot.plan].supportLevel)).catch(error => console.error('[Lotle plan] Support plan lookup failed', error)); }, []);

  return (
    <div className="dl-workspace min-h-full flex flex-col bg-[#F8F9FA] text-slate-900">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        <button onClick={() => navigate('/app/more')} aria-label="Back to More" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">We’re here to help</p><h1 className="text-xl font-extrabold tracking-tight">Help & Support</h1></div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6 pb-28">
        <section className="rounded-3xl bg-slate-950 p-6 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Headset className="h-6 w-6" /></div>
          <h2 className="text-xl font-extrabold">How can we help?</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">Talk to the {name} support team about your account, vehicle listings, showroom or any issue you’re experiencing.</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{supportLevel === 'priority' ? "Priority support" : "Standard support"}</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Phone className="h-5 w-5" /></span>
            <div><p className="text-sm font-bold">Phone support</p><p className="mt-0.5 text-sm text-slate-500">{SUPPORT_PHONE}</p></div>
          </div>
          <a href={SUPPORT_TEL} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-900"><Phone className="h-4 w-4" /> Call support</a>
          <a href={supportLevel === 'priority' ? SUPPORT_WHATSAPP + "?text=" + encodeURIComponent("Lotlé Pro priority support request") : SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#171717] px-4 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" /> {supportLevel === 'priority' ? "Contact priority support" : "Chat on WhatsApp"}</a>
        </section>
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
          <p>For a faster response, include your dealership name and a short description of the issue when contacting support. Never share your password or verification codes.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};
