import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '../components/common/Select';
import {
  CarFront, Heart, Home, MapPin, Phone,
  Search, Share2, SlidersHorizontal, X, Menu, MessageCircle, ChevronRight,
  Clock3, ArrowUpRight
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { planService } from '../services/planService';
import { isSupabaseConfigured } from '../lib/supabase';
import { absoluteUrl, homeTitle, pageTitle } from '../config/brand';
import type { Dealership, Vehicle } from '../types';
import { FeaturedVehicleCarousel } from '../components/storefront/FeaturedVehicleCarousel';
import './PublicShowroomPage.css';

interface PublicShowroomPageProps {
  slug?: string;
  previewDealership?: Dealership;
  previewVehicles?: Vehicle[];
}

const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M16 3.2A12.7 12.7 0 0 0 5.1 22.4L3.5 28.8l6.6-1.7A12.8 12.8 0 1 0 16 3.2Zm0 23.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.5 10.5 0 1 1 16 26.4Zm5.8-7.9c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.6 8.6 0 0 1-2.5-1.5 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.7-1.7-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.8 1.2 3.2 1.4 3.4 2.4 3.7 5.8 5.1c.8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4s-.3-.2-.6-.4Z" />
  </svg>
);

type Sheet = 'contact' | 'filters' | null;

