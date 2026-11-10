import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CarFront, Gauge, Heart, MapPin, Pause, Play, Search, Share2, SlidersHorizontal, X } from 'lucide-react';
import { Select } from '../components/common/Select';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { planService } from '../services/planService';
import { isSupabaseConfigured } from '../lib/supabase';
import { absoluteUrl, homeTitle, pageTitle } from '../config/brand';
import type { Dealership, Vehicle } from '../types';
import './PublicShowroomPage.css';

interface PublicShowroomPageProps {
  slug?: string;
  previewDealership?: Dealership;
  previewVehicles?: Vehicle[];
}

export const PublicShowroomPage: React.FC<PublicShowroomPageProps> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate, showToast } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(previewDealership || null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewVehicles || []);
  const [loading, setLoading] = useState(!previewDealership);
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]'));
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setVideoAllowed(!reducedMotion && !connection?.saveData);
  }, []);

  // Preserve the existing public dealership and inventory fetches and view analytics.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (previewDealership) {
          setDealer(previewDealership);
          setVehicles(previewVehicles || []);
          setLoading(false);
          return;
        }
        if (!slug) {
          setDealer(storageService.getDealership());
          setVehicles(storageService.getVehicles());
          setLoading(false);
          return;
        }
        if (isSupabaseConfigured()) {
          const found = await supabaseService.getDealershipBySlug(slug);
          if (!active) return;
          setDealer(found);
          if (found) {
            const inventory = await supabaseService.getVehicles(found.id, true);
            if (active) setVehicles(inventory);
            void supabaseService.incrementStorefrontViews(found.slug).catch(() => undefined);
          }
        } else {
          const local = storageService.getDealership();
          if (local.slug === slug) {
            setDealer(local);
            setVehicles(storageService.getVehicles());
          } else {
            setDealer(null);
          }
        }
      } catch (error) {
        console.error('Public showroom load failed:', error);
        if (active) setDealer(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [slug, previewDealership, previewVehicles]);

  useEffect(() => {
    if (!dealer) return;
    let active = true;
    void planService.getPublicPlan(dealer.id)
      .then(snapshot => {
        if (active) setShowPoweredBy(snapshot.config[snapshot.plan].showPoweredBy);
      })
      .catch(error => console.error('[DriveLink plan] Public showroom plan lookup failed:', error));
    return () => { active = false; };
  }, [dealer?.id]);

  useEffect(() => {
    if (!dealer) return;
    const availableCount = vehicles.filter(vehicle => vehicle.status === 'available').length;
    document.title = pageTitle(dealer.name + ' cars');
    const setMeta = (key: string, value: string, property = false) => {
      let element = document.querySelector('meta[' + (property ? 'property' : 'name') + '="' + key + '"]') as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(property ? 'property' : 'name', key);
        document.head.appendChild(element);
      }
      element.content = value;
    };
    setMeta('og:title', dealer.name, true);
    setMeta('og:description', availableCount + (availableCount === 1 ? ' car available' : ' cars available') + ' at ' + dealer.name, true);
    const poster = dealer.coverUrl;
    if (poster) {
      const clean = poster.split('?')[0];
      const image = clean.includes('/storage/v1/object/public/')
        ? clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&height=630&resize=cover&quality=80'
        : clean;
      setMeta('og:image', image, true);
      setMeta('twitter:image', image);
    }
    const description = availableCount + (availableCount === 1 ? ' car' : ' cars') + ' available at ' + dealer.name + '. Browse the latest vehicles in the showroom.';
    setMeta('description', description);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', dealer.name + ' cars');
    setMeta('twitter:description', description);
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalElement = canonical || document.head.appendChild(document.createElement('link'));
    canonicalElement.rel = 'canonical';
    canonicalElement.href = absoluteUrl('/' + encodeURIComponent(dealer.slug));
    return () => { document.title = homeTitle; };
  }, [dealer, vehicles]);

  const publicVehicles = useMemo(
    () => vehicles.filter(vehicle => vehicle.status !== 'draft'),
    [vehicles]
  );
  const available = useMemo(
    () => publicVehicles.filter(vehicle => vehicle.status === 'available'),
    [publicVehicles]
  );
  const makes = useMemo(
    () => Array.from(new Set(available.map(vehicle => vehicle.make).filter(Boolean))).sort(),
    [available]
  );
  const newArrivals = useMemo(
    () => [...available].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')).slice(0, 4),
    [available]
  );
  const filtered = useMemo(() => available.filter(vehicle => {
    const haystack = [vehicle.year, vehicle.make, vehicle.model, vehicle.fuel, vehicle.colour, vehicle.description].join(' ').toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (make !== 'All' && vehicle.make !== make) return false;
    if (minPrice && vehicle.price < Number(minPrice)) return false;
    if (maxPrice && vehicle.price > Number(maxPrice)) return false;
    if (yearFrom && vehicle.year < Number(yearFrom)) return false;
    if (yearTo && vehicle.year > Number(yearTo)) return false;
    if (transmission !== 'All' && vehicle.transmission !== transmission) return false;
    if (fuel !== 'All' && vehicle.fuel !== fuel) return false;
    return true;
  }), [available, query, make, minPrice, maxPrice, yearFrom, yearTo, transmission, fuel]);

  if (loading) return <main className="dl-public-showroom"><div className="dl-ps-loading">Loading showroom…</div></main>;
  if (!dealer) return <main className="dl-public-showroom dl-ps-unavailable"><h1>Showroom unavailable</h1><p>This dealership link may be incorrect or unpublished.</p></main>;

  const bannerVideoUrl = dealer.bannerVideoUrl || '';
  const posterUrl = dealer.coverUrl || '';
  const canPlayVideo = Boolean(bannerVideoUrl && videoAllowed && !videoFailed);
  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');
  const money = (vehicle: Vehicle) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: vehicle.currency || dealer.currency,
    maximumFractionDigits: 0,
  }).format(vehicle.price);
  const vehicleUrl = (vehicle: Vehicle) => '/' + dealer.slug + '/vehicle/' + vehicle.id;
  const imageUrl = (source?: string) => {
    if (!source) return '';
    const clean = source.split('?')[0];
    return clean.includes('/storage/v1/object/public/')
      ? clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=900&height=675&resize=cover&quality=82&format=webp'
      : source;
  };
  const whatsappUrl = (vehicle: Vehicle) => {
    if (!waNumber) return '';
    const message = 'Hi ' + dealer.name + ', I am interested in the ' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + ' listed at ' + money(vehicle) + '. Is it still available?';
    return 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(message);
  };
  const recordWhatsAppEnquiry = (vehicle: Vehicle) => {
    const message = 'Hi ' + dealer.name + ', I am interested in the ' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + ' listed at ' + money(vehicle) + '. Is it still available?';
    const enquiry = {
      dealershipId: dealer.id,
      vehicleId: vehicle.id,
      buyerName: 'WhatsApp Buyer',
      buyerPhone: 'WhatsApp Link Click',
      message,
      stage: 'new' as const,
      source: 'whatsapp' as const,
      notes: 'Buyer clicked WhatsApp contact link from storefront.',
    };
    if (isSupabaseConfigured()) {
      void supabaseService.createEnquiry(enquiry).catch(error => {
        console.error('Could not record public WhatsApp enquiry:', error);
      });
    } else {
      try {
        storageService.saveDealership(dealer);
        void storageService.createEnquiryAsync(enquiry).catch(error => {
          console.error('Could not record local WhatsApp enquiry:', error);
        });
      } catch (error) {
        console.error('Could not record local WhatsApp enquiry:', error);
      }
    }
  };
  const toggleSave = (id: string) => setSaved(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    try { localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next)); } catch {}
    return next;
  });
  const scrollToCars = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const clearFilters = () => {
    setQuery('');
    setMake('All');
    setMinPrice('');
    setMaxPrice('');
    setYearFrom('');
    setYearTo('');
    setTransmission('All');
    setFuel('All');
  };
  const share = async () => {
    const url = absoluteUrl('/' + encodeURIComponent(dealer.slug));
    if (navigator.share) {
      try {
        await navigator.share({ title: dealer.name, text: 'Browse vehicles at ' + dealer.name, url });
      } catch { /* share sheet dismissed */ }
    } else {
      await navigator.clipboard?.writeText(url);
      showToast('Showroom link copied');
    }
  };
  const card = (vehicle: Vehicle) => (
    <article className="dl-ps-car" key={vehicle.id}>
      <button className="dl-ps-card-image-button" onClick={() => navigate(vehicleUrl(vehicle))} aria-label={'View ' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model}>
        {vehicle.photos?.[0]
          ? <img className="dl-ps-card-image" src={imageUrl(vehicle.photos[0])} alt={vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model} loading="lazy" decoding="async" />
          : <span className="dl-ps-no-photo"><CarFront size={32} /></span>}
        <span className="dl-ps-image-count">{(vehicle.photos || []).length} {(vehicle.photos || []).length === 1 ? 'PHOTO' : 'PHOTOS'}</span>
        <span className="dl-ps-card-heart" onClick={event => { event.stopPropagation(); toggleSave(vehicle.id); }} role="button" tabIndex={0} aria-label={saved.includes(vehicle.id) ? 'Remove saved vehicle' : 'Save vehicle'} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggleSave(vehicle.id); } }}>
          <Heart size={17} fill={saved.includes(vehicle.id) ? 'currentColor' : 'none'} />
        </span>
      </button>
      <div className="dl-ps-car-info">
        <button className="dl-ps-car-title" onClick={() => navigate(vehicleUrl(vehicle))}>{(vehicle.make + ' ' + vehicle.model).toUpperCase()}</button>
        <strong className="dl-ps-car-price">{money(vehicle)}</strong>
        <div className="dl-ps-car-chips">
          <span><CalendarDays size={12} />{vehicle.year}</span>
          <span><Gauge size={12} />{Number(vehicle.mileageKm || 0).toLocaleString()} KM</span>
        </div>
        {waNumber ? (
          <a className="dl-ps-enquiry-button" href={whatsappUrl(vehicle)} target="_blank" rel="noreferrer" onClick={() => recordWhatsAppEnquiry(vehicle)}>
            <span>WHATSAPP ENQUIRY</span>
          </a>
        ) : (
          <button className="dl-ps-enquiry-button is-disabled" type="button" disabled>WHATSAPP UNAVAILABLE</button>
        )}
      </div>
    </article>
  );

  return (
    <main className="dl-public-showroom">
      <section className="dl-ps-hero" aria-label={dealer.name + ' showroom'}>
        {canPlayVideo ? (
          <video
            ref={videoRef}
            className="dl-ps-hero-media"
            src={bannerVideoUrl}
            poster={posterUrl || undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
          />
        ) : posterUrl ? (
          <img className="dl-ps-hero-media" src={posterUrl} alt="" fetchPriority="high" decoding="async" />
        ) : (
          <div className="dl-ps-hero-media dl-ps-hero-empty" />
        )}
        <div className="dl-ps-hero-overlay" />
        <div className="dl-ps-hero-content">
          <h1>{dealer.name.toUpperCase()}</h1>
          <button className="dl-ps-view-cars" onClick={() => scrollToCars('dl-ps-new-arrivals')}>VIEW CARS</button>
        </div>
        {canPlayVideo && (
          <button
            className="dl-ps-video-toggle"
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (video.paused) void video.play().catch(() => setVideoPlaying(false));
              else video.pause();
            }}
            aria-label={videoPlaying ? 'Pause banner video' : 'Play banner video'}
          >
            {videoPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
        )}
      </section>

      <div className="dl-ps-content">
        <section className="dl-ps-section" id="dl-ps-new-arrivals">
          <div className="dl-ps-section-heading">
            <h2>NEW ARRIVALS</h2>
            <button type="button" onClick={() => scrollToCars('dl-ps-all-cars')}>VIEW ALL</button>
          </div>
          {newArrivals.length ? (
            <div className="dl-ps-grid">{newArrivals.map(card)}</div>
          ) : (
            <div className="dl-ps-empty"><CarFront size={28} /><p>New vehicles will appear here when listed.</p></div>
          )}
        </section>

        <section className="dl-ps-section dl-ps-all-section" id="dl-ps-all-cars">
          <div className="dl-ps-section-heading">
            <h2>ALL CARS</h2>
            <span>{filtered.length} {filtered.length === 1 ? 'VEHICLE' : 'VEHICLES'}</span>
          </div>
          <div className="dl-ps-tools">
            <label className="dl-ps-search">
              <Search size={17} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicles" aria-label="Search vehicles" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
            </label>
            <button className="dl-ps-filter-button" type="button" onClick={() => setFilterOpen(true)} aria-label="Open filters"><SlidersHorizontal size={18} /></button>
            <button className="dl-ps-share-button" type="button" onClick={() => void share()} aria-label="Share showroom"><Share2 size={18} /></button>
          </div>
          {makes.length > 1 && (
            <div className="dl-ps-make-chips">
              <button className={make === 'All' ? 'active' : ''} onClick={() => setMake('All')}>ALL</button>
              {makes.map(item => <button key={item} className={make === item ? 'active' : ''} onClick={() => setMake(item)}>{item.toUpperCase()}</button>)}
            </div>
          )}
          {filtered.length ? (
            <div className="dl-ps-grid">{filtered.map(card)}</div>
          ) : (
            <div className="dl-ps-empty"><Search size={28} /><h3>{available.length ? 'No matching vehicles' : 'No cars listed yet'}</h3><p>{available.length ? 'Try changing your search or filters.' : 'Check back soon for new arrivals.'}</p>{available.length > 0 && <button onClick={clearFilters}>CLEAR FILTERS</button>}</div>
          )}
        </section>
      </div>

      <footer className="dl-ps-footer">
        <strong>{dealer.name}</strong>
        <span>{[dealer.city, dealer.country].filter(Boolean).join(', ')}</span>
        {dealer.phone && <a href={'tel:' + dealer.phone}>{dealer.phone}</a>}
        {showPoweredBy && <span className="dl-ps-powered">POWERED BY DRIVELINK</span>}
      </footer>

      {filterOpen && (
        <div className="dl-ps-filter-backdrop" onClick={() => setFilterOpen(false)}>
          <section className="dl-ps-filter-sheet" onClick={event => event.stopPropagation()} aria-label="Vehicle filters">
            <div className="dl-ps-filter-handle" />
            <header><h2>FILTER CARS</h2><button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters"><X size={20} /></button></header>
            <div className="dl-ps-filter-fields">
              <div className="dl-ps-filter-field"><span>MAKE</span><Select title="Make" value={make} options={[{ value: 'All', label: 'All makes' }, ...makes.map(item => ({ value: item, label: item }))]} onChange={setMake} /></div>
              <label>MINIMUM PRICE<input type="number" min="0" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="Any" /></label>
              <label>MAXIMUM PRICE<input type="number" min="0" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Any" /></label>
              <label>YEAR FROM<input type="number" min="1950" value={yearFrom} onChange={event => setYearFrom(event.target.value)} placeholder="Any" /></label>
              <label>YEAR TO<input type="number" min="1950" value={yearTo} onChange={event => setYearTo(event.target.value)} placeholder="Any" /></label>
              <div className="dl-ps-filter-field"><span>TRANSMISSION</span><Select title="Transmission" value={transmission} options={[{ value: 'All', label: 'All' }, { value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} onChange={setTransmission} /></div>
              <div className="dl-ps-filter-field"><span>FUEL TYPE</span><Select title="Fuel type" value={fuel} options={[{ value: 'All', label: 'All' }, ...Array.from(new Set(available.map(vehicle => vehicle.fuel))).map(item => ({ value: item, label: item }))]} onChange={setFuel} /></div>
            </div>
            <div className="dl-ps-filter-actions">
              <button type="button" onClick={clearFilters}>CLEAR ALL</button>
              <button type="button" onClick={() => setFilterOpen(false)}>SHOW {filtered.length} CARS</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
