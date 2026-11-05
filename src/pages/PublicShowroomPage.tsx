import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DriveLinkLogo } from '../components/common/DriveLinkLogo';
import { Select } from '../components/common/Select';
import { CalendarDays, CarFront, Fuel, Gauge, Heart, MapPin, Phone, Search, Share2, SlidersHorizontal, X, ArrowRight } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Dealership, Vehicle } from '../types';
import './PublicShowroomPage.css';

const WhatsAppMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M16.02 3.2A12.55 12.55 0 0 0 5.24 22.2L3.5 28.55l6.5-1.7a12.7 12.7 0 0 0 6.02 1.52h.01c6.96 0 12.62-5.66 12.62-12.62 0-3.37-1.31-6.54-3.69-8.92a12.53 12.53 0 0 0-8.94-3.63Zm0 22.99h-.01a10.5 10.5 0 0 1-5.35-1.46l-.38-.23-3.86 1.01 1.03-3.76-.25-.39a10.43 10.43 0 1 1 8.82 4.83Zm5.73-7.82c-.31-.16-1.82-.9-2.1-1-.28-.1-.49-.16-.7.16-.2.31-.8 1- .98 1.2-.18.2-.36.23-.67.08-.31-.16-1.3-.48-2.47-1.52-.91-.81-1.53-1.82-1.71-2.13-.18-.31-.02-.48.14-.64.14-.14.31-.36.46-.54.15-.18.2-.31.31-.52.1-.2.05-.39-.03-.54-.08-.15-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.57s1.1 2.98 1.25 3.19c.15.2 2.16 3.3 5.23 4.63.73.31 1.3.5 1.74.64.73.23 1.4.2 1.93.12.59-.09 1.82-.74 2.08-1.46.26-.72.26-1.33.18-1.46-.08-.13-.28-.2-.59-.36Z" />
  </svg>
);

