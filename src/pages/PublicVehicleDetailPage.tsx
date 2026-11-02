import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, MapPin, Phone, Share2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { supabaseService } from '../services/supabaseService';
import { storageService } from '../services/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { ShareModal } from '../components/common/ShareModal';
import type { Dealership, Vehicle } from '../types';

interface PublicVehicleDetailPageProps { vehicleId: string; slug?: string; }

export const PublicVehicleDetailPage: React.FC<PublicVehicleDetailPageProps> = ({ vehicleId, slug }) => {
  const { navigate } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isSupabaseConfigured()) {
          const foundDealer = slug ? await supabaseService.getDealershipBySlug(slug) : null;
          const foundVehicle = await supabaseService.getVehicleById(vehicleId, true);
          if (!active) return;
          if (foundDealer && foundVehicle && foundVehicle.dealershipId === foundDealer.id && foundVehicle.status === 'available') {
            setDealer(foundDealer); setVehicle(foundVehicle);
          } else { setDealer(foundDealer); setVehicle(null); }
        } else {
          const localDealer = storageService.getDealership();
          const localVehicle = storageService.getVehicleById(vehicleId);
          if (localDealer.slug === slug && localVehicle?.dealershipId === localDealer.id && localVehicle.status === 'available') { setDealer(localDealer); setVehicle(localVehicle); }
        }
      } catch { if (active) { setDealer(null); setVehicle(null); } }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [vehicleId, slug]);

  if (loading) return <div className="dl-store-loading">Loading vehicle…</div>;
  if (!dealer || !vehicle) return <div className="dl-store-loading"><h1>Vehicle unavailable</h1><p>This vehicle may have been sold or removed.</p><button onClick={() => navigate('/showroom/' + (slug || ''))}>Return to showroom</button></div>;

  const photos = vehicle.photos || [];
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:vehicle.currency || dealer.currency, maximumFractionDigits:0 }).format(vehicle.price);
  const wa = dealer.whatsapp ? 'https://wa.me/' + dealer.whatsapp.replace(/\D/g,'') + '?text=' + encodeURIComponent('Hi ' + dealer.name + ', I am interested in the ' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + '. Is it still available?') : '';
  const specs = [
    ['Year', String(vehicle.year)], ['Mileage', vehicle.mileageKm.toLocaleString() + ' km'],
    ['Fuel', vehicle.fuel], ['Transmission', vehicle.transmission],
    ['Engine', vehicle.engineSize], ['Body colour', vehicle.colour],
    ['Condition', vehicle.condition], ['Drive type', undefined],
  ].filter((item): item is [string,string] => Boolean(item[1]));

  return <main className="dl-public-vehicle dl-store-browse">
    <header className="dl-vehicle-public-header"><button onClick={() => navigate('/' + dealer.slug + '/browse')} aria-label="Back"><ArrowLeft/></button><button onClick={() => setShareOpen(true)} aria-label="Share vehicle"><Share2/></button></header>
    <section className="dl-vehicle-public-gallery">
      {photos[photoIndex] ? <img src={photos[photoIndex]} alt={vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model}/> : <div className="dl-vehicle-no-photo">No vehicle photos available</div>}
      {photos.length > 1 && <><button className="prev" onClick={() => setPhotoIndex(i => (i - 1 + photos.length) % photos.length)} aria-label="Previous photo"><ChevronLeft/></button><button className="next" onClick={() => setPhotoIndex(i => (i + 1) % photos.length)} aria-label="Next photo"><ChevronRight/></button><span className="dl-vehicle-photo-count">{photoIndex + 1} / {photos.length}</span></>}
    </section>
    <section className="dl-vehicle-public-content">
      <div className="dl-vehicle-public-title"><div><p>{vehicle.year} · {vehicle.mileageKm.toLocaleString()} km</p><h1>{vehicle.make} {vehicle.model}</h1></div><strong>{money}</strong></div>
      <p className="dl-vehicle-public-location"><MapPin size={15}/>{[dealer.city,dealer.country].filter(Boolean).join(', ')}</p>
      <section className="dl-vehicle-public-section"><h2>Specifications</h2><div className="dl-vehicle-spec-grid">{specs.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      {vehicle.description && <section className="dl-vehicle-public-section"><h2>About this vehicle</h2><p>{vehicle.description}</p></section>}
      {!!vehicle.features?.length && <section className="dl-vehicle-public-section"><h2>Features</h2><div className="dl-vehicle-features">{vehicle.features.map(f => <span key={f}>{f}</span>)}</div></section>}
      <button className="dl-vehicle-dealer-card" onClick={() => navigate('/' + dealer.slug)}>{dealer.logoUrl ? <img src={dealer.logoUrl} alt=""/> : <span>{dealer.name.slice(0,2)}</span>}<div><strong>{dealer.name}</strong><small>{dealer.city} · View dealership</small></div><ArrowRight/></button>
    </section>
    <div className="dl-vehicle-public-actions">{wa && <a href={wa} target="_blank" rel="noreferrer">Enquire on WhatsApp</a>}{dealer.phone && <a className="secondary" href={'tel:' + dealer.phone}><Phone size={17}/> Call</a>}</div>
    <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} title={vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model} url={window.location.href} description={'View this vehicle at ' + dealer.name + '.'}/>
  </main>;
};
