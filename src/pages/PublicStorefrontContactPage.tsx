import React, { useEffect, useState } from 'react';
import { Select } from '../components/common/Select';
import { ArrowLeft, MapPin, Phone, MessageCircle, Send, Share2, Grid2x2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Dealership, Vehicle } from '../types';

export const PublicStorefrontContactPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { navigate } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isSupabaseConfigured()) {
          const found = await supabaseService.getDealershipBySlug(slug);
          if (active) setDealer(found);
          if (found) { const list = await supabaseService.getVehicles(found.id, true); if (active) setVehicles(list); }
        } else {
          const local = storageService.getDealership();
          if (local.slug === slug && active) { setDealer(local); setVehicles(storageService.getVehicles().filter(v => v.status === 'available')); }
        }
      } catch { if (active) setDealer(null); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dealer || !name.trim() || !phone.trim() || !message.trim()) { setError('Please complete your name, phone number and message.'); return; }
    setSending(true); setError('');
    try {
      const payload = { dealershipId: dealer.id, vehicleId: vehicleId || null, buyerName: name.trim(), buyerPhone: phone.trim(), message: message.trim(), stage: 'new' as const, source: 'form' as const, notes: 'Public dealership contact form.' };
      if (isSupabaseConfigured()) await supabaseService.createEnquiry(payload);
      else await storageService.createEnquiryAsync(payload);
      setSent(true);
    } catch { setError('Your enquiry could not be sent. Please try WhatsApp or call the dealership.'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="dl-store-loading">Loading contact details…</div>;
  if (!dealer) return <div className="dl-store-loading">This dealership could not be found.</div>;
  const back = () => navigate('/' + dealer.slug + '/browse');
  const shareShowroom = async () => { const url = window.location.origin + '/' + dealer.slug; if (navigator.share) { try { await navigator.share({ title: dealer.name, url }); } catch { /* share sheet dismissed */ } } else if (navigator.clipboard) { await navigator.clipboard.writeText(url); } };
  const whatsapp = dealer.whatsapp ? 'https://wa.me/' + dealer.whatsapp.replace(/\D/g,'') : '';

  return <main className="dl-store-contact">
    <header><button onClick={back} aria-label="Back to inventory"><ArrowLeft/></button><span>Contact dealership</span></header>
    <section className="dl-contact-profile">
      {dealer.logoUrl ? <img src={dealer.logoUrl} alt={dealer.name}/> : <span className="dl-contact-monogram">{dealer.name.slice(0,2).toUpperCase()}</span>}
      <h1>{dealer.name}</h1><p><MapPin size={15}/>{[dealer.city,dealer.country].filter(Boolean).join(', ')}</p>
      {dealer.bio && <div>{dealer.bio}</div>}
    </section>
    <section className="dl-contact-methods">
      {dealer.phone && <a href={'tel:' + dealer.phone}><Phone/>Call dealership</a>}
      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp</a>}
      {dealer.email && <a href={'mailto:' + dealer.email}><Send/>Email</a>}
    </section>
    <form className="dl-contact-form" onSubmit={submit}>
      <h2>Send an enquiry</h2><p>Leave your details and the dealership will get back to you.</p>
      {sent ? <div className="dl-contact-success"><strong>Enquiry sent.</strong><span>Thank you. Your message has been delivered to the dealership.</span></div> : <>
        <label>Your name<input value={name} onChange={e => setName(e.target.value)} required placeholder="Full name"/></label>
        <label>Phone / WhatsApp number<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+263… or +27…"/></label>
        <div className="dl-contact-select"><span>Vehicle of interest (optional)</span><Select value={vehicleId} title="Vehicle of interest" placeholder="General enquiry" options={[{value:'',label:'General enquiry'},...vehicles.map(v=>({value:v.id,label:`${v.year} ${v.make} ${v.model}`}))]} onChange={setVehicleId}/></div>
        <label>Message<textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} required placeholder="How can the dealership help?"/></label>
        {error && <p className="dl-contact-error">{error}</p>}
        <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send Enquiry'}</button>
      </>}
    </form>
    <nav className="dl-store-bottom-nav"><button onClick={() => navigate('/' + dealer.slug)}><Grid2x2/><span>Home</span></button><button onClick={back}><span>Inventory</span></button><button className="active"><MessageCircle/><span>Enquiries</span></button><button onClick={shareShowroom}><Share2/><span>More</span></button></nav>
  </main>;
};
