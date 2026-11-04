import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, CarFront, MoreHorizontal, Pencil, Trash2, X, LayoutGrid,
  List as ListIcon, Share2, RefreshCw, ArrowUpRight, SlidersHorizontal,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Vehicle, VehicleStatus } from '../types';
import './VehiclesListPage.css';

type InventoryFilter = 'all' | 'available' | 'reserved' | 'sold';
type ViewMode = 'grid' | 'list';

const filters: { id: InventoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'sold', label: 'Sold' },
];

export const VehiclesListPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem('drivelink_garage_view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const [showAddButton, setShowAddButton] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setVehicles(await storageService.getVehiclesAsync());
    } catch (e: any) {
      setError(e?.message || 'Could not load your garage.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 24) setShowAddButton(true);
      else if (currentY > lastScrollY.current + 5) setShowAddButton(false);
      else if (currentY < lastScrollY.current - 5) setShowAddButton(true);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const counts = useMemo(() => ({
    all: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    reserved: vehicles.filter(v => v.status === 'reserved').length,
    sold: vehicles.filter(v => v.status === 'sold').length,
  }), [vehicles]);

  const visible = useMemo(() => vehicles.filter(v => {
    const matchesFilter = filter === 'all' || v.status === filter;
    const query = search.toLowerCase().trim();
    const matchesSearch = !query || `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [vehicles, filter, search]);

  const updateStatus = async (vehicle: Vehicle, status: VehicleStatus) => {
    try {
      await storageService.updateVehicleAsync(vehicle.id, { status });
      setVehicles(items => items.map(v => v.id === vehicle.id ? { ...v, status } : v));
      showToast(`Vehicle marked ${status}`);
    } catch (e: any) {
      showToast(e?.message || 'Could not update vehicle status.');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await storageService.deleteVehicleAsync(deleteTarget.id);
      setVehicles(items => items.filter(v => v.id !== deleteTarget.id));
      showToast('Vehicle deleted');
    } catch (e: any) {
      showToast(e?.message || 'Could not delete vehicle.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const price = (v: Vehicle) => `${v.currency === 'ZAR' ? 'R' : '$'}${v.price.toLocaleString()}`;
  const openVehicle = (vehicle: Vehicle) => navigate(`/app/vehicles/${vehicle.id}`);
  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('drivelink_garage_view', mode); } catch { /* storage unavailable */ }
  };
  const shareVehicle = async (vehicle: Vehicle) => {
    const dealer = storageService.getDealership();
    const url = `${window.location.origin}/${dealer.slug}/vehicle/${vehicle.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Vehicle link copied');
    } catch {
      showToast(url);
    }
  };
  const previewShowroom = () => {
    try { navigate(`/${storageService.getDealership().slug}`); }
    catch { navigate('/app/settings'); }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (window.scrollY <= 0) touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartY.current === null || refreshing) return;
    const distance = Math.max(0, Math.min(92, (event.touches[0]?.clientY ?? 0) - touchStartY.current));
    if (distance > 0) setPullDistance(distance);
  };
  const handleTouchEnd = () => {
    if (pullDistance > 64 && !refreshing) void load(true);
    touchStartY.current = null;
    setPullDistance(0);
  };

  const statusLabel: Record<string, string> = { available: 'Available', reserved: 'Reserved', sold: 'Sold', draft: 'Draft' };

  return (
    <div className="dl-workspace garage-page min-h-full flex flex-col" onClick={() => menuId && setMenuId(null)}>
      <header className="garage-header sticky top-0 z-20">
        <div className="garage-header-inner">
          <div className="min-w-0">
            <p className="garage-eyebrow">INVENTORY</p>
            <h1>Garage</h1>
            <p className="garage-summary">{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} <span>·</span> {counts.available} available</p>
          </div>
          {vehicles.length > 0 && (
            <button type="button" onClick={() => navigate('/app/vehicles/new')} aria-label="Add vehicle" className="garage-header-add">
              <Plus size={22} strokeWidth={2.2}/>
            </button>
          )}
        </div>
      </header>

      <main
        className="garage-main flex-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {(refreshing || pullDistance > 12) && (
          <div className="garage-pull-indicator" style={{ height: refreshing ? 38 : Math.min(38, pullDistance * .55) }}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/>
            <span>{refreshing ? 'Refreshing inventory…' : pullDistance > 64 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        )}

        <div className="garage-search-wrap">
          <Search size={18} aria-hidden="true"/>
          <input
            aria-label="Search inventory"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search make, model or year"
          />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={16}/></button>}
        </div>

        <div className="garage-toolbar">
          <div className="garage-filter-viewport">
            <div className="garage-filter-row" role="group" aria-label="Filter vehicles">
              {filters.map(tab => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  aria-pressed={filter === tab.id}
                  className={`garage-filter-chip ${filter === tab.id ? 'is-selected' : ''}`}
                >
                  <span>{tab.label}</span><small>{counts[tab.id]}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="garage-view-toggle" role="group" aria-label="Inventory view">
            <button type="button" onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={viewMode === 'grid' ? 'is-active' : ''}><LayoutGrid size={16}/></button>
            <button type="button" onClick={() => setView('list')} aria-label="List view" aria-pressed={viewMode === 'list'} className={viewMode === 'list' ? 'is-active' : ''}><ListIcon size={17}/></button>
          </div>
        </div>

        {error && <div role="alert" className="garage-error">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}

        {loading ? (
          <div className={`garage-vehicle-layout ${viewMode}`} aria-label="Loading vehicles">
            {[1, 2, 3].map(n => <div key={n} className="garage-skeleton"><div/><span/><i/></div>)}
          </div>
        ) : vehicles.length === 0 ? (
          <section className="garage-empty">
            <div className="garage-empty-icon"><CarFront size={36} strokeWidth={1.65}/></div>
            <h2>Your garage is empty</h2>
            <p>Add your first vehicle and it goes live on your showroom link right away.</p>
            <button type="button" onClick={() => navigate('/app/vehicles/new')} className="garage-empty-cta"><Plus size={18}/> Add your first vehicle</button>
            <button type="button" onClick={previewShowroom} className="garage-preview-link">Preview my showroom <ArrowUpRight size={14}/></button>
          </section>
        ) : visible.length === 0 ? (
          <section className="garage-no-results">
            <div className="garage-no-results-icon"><SlidersHorizontal size={22}/></div>
            <h2>No vehicles found</h2>
            <p>Try a different search or remove some filters.</p>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>
          </section>
        ) : (
          <div className={`garage-vehicle-layout ${viewMode}`}>
            {visible.map((vehicle, index) => (
              <article
                key={vehicle.id}
                role="button"
                tabIndex={0}
                aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model}, ${statusLabel[vehicle.status] || vehicle.status}`}
                onClick={() => openVehicle(vehicle)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVehicle(vehicle); } }}
                className="garage-vehicle-card"
                style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
              >
                <div className="garage-vehicle-photo">
                  {vehicle.photos?.[0]
                    ? <img src={vehicle.photos[0]} alt={`${vehicle.make} ${vehicle.model}`} loading={index > 2 ? 'lazy' : 'eager'}/>
                    : <div className="garage-photo-placeholder"><CarFront size={38}/></div>}
                  <span className={`garage-status-pill ${vehicle.status}`}>{statusLabel[vehicle.status] || vehicle.status}</span>
                  <div className="garage-card-menu" onClick={event => event.stopPropagation()}>
                    <button type="button" aria-label={`Actions for ${vehicle.make} ${vehicle.model}`} aria-expanded={menuId === vehicle.id} onClick={() => setMenuId(menuId === vehicle.id ? null : vehicle.id)}><MoreHorizontal size={20}/></button>
                    {menuId === vehicle.id && (
                      <div className="garage-menu-popover" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuId(null); navigate(`/app/vehicles/${vehicle.id}/edit`); }}><Pencil size={14}/> Edit</button>
                        {(['reserved', 'sold', 'available'] as VehicleStatus[]).filter(status => status !== vehicle.status).map(status => (
                          <button type="button" role="menuitem" key={status} onClick={() => { setMenuId(null); void updateStatus(vehicle, status); }}>Mark as {status}</button>
                        ))}
                        <button type="button" role="menuitem" onClick={() => { setMenuId(null); void shareVehicle(vehicle); }}><Share2 size={14}/> Share link</button>
                        <div className="garage-menu-divider"/>
                        <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuId(null); setDeleteTarget(vehicle); }}><Trash2 size={14}/> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="garage-vehicle-info">
                  <h2>{vehicle.year} {vehicle.make} {vehicle.model}</h2>
                  <p className="garage-vehicle-price">{price(vehicle)}</p>
                  <p className="garage-vehicle-meta">{vehicle.mileageKm.toLocaleString()} km <span>·</span> {vehicle.transmission}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {!loading && vehicles.length > 3 && (
        <button
          type="button"
          onClick={() => navigate('/app/vehicles/new')}
          className={`garage-floating-add ${showAddButton ? 'is-visible' : 'is-hidden'}`}
          aria-hidden={!showAddButton}
          tabIndex={showAddButton ? 0 : -1}
        >
          <Plus size={17}/> Add vehicle
        </button>
      )}

      {deleteTarget && (
        <div className="garage-delete-backdrop" onClick={() => setDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="garage-delete-title" className="garage-delete-dialog" onClick={event => event.stopPropagation()}>
            <div className="garage-delete-icon"><Trash2 size={20}/></div>
            <h2 id="garage-delete-title">Delete this vehicle?</h2>
            <p>This will remove {deleteTarget.year} {deleteTarget.make} {deleteTarget.model} from your garage.</p>
            <div className="garage-delete-actions">
              <button type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" onClick={() => void remove()}>Delete vehicle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