export const PublicShowroomPage: React.FC<{ slug?: string; previewDealership?: Dealership; previewVehicles?: Vehicle[] }> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate, showToast, currentPath } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(previewDealership || null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewVehicles || []);
  const [loading, setLoading] = useState(!previewDealership);
  const sessionKey = 'drivelink:showroom-seen:' + (slug || previewDealership?.slug || 'preview');
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (/(?:\/cars|\/browse)$/.test(window.location.pathname.replace(/\/$/, ''))) return false;
    try { return window.sessionStorage.getItem(sessionKey) !== '1'; } catch { return true; }
  });
  useEffect(() => {
    const handleBackToLanding = () => {
      try { window.sessionStorage.setItem(sessionKey + ':back', '1'); } catch { /* session storage may be unavailable */ }
    };
    window.addEventListener('popstate', handleBackToLanding);
    return () => window.removeEventListener('popstate', handleBackToLanding);
  }, [sessionKey]);

  useEffect(() => {
    const isBrowseRoute = /(?:\/cars|\/browse)$/.test(currentPath.replace(/\/$/, ''));
    let seen = false;
    let returningByBack = false;
    try {
      seen = window.sessionStorage.getItem(sessionKey) === '1';
      returningByBack = window.sessionStorage.getItem(sessionKey + ':back') === '1';
      if (returningByBack) window.sessionStorage.removeItem(sessionKey + ':back');
    } catch { /* session storage may be unavailable */ }
    if (!isBrowseRoute && seen && !returningByBack && slug) {
      navigate('/' + encodeURIComponent(slug) + '/cars');
      setShowLanding(false);
      return;
    }
    setShowLanding(!isBrowseRoute);
  }, [sessionKey, currentPath, slug, navigate]);

  const [bannerFailed, setBannerFailed] = useState(false);
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false);
  const [leavingLanding, setLeavingLanding] = useState(false);
  useEffect(() => {
    if (!showLanding) return;
    const previous = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previous;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [showLanding, currentPath]);

  const [query, setQuery] = useState('');
  const [make, setMake] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [fabVisible, setFabVisible] = useState(true);
  const listingRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const lastScroll = useRef(0);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]')); } catch { setSaved([]); }
  }, []);

  // Keep the existing showroom data-loading and view-count behaviour unchanged.
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
          if (local.slug === slug) { setDealer(local); setVehicles(storageService.getVehicles()); }
          else setDealer(null);
        }
      } catch {
        if (active) setDealer(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [slug, previewDealership, previewVehicles]);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      const footerVisible = (footerRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY) < window.innerHeight;
      setFabVisible(!footerVisible && (y < 40 || y < lastScroll.current));
      lastScroll.current = y;
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) setFabVisible(false);
    }, { threshold: 0.05 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [loading, dealer]);



  useEffect(() => {
    if (!dealer) return;
    const city = dealer.city || dealer.country;
    const count = vehicles.filter(v => v.status === 'available').length;
    document.title = dealer.name + ' | Cars available';
    const setMeta = (key: string, value: string, property = false) => {
      let el = document.querySelector('meta[' + (property ? 'property' : 'name') + '="' + key + '"]') as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute(property ? 'property' : 'name', key); document.head.appendChild(el); }
      el.content = value;
    };
    setMeta('og:title', dealer.name, true);
    setMeta('og:description', count + (count === 1 ? ' car available in ' : ' cars available in ') + city, true);
    if (dealer.coverUrl) {
      const ogImage = dealer.coverUrl.replace(/\/banner\.webp(?:\?.*)?$/, '/banner-og.webp');
      const transformedFallback = dealer.coverUrl.includes('/storage/v1/object/public/')
        ? dealer.coverUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&height=630&resize=cover&quality=80'
        : dealer.coverUrl;
      setMeta('og:image', transformedFallback, true);
      void fetch(ogImage, { method: 'HEAD' }).then(response => {
        if (response.ok) setMeta('og:image', ogImage, true);
      }).catch(() => undefined);
      setMeta('og:image:width', '1200', true);
      setMeta('og:image:height', '630', true);
    }
    setMeta('description', count + (count === 1 ? ' car available in ' : ' cars available in ') + city + '. Browse the showroom at ' + dealer.name + '.');
    return () => { document.title = 'DriveLink | Online Showrooms for Car Dealerships'; };
  }, [dealer, vehicles]);

  const available = useMemo(() => vehicles.filter(v => v.status === 'available'), [vehicles]);
  const makes = useMemo(() => Array.from(new Set(available.map(v => v.make).filter(Boolean))).sort(), [available]);
  const filtered = useMemo(() => vehicles.filter(v => {
    const hay = [v.year, v.make, v.model, v.fuel, v.colour, v.description].join(' ').toLowerCase();
    if (v.status === 'draft') return false;
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (make !== 'All' && v.make !== make) return false;
    if (savedOnly && !saved.includes(v.id)) return false;
    if (minPrice && v.price < Number(minPrice)) return false;
    if (maxPrice && v.price > Number(maxPrice)) return false;
    if (yearFrom && v.year < Number(yearFrom)) return false;
    if (yearTo && v.year > Number(yearTo)) return false;
    if (transmission !== 'All' && v.transmission !== transmission) return false;
    if (fuel !== 'All' && v.fuel !== fuel) return false;
    return true;
  }).sort((a, b) => (a.status === 'sold' ? 1 : 0) - (b.status === 'sold' ? 1 : 0)), [vehicles, query, make, savedOnly, saved, minPrice, maxPrice, yearFrom, yearTo, transmission, fuel]);

  if (loading) return <main className="dl-public-showroom"><div className="dl-ps-loading">Loading showroom…</div></main>;
  if (!dealer) return <main className="dl-public-showroom dl-ps-unavailable"><h1>Showroom unavailable</h1><p>This dealership link may be incorrect or unpublished.</p></main>;

  const initials = dealer.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'DL';
  const city = [dealer.city, dealer.country].filter(Boolean).join(', ');
  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');
  const wa = (message: string) => waNumber ? 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(message) : '';
  const generalMessage = 'Hi, I am interested in a car from your showroom';
  const money = (v: Vehicle) => new Intl.NumberFormat('en-US', { style: 'currency', currency: v.currency || dealer.currency, maximumFractionDigits: 0 }).format(v.price);
  const toggleSave = (id: string) => setSaved(old => {
    const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id];
    localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next));
    return next;
  });
  const share = async () => {
    const url = window.location.origin + '/' + encodeURIComponent(dealer.slug);
    if (navigator.share) {
      try { await navigator.share({ title: dealer.name, text: available.length + ' cars available in ' + (dealer.city || dealer.country), url }); } catch { /* share dismissed */ }
    } else {
      await navigator.clipboard?.writeText(url);
      showToast('Showroom link copied');
    }
  };
  const clear = () => {
    setMinPrice(''); setMaxPrice(''); setYearFrom(''); setYearTo('');
    setTransmission('All'); setFuel('All'); setMake('All'); setSavedOnly(false); setQuery('');
  };
  const scrollCars = () => {
    try { window.sessionStorage.setItem(sessionKey, '1'); } catch { /* session storage may be unavailable */ }
    navigate('/' + encodeURIComponent(dealer.slug) + '/cars');
  };
  const goVehicle = (vehicle: Vehicle) => navigate('/' + dealer.slug + '/vehicle/' + vehicle.id);
  const countLabel = (count: number) => count + (count === 1 ? ' car' : ' cars');

  return (
    <main className="dl-public-showroom">
      {showLanding && (
        <section className={'dl-ps-landing ' + (!dealer.coverUrl || bannerFailed ? 'has-no-banner' : '') + (leavingLanding ? ' is-leaving' : '')} aria-label="Showroom welcome">
          {dealer.coverUrl && !bannerFailed ? (
            <>
              <div className="dl-ps-landing-placeholder" />
              <img className="dl-ps-landing-image" src={dealer.coverUrl} alt="" fetchPriority="high" loading="eager" decoding="async" onError={() => { console.error('[DriveLink showroom] Banner failed to load:', dealer.coverUrl); setBannerFailed(true); }} />
            </>
            ) : !fallbackImageFailed && vehicles.find(vehicle => vehicle.photos?.[0]) ? <img className="dl-ps-landing-image" src={vehicles.find(vehicle => vehicle.photos?.[0])?.photos?.[0]} alt="" fetchPriority="high" loading="eager" decoding="async" onError={() => { console.error('[DriveLink showroom] First vehicle cover failed to load.'); setFallbackImageFailed(true); }} /> : <div className="dl-ps-landing-fallback" />}
          <div className="dl-ps-landing-top-shade" />
          <div className="dl-ps-landing-bottom-shade" />
          <div className="dl-ps-landing-top">
            <div className="dl-ps-landing-identity">
              <div className="dl-ps-logo">{dealer.logoUrl ? <img src={dealer.logoUrl} alt="" /> : <span>{initials}</span>}</div>
              <div><strong>{dealer.name}</strong><small>{city}</small></div>
            </div>
            <button className="dl-ps-round-share" onClick={() => void share()} aria-label="Share showroom"><Share2 size={19} /></button>
          </div>
          {(!dealer.coverUrl || bannerFailed) && (
            <div className="dl-ps-fallback-logo">{dealer.logoUrl ? <img src={dealer.logoUrl} alt={dealer.name} /> : <span>{initials}</span>}</div>
          )}
          <div className="dl-ps-landing-copy">
            <h1>{dealer.tagline?.trim() && dealer.tagline.trim() !== 'Quality vehicles. Fair prices.' && dealer.tagline.trim() !== dealer.name ? dealer.tagline.trim() : 'Find your next car.'}</h1>
            <p>{countLabel(available.length)} available{dealer.city ? ' · ' + dealer.city : ''}</p>
            <div className="dl-ps-landing-actions">
              <button className="dl-ps-explore" onClick={scrollCars}>Explore cars <i><ArrowRight size={16} /></i></button>
              {waNumber && <a className="dl-ps-landing-wa" href={wa(generalMessage)} target="_blank" rel="noreferrer" aria-label="Contact dealership on WhatsApp"><WhatsAppMark size={22} /></a>}
            </div>
          </div>
        </section>
      )}

      {!showLanding && <>
      <section className="dl-ps-listings" ref={listingRef} id="available-cars">
        <header className="dl-ps-list-header">
          <div className="dl-ps-list-brand">
            <div className="dl-ps-logo is-light">{dealer.logoUrl ? <img src={dealer.logoUrl} alt="" /> : <span>{initials}</span>}</div>
            <div><strong>{dealer.name}</strong><small><MapPin size={12} />{city}</small></div>
          </div>
          <button className="dl-ps-round-share is-light-share" onClick={() => void share()} aria-label="Share showroom"><Share2 size={18} /></button>
        </header>

        <div className="dl-ps-search-row">
          <label><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search cars…" aria-label="Search cars" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
          <button className="dl-ps-filter-trigger" onClick={() => setFilterOpen(true)} aria-label="Filters"><SlidersHorizontal size={19} /></button>
        </div>

        {makes.length > 1 && (
          <div className="dl-ps-chips">
            <button className={make === 'All' && !savedOnly ? 'active' : ''} onClick={() => { setMake('All'); setSavedOnly(false); }}>All</button>
            {makes.map(item => <button key={item} className={make === item && !savedOnly ? 'active' : ''} onClick={() => { setMake(item); setSavedOnly(false); }}>{item}</button>)}
          </div>
        )}

        <div className="dl-ps-section-title"><h1>Available cars</h1><span>{countLabel(filtered.length)}</span></div>

        {filtered.length ? (
          <div className="dl-ps-grid">
            {filtered.map(vehicle => (
              <article className="dl-ps-car" key={vehicle.id} role="link" tabIndex={0} onClick={() => goVehicle(vehicle)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goVehicle(vehicle); } }}>
                <div className="dl-ps-photo">
                  {vehicle.photos?.[0] ? <img loading="lazy" decoding="async" src={vehicle.photos[0]} alt={vehicle.make + ' ' + vehicle.model} /> : <span className="dl-ps-no-photo"><CarFront size={36} /></span>}
                  {vehicle.status !== 'available' && <span className={'dl-ps-status ' + vehicle.status}>{vehicle.status === 'reserved' ? 'Reserved' : 'Sold'}</span>}
                  <span className="dl-ps-photo-count">{(vehicle.photos || []).length} {(vehicle.photos || []).length === 1 ? 'photo' : 'photos'}</span>
                  <button className={'dl-ps-heart ' + (saved.includes(vehicle.id) ? 'saved' : '')} onClick={e => { e.stopPropagation(); toggleSave(vehicle.id); }} onKeyDown={e => e.stopPropagation()} aria-label={saved.includes(vehicle.id) ? 'Remove saved car' : 'Save car'}><Heart fill={saved.includes(vehicle.id) ? 'currentColor' : 'none'} size={18} /></button>
                </div>
                <div className="dl-ps-car-info">
                  <div className="dl-ps-car-heading"><h2>{vehicle.make} {vehicle.model}</h2><strong>{money(vehicle)}</strong></div>
                  <div className="dl-ps-specs">
                    <span><CalendarDays size={14} />{vehicle.year}</span>
                    <span><Gauge size={14} />{Number(vehicle.mileageKm || 0).toLocaleString()} km</span>
                    <span><Fuel size={14} />{vehicle.fuel}</span>
                    <span><CarFront size={14} />{vehicle.transmission}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="dl-ps-empty"><CarFront size={32} /><h2>No cars listed yet</h2><p>Check back soon or contact the dealership.</p>{waNumber && <a href={wa(generalMessage)} target="_blank" rel="noreferrer">Message us on WhatsApp</a>}</div>
        ) : (
          <div className="dl-ps-empty"><Search size={30} /><h2>No cars match your search</h2><button onClick={clear}>Clear filters</button></div>
        )}
      </section>

      <footer className="dl-ps-footer" ref={footerRef}>
        <strong>{dealer.name}</strong>
        {dealer.phone && <a href={'tel:' + dealer.phone}><Phone size={14} />{dealer.phone}</a>}
        {dealer.address && <p><MapPin size={14} />{dealer.address}</p>}
        {(dealer as Dealership & { hours?: string }).hours && <p>{(dealer as Dealership & { hours?: string }).hours}</p>}
        <a className="dl-ps-powered" href="https://drivelink.app.zw" aria-label="Powered by DriveLink"><span>Powered by</span><DriveLinkLogo variant="light" size="sm" /></a>
      </footer>

      {waNumber && <a className={'dl-ps-floating-wa ' + (!fabVisible ? 'hidden' : '')} href={wa(generalMessage)} target="_blank" rel="noreferrer" aria-label="Message dealership on WhatsApp"><WhatsAppMark size={24} /></a>}

      {filterOpen && (
        <div className="dl-ps-backdrop" onClick={() => setFilterOpen(false)}>
          <section className="dl-ps-filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="dl-ps-handle" />
            <header><h2>Filters</h2><button onClick={() => setFilterOpen(false)} aria-label="Close filters"><X /></button></header>
            <div className="dl-ps-filter-grid">
              <label>Minimum price<input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Any" /></label>
              <label>Maximum price<input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Any" /></label>
              <label>Year from<input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="Any" /></label>
              <label>Year to<input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="Any" /></label>
            </div>
            <div className="dl-ps-filter-select"><span>Transmission</span><Select value={transmission} title="Transmission" options={[{ value: 'All', label: 'All' }, { value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} onChange={setTransmission} /></div>
            <div className="dl-ps-filter-select"><span>Fuel type</span><Select value={fuel} title="Fuel type" options={[{ value: 'All', label: 'All' }, ...Array.from(new Set(vehicles.map(v => v.fuel))).map(item => ({ value: item, label: item }))]} onChange={setFuel} /></div>
            <div className="dl-ps-sheet-actions"><button onClick={clear}>Clear all</button><button onClick={() => setFilterOpen(false)}>Show {filtered.length} cars</button></div>
          </section>
        </div>
      )}
      </>}
    </main>
  );
};
