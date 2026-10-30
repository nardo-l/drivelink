import React from 'react';
import { useNavigation } from '../context/NavigationContext';
import { CAR_RAV4_SILVER } from '../utils/carVisuals';
import { ArrowRight, Link2, ShieldCheck, Smartphone } from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <main className="dl-welcome min-h-screen w-full text-[#111216]">
      <header className="dl-welcome-content flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center"><Link2 size={16} /></div>
          <span className="text-[17px] font-black tracking-tight">DriveLink</span>
        </div>
        <button onClick={() => navigate('/login')} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold">Sign in</button>
      </header>

      <section className="dl-welcome-content">
        <div className="dl-welcome-hero rounded-[28px] px-6 py-7 sm:px-10 sm:py-10 flex flex-col justify-end text-white">
          <img src={CAR_RAV4_SILVER} alt="Premium vehicle displayed in a dealership showroom" />
          <div className="mb-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Online showroom for car dealers
          </div>
          <div className="max-w-md">
            <p className="text-[10px] uppercase tracking-[.2em] font-extrabold text-white/65 mb-3">Your dealership. Your brand. One link.</p>
            <h1 className="text-[clamp(38px,10vw,58px)] leading-[.98] font-black tracking-[-.065em]">Get your dealership online.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">Showcase your vehicles in a premium online showroom and turn buyer interest into direct enquiries.</p>
            <button onClick={() => navigate('/onboarding')} className="mt-7 w-full sm:w-auto min-h-12 rounded-full bg-white px-6 text-sm font-extrabold text-black flex items-center justify-center gap-3">
              Get started <ArrowRight size={17} />
            </button>
          </div>
          <div className="mt-8 flex items-center gap-5 text-[10px] font-semibold text-white/65">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14}/> No technical skills needed</span>
            <span className="flex items-center gap-1.5"><Smartphone size={14}/> Mobile first</span>
          </div>
        </div>
      </section>

      <section className="dl-welcome-content grid grid-cols-3 gap-2 py-5">
        {[['01','Build your showroom'],['02','Add your vehicles'],['03','Share your link']].map(([n,label]) => (
          <div key={n} className="rounded-2xl bg-white border border-black/[.06] p-3">
            <p className="text-[10px] font-black text-black/35">{n}</p>
            <p className="mt-2 text-[11px] leading-4 font-bold">{label}</p>
          </div>
        ))}
      </section>
      <footer className="dl-welcome-content pb-7 text-[10px] text-black/40 flex justify-between">
        <span>DriveLink · Online showrooms for car dealers</span><span>Zimbabwe & South Africa</span>
      </footer>
    </main>
  );
};