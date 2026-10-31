import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { MARKETING_CAR_IMAGES } from '../utils/marketingCarImages';
import { ArrowRight, ArrowUpRight, CarFront, Check, ChevronDown, Link2, Menu, MessageCircle, Play, Share2, Users, X, BarChart3, ClipboardList, HelpCircle } from 'lucide-react';

const ORANGE = '#FF784F';

const faqs = [
  ['What is DriveLink?', 'DriveLink gives your dealership one professional online showroom link, with tools to manage your vehicle listings and customer enquiries.'],
  ['How much does DriveLink cost?', 'DriveLink is priced at $3.99 per month after the 3-day free trial.'],
  ['Is there a free trial?', 'Yes. New dealerships can start with a 3-day free trial.'],
  ['How does my online showroom work?', 'Your showroom is a public page with your dealership details and vehicle listings. Share its link on WhatsApp, Instagram or anywhere buyers find you.'],
  ['Can I add multiple vehicles?', 'Yes. You can add and manage multiple vehicle listings from your Garage.'],
  ['Can customers contact me on WhatsApp?', 'Your showroom and vehicle pages can direct interested buyers to contact your dealership.'],
  ['Can I update my vehicle prices and availability?', 'Yes. You can edit a listing and update its price and availability from your inventory.'],
  ['Can I cancel my subscription?', 'You can manage your subscription from the Billing area of your DriveLink account.'],
  ['Does DriveLink work in Zimbabwe and South Africa?', 'DriveLink is designed for dealers in both markets, with country, location and currency options.'],
];

const garageImages = [MARKETING_CAR_IMAGES.hondaFit, MARKETING_CAR_IMAGES.vitz, MARKETING_CAR_IMAGES.imageTwo];

const FeatureMockup: React.FC<{ type: 'showroom' | 'garage' | 'leads' | 'analytics' }> = ({ type }) => {
  if (type === 'showroom') return <div className="dl-mock-phone"><div className="dl-mock-browser">● ● ● <span>drivelink.co.zw</span></div><div className="dl-mock-brand"><b>↗ DriveLink</b><span>☰</span></div><img src={MARKETING_CAR_IMAGES.showroom} alt="Vehicle photo in a dealership showroom" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /><div className="p-4"><b className="text-xl">Your next car is here.</b><p className="text-xs text-neutral-500 mt-1">Explore available vehicles</p><div className="dl-mock-cta">Browse inventory <ArrowRight size={13}/></div><div className="grid grid-cols-2 gap-2 mt-3"><img src={MARKETING_CAR_IMAGES.hondaFit} alt="Honda Fit vehicle listing" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/><img src={MARKETING_CAR_IMAGES.vitz} alt="Toyota Vitz vehicle listing" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/></div></div></div>;
  if (type === 'garage') return <div className="dl-mock-panel"><div className="flex justify-between items-center"><div><b className="text-lg">Garage</b><p className="text-xs text-neutral-500">Your vehicle inventory</p></div><span className="dl-mock-plus">+</span></div><div className="dl-mock-search">⌕　Search vehicles</div>{['Toyota Hilux','BMW 320i','Volkswagen Golf'].map((name,i)=><div className="dl-mock-row" key={name}><img src={i===1?MARKETING_CAR_IMAGES.imageTwo:garageImages[i]} alt={`${name} vehicle photo`} loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/><div className="min-w-0"><b>{name}</b><small>{i===0?'Available':'Vehicle listing'} · View details</small><strong>{i===0?'Edit listing':'Manage listing'}</strong></div><span className="dl-mock-status">Available</span></div>)}</div>;
  if (type === 'leads') return <div className="dl-mock-panel"><div className="flex justify-between"><div><b className="text-lg">Leads</b><p className="text-xs text-neutral-500">Manage your enquiries</p></div><MessageCircle className="text-orange-500"/></div><div className="flex gap-2 my-4"><span className="dl-mock-chip active">All</span><span className="dl-mock-chip">New</span><span className="dl-mock-chip">Contacted</span></div>{['New enquiry','Buyer follow-up','Vehicle question'].map((name,i)=><div className="dl-mock-lead" key={name}><span className="dl-mock-avatar">{['T','A','M'][i]}</span><div><b>{name}</b><small>{['Interested in a vehicle','Asked about availability','Requested more photos'][i]}</small></div><span className="dl-mock-dot"/></div>)}<div className="dl-mock-whatsapp"><MessageCircle size={15}/> Contact buyer</div></div>;
  return <div className="dl-mock-panel"><div className="flex justify-between items-center"><div><b className="text-lg">Analytics</b><p className="text-xs text-neutral-500">Understand your dealership</p></div><span className="dl-mock-chip">Last 30 days</span></div><div className="grid grid-cols-3 gap-2 mt-5">{['Visits','Enquiries','Vehicles'].map(x=><div className="dl-mock-stat" key={x}><b>—</b><small>{x}</small></div>)}</div><div className="dl-mock-chart"><div className="dl-chart-line"/></div><div className="text-xs font-bold mt-3">Your dealership activity</div><p className="text-[10px] text-neutral-400">Your own account data appears here.</p></div>;
};

