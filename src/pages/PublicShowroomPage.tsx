import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Camera,
  CarFront,
  Fuel,
  Gauge,
  Heart,
  MapPin,
  Phone,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { Select } from '../components/common/Select';
import { Logo } from '../components/common/Logo';
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

const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M16 3.2A12.7 12.7 0 0 0 5.1 22.4L3.5 28.8l6.6-1.7A12.8 12.8 0 1 0 16 3.2Zm0 23.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.5 10.5 0 1 1 16 26.4Zm5.8-7.9c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.6 8.6 0 0 1-2.5-1.5 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.7-1.7-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.8 1.2 3.2 1.4 3.4 2.4 3.7 5.8 5.1c.8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4s-.3-.2-.6-.4Z" />
  </svg>
);

export const PublicShowroomPage: React.FC<PublicShowroomPageProps> = ({ slug, previewDealership, previewVehicles }) => {
  const { navigate, showToast } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(previewDealership || null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewVehicles || []);
  const [loading, setLoading] = useState(!previewDealership);
  const [showPoweredBy, setShowPoweredBy] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);

  // View state
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [quickFilter, setQuickFilter] = useState<'all' | 'underPrice' | 'automatic' | 'newest'>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]'));
    } catch {
      setSaved([]);
    }
  }, []);

  // Public dealership and inventory fetching + view analytics
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

  // Plan rules for footer "Powered by Lotlé"
  useEffect(() => {
    if (!dealer) return;
    let active = true;
    void planService.getPublicPlan(dealer.id)
      .then(snapshot => {
        if (active) setShowPoweredBy(snapshot.config[snapshot.plan].showPoweredBy);
      })
      .catch(error => console.error('[Lotle plan] Public showroom plan lookup failed:', error));
    return () => { active = false; };
  }, [dealer?.id]);

  // Page title, metadata & social cards (og:image uses first car cover photo, fallback to logo)
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
    setMeta('og:title', dealer.name, true);
    setMeta('og:description', `${availableCount} ${availableCount === 1 ? 'car available' : 'cars available'} at ${dealer.name}`, true);

    const firstCarPhoto = vehicles.find(v => v.photos?.[0])?.photos?.[0];
    const shareImage = firstCarPhoto || dealer.logoUrl;
    if (shareImage) {
      const clean = shareImage.split('?')[0];
      const image = clean.includes('/storage/v1/object/public/')
        ? clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&height=630&resize=cover&quality=80'
        : clean;
      setMeta('og:image', image, true);
      setMeta('twitter:image', image);
    }
    const description = `${availableCount} ${availableCount === 1 ? 'car' : 'cars'} available at ${dealer.name}. Browse available vehicles in the showroom.`;
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
    () => vehicles.filter(v => v.status !== 'draft'),
    [vehicles]
  );
  const available = useMemo(
    () => publicVehicles.filter(v => v.status === 'available'),
    [publicVehicles]
  );

  // Makes in stock with count
  const makesWithCount = useMemo(() => {
    const map = new Map<string, number>();
    available.forEach(v => {
      if (v.make) map.set(v.make, (map.get(v.make) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([m, count]) => ({ make: m, count }))
      .sort((a, b) => a.make.localeCompare(b.make));
  }, [available]);

  // Featured Car: only if dealer has 2 or more available cars, pick the most recently added available car
  const featuredCar = useMemo(() => {
    if (available.length < 2) return null;
    return [...available].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0];
  }, [available]);

  const currencySymbol = dealer?.currency === 'ZAR' ? 'R' : '$';
  const underPriceThreshold = dealer?.currency === 'ZAR' ? 100000 : 5000;
  const underPriceLabel = dealer?.currency === 'ZAR' ? 'Under R100,000' : 'Under $5,000';

  // Check which browse tiles have matching cars
  const hasUnderPrice = useMemo(
    () => available.some(v => v.price <= underPriceThreshold),
    [available, underPriceThreshold]
  );
  const hasAutomatic = useMemo(
    () => available.some(v => v.transmission === 'Automatic'),
    [available]
  );

  // Filtered vehicles
  const filtered = useMemo(() => {
    return publicVehicles.filter(v => {
      // Saved filter
      if (savedOnly && !saved.includes(v.id)) return false;

      // Text query
      if (query) {
        const hay = [v.year, v.make, v.model, v.fuel, v.colour, v.description].join(' ').toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }

      // Make chip
      if (make !== 'All' && v.make !== make) return false;

      // Quick browse tile filters
      if (quickFilter === 'underPrice' && v.price > underPriceThreshold) return false;
      if (quickFilter === 'automatic' && v.transmission !== 'Automatic') return false;

      // Sheet filters
      if (minPrice && v.price < Number(minPrice)) return false;
      if (maxPrice && v.price > Number(maxPrice)) return false;
      if (yearFrom && v.year < Number(yearFrom)) return false;
      if (yearTo && v.year > Number(yearTo)) return false;
      if (transmission !== 'All' && v.transmission !== transmission) return false;
      if (fuel !== 'All' && v.fuel !== fuel) return false;

      return true;
    }).sort((a, b) => {
      // Dimmed and sorted last: sold cars
      const aSold = a.status === 'sold' ? 1 : 0;
      const bSold = b.status === 'sold' ? 1 : 0;
      if (aSold !== bSold) return aSold - bSold;

      // When "Newest" tile is selected, sort by year descending, then date descending
      if (quickFilter === 'newest') {
        if (b.year !== a.year) return b.year - a.year;
        return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
      }

      // Default: newly updated/created first
      return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
    });
  }, [publicVehicles, savedOnly, saved, query, make, quickFilter, underPriceThreshold, minPrice, maxPrice, yearFrom, yearTo, transmission, fuel]);

  if (loading) {
    return (
      <main className="dl-public-showroom">
        <div className="dl-ps-loading">Loading showroom…</div>
      </main>
    );
  }

  if (!dealer) {
    return (
      <main className="dl-public-showroom dl-ps-unavailable">
        <h1>Showroom unavailable</h1>
        <p>This dealership link may be incorrect or unpublished.</p>
      </main>
    );
  }

  const initials = dealer.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'DL';
  const city = [dealer.city, dealer.country].filter(Boolean).join(', ');
  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');
  const generalMessage = `Hi, I am interested in a car from ${dealer.name}`;

  const money = (v: Vehicle) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: v.currency || dealer.currency,
    maximumFractionDigits: 0,
  }).format(v.price);

  const getThumbnailUrl = (source?: string) => {
    if (!source) return '';
    const clean = source.split('?')[0];
    return clean.includes('/storage/v1/object/public/')
      ? clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=900&height=1125&resize=cover&quality=80&format=webp'
      : source;
  };

  const getFeaturedImageUrl = (source?: string) => {
    if (!source) return '';
    const clean = source.split('?')[0];
    return clean.includes('/storage/v1/object/public/')
      ? clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&height=750&resize=cover&quality=85&format=webp'
      : source;
  };

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      try {
        localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearFilters = () => {
    setQuery('');
    setMake('All');
    setQuickFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setYearFrom('');
    setYearTo('');
    setTransmission('All');
    setFuel('All');
    setSavedOnly(false);
  };

  const share = async () => {
    const url = absoluteUrl('/' + encodeURIComponent(dealer.slug));
    if (navigator.share) {
      try {
        await navigator.share({ title: dealer.name, text: `Browse vehicles at ${dealer.name}`, url });
      } catch {}
    } else {
      await navigator.clipboard?.writeText(url);
      showToast('Showroom link copied');
    }
  };

  const recordGeneralWhatsAppEnquiry = () => {
    const enquiry = {
      dealershipId: dealer.id,
      buyerName: 'WhatsApp Buyer',
      buyerPhone: 'WhatsApp Link Click',
      message: generalMessage,
      stage: 'new' as const,
      source: 'whatsapp' as const,
      notes: 'Buyer clicked showroom floating WhatsApp button.',
    };
    if (isSupabaseConfigured()) {
      void supabaseService.createEnquiry(enquiry).catch(err => console.error('Could not record WhatsApp enquiry:', err));
    } else {
      try {
        storageService.saveDealership(dealer);
        void storageService.createEnquiryAsync(enquiry).catch(err => console.error('Could not record WhatsApp enquiry:', err));
      } catch (err) {
        console.error('Could not record WhatsApp enquiry:', err);
      }
    }
  };

  const openWhatsApp = () => {
    if (!waNumber) return;
    recordGeneralWhatsAppEnquiry();
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(generalMessage)}`, '_blank', 'noopener,noreferrer');
  };

  const handleSearchClick = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const countText = filtered.length === 1 ? '1 car' : `${filtered.length} cars`;

  return (
    <main className="dl-public-showroom">
      <div className="dl-ps-container">
        {/* 1. HEADER */}
        <header className="dl-ps-header">
          <div className="dl-ps-brand">
            <div className="dl-ps-avatar">
              {dealer.logoUrl ? (
                <img src={dealer.logoUrl} alt={dealer.name} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="dl-ps-dealer-info">
              <span className="dl-ps-welcome">Welcome</span>
              <h1 className="dl-ps-dealer-name">{dealer.name}</h1>
              {city && (
                <span className="dl-ps-city">
                  <MapPin size={11} />
                  <span>{city}</span>
                </span>
              )}
            </div>
          </div>
          <div className="dl-ps-header-actions">
            <button
              type="button"
              className="dl-ps-round-btn"
              onClick={handleSearchClick}
              aria-label="Search showroom"
            >
              <Search size={19} />
            </button>
            <button
              type="button"
              className="dl-ps-round-btn"
              onClick={() => void share()}
              aria-label="Share showroom"
            >
              <Share2 size={19} />
            </button>
          </div>
        </header>

        {/* 2. SEARCH AND FILTERS */}
        <section className="dl-ps-search-section">
          <div className="dl-ps-search-row">
            <label className="dl-ps-search-box">
              <Search size={18} className="dl-ps-search-icon" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search cars…"
                aria-label="Search cars"
              />
              {query && (
                <button
                  type="button"
                  className="dl-ps-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="dl-ps-filter-trigger"
              onClick={() => setFilterOpen(true)}
              aria-label="Filter options"
            >
              <SlidersHorizontal size={19} />
            </button>
          </div>

          {/* Make chips (hidden if only 1 or 0 makes) */}
          {makesWithCount.length > 1 && (
            <div className="dl-ps-chips-wrap">
              <div className="dl-ps-chips">
                <button
                  type="button"
                  className={`dl-ps-chip ${make === 'All' ? 'is-active' : ''}`}
                  onClick={() => setMake('All')}
                >
                  All ({available.length})
                </button>
                {makesWithCount.map(({ make: itemMake, count }) => (
                  <button
                    key={itemMake}
                    type="button"
                    className={`dl-ps-chip ${make === itemMake ? 'is-active' : ''}`}
                    onClick={() => setMake(itemMake)}
                  >
                    {itemMake} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. FEATURED CAR (only if the dealer has 2 or more cars, and not in savedOnly view) */}
        {featuredCar && !savedOnly && (
          <section className="dl-ps-featured-section" aria-label="Featured car">
            <article
              className="dl-ps-featured-card"
              onClick={() => navigate(`/${dealer.slug}/vehicle/${featuredCar.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/${dealer.slug}/vehicle/${featuredCar.id}`);
                }
              }}
            >
              {featuredCar.photos?.[0] ? (
                <img
                  src={getFeaturedImageUrl(featuredCar.photos[0])}
                  alt={`${featuredCar.year} ${featuredCar.make} ${featuredCar.model}`}
                  className="dl-ps-featured-img"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : (
                <div className="dl-ps-featured-fallback">
                  <CarFront size={54} />
                </div>
              )}
              <div className="dl-ps-featured-gradient" />
              <div className="dl-ps-featured-content">
                <div className="dl-ps-featured-info">
                  <span className="dl-ps-featured-tag">Featured</span>
                  <h2 className="dl-ps-featured-title">
                    {featuredCar.year} {featuredCar.make} {featuredCar.model}
                  </h2>
                  <div className="dl-ps-featured-specs">
                    <span><CalendarDays size={12} /> {featuredCar.year}</span>
                    <span className="dl-ps-dot">·</span>
                    <span><Gauge size={12} /> {Number(featuredCar.mileageKm || 0).toLocaleString()} km</span>
                    <span className="dl-ps-dot">·</span>
                    <span><Fuel size={12} /> {featuredCar.fuel}</span>
                  </div>
                  <strong className="dl-ps-featured-price">{money(featuredCar)}</strong>
                </div>
                <div className="dl-ps-featured-btn">
                  <span>View car</span>
                  <span className="dl-ps-featured-arrow">
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </div>
            </article>
          </section>
        )}

        {/* 4. BROWSE TILES */}
        <section className="dl-ps-browse-tiles" aria-label="Quick filters">
          <button
            type="button"
            className={`dl-ps-browse-tile ${quickFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => {
              setQuickFilter('all');
              setMinPrice('');
              setMaxPrice('');
              setTransmission('All');
              setMake('All');
            }}
          >
            <span className="dl-ps-tile-icon"><CarFront size={20} /></span>
            <span className="dl-ps-tile-label">All cars</span>
          </button>

          {hasUnderPrice && (
            <button
              type="button"
              className={`dl-ps-browse-tile ${quickFilter === 'underPrice' ? 'is-active' : ''}`}
              onClick={() => setQuickFilter(f => f === 'underPrice' ? 'all' : 'underPrice')}
            >
              <span className="dl-ps-tile-icon"><Tag size={20} /></span>
              <span className="dl-ps-tile-label">{underPriceLabel}</span>
            </button>
          )}

          {hasAutomatic && (
            <button
              type="button"
              className={`dl-ps-browse-tile ${quickFilter === 'automatic' ? 'is-active' : ''}`}
              onClick={() => setQuickFilter(f => f === 'automatic' ? 'all' : 'automatic')}
            >
              <span className="dl-ps-tile-icon"><Gauge size={20} /></span>
              <span className="dl-ps-tile-label">Automatic</span>
            </button>
          )}

          <button
            type="button"
            className={`dl-ps-browse-tile ${quickFilter === 'newest' ? 'is-active' : ''}`}
            onClick={() => setQuickFilter(f => f === 'newest' ? 'all' : 'newest')}
          >
            <span className="dl-ps-tile-icon"><Sparkles size={20} /></span>
            <span className="dl-ps-tile-label">Newest</span>
          </button>
        </section>

        {/* 5. CAR CARDS */}
        <section className="dl-ps-listings-section" id="available-cars">
          <div className="dl-ps-section-head">
            <h2 className="dl-ps-section-title">
              {savedOnly ? 'Saved cars' : 'Available cars'}
            </h2>
            <span className="dl-ps-section-count">{countText}</span>
          </div>

          {filtered.length > 0 ? (
            <div className="dl-ps-grid">
              {filtered.map((vehicle, index) => {
                const isSold = vehicle.status === 'sold';
                const isReserved = vehicle.status === 'reserved';
                const isSaved = saved.includes(vehicle.id);
                const hasPhoto = Boolean(vehicle.photos?.[0]);
                const photoCount = (vehicle.photos || []).length;

                return (
                  <article
                    key={vehicle.id}
                    className={`dl-ps-card ${isSold ? 'is-sold' : ''} ${!hasPhoto ? 'no-photo' : ''}`}
                    onClick={() => navigate(`/${dealer.slug}/vehicle/${vehicle.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/${dealer.slug}/vehicle/${vehicle.id}`);
                      }
                    }}
                  >
                    {/* Photo or No-photo container */}
                    <div className="dl-ps-card-media">
                      {hasPhoto ? (
                        <img
                          src={getThumbnailUrl(vehicle.photos[0])}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="dl-ps-card-img"
                          loading={index === 0 ? 'eager' : 'lazy'}
                          fetchPriority={index === 0 ? 'high' : 'auto'}
                          decoding="async"
                          width={900}
                          height={1125}
                        />
                      ) : (
                        <div className="dl-ps-no-photo-view">
                          <CarFront size={48} className="dl-ps-no-photo-icon" />
                        </div>
                      )}

                      {/* Dark gradient on bottom 45% only for photo cards */}
                      {hasPhoto && <div className="dl-ps-card-gradient" />}

                      {/* Top-left: status pill only for Reserved or Sold */}
                      {(isReserved || isSold) && (
                        <span className={`dl-ps-status-pill ${isSold ? 'is-sold' : 'is-reserved'}`}>
                          {isSold ? 'Sold' : 'Reserved'}
                        </span>
                      )}

                      {/* Top-right: round white heart button */}
                      <button
                        type="button"
                        className={`dl-ps-heart-btn ${isSaved ? 'is-saved' : ''}`}
                        onClick={e => toggleSave(vehicle.id, e)}
                        aria-label={isSaved ? 'Remove from saved' : 'Save car'}
                      >
                        <Heart size={18} fill={isSaved ? '#EF4444' : 'none'} color={isSaved ? '#EF4444' : '#0A0F1E'} />
                      </button>

                      {/* Bottom overlay inside card */}
                      <div className="dl-ps-card-overlay">
                        {hasPhoto && (
                          <div className="dl-ps-photo-badge">
                            <Camera size={11} />
                            <span>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
                          </div>
                        )}
                        <div className="dl-ps-card-bottom-row">
                          <div className="dl-ps-card-main-info">
                            <h3 className="dl-ps-card-name">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </h3>
                            <div className="dl-ps-card-specs">
                              <span><CalendarDays size={12} /> {vehicle.year}</span>
                              <span className="dl-ps-dot">·</span>
                              <span><Gauge size={12} /> {Number(vehicle.mileageKm || 0).toLocaleString()} km</span>
                              <span className="dl-ps-dot">·</span>
                              <span><Fuel size={12} /> {vehicle.fuel}</span>
                            </div>
                          </div>
                          <div className="dl-ps-card-price-wrap">
                            <strong className="dl-ps-card-price">{money(vehicle)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* 8. EMPTY AND EDGE STATES */
            <div className="dl-ps-empty-box">
              {savedOnly ? (
                <>
                  <div className="dl-ps-empty-icon"><Heart size={38} /></div>
                  <h3 className="dl-ps-empty-title">No saved cars</h3>
                  <p className="dl-ps-empty-desc">Tap the heart on a car to save it.</p>
                  <button type="button" className="dl-ps-empty-btn" onClick={() => setSavedOnly(false)}>
                    View all cars
                  </button>
                </>
              ) : publicVehicles.length === 0 ? (
                <>
                  <div className="dl-ps-empty-icon"><CarFront size={38} /></div>
                  <h3 className="dl-ps-empty-title">No cars listed yet</h3>
                  <p className="dl-ps-empty-desc">Check back soon or contact the dealership.</p>
                  {waNumber && (
                    <button type="button" className="dl-ps-empty-btn" onClick={openWhatsApp}>
                      Message us on WhatsApp
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="dl-ps-empty-icon"><Search size={38} /></div>
                  <h3 className="dl-ps-empty-title">No cars match your search</h3>
                  <p className="dl-ps-empty-desc">Try clearing your search or filters to see all available inventory.</p>
                  <button type="button" className="dl-ps-empty-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* 7. FOOTER */}
        <footer className="dl-ps-footer">
          <strong className="dl-ps-footer-title">{dealer.name}</strong>
          {dealer.phone && (
            <a href={`tel:${dealer.phone}`} className="dl-ps-footer-link">
              <Phone size={13} />
              <span>{dealer.phone}</span>
            </a>
          )}
          {dealer.address && (
            <p className="dl-ps-footer-text">
              <MapPin size={13} />
              <span>{dealer.address}</span>
            </p>
          )}
          {(dealer as any).hours && (
            <p className="dl-ps-footer-text">
              <Clock size={13} />
              <span>{(dealer as any).hours}</span>
            </p>
          )}
          {showPoweredBy && (
            <a className="dl-ps-powered" href="/" aria-label="Powered by Lotlé">
              <span>Powered by Lotlé</span>
              <Logo variant="light" size="sm" />
            </a>
          )}
        </footer>
      </div>

      {/* 6. FLOATING PILL BAR */}
      <nav className="dl-ps-floating-pill" aria-label="Showroom quick actions">
        <button
          type="button"
          className={`dl-ps-pill-tab ${!savedOnly ? 'is-active' : ''}`}
          onClick={() => setSavedOnly(false)}
        >
          <CarFront size={16} />
          <span>Cars</span>
        </button>

        <button
          type="button"
          className={`dl-ps-pill-tab ${savedOnly ? 'is-active' : ''}`}
          onClick={() => setSavedOnly(true)}
        >
          <Heart size={16} fill={savedOnly ? 'currentColor' : 'none'} />
          <span>Saved</span>
          {saved.length > 0 && (
            <span className="dl-ps-pill-badge">{saved.length}</span>
          )}
        </button>

        {waNumber && (
          <button
            type="button"
            className="dl-ps-pill-wa"
            onClick={openWhatsApp}
            aria-label="Message dealership on WhatsApp"
          >
            <WhatsAppIcon size={20} />
          </button>
        )}

        {dealer.phone && (
          <a
            href={`tel:${dealer.phone}`}
            className="dl-ps-pill-tab dl-ps-pill-call"
            aria-label="Call dealership"
          >
            <Phone size={16} />
            <span>Call</span>
          </a>
        )}
      </nav>

      {/* BOTTOM FILTER SHEET MODAL */}
      {filterOpen && (
        <div className="dl-ps-sheet-backdrop" onClick={() => setFilterOpen(false)}>
          <section
            className="dl-ps-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Filter cars"
          >
            <div className="dl-ps-sheet-handle" />
            <header className="dl-ps-sheet-header">
              <h2>Filter cars</h2>
              <button
                type="button"
                className="dl-ps-sheet-close"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </header>

            <div className="dl-ps-sheet-grid">
              <div className="dl-ps-sheet-field">
                <span>Make</span>
                <Select
                  title="Make"
                  value={make}
                  options={[{ value: 'All', label: 'All makes' }, ...makesWithCount.map(m => ({ value: m.make, label: `${m.make} (${m.count})` }))]}
                  onChange={setMake}
                />
              </div>

              <div className="dl-ps-sheet-field">
                <span>Transmission</span>
                <Select
                  title="Transmission"
                  value={transmission}
                  options={[
                    { value: 'All', label: 'All transmissions' },
                    { value: 'Automatic', label: 'Automatic' },
                    { value: 'Manual', label: 'Manual' },
                  ]}
                  onChange={setTransmission}
                />
              </div>

              <label className="dl-ps-sheet-field">
                <span>Min price ({currencySymbol})</span>
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  placeholder="Any"
                />
              </label>

              <label className="dl-ps-sheet-field">
                <span>Max price ({currencySymbol})</span>
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="Any"
                />
              </label>

              <label className="dl-ps-sheet-field">
                <span>Year from</span>
                <input
                  type="number"
                  min="1950"
                  value={yearFrom}
                  onChange={e => setYearFrom(e.target.value)}
                  placeholder="Any"
                />
              </label>

              <label className="dl-ps-sheet-field">
                <span>Year to</span>
                <input
                  type="number"
                  min="1950"
                  value={yearTo}
                  onChange={e => setYearTo(e.target.value)}
                  placeholder="Any"
                />
              </label>

              <div className="dl-ps-sheet-field full-width">
                <span>Fuel type</span>
                <Select
                  title="Fuel type"
                  value={fuel}
                  options={[
                    { value: 'All', label: 'All fuel types' },
                    ...Array.from(new Set(available.map(v => v.fuel).filter(Boolean))).map(f => ({ value: f, label: f })),
                  ]}
                  onChange={setFuel}
                />
              </div>
            </div>

            <div className="dl-ps-sheet-actions">
              <button
                type="button"
                className="dl-ps-sheet-btn secondary"
                onClick={clearFilters}
              >
                Clear all
              </button>
              <button
                type="button"
                className="dl-ps-sheet-btn primary"
                onClick={() => setFilterOpen(false)}
              >
                Show {filtered.length} {filtered.length === 1 ? 'car' : 'cars'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