export const PublicShowroomPage: React.FC<PublicShowroomPageProps> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate, showToast } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(previewDealership || null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewVehicles || []);
  const [loading, setLoading] = useState(!previewDealership);
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'inventory' | 'saved' | 'contact'>('home');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]')); }
    catch { setSaved([]); }
  }, []);

  // Only the dealership lookup determines whether the showroom exists. Inventory,
  // analytics and plan information are independent so their failures never hide it.
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (previewDealership) {
        setDealer(previewDealership);
        setVehicles(previewVehicles || []);
        setLoading(false);
        return;
      }
      if (!slug) {
        try {
          setDealer(storageService.getDealership());
          setVehicles(storageService.getVehicles());
        } catch (error) {
          console.error('Local showroom load failed:', error);
          setDealer(null);
        } finally { if (active) setLoading(false); }
        return;
      }
      if (!isSupabaseConfigured()) {
        try {
          const local = storageService.getDealership();
          if (local.slug === slug) {
            setDealer(local);
            setVehicles(storageService.getVehicles());
          } else setDealer(null);
        } catch (error) {
          console.error('Local showroom lookup failed:', error);
          setDealer(null);
        } finally { if (active) setLoading(false); }
        return;
      }
      try {
        const found = await supabaseService.getDealershipBySlug(slug);
        if (!active) return;
        setDealer(found);
        if (found) {
          void supabaseService.incrementStorefrontViews(found.slug).catch(error =>
            console.warn('Store visit analytics could not be recorded:', error)
          );
          try {
            const inventory = await supabaseService.getVehicles(found.id, true);
            if (active) setVehicles(inventory || []);
          } catch (error) {
            console.warn('Showroom inventory could not be loaded:', error);
            if (active) setVehicles([]);
          }
        }
      } catch (error) {
        console.error('Public showroom dealership lookup failed:', error);
        if (active) setDealer(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [slug, previewDealership, previewVehicles]);

  // Plan lookup is optional. A failed lookup keeps the Free-plan attribution visible.
  useEffect(() => {
    if (!dealer || previewDealership || !isSupabaseConfigured()) return;
    let active = true;
    void planService.getPublicPlan(dealer.id)
      .then(snapshot => {
        if (active) setShowPoweredBy(snapshot.config[snapshot.plan]?.showPoweredBy ?? true);
      })
      .catch(error => console.warn('Public showroom plan lookup failed; using default attribution:', error));
    return () => { active = false; };
  }, [dealer?.id, previewDealership]);

  const publicVehicles = useMemo(() => vehicles.filter(v => v.status !== 'draft' && v.status !== 'hidden'), [vehicles]);
  const available = useMemo(() => publicVehicles.filter(v => v.status === 'available'), [publicVehicles]);
  const makesWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    available.forEach(v => { if (v.make) counts.set(v.make, (counts.get(v.make) || 0) + 1); });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [available]);

  const filtered = useMemo(() => publicVehicles.filter(v => {
    if (savedOnly && !saved.includes(v.id)) return false;
    if (query && ![v.year, v.make, v.model, v.fuel, v.colour, v.description].join(' ').toLowerCase().includes(query.toLowerCase())) return false;
    if (make !== 'All' && v.make !== make) return false;
    if (minPrice && v.price < Number(minPrice)) return false;
    if (maxPrice && v.price > Number(maxPrice)) return false;
    if (yearFrom && v.year < Number(yearFrom)) return false;
    if (yearTo && v.year > Number(yearTo)) return false;
    if (transmission !== 'All' && v.transmission !== transmission) return false;
    if (fuel !== 'All' && v.fuel !== fuel) return false;
    return true;
  }).sort((a, b) => {
    const soldOrder = Number(a.status === 'sold') - Number(b.status === 'sold');
    if (soldOrder) return soldOrder;
    return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
  }), [publicVehicles, savedOnly, saved, query, make, minPrice, maxPrice, yearFrom, yearTo, transmission, fuel]);

  useEffect(() => {
    if (!dealer) return;
    const availableCount = vehicles.filter(v => v.status === 'available').length;
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
    const firstCarPhoto = vehicles.find(v => v.photos?.[0])?.photos?.[0];
    const shareImage = dealer.coverUrl || firstCarPhoto || dealer.logoUrl;
    setMeta('og:title', dealer.name, true);
    setMeta('og:description', availableCount + ' ' + (availableCount === 1 ? 'car available' : 'cars available') + ' at ' + dealer.name, true);
    if (shareImage) setMeta('og:image', shareImage, true);
    if (shareImage) setMeta('twitter:image', shareImage);
    const description = availableCount + ' ' + (availableCount === 1 ? 'car' : 'cars') + ' available at ' + dealer.name + '. Browse available vehicles in the showroom.';
    setMeta('description', description);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', dealer.name + ' cars');
    setMeta('twitter:description', description);
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) canonical = document.head.appendChild(document.createElement('link'));
    canonical.rel = 'canonical';
    canonical.href = absoluteUrl('/' + encodeURIComponent(dealer.slug));
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'AutoDealer',
      name: dealer.name,
      url: canonical.href,
      image: shareImage ? [shareImage] : undefined,
      telephone: dealer.phone || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: dealer.address || undefined,
        addressLocality: dealer.city || undefined,
        addressCountry: dealer.country || undefined,
      },
      makesOffer: vehicles.filter(vehicle => vehicle.status === 'available').map(vehicle => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Car', name: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') },
        price: vehicle.price,
        priceCurrency: vehicle.currency || dealer.currency,
        url: absoluteUrl('/' + encodeURIComponent(dealer.slug) + '/vehicle/' + vehicle.id),
      })),
    };
    let structuredData = document.querySelector('#dl-public-showroom-jsonld') as HTMLScriptElement | null;
    if (!structuredData) {
      structuredData = document.createElement('script');
      structuredData.id = 'dl-public-showroom-jsonld';
      structuredData.type = 'application/ld+json';
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify(jsonLd);
    return () => {
      document.title = homeTitle;
      document.querySelector('#dl-public-showroom-jsonld')?.remove();
    };
  }, [dealer, vehicles]);

  if (loading) return <main className="dl-public-showroom"><div className="dl-ps-loading"><span /></div></main>;
  if (!dealer) return <main className="dl-public-showroom dl-ps-unavailable"><div><h1>Showroom unavailable</h1><p>This dealership link may be incorrect or unpublished.</p></div></main>;

  const initials = dealer.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'DL';
  const city = [dealer.city, dealer.country].filter(Boolean).join(', ');
  const waNumber = (dealer.whatsapp || '').replace(/\D/g, '');
  const phone = dealer.phone || '';
  const hours = (dealer as any).hours || (dealer as any).openingHours || '';
  const firstCarPhoto = vehicles.find(v => v.photos?.[0])?.photos?.[0] || '';
  const heroImage = dealer.coverUrl || firstCarPhoto;
  const availableCount = available.length;
  const countLabel = (n: number) => n + ' ' + (n === 1 ? 'car' : 'cars');
  const money = (v: Vehicle) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: v.currency || dealer.currency, maximumFractionDigits: 0,
  }).format(v.price);
  // Use the exact public Storage URL saved with the vehicle. Rewriting it to
  // /render/image/public can fail when image transformations are unavailable
  // or the bucket does not support them, leaving both the hero and cards blank.
  const imageUrl = (source: string, ..._dimensions: number[]) => source || '';
  const toggleSave = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSaved(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      try { localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearFilters = () => {
    setQuery(''); setMake('All'); setMinPrice(''); setMaxPrice('');
    setYearFrom(''); setYearTo(''); setTransmission('All'); setFuel('All'); setSavedOnly(false);
  };
  const share = async () => {
    const url = absoluteUrl('/' + encodeURIComponent(dealer.slug));
    if (navigator.share) {
      try { await navigator.share({ title: dealer.name, text: 'Browse vehicles at ' + dealer.name, url }); } catch {}
    } else {
      try { await navigator.clipboard?.writeText(url); showToast('Showroom link copied'); }
      catch { showToast(url); }
    }
  };
  const generalMessage = 'Hi, I am interested in a car from ' + dealer.name;
  const recordGeneralWhatsAppEnquiry = () => {
    const enquiry = {
      dealershipId: dealer.id, buyerName: 'WhatsApp Buyer', buyerPhone: 'WhatsApp Link Click',
      message: generalMessage, stage: 'new' as const, source: 'whatsapp' as const,
      notes: 'Buyer clicked showroom WhatsApp contact link.',
    };
    if (isSupabaseConfigured()) {
      void supabaseService.createEnquiry(enquiry).catch(err => console.error('Could not record WhatsApp enquiry:', err));
    } else {
      try {
        storageService.saveDealership(dealer);
        void storageService.createEnquiryAsync(enquiry).catch(err => console.error('Could not record WhatsApp enquiry:', err));
      } catch (err) { console.error('Could not record WhatsApp enquiry:', err); }
    }
  };
  const openWhatsApp = () => {
    if (!waNumber) return;
    recordGeneralWhatsAppEnquiry();
    window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(generalMessage), '_blank', 'noopener,noreferrer');
  };
  const openContact = () => { setActiveTab('contact'); setSheet('contact'); };
  const browse = () => {
    setSavedOnly(false);
    setActiveTab('inventory');
    document.getElementById('available-cars')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const home = () => {
    setSavedOnly(false); setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onSearch = () => {
    if (activeTab === 'contact') { setActiveTab('inventory'); setSavedOnly(false); }
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const savedCount = publicVehicles.filter(v => saved.includes(v.id)).length;

  return (
    <main className="dl-public-showroom">
        <header className="dl-ps-header">
          <button type="button" className="dl-ps-brand" onClick={home} aria-label={dealer.name + ' home'}>
            <span className="dl-ps-avatar">
              {dealer.logoUrl ? <img src={dealer.logoUrl} alt="" /> : <span>{initials}</span>}
            </span>
            <span className="dl-ps-dealer-name">{dealer.name}</span>
          </button>
          <div className="dl-ps-header-actions">
            <button type="button" className="dl-ps-search-round" onClick={onSearch} aria-label="Search showroom"><Search size={19} /></button>
            <button type="button" className="dl-ps-menu-round" onClick={openContact} aria-label="Open showroom menu"><Menu size={20} /></button>
          </div>
        </header>
      {activeTab === 'home' && (
      <section className="dl-ps-hero" style={heroImage ? { backgroundImage: 'url("' + imageUrl(heroImage, 1600, 900) + '")' } : undefined}>
        <div className="dl-ps-hero-fade" />

        <div className="dl-ps-hero-content">
          {city && <span className="dl-ps-location-pill"><MapPin size={13} />{city}</span>}
          <h1>{dealer.tagline?.trim() && dealer.tagline.trim() !== 'Quality vehicles. Fair prices.' ? dealer.tagline.trim() : 'Find your next car.'}</h1>
          {availableCount > 0 && <p>{countLabel(availableCount)} available</p>}
          <button type="button" className="dl-ps-browse-button" onClick={browse}>Browse inventory <ChevronRight size={17} /></button>
        </div>
      </section>
      )}

      <div className="dl-ps-container">
        {activeTab === 'home' && availableCount > 0 && (
        <section className="dl-ps-trust-strip" aria-label="Dealership information">
          <div><strong>{availableCount}</strong><span>cars in stock</span></div>
          {waNumber && <div><strong>Replies on</strong><span>WhatsApp</span></div>}
          {city && <div><strong>Based in</strong><span>{dealer.city || dealer.country}</span></div>}
        </section>
        )}
        {activeTab === 'home' && <FeaturedVehicleCarousel dealer={dealer} vehicles={publicVehicles} onVehicleClick={id => navigate('/' + encodeURIComponent(dealer.slug) + '/vehicle/' + encodeURIComponent(id))} />}
        {(activeTab === 'inventory' || activeTab === 'saved') && (
        <section className="dl-ps-search-section" aria-label="Search and filter inventory">
          <div className="dl-ps-search-row">
            <label className="dl-ps-search-box">
              <Search size={19} />
              <input ref={searchInputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for cars... (e.g. Toyota, BMW)" aria-label="Search for cars" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
            </label>
            <button type="button" className="dl-ps-filter-trigger" onClick={() => { setActiveTab('inventory'); setSheet('filters'); }} aria-label="Open filters"><SlidersHorizontal size={19} /></button>
          </div>
          {makesWithCount.length > 1 && (
            <div className="dl-ps-chips-wrap">
              <div className="dl-ps-chips">
                <button type="button" className={'dl-ps-chip ' + (make === 'All' ? 'is-active' : '')} onClick={() => setMake('All')}>All cars <span>{availableCount}</span></button>
                {makesWithCount.map(item => <button key={item.name} type="button" className={'dl-ps-chip ' + (make === item.name ? 'is-active' : '')} onClick={() => setMake(item.name)}>{item.name} <span>{item.count}</span></button>)}
              </div>
            </div>
          )}
        </section>

        )}



        {activeTab !== 'contact' && activeTab !== 'home' && (
        <section className="dl-ps-listings-section" id="available-cars">
          {activeTab !== 'home' && (
          <div className="dl-ps-section-head">
            <h2>{savedOnly ? 'Saved cars' : 'Available cars'}</h2>
            {filtered.length > 0 && <span>{countLabel(filtered.length)}</span>}
          </div>
          )}
          {filtered.length > 0 ? (
            <div className="dl-ps-grid">
              {filtered.map((vehicle, index) => {
                const isSold = vehicle.status === 'sold';
                const isReserved = vehicle.status === 'reserved';
                const isSaved = saved.includes(vehicle.id);
                const hasPhoto = Boolean(vehicle.photos?.[0]);
                const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
                const specs = [
                  vehicle.mileageKm != null && Number(vehicle.mileageKm) > 0 ? Number(vehicle.mileageKm).toLocaleString() + ' km' : '',
                  vehicle.fuel || '',
                  vehicle.transmission || '',
                ].filter(Boolean);
                const vehicleUrl = '/' + dealer.slug + '/vehicle/' + vehicle.id;
                return (
                  <article key={vehicle.id} className={'dl-ps-card ' + (isSold ? 'is-sold' : '') + (!hasPhoto ? ' no-photo' : '')}>
                    <a className="dl-ps-card-link" href={vehicleUrl} aria-label={'View ' + title}>
                      <div className="dl-ps-card-media">
                        {hasPhoto ? (
                          <>
                            {!loadedImages.includes(vehicle.id) && <div className="dl-ps-image-skeleton" />}
                            <img src={imageUrl(vehicle.photos[0])} alt={title} className={'dl-ps-card-img ' + (loadedImages.includes(vehicle.id) ? 'is-loaded' : '')}
                              loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async"
                              width={1200} height={900} onLoad={() => setLoadedImages(current => current.includes(vehicle.id) ? current : [...current, vehicle.id])}
                              onError={() => setLoadedImages(current => current.includes(vehicle.id) ? current : [...current, vehicle.id])} />
                          </>
                        ) : <div className="dl-ps-no-photo-view"><CarFront size={58} /><span>Photo coming soon</span></div>}
                        {hasPhoto && <div className="dl-ps-card-gradient" />}
                        {(isReserved || isSold) && <span className={'dl-ps-status-pill ' + (isSold ? 'is-sold' : 'is-reserved')}>{isSold ? 'Sold' : 'Reserved'}</span>}
                        <div className="dl-ps-card-overlay">
                          <div className="dl-ps-card-copy">
                            <h3 title={title}>{title}</h3>
                            {specs.length > 0 && <div className="dl-ps-card-specs">{specs.map((spec, specIndex) => <React.Fragment key={spec}>{specIndex > 0 && <span className="dl-ps-spec-separator">•</span>}<span>{spec}</span></React.Fragment>)}</div>}
                            <strong className="dl-ps-card-price">{money(vehicle)}</strong>
                          </div>
                        </div>
                      </div>
                    </a>
                    <button type="button" className={'dl-ps-heart-btn ' + (isSaved ? 'is-saved' : '')} onClick={event => toggleSave(vehicle.id, event)} aria-label={isSaved ? 'Remove from saved' : 'Save car'}>
                      <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="dl-ps-empty-box">
              {savedOnly ? <><Heart size={34} /><h3>No saved cars</h3><p>Tap the heart on a car to save it.</p><button type="button" onClick={() => { setSavedOnly(false); setActiveTab('inventory'); }}>Browse inventory</button></>
                : publicVehicles.length === 0 ? <><h3>No vehicles listed yet</h3></>
                  : <><Search size={34} /><h3>No cars match your search</h3><button type="button" onClick={clearFilters}>Clear filters</button></>}
            </div>
          )}
        </section>

        )}

        {activeTab !== 'contact' && waNumber && (
          <button type="button" className="dl-ps-whatsapp-card" onClick={openWhatsApp}>
            <span className="dl-ps-whatsapp-icon"><WhatsAppIcon size={24} /></span>
            <span className="dl-ps-whatsapp-copy"><strong>Chat on WhatsApp</strong><small>Ask about any car</small></span>
            <span className="dl-ps-whatsapp-arrow"><ArrowUpRight size={20} /></span>
          </button>
        )}

        {activeTab !== 'contact' && <footer className="dl-ps-footer">
          <strong>{dealer.name}</strong>
          {phone && <a href={'tel:' + phone}><Phone size={14} />{phone}</a>}
          {dealer.address && <p><MapPin size={14} />{dealer.address}</p>}
          {hours && <p><Clock3 size={14} />{hours}</p>}
          {showPoweredBy && <span className="dl-ps-powered">Powered by Lotlé</span>}
        </footer>}
      </div>

      <nav className="dl-ps-bottom-bar" aria-label="Showroom navigation">
        <button type="button" className={activeTab === 'home' ? 'is-active' : ''} onClick={home}><Home size={19} /><span>Home</span></button>
        <button type="button" className={activeTab === 'inventory' ? 'is-active' : ''} onClick={browse}><CarFront size={19} /><span>Inventory</span></button>
        <button type="button" className={activeTab === 'saved' ? 'is-active' : ''} onClick={() => { setSavedOnly(true); setActiveTab('saved'); document.getElementById('available-cars')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span className="dl-ps-bottom-icon"><Heart size={19} />{savedCount > 0 && <i>{savedCount}</i>}</span><span>Saved</span></button>
        <button type="button" className={activeTab === 'contact' ? 'is-active' : ''} onClick={openContact}><MessageCircle size={19} /><span>Contact</span></button>
      </nav>

      {sheet && (
        <div className="dl-ps-sheet-backdrop" onClick={() => setSheet(null)}>
          <section className="dl-ps-sheet" role="dialog" aria-modal="true" aria-label={sheet === 'filters' ? 'Filter cars' : 'Contact dealership'} onClick={event => event.stopPropagation()}>
            <div className="dl-ps-sheet-handle" />
            <header><h2>{sheet === 'filters' ? 'Filter inventory' : dealer.name}</h2><button type="button" onClick={() => setSheet(null)} aria-label="Close"><X size={20} /></button></header>
            {sheet === 'contact' ? (
              <div className="dl-ps-contact-content">
                <button type="button" onClick={() => void share()}><Share2 size={18} /><span><strong>Share this showroom</strong><small>Send the showroom link to someone</small></span><ChevronRight size={17} /></button>
                {phone && <a href={'tel:' + phone}><Phone size={18} /><span><strong>Call</strong><small>{phone}</small></span><ChevronRight size={17} /></a>}
                {waNumber && <button type="button" onClick={openWhatsApp}><WhatsAppIcon size={19} /><span><strong>WhatsApp</strong><small>Chat with the dealership</small></span><ChevronRight size={17} /></button>}
                {dealer.address && <div><MapPin size={18} /><span><strong>Address</strong><small>{dealer.address}{city ? ', ' + city : ''}</small></span></div>}
                {hours && <div><Clock3 size={18} /><span><strong>Opening hours</strong><small>{hours}</small></span></div>}
              </div>
            ) : (
              <>
                <div className="dl-ps-sheet-grid">
                  <label>Minimum price<input type="number" min="0" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="Any" /></label>
                  <label>Maximum price<input type="number" min="0" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Any" /></label>
                  <label>Year from<input type="number" min="1950" value={yearFrom} onChange={event => setYearFrom(event.target.value)} placeholder="Any" /></label>
                  <label>Year to<input type="number" min="1950" value={yearTo} onChange={event => setYearTo(event.target.value)} placeholder="Any" /></label>
                  <div className="dl-ps-filter-select"><span>Transmission</span><Select title="Transmission" value={transmission} options={[{ value: 'All', label: 'All transmissions' }, { value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} onChange={setTransmission} /></div>
                  <div className="dl-ps-filter-select"><span>Fuel</span><Select title="Fuel" value={fuel} options={[{ value: 'All', label: 'All fuel types' }, ...Array.from(new Set(available.map(v => v.fuel).filter(Boolean))).map(value => ({ value, label: value }))]} onChange={setFuel} /></div>
                </div>
                <div className="dl-ps-sheet-actions"><button type="button" className="is-secondary" onClick={clearFilters}>Clear filters</button><button type="button" onClick={() => setSheet(null)}>Show {countLabel(filtered.length)}</button></div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
};