export const WelcomePage: React.FC = () => {
  const { navigate } = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const goStart = () => navigate('/onboarding');
  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="dl-marketing-page">
      <div className="dl-marketing-glow dl-glow-one"/><div className="dl-marketing-glow dl-glow-two"/>
      <header className="dl-marketing-nav">
        <a href="#top" className="dl-brand" aria-label="DriveLink home"><span className="dl-brand-mark">D</span><span>DriveLink</span></a>
        <nav className="hidden md:flex items-center gap-8">
          <button onClick={()=>scrollTo('features')}>Features</button><button onClick={()=>scrollTo('how-it-works')}>How it works</button><button onClick={()=>scrollTo('pricing')}>Pricing</button><button onClick={()=>scrollTo('faq')}>FAQ</button>
        </nav>
        <div className="hidden md:flex items-center gap-5"><button className="dl-login-link" onClick={()=>navigate('/login')}>Log in</button><button className="dl-button dl-button-small" onClick={goStart}>Get Started <ArrowRight size={15}/></button></div>
        <button className="md:hidden dl-menu-toggle" aria-label={menuOpen?'Close menu':'Open menu'} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X/>:<Menu/>}</button>
      </header>
      {menuOpen && <div className="dl-mobile-menu"><button onClick={()=>scrollTo('features')}>Features</button><button onClick={()=>scrollTo('how-it-works')}>How it works</button><button onClick={()=>scrollTo('pricing')}>Pricing</button><button onClick={()=>scrollTo('faq')}>FAQ</button><button onClick={()=>{setMenuOpen(false);navigate('/login')}}>Log in</button><button className="dl-button" onClick={goStart}>Get Started <ArrowRight size={15}/></button></div>}

      <section id="top" className="dl-hero dl-section-wrap">
        <div className="dl-hero-copy">
          <span className="dl-trial-badge"><i/> 3-Day Free Trial</span>
          <h1>Your entire<br/>dealership.<br/><em>One link.</em></h1>
          <p>Create your online showroom, showcase your inventory and manage customer enquiries — all in one place.</p>
          <div className="dl-hero-actions"><button className="dl-button" onClick={goStart}>Start Free Trial <ArrowRight size={17}/></button><button className="dl-watch" onClick={()=>scrollTo('how-it-works')}><span><Play size={13} fill="currentColor"/></span> See how it works</button></div>
          <small className="dl-price-note">$3.99/month after trial. Cancel anytime.</small>
        </div>
        <div className="dl-hero-visual" aria-label="DriveLink showroom and dealer tools preview">
          <div className="dl-orb dl-orb-orange"/><div className="dl-orb dl-orb-blue"/>
          <div className="dl-hero-phone"><div className="dl-phone-top"><span>9:41</span><span>●●● ▰</span></div><div className="dl-phone-url">⌑　drivelink.co.zw</div><div className="dl-phone-brand"><b><span className="dl-brand-mini">D</span> DriveLink</b><span>☰</span></div><img className="dl-phone-car" src={MARKETING_CAR_IMAGES.hero} alt="Mercedes-Benz GLE in a DriveLink showroom preview" loading="eager" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/><div className="dl-phone-content"><b>Premium cars.<br/>One simple link.</b><p>Find your next car today.</p><span className="dl-phone-cta">Browse inventory　→</span><div className="dl-phone-tiles"><img src={MARKETING_CAR_IMAGES.hondaFit} alt="Honda Fit vehicle preview" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/><img src={MARKETING_CAR_IMAGES.vitz} alt="Toyota Vitz vehicle preview" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/></div></div></div>
          <div className="dl-float-card dl-float-stats"><div className="dl-float-title">Your showroom <span>↗</span></div><div className="dl-float-metric"><small>Showroom visits</small><b>Live insights</b><span className="dl-sparkline"/></div><div className="dl-float-metric"><small>Customer enquiries</small><b>All in one place</b><span className="dl-sparkline second"/></div><div className="dl-float-inventory"><img src={MARKETING_CAR_IMAGES.imageTwo} alt="Vehicle thumbnail" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/><div><b>Your inventory</b><small>Manage your vehicles</small></div><ArrowUpRight size={16}/></div></div>
        </div>
      </section>

      <section className="dl-trust dl-section-wrap"><span>Made for independent dealers and dealerships</span><div className="dl-trust-rule"/><p>Built for the way car dealers work in Zimbabwe and South Africa.</p></section>

      <section id="how-it-works" className="dl-how dl-section-wrap">
        <div className="dl-section-heading"><span className="dl-kicker">A simpler way to sell</span><h2>Get started in<br/>3 simple steps.</h2><p>Launch your online dealership in minutes.</p></div>
        <div className="dl-steps"><article><i>1</i><CarFront/><h3>Create Your Account</h3><p>Sign up and set up your dealership.</p></article><ArrowRight className="dl-step-arrow"/><article><i>2</i><ClipboardList/><h3>Add Your Cars</h3><p>Upload your inventory and set your prices.</p></article><ArrowRight className="dl-step-arrow"/><article><i>3</i><Share2/><h3>Share Your Showroom</h3><p>Share one link and make it easy for buyers to reach you.</p></article></div>
      </section>

      <section id="features" className="dl-features dl-section-wrap">
        <div className="dl-section-heading dl-feature-heading"><span className="dl-kicker">Everything in one place</span><h2>Everything you need<br/>to manage your dealership.</h2><p>Simple tools that keep your online showroom and day-to-day work connected.</p></div>
        <div className="dl-feature-row"><div className="dl-feature-visual showroom"><FeatureMockup type="showroom"/></div><div className="dl-feature-copy"><span className="dl-feature-icon"><Link2/></span><h3>Your own online showroom</h3><p>Give buyers one clean link to browse your dealership and see the vehicles you have available.</p><ul><li><Check/> A public dealership page</li><li><Check/> Shareable vehicle listings</li><li><Check/> Your dealership details in one place</li></ul></div></div>
        <div className="dl-feature-row reverse"><div className="dl-feature-visual garage"><FeatureMockup type="garage"/></div><div className="dl-feature-copy"><span className="dl-feature-icon"><CarFront/></span><h3>Your inventory, under control</h3><p>Add vehicles, update prices and keep availability up to date from your Garage.</p><ul><li><Check/> Add and edit listings</li><li><Check/> Manage available, reserved and sold vehicles</li><li><Check/> Keep vehicle information organized</li></ul></div></div>
        <div className="dl-feature-row"><div className="dl-feature-visual leads"><FeatureMockup type="leads"/></div><div className="dl-feature-copy"><span className="dl-feature-icon"><Users/></span><h3>Every enquiry has a place</h3><p>Keep customer enquiries organized so you can follow up and move conversations forward.</p><ul><li><Check/> View incoming enquiries</li><li><Check/> Track lead status</li><li><Check/> Continue conversations with buyers</li></ul></div></div>
        <div className="dl-feature-row reverse"><div className="dl-feature-visual analytics"><FeatureMockup type="analytics"/></div><div className="dl-feature-copy"><span className="dl-feature-icon"><BarChart3/></span><h3>Understand your performance</h3><p>See the activity recorded for your dealership and understand how buyers interact with your showroom.</p><ul><li><Check/> Review available activity metrics</li><li><Check/> See your enquiry activity</li><li><Check/> Monitor your inventory</li></ul></div></div>
      </section>

      <section id="pricing" className="dl-pricing dl-section-wrap"><div><span className="dl-kicker">Straightforward pricing</span><h2>Simple. Affordable.<br/>Built for dealers.</h2><p>Everything you need to bring your dealership online, without complicated plans.</p></div><div className="dl-price-card"><div className="dl-price-card-top"><span className="dl-trial-badge"><i/> 3-Day Free Trial</span><span className="dl-price-tag">One simple plan</span></div><div className="dl-price"><strong>$3.99</strong><span>/ month</span></div><p className="dl-price-sub">After your 3-day free trial.</p><ul><li><Check/> Create your online dealership showroom</li><li><Check/> Manage your vehicle inventory</li><li><Check/> Upload vehicle photographs</li><li><Check/> Receive and manage customer enquiries</li><li><Check/> Track available dealership performance</li><li><Check/> Share your showroom link</li></ul><button className="dl-button w-full" onClick={goStart}>Start Your Free Trial <ArrowRight size={16}/></button><small>Trial and billing details are shown during account setup.</small></div></section>

      <section id="faq" className="dl-faq dl-section-wrap"><div className="dl-faq-intro"><span className="dl-kicker">Questions, answered</span><h2>Got questions?</h2><p>Find straightforward answers about DriveLink.</p><div className="dl-faq-help"><HelpCircle/> Still need help? <a href="mailto:support@drivelink.co.zw">Contact us</a></div></div><div className="dl-faq-list">{faqs.map(([q,a],i)=><div className="dl-faq-item" key={q}><button aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{q}</span><ChevronDown className={openFaq===i?'rotate-180':''}/></button>{openFaq===i&&<p>{a}</p>}</div>)}</div></section>

      <section className="dl-final-cta dl-section-wrap"><div><span className="dl-kicker">Manage. Sell. Grow.</span><h2>Ready to grow<br/>your dealership?</h2><p>Start your 3-day free trial and give your dealership one professional link.</p></div><button className="dl-button" onClick={goStart}>Get Started <ArrowRight size={17}/></button></section>
      <footer className="dl-footer dl-section-wrap"><div className="dl-footer-main"><div><a href="#top" className="dl-brand"><span className="dl-brand-mark">D</span><span>DriveLink</span></a><p>Manage. Sell. Grow.</p><small>Online showrooms and dealership tools.</small></div><div className="dl-footer-links"><button onClick={()=>scrollTo('features')}>Features</button><button onClick={()=>scrollTo('pricing')}>Pricing</button><button onClick={()=>scrollTo('faq')}>FAQ</button><button onClick={()=>navigate('/login')}>Log in</button><a href="mailto:support@drivelink.co.zw">Contact</a></div><div className="dl-footer-social"><a href="https://wa.me/" aria-label="WhatsApp"><MessageCircle/></a><a href="https://instagram.com/" aria-label="Instagram"><Share2 size={15}/></a></div></div><div className="dl-footer-bottom"><span>© {new Date().getFullYear()} DriveLink. All rights reserved.</span><div><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></div><span>Zimbabwe · South Africa</span></div></footer>
    </main>
  );
};
