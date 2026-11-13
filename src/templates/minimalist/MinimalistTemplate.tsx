import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Car,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Share2,
  X,
} from 'lucide-react';
import type { TemplateShowroomProps } from '../types';
import { FeaturedVehicleCarousel } from '../common/FeaturedVehicleCarousel';
import './MinimalistTemplate.css';

export const MinimalistTemplate: React.FC<TemplateShowroomProps> = ({
  dealer,
  vehicles,
  showPoweredBy,
  onVehicleClick,
  onWhatsAppClick,
  onShare,
  isPreview = false,
  initialTab = 'home',
}) => {
  const [tab, setTab] = useState<'home' | 'inventory' | 'saved' | 'contact'>(initialTab);
  const [query, setQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState('All');
  const [saved, setSaved] = useState<string[]>([]);
  const inventoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPreview) return;
    try { setSaved(JSON.parse(localStorage.getItem('drivelink:saved-vehicles') || '[]')); }
    catch { setSaved([]); }
  }, [isPreview]);

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    setSaved(next);
    if (!isPreview) { try { localStorage.setItem('drivelink:saved-vehicles', JSON.stringify(next)); } catch {} }
  };

  const availableVehicles = useMemo(
    () => vehicles.filter(v => v.status === 'available'),
    [vehicles]
  );



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

  return (
    <div className="dl-tpl-minimalist">
      {/* Top Bar */}
      <header className="mn-header">
        <div className="mn-brand">
          {dealer.logoUrl ? (
            <img src={dealer.logoUrl} alt={dealer.name} className="mn-logo-img" />
          ) : (
            <span className="mn-logo-badge">
              {dealer.name.slice(0, 2).toUpperCase() || 'ML'}
            </span>
          )}
          <span className="truncate max-w-[210px]">{dealer.name}</span>
          {dealer.isVerified && <span className="mn-verified-badge">Verified</span>}
        </div>
        <div className="mn-header-actions">
          <button
            type="button"
            className="mn-icon-btn"
            onClick={() => setTab('inventory')}
            aria-label="Search vehicles"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            className="mn-icon-btn"
            onClick={onShare}
            aria-label="Share showroom"
          >
            <Share2 size={16} />
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      {tab === 'home' && (
        <>
          <section className="mn-hero">
            <h1 className="mn-hero-title">
              Quality Cars. <br />Better Journeys.
            </h1>
            <p className="mn-hero-sub">
              {dealer.tagline || 'Browse our available vehicles.'}
            </p>
            <button
              type="button"
              className="mn-cta-btn"
              onClick={scrollToInventory}
            >
              Browse Inventory <ChevronRight size={16} />
            </button>


          </section>

          {/* Real Stats Only */}
          {availableVehicles.length > 0 && (
          <div className="mn-stats-row">
            <div className="mn-stat-box">
              <Car size={18} />
              <div>
                <strong>{availableVehicles.length}</strong>
                <small>Cars Available</small>
              </div>
            </div>
          </div>
          )}
        </>
      )}

      {tab === 'home' && <FeaturedVehicleCarousel dealer={dealer} vehicles={vehicles} onVehicleClick={onVehicleClick} variant="minimalist" />}

      {/* Inventory Section */}
      {(tab === 'home' || tab === 'inventory' || tab === 'saved') && (
        <section ref={inventoryRef} className="mn-inventory-section">
          <div className="mn-section-heading">
            <h2>
              {tab === 'saved'
                ? 'Saved Vehicles'
                : tab === 'inventory'
                ? 'Available Stock'
                : 'Popular Categories'}
            </h2>
            {tab === 'home' && (
              <button type="button" onClick={() => setTab('inventory')}>
                View all <ChevronRight size={13} />
              </button>
            )}
          </div>

          {/* Search Input on inventory view */}
          {tab === 'inventory' && (
            <input
              type="text"
              placeholder="Search make, model, year…"
              className="mn-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          )}

          {/* Category/Make Pills */}
          <div className="mn-category-pills">
            {makes.map(makeName => (
              <button
                key={makeName}
                type="button"
                className={`mn-pill ${selectedMake === makeName ? 'is-active' : ''}`}
                onClick={() => setSelectedMake(makeName)}
              >
                {makeName}
              </button>
            ))}
          </div>

          {/* Vehicles Grid */}
          {displayedVehicles.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Car size={36} className="mx-auto mb-2 opacity-30" />
              <p>No vehicles found.</p>
              {(query || selectedMake !== 'All') && (
                <button
                  type="button"
                  className="mt-2 text-gray-900 font-bold text-xs underline"
                  onClick={() => {
                    setQuery('');
                    setSelectedMake('All');
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="mn-cards-grid">
              {displayedVehicles.map(vehicle => {
                const formattedPrice = !vehicle.price || Number(vehicle.price) <= 0 ? 'Price on request' : new Intl.NumberFormat('en-US', { style: 'currency', currency: vehicle.currency || dealer.currency, maximumFractionDigits: 0 }).format(vehicle.price);
                const isFav = saved.includes(vehicle.id);

                return (
                  <div
                    key={vehicle.id}
                    className="mn-card"
                  >
                    <a
                      className="mn-card-link-overlay"
                      href={'/' + encodeURIComponent(dealer.slug) + '/vehicle/' + encodeURIComponent(vehicle.id)}
                      aria-label={'View ' + [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                      onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onVehicleClick(vehicle.id); } }}
                    />
                    <div className="mn-card-img">
                      {vehicle.photos?.[0] ? (
                        <img
                          src={vehicle.photos[0]}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Car size={32} />
                        </div>
                      )}
                      <span className={`mn-status-tag ${vehicle.status}`}>
                        {vehicle.status}
                      </span>
                    </div>

                    <div className="mn-card-content">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="mn-card-title">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <button
                          type="button"
                          className={`relative z-10 p-1 text-gray-400 hover:text-red-500 ${
                            isFav ? 'text-red-500 fill-red-500' : ''
                          }`}
                          onClick={e => toggleSave(vehicle.id, e)}
                          aria-label={isFav ? 'Remove from saved' : 'Save vehicle'}
                        >
                          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      <div className="mn-card-price">{formattedPrice}</div>

                      <div className="mn-card-specs">
                        {vehicle.mileageKm != null && (
                          <span className="mn-spec-pill">
                            {Number(vehicle.mileageKm).toLocaleString()} km
                          </span>
                        )}
                        {vehicle.transmission && (
                          <span className="mn-spec-pill">{vehicle.transmission}</span>
                        )}
                        {vehicle.fuel && (
                          <span className="mn-spec-pill">{vehicle.fuel}</span>
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
        <section className="p-6 max-w-lg mx-auto space-y-6">
          <div className="text-center pt-2">
            {dealer.logoUrl ? (
              <img
                src={dealer.logoUrl}
                alt={dealer.name}
                className="w-16 h-16 rounded-2xl mx-auto object-cover border border-gray-200 mb-3"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 mx-auto grid place-items-center text-xl font-bold text-gray-800 mb-3">
                {dealer.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h2 className="text-xl font-extrabold text-gray-900">{dealer.name}</h2>
            {[dealer.city, dealer.country].filter(Boolean).length > 0 && <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><MapPin size={13} />{[dealer.city, dealer.country].filter(Boolean).join(', ')}</p>}
          </div>

          <div className="space-y-3 pt-2">
            {waNumber && <button type="button" onClick={onWhatsAppClick} className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full bg-[#10B981] text-white font-bold text-sm"><MessageCircle size={18} /> Contact via WhatsApp</button>}
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full bg-gray-100 text-gray-900 font-bold text-sm hover:bg-gray-200 transition"
              >
                <Phone size={18} /> Call {dealer.phone}
              </a>
            )}
          </div>
        </section>
      )}

      {/* Powered by Lotlé */}
      {showPoweredBy && (
        <footer className="pt-8 pb-4 text-center">
          <a
            href="https://lotle.link"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-900 transition"
          >
            Powered by <strong className="text-gray-900">Lotlé</strong>
          </a>
        </footer>
      )}

      {/* Floating Bottom Nav */}
      <nav className="mn-bottom-bar" aria-label="Showroom navigation">
        <button
          type="button"
          className={`mn-nav-btn ${tab === 'home' ? 'is-active' : ''}`}
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
          className={`mn-nav-btn ${tab === 'inventory' ? 'is-active' : ''}`}
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
          className={`mn-nav-btn ${tab === 'saved' ? 'is-active' : ''}`}
          onClick={() => setTab('saved')}
        >
          <Heart size={18} />
          <span>Saved ({saved.length})</span>
        </button>
        <button
          type="button"
          className={`mn-nav-btn ${tab === 'contact' ? 'is-active' : ''}`}
          onClick={() => setTab('contact')}
        >
          <Phone size={18} />
          <span>Contact</span>
        </button>
      </nav>
    </div>
  );
};

export default MinimalistTemplate;
