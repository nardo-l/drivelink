import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Car,
  Check,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { TemplateShowroomProps } from '../types';
import './PrestigeTemplate.css';

export const PrestigeTemplate: React.FC<TemplateShowroomProps> = ({
  dealer,
  vehicles,
  showPoweredBy,
  onVehicleClick,
  onContactClick,
  onShare,
  initialTab = 'home',
}) => {
  const [tab, setTab] = useState<'home' | 'inventory' | 'saved' | 'contact'>(initialTab);
  const [query, setQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const inventoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]'));
    } catch {
      setSaved([]);
    }
  }, []);

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next));
  };

  const availableVehicles = useMemo(
    () => vehicles.filter(v => v.status === 'available'),
    [vehicles]
  );

  const heroVehicle = useMemo(() => {
    return availableVehicles.find(v => v.photos && v.photos.length > 0) || availableVehicles[0];
  }, [availableVehicles]);

  const makes = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => {
      if (v.make) set.add(v.make);
    });
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const displayedVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (v.status === 'draft' || v.status === 'hidden') return false;
      if (tab === 'saved' && !saved.includes(v.id)) return false;
      if (selectedMake !== 'All' && v.make !== selectedMake) return false;
      if (query.trim()) {
        const text = `${v.year} ${v.make} ${v.model} ${v.fuel} ${v.transmission}`.toLowerCase();
        if (!text.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [vehicles, tab, saved, selectedMake, query]);

  const scrollToInventory = () => {
    if (tab !== 'inventory' && tab !== 'home') {
      setTab('inventory');
    }
    inventoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const waNumber = (dealer.whatsapp || dealer.phone || '').replace(/\D/g, '');
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        `Hi, I'm visiting the ${dealer.name} showroom on Lotlé and have an enquiry.`
      )}`
    : '';

  return (
    <div className="dl-tpl-prestige">
      {/* Top Header */}
      <header className="pt-header">
        <div className="pt-brand">
          {dealer.logoUrl ? (
            <img src={dealer.logoUrl} alt={dealer.name} className="pt-logo-img" />
          ) : (
            <span className="pt-logo-badge">
              {dealer.name.slice(0, 2).toUpperCase() || 'PL'}
            </span>
          )}
          <span className="truncate max-w-[200px]">{dealer.name}</span>
        </div>
        <div className="pt-header-actions">
          <button
            type="button"
            className="pt-icon-btn"
            onClick={() => setSearchOpen(v => !v)}
            aria-label="Search vehicles"
          >
            <Search size={17} />
          </button>
          <button
            type="button"
            className="pt-icon-btn"
            onClick={onShare}
            aria-label="Share showroom"
          >
            <Share2 size={17} />
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      {tab === 'home' && (
        <>
          <section className="pt-hero">
            <div className="pt-hero-glow" />
            <h1 className="pt-hero-title">
              Drive <em>Your Dream</em>
            </h1>
            <p className="pt-hero-sub">
              {dealer.tagline || 'Premium vehicles. Exceptional quality. Verified stock.'}
            </p>
            <button
              type="button"
              className="pt-cta-btn"
              onClick={scrollToInventory}
            >
              Browse Inventory <ChevronRight size={16} />
            </button>

            {heroVehicle && (
              <div
                className="pt-hero-showcase"
                onClick={() => onVehicleClick(heroVehicle.id)}
              >
                {heroVehicle.photos?.[0] ? (
                  <img
                    src={heroVehicle.photos[0]}
                    alt={`${heroVehicle.year} ${heroVehicle.make} ${heroVehicle.model}`}
                    loading="eager"
                  />
                ) : (
                  <div className="aspect-[16/9] flex items-center justify-center bg-black/60 text-white/40">
                    <Car size={48} />
                  </div>
                )}
                <div className="pt-hero-showcase-overlay">
                  <span className="pt-hero-showcase-badge">Featured</span>
                  <strong className="text-white text-base font-bold">
                    {heroVehicle.year} {heroVehicle.make} {heroVehicle.model}
                  </strong>
                  <span className="text-[#A78BFA] text-sm font-black">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: heroVehicle.currency || dealer.currency,
                      maximumFractionDigits: 0,
                    }).format(heroVehicle.price)}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Real stats only */}
          <div className="pt-stat-strip">
            <div className="pt-stat-chip">
              <Car size={20} />
              <div>
                <strong>{availableVehicles.length}+</strong>
                <small>Cars In Stock</small>
              </div>
            </div>
            <div className="pt-stat-chip">
              <Shield size={20} />
              <div>
                <strong>Verified</strong>
                <small>Trusted Dealer</small>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Inventory Section (shown on Home & Inventory tabs) */}
      {(tab === 'home' || tab === 'inventory' || tab === 'saved') && (
        <section ref={inventoryRef} className="pt-inventory-sec">
          <div className="pt-sec-header">
            <h2>
              {tab === 'saved'
                ? 'Saved Vehicles'
                : tab === 'inventory'
                ? 'All Inventory'
                : 'Our Collection'}
            </h2>
            {tab === 'home' && (
              <button type="button" onClick={() => setTab('inventory')}>
                View all <ChevronRight size={13} />
              </button>
            )}
          </div>

          {/* Search bar toggle */}
          {(searchOpen || tab === 'inventory') && (
            <div className="pt-search-bar">
              <div className="pt-search-box">
                <Search size={16} className="text-[#8E95A5]" />
                <input
                  type="text"
                  placeholder="Search make, model, year…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-[#8E95A5]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Category/Make Pills */}
          <div className="pt-categories-scroll">
            {makes.map(makeName => (
              <button
                key={makeName}
                type="button"
                className={`pt-cat-pill ${selectedMake === makeName ? 'is-active' : ''}`}
                onClick={() => setSelectedMake(makeName)}
              >
                {makeName}
              </button>
            ))}
          </div>

          {/* Vehicle Grid */}
          {displayedVehicles.length === 0 ? (
            <div className="py-16 text-center text-white/50 text-sm">
              <Car size={36} className="mx-auto mb-2 opacity-40" />
              <p>No vehicles found matching your criteria.</p>
              {(query || selectedMake !== 'All') && (
                <button
                  type="button"
                  className="mt-3 text-[#A78BFA] font-bold text-xs"
                  onClick={() => {
                    setQuery('');
                    setSelectedMake('All');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="pt-vehicle-grid">
              {displayedVehicles.map(vehicle => {
                const formattedPrice = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: vehicle.currency || dealer.currency,
                  maximumFractionDigits: 0,
                }).format(vehicle.price);
                const isFav = saved.includes(vehicle.id);

                return (
                  <div
                    key={vehicle.id}
                    className="pt-vehicle-card"
                    onClick={() => onVehicleClick(vehicle.id)}
                  >
                    <div className="pt-card-media">
                      {vehicle.photos?.[0] ? (
                        <img
                          src={vehicle.photos[0]}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <Car size={32} />
                        </div>
                      )}
                      <span className={`pt-card-status ${vehicle.status}`}>
                        {vehicle.status}
                      </span>
                      <button
                        type="button"
                        className={`pt-card-fav ${isFav ? 'is-saved' : ''}`}
                        onClick={e => toggleSave(vehicle.id, e)}
                        aria-label={isFav ? 'Remove from saved' : 'Save vehicle'}
                      >
                        <Heart size={16} />
                      </button>
                    </div>

                    <div className="pt-card-body">
                      <h3 className="pt-card-title">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                      <div className="pt-card-price">{formattedPrice}</div>
                      <div className="pt-card-specs">
                        {vehicle.mileageKm != null && (
                          <span className="pt-card-spec-tag">
                            {Number(vehicle.mileageKm).toLocaleString()} km
                          </span>
                        )}
                        {vehicle.transmission && (
                          <span className="pt-card-spec-tag">{vehicle.transmission}</span>
                        )}
                        {vehicle.fuel && (
                          <span className="pt-card-spec-tag">{vehicle.fuel}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Contact Tab */}
      {tab === 'contact' && (
        <section className="p-5 max-w-lg mx-auto space-y-6">
          <div className="text-center pt-4">
            {dealer.logoUrl ? (
              <img
                src={dealer.logoUrl}
                alt={dealer.name}
                className="w-16 h-16 rounded-2xl mx-auto object-cover border border-white/20 mb-3"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/10 mx-auto grid place-items-center text-xl font-bold mb-3">
                {dealer.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h2 className="text-xl font-extrabold text-white">{dealer.name}</h2>
            <p className="text-xs text-[#8E95A5] mt-1 flex items-center justify-center gap-1">
              <MapPin size={13} />
              {[dealer.city, dealer.country].filter(Boolean).join(', ') || 'Harare, Zimbabwe'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full bg-[#10B981] text-white font-bold text-sm shadow-lg hover:brightness-105 transition"
              >
                <MessageCircle size={18} /> Chat on WhatsApp
              </a>
            )}
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full bg-white/10 border border-white/10 text-white font-bold text-sm hover:bg-white/15 transition"
              >
                <Phone size={18} /> Call {dealer.phone}
              </a>
            )}
          </div>
        </section>
      )}

      {/* Powered by Lotlé Attribution */}
      {showPoweredBy && (
        <footer className="pt-8 pb-4 text-center">
          <a
            href="https://lotle.link"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-[#8E95A5] hover:text-white transition"
          >
            Powered by <strong className="text-white">Lotlé</strong>
          </a>
        </footer>
      )}

      {/* Floating Bottom Nav */}
      <nav className="pt-bottom-bar" aria-label="Showroom navigation">
        <button
          type="button"
          className={`pt-nav-item ${tab === 'home' ? 'is-active' : ''}`}
          onClick={() => {
            setTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Home size={18} />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`pt-nav-item ${tab === 'inventory' ? 'is-active' : ''}`}
          onClick={() => {
            setTab('inventory');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Car size={18} />
          <span>Inventory</span>
        </button>
        <button
          type="button"
          className={`pt-nav-item ${tab === 'saved' ? 'is-active' : ''}`}
          onClick={() => setTab('saved')}
        >
          <Heart size={18} />
          <span>Saved ({saved.length})</span>
        </button>
        <button
          type="button"
          className={`pt-nav-item ${tab === 'contact' ? 'is-active' : ''}`}
          onClick={() => setTab('contact')}
        >
          <Phone size={18} />
          <span>Contact</span>
        </button>
      </nav>
    </div>
  );
};

export default PrestigeTemplate;
