import React from 'react';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Dealership, Vehicle } from '../types';

interface PublicShowroomPageProps { slug?: string; previewDealership?: Dealership; previewVehicles?: Vehicle[]; }

export const PublicShowroomPage: React.FC<PublicShowroomPageProps> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(previewDealership || null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewVehicles || []);
  const [loading, setLoading] = useState(!previewDealership);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (previewDealership) { setDealer(previewDealership); setVehicles(previewVehicles || []); setLoading(false); return; }
      if (!slug) { setDealer(storageService.getDealership()); setVehicles(storageService.getVehicles()); setLoading(false); return; }
      try {
        if (isSupabaseConfigured()) {
          const found = await supabaseService.getDealershipBySlug(slug);
          if (!active) return;
          setDealer(found);
          if (found) {
            const inventory = await supabaseService.getVehicles(found.id, true);
            if (active) setVehicles(inventory.filter(v => v.status === 'available'));
            supabaseService.incrementStorefrontViews(found.slug).catch(() => undefined);
          }
        } else {
          const local = storageService.getDealership();
          if (local.slug === slug) { setDealer(local); setVehicles(storageService.getVehicles().filter(v => v.status === 'available')); }
          else setDealer(null);
        }
      } catch { if (active) setDealer(null); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [slug, previewDealership, previewVehicles]);

  if (loading) return <div className="dl-cinematic-loading">Loading showroom…</div>;
  if (!dealer) return <div className="dl-cinematic-loading"><h1>Showroom unavailable</h1><p>This dealership link may be incorrect or unpublished.</p></div>;

  const heroPhoto = dealer.coverUrl || '';
  const title = dealer.tagline?.trim() || 'Drive Your Dream Today.';
  const description = dealer.bio?.trim() || 'Premium cars. Great deals. Trusted dealership.';
  const dealerInitials = dealer.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DL';
  const browse = () => navigate('/' + encodeURIComponent(dealer.slug) + '/browse');

  return (
    <main className="dl-cinematic-storefront" style={{ backgroundImage: heroPhoto ? 'linear-gradient(90deg,rgba(0,0,0,.76),rgba(0,0,0,.16)),linear-gradient(0deg,rgba(0,0,0,.38),transparent 55%),url(' + JSON.stringify(heroPhoto) + ')' : 'linear-gradient(135deg,#172235 0%,#35445b 52%,#111827 100%)' }}>
      <header className="dl-cinematic-header">
        <button className="dl-cinematic-brand" onClick={browse} aria-label="Explore dealership inventory">
          {dealer.logoUrl ? <img src={dealer.logoUrl} alt="" /> : <span>{dealerInitials}</span>}
          <span><strong>{dealer.name}</strong><small>{[dealer.city, dealer.country].filter(Boolean).join(', ')}</small></span>
        </button>
        <button className="dl-cinematic-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Open menu">{menuOpen ? <X/> : <Menu/>}</button>
        {menuOpen && <div className="dl-cinematic-menu-panel"><button onClick={browse}>Explore cars</button><button onClick={() => navigate('/' + dealer.slug + '/contact')}>Contact dealership</button></div>}
      </header>
      <section className="dl-cinematic-copy">
        <p className="dl-cinematic-eyebrow">{dealer.city}{dealer.city && dealer.country ? ' · ' : ''}{dealer.country}</p>
        <h1>{title}</h1>
        <p className="dl-cinematic-description">{description}</p>
        <button className="dl-explore-button" onClick={browse}>Explore Cars <span><ArrowRight/></span></button>
      </section>
      <div className="dl-cinematic-footer"><span>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} available</span><span className="dl-cinematic-dots"><i/><i/><i/></span></div>
    </main>
  );
};
