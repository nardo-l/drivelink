import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CarFront, Contact, Grid2X2, Heart, MapPin, Search, Share2, SlidersHorizontal, X } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Dealership, Vehicle } from '../types';

export const PublicStorefrontBrowsePage: React.FC<{ slug: string }> = ({ slug }) => {
  const { navigate } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [minMileage, setMinMileage] = useState('');
  const [maxMileage, setMaxMileage] = useState('');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [sort, setSort] = useState('newest');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isSupabaseConfigured()) {
          const found = await supabaseService.getDealershipBySlug(slug);
          if (!active) return;
          setDealer(found);
          if (found) setVehicles((await supabaseService.getVehicles(found.id, true)).filter(v => v.status === 'available'));
        } else {
          const local = storageService.getDealership();
          if (local.slug === slug) { setDealer(local); setVehicles(storageService.getVehicles().filter(v => v.status === 'available')); }
        }
      } catch { if (active) setDealer(null); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [slug]);

  const brands = useMemo(() => ['All', ...Array.from(new Set(vehicles.map(v => v.make).filter(Boolean))).sort()], [vehicles]);
  const filtered = useMemo(() => {
    const list = vehicles.filter(v => {
      const haystack = [v.make, v.model, v.year, v.colour, v.condition, v.description].join(' ').toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (brand !== 'All' && v.make !== brand) return false;
      if (minPrice && v.price < Number(minPrice)) return false;
      if (maxPrice && v.price > Number(maxPrice)) return false;
      if (yearFrom && v.year < Number(yearFrom)) return false;
      if (yearTo && v.year > Number(yearTo)) return false;
      if (minMileage && v.mileageKm < Number(minMileage)) return false;
      if (maxMileage && v.mileageKm > Number(maxMileage)) return false;
      if (transmission !== 'All' && v.transmission !== transmission) return false;
      if (fuel !== 'All' && v.fuel !== fuel) return false;
      return true;
    });
    return list.sort((a,b) => sort === 'price-low' ? a.price-b.price : sort === 'price-high' ? b.price-a.price : sort === 'year' ? b.year-a.year : 0);
  }, [vehicles, query, brand, minPrice, maxPrice, yearFrom, yearTo, minMileage, maxMileage, transmission, fuel, sort]);

  if (loading) return <div className="dl-store-loading">Loading vehicles…</div>;
  if (!dealer) return <div className="dl-store-loading"><h1>Showroom unavailable</h1><button onClick={() => navigate('/')}>Back to DriveLink</button></div>;
  const money = (v: Vehicle) => new Intl.NumberFormat('en-US', { style:'currency', currency:v.currency || dealer.currency, maximumFractionDigits:0 }).format(v.price);
  const clearFilters = () => { setMinPrice(''); setMaxPrice(''); setYearFrom(''); setYearTo(''); setMinMileage(''); setMaxMileage(''); setTransmission('All'); setFuel('All'); setBrand('All'); };
  const goHome = () => navigate('/' + dealer.slug);
  const goContact = () => navigate('/' + dealer.slug + '/contact');
  const shareShowroom = async () => { const url = window.location.origin + '/' + dealer.slug; if (navigator.share) { try { await navigator.share({ title: dealer.name, text: 'Browse vehicles at ' + dealer.name, url }); } catch { /* share sheet dismissed */ } } else if (navigator.clipboard) { await navigator.clipboard.writeText(url); } };

  return <main className="dl-store-browse">
    <header className="dl-store-header">
      <button className="dl-store-dealer" onClick={goHome}>
        {dealer.logoUrl ? <img src={dealer.logoUrl} alt="" /> : <span className="dl-store-monogram">{dealer.name.slice(0,2).toUpperCase()}</span>}
        <span><strong>{dealer.name}</strong><small><MapPin size={12}/>{[dealer.city,dealer.country].filter(Boolean).join(', ')}</small></span>
      </button>
      <button className="dl-store-icon" onClick={() => searchInputRef.current?.focus()} aria-label="Focus search"><Search/></button>
    </header>
    <section className="dl-store-search-row">
      <label className="dl-store-search"><Search/><input ref={searchInputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search cars…" aria-label="Search cars"/></label>
      <button className="dl-store-filter-button" onClick={() => setFiltersOpen(true)} aria-label="Open filters"><SlidersHorizontal/></button>
    </section>
    <div className="dl-store-brands">{brands.map(item => <button key={item} className={brand === item ? 'active' : ''} onClick={() => setBrand(item)}>{item}</button>)}</div>
    <section className="dl-store-section-heading"><div><h1>Available Cars</h1><p>{filtered.length} vehicles available</p></div><button onClick={() => {setBrand('All');setQuery('');}}>View all <ArrowRight size={16}/></button></section>
    <div className="dl-store-sort"><span>Available inventory</span><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort vehicles"><option value="newest">Recently added</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="year">Newest year</option></select></div>
    {filtered.length ? <section className="dl-store-list">{filtered.map(vehicle => <article key={vehicle.id} className="dl-store-car-card" onClick={() => navigate('/' + dealer.slug + '/vehicle/' + vehicle.id)}>
      <div className="dl-store-car-photo"><img src={vehicle.photos?.[0] || ''} alt={vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model}/><button onClick={e => {e.stopPropagation();setFavorites(old => old.includes(vehicle.id) ? old.filter(id => id !== vehicle.id) : [...old,vehicle.id]);}} aria-label="Save vehicle" className={favorites.includes(vehicle.id) ? 'saved' : ''}><Heart fill={favorites.includes(vehicle.id) ? 'currentColor' : 'none'}/></button></div>
      <div className="dl-store-car-info"><div><h2>{vehicle.make} {vehicle.model}</h2><p>{vehicle.year} <i/> {vehicle.mileageKm.toLocaleString()} km <i/> {vehicle.fuel}</p></div><strong>{money(vehicle)}</strong></div>
    </article>)}</section> : <div className="dl-store-empty"><CarFront/><h2>No matching vehicles</h2><p>Try a different search or clear your filters.</p><button onClick={() => {clearFilters();setQuery('');}}>Clear filters</button></div>}
    <footer className="dl-store-footer">{dealer.name} · Powered by DriveLink</footer>
    <nav className="dl-store-bottom-nav"><button onClick={goHome}><Grid2X2/><span>Home</span></button><button className="active"><CarFront/><span>Inventory</span></button><button onClick={goContact}><Contact/><span>Enquiries</span></button><button onClick={shareShowroom}><Share2/><span>More</span></button></nav>
    {filtersOpen && <div className="dl-store-filter-backdrop" onClick={() => setFiltersOpen(false)}><section className="dl-store-filter-panel" onClick={e => e.stopPropagation()}><header><div><h2>Filters</h2><p>Find the right vehicle</p></div><button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X/></button></header>
      <label>Make<select value={brand} onChange={e => setBrand(e.target.value)}>{brands.map(b => <option key={b}>{b}</option>)}</select></label>
      <div className="dl-store-filter-two"><label>Minimum price<input type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="No minimum"/></label><label>Maximum price<input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="No maximum"/></label></div>
      <div className="dl-store-filter-two"><label>Year from<input type="number" min="1950" max={new Date().getFullYear()+1} value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="Any year"/></label><label>Year to<input type="number" min="1950" max={new Date().getFullYear()+1} value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="Any year"/></label></div>
      <div className="dl-store-filter-two"><label>Min mileage (km)<input type="number" min="0" value={minMileage} onChange={e => setMinMileage(e.target.value)} placeholder="Any"/></label><label>Max mileage (km)<input type="number" min="0" value={maxMileage} onChange={e => setMaxMileage(e.target.value)} placeholder="Any"/></label></div>
      <label>Transmission<select value={transmission} onChange={e => setTransmission(e.target.value)}><option>All</option><option>Automatic</option><option>Manual</option></select></label>
      <label>Fuel type<select value={fuel} onChange={e => setFuel(e.target.value)}><option>All</option>{Array.from(new Set(vehicles.map(v => v.fuel))).map(f => <option key={f}>{f}</option>)}</select></label>
      <div className="dl-store-filter-actions"><button onClick={clearFilters}>Clear all</button><button onClick={() => setFiltersOpen(false)}>Show {filtered.length} cars</button></div>
    </section></div>}
  </main>;
};
