import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, CarFront, MoreHorizontal, Pencil, Trash2, X,
  Share2, RefreshCw, ArrowUpRight, SlidersHorizontal, CalendarDays, Gauge, Fuel,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Vehicle, VehicleStatus } from '../types';
import { planService } from '../services/planService';
import './VehiclesListPage.css';

type InventoryFilter = 'all' | 'available' | 'reserved' | 'sold';
type ViewMode = 'single' | 'double';

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
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [showVehicleLimitSheet, setShowVehicleLimitSheet] = useState(false);
  const [showKeepVehiclesSheet, setShowKeepVehiclesSheet] = useState(false);
  const [selectedKeepVehicleIds, setSelectedKeepVehicleIds] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { const id = storageService.getUserSession().userId || 'anonymous'; return localStorage.getItem(`drivelink_garage_columns_${id}`) === 'double' ? 'double' : 'single'; } catch { return 'single'; }
  });
  const floatingAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const showAddButtonRef = useRef(true);
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

  useEffect(() => { void planService.getMyPlan().then(p => { setPlan(p.plan); return load(); }).catch(e => { console.error('[Lotle plan] Garage plan load failed', e); void load(); }); }, [load]);

  const activeVehicleCount = vehicles.filter(v => v.status !== 'hidden').length;
  const hiddenVehicleCount = vehicles.filter(v => v.status === 'hidden').length;
  const openKeepPicker = () => { setSelectedKeepVehicleIds(vehicles.filter(v => v.status !== 'hidden').slice(0,3).map(v => v.id)); setShowKeepVehiclesSheet(true); };
  const saveKeepSelection = async () => {
    try { await planService.chooseFreeVehicles(selectedKeepVehicleIds); setShowKeepVehiclesSheet(false); await load(true); showToast('Your showroom selection is saved.'); }
    catch (e: any) { showToast(e?.message || 'Could not save your showroom selection.'); }
  };
  const requestAddVehicle = () => {
    if (plan === 'free' && activeVehicleCount >= 3) { setShowVehicleLimitSheet(true); return; }
    navigate('/app/vehicles/new');
  };

  useEffect(() => {
    const onScroll = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const currentY = window.scrollY;
        let visible = showAddButtonRef.current;
        if (currentY < 24) visible = true;
        else if (currentY > lastScrollY.current + 5) visible = false;
        else if (currentY < lastScrollY.current - 5) visible = true;
        lastScrollY.current = currentY;
        if (visible !== showAddButtonRef.current) {
          showAddButtonRef.current = visible;
          const button = floatingAddButtonRef.current;
          if (button) {
            button.classList.toggle('is-visible', visible);
            button.classList.toggle('is-hidden', !visible);
            button.setAttribute('aria-hidden', String(!visible));
            button.tabIndex = visible ? 0 : -1;
          }
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    };
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
  }).sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold')), [vehicles, filter, search]);

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
    try { const id = storageService.getUserSession().userId || 'anonymous'; localStorage.setItem(`drivelink_garage_columns_${id}`, mode); } catch { /* storage unavailable */ }
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

  const statusLabel: Record<string, string> = { available: 'Available', reserved: 'Reserved', sold: 'Sold', draft: 'Draft', hidden: 'Hidden' };
  const imageSource = (url: string) => { try { const parsed = new URL(url); if (!parsed.pathname.includes('/storage/v1/object/public/')) return url; parsed.pathname = parsed.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/'); parsed.searchParams.set('width', '800'); parsed.searchParams.set('height', '1000'); parsed.searchParams.set('resize', 'cover'); parsed.searchParams.set('quality', '78'); parsed.searchParams.set('format', 'webp'); return parsed.toString(); } catch { return url; } };

  return (
    <div className="dl-workspace garage-page min-h-full flex flex-col" onClick={() => menuId && setMenuId(null)}>
      <header className="garage-header sticky top-0 z-20">
        <div className="garage-header-inner">
          <div className="min-w-0">
            <p className="garage-eyebrow">INVENTORY</p>
            <h1>Garage</h1>
            <p className="garage-summary">{loading ? 'Loading your inventory…' : <>{plan === 'free' ? `${activeVehicleCount} of 3 vehicles` : `${activeVehicleCount} vehicles`} <span>·</span> {counts.available} available</>}</p>
          </div>
          {vehicles.length > 0 && (
            <button type="button" onClick={requestAddVehicle} aria-label="Add vehicle" className="garage-header-add">
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
          <div className="garage-view-toggle" role="group" aria-label="Card columns">
            <button type="button" onClick={() => setView('single')} aria-label="Single column" aria-pressed={viewMode === 'single'} className={viewMode === 'single' ? 'is-active' : ''}><span className="garage-column-icon single"/></button>
            <button type="button" onClick={() => setView('double')} aria-label="Two columns" aria-pressed={viewMode === 'double'} className={viewMode === 'double' ? 'is-active' : ''}><span className="garage-column-icon double"/></button>
          </div>
        </div>

        {plan === 'free' && hiddenVehicleCount > 0 && <aside className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs leading-relaxed text-slate-600">Your showroom shows 3 vehicles on the Free plan. Choose which ones to keep, or upgrade to show them all.</p>
          <button type="button" className="mt-3 text-xs font-bold text-slate-900 underline underline-offset-4" onClick={openKeepPicker}>Choose vehicles</button>
        </aside>}

        {error && <div role="alert" className="garage-error">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}

        {loading ? (
          <div className={`garage-vehicle-layout ${viewMode}`} aria-label="Loading vehicles">
            {[1, 2, 3].map(n => <div key={n} className="garage-skeleton"><div/></div>)}
          </div>
        ) : vehicles.length === 0 ? (
          <section className="garage-empty">
            <div className="garage-empty-icon"><CarFront size={36} strokeWidth={1.65}/></div>
            <h2>Your garage is empty</h2>
            <p>Add your first vehicle and it goes live on your showroom link right away.</p>
            <button type="button" onClick={requestAddVehicle} className="garage-empty-cta"><Plus size={18}/> Add your first vehicle</button>
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
              <article key={vehicle.id} role="button" tabIndex={0}
                aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model}, ${statusLabel[vehicle.status] || vehicle.status}`}
                onClick={() => openVehicle(vehicle)}
                onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVehicle(vehicle); } }}
                className={`garage-vehicle-card ${vehicle.status === 'sold' ? 'is-sold' : ''}`}
                style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}>
                <div className="garage-vehicle-photo">
                  {vehicle.photos?.[0]
                    ? <div className="garage-image-frame"><div className="garage-image-skeleton"/><img src={imageSource(vehicle.photos[0])} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" decoding="async" onLoad={event => event.currentTarget.classList.add('is-loaded')} onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('has-error'); }}/></div>
                    : <div className="garage-photo-placeholder"><CarFront size={34}/><span>Add photos</span></div>}
                  <div className="garage-photo-gradient"/>
                  <span className={`garage-status-pill ${vehicle.status}`}>{statusLabel[vehicle.status] || vehicle.status}</span>
                  <div className="garage-card-menu" onClick={event => event.stopPropagation()}>
                    <button type="button" aria-label={`Actions for ${vehicle.make} ${vehicle.model}`} aria-expanded={menuId === vehicle.id} onClick={() => setMenuId(menuId === vehicle.id ? null : vehicle.id)}><MoreHorizontal size={20}/></button>
                  </div>
                  <div className="garage-photo-copy">
                    <div className="garage-photo-details"><h2>{vehicle.make} {vehicle.model}</h2>
                      <p className="garage-vehicle-meta"><span><CalendarDays size={11}/>{vehicle.year}</span><span><Gauge size={11}/>{vehicle.mileageKm.toLocaleString()} km</span><span><Fuel size={11}/>{vehicle.fuel || 'Petrol'}</span></p>
                    </div>
                    <p className="garage-vehicle-price">{price(vehicle)}</p>
                  </div>
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
          ref={floatingAddButtonRef}
          className="garage-floating-add is-visible"
          aria-hidden="false"
          tabIndex={0}
        >
          <Plus size={17}/> Add vehicle
        </button>
      )}

      {menuId && (() => {
        const selected = vehicles.find(vehicle => vehicle.id === menuId);
        if (!selected) return null;
        return <div className="garage-sheet-backdrop" onClick={() => setMenuId(null)}>
          <section className="garage-action-sheet" role="dialog" aria-modal="true" aria-label={`Actions for ${selected.make} ${selected.model}`} onClick={event => event.stopPropagation()}>
            <div className="garage-sheet-handle"/><p className="garage-sheet-title">{selected.year} {selected.make} {selected.model}</p>
            <button type="button" onClick={() => { setMenuId(null); navigate(`/app/vehicles/${selected.id}/edit`); }}><Pencil size={17}/> Edit</button>
            {selected.status !== 'reserved' && <button type="button" onClick={() => { setMenuId(null); void updateStatus(selected, 'reserved'); }}>Mark as reserved</button>}
            {selected.status !== 'sold' && <button type="button" onClick={() => { setMenuId(null); void updateStatus(selected, 'sold'); }}>Mark as sold</button>}
            <button type="button" onClick={() => { setMenuId(null); void shareVehicle(selected); }}><Share2 size={17}/> Share link</button>
            <button type="button" className="is-danger" onClick={() => { setMenuId(null); setDeleteTarget(selected); }}><Trash2 size={17}/> Delete</button>
            <button type="button" className="garage-sheet-cancel" onClick={() => setMenuId(null)}>Cancel</button>
          </section>
        </div>;
      })()}

      {showKeepVehiclesSheet && <div className="garage-sheet-backdrop" onClick={() => setShowKeepVehiclesSheet(false)}>
        <section className="garage-action-sheet" role="dialog" aria-modal="true" aria-label="Choose showroom vehicles" onClick={event => event.stopPropagation()}>
          <div className="garage-sheet-handle"/>
          <p className="garage-sheet-title">Choose 3 vehicles for your showroom</p>
          <p className="px-2 text-xs text-slate-500">Your other vehicles stay saved and can be restored by upgrading.</p>
          <div className="max-h-[42vh] overflow-y-auto space-y-1 px-1">
            {vehicles.map(vehicle => <button key={vehicle.id} type="button" onClick={() => setSelectedKeepVehicleIds(ids => ids.includes(vehicle.id) ? ids.filter(id => id !== vehicle.id) : ids.length < 3 ? [...ids, vehicle.id] : ids)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
              <span className={'grid h-5 w-5 place-items-center rounded-md border '+(selectedKeepVehicleIds.includes(vehicle.id)?'border-slate-900 bg-slate-900 text-white':'border-slate-300')}>{selectedKeepVehicleIds.includes(vehicle.id)?'✓':''}</span>
              <span className="min-w-0 flex-1 text-xs font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</span>
              <span className="text-[10px] text-slate-400">{vehicle.status==='hidden'?'Hidden':'Shown'}</span>
            </button>)}
          </div>
          <p className="px-2 text-[10px] text-slate-400">{selectedKeepVehicleIds.length} of 3 selected</p>
          <button type="button" disabled={selectedKeepVehicleIds.length===0} onClick={() => void saveKeepSelection()}>Save selection</button>
          <button type="button" onClick={() => navigate('/app/upgrade?reason=vehicle_limit')}>Upgrade to show them all</button>
          <button type="button" className="garage-sheet-cancel" onClick={() => setShowKeepVehiclesSheet(false)}>Not now</button>
        </section>
      </div>}

      {showVehicleLimitSheet && <div className="garage-sheet-backdrop" onClick={() => setShowVehicleLimitSheet(false)}>
        <section className="garage-action-sheet" role="dialog" aria-modal="true" aria-label="Free vehicle limit" onClick={event => event.stopPropagation()}>
          <div className="garage-sheet-handle"/>
          <p className="garage-sheet-title">You've used your 3 free vehicles.</p>
          <p className="text-sm text-slate-500 px-2">Upgrade to Pro for unlimited vehicles.</p>
          <button type="button" onClick={() => navigate('/app/upgrade?reason=vehicle_limit')}>Upgrade</button>
          <button type="button" className="garage-sheet-cancel" onClick={() => setShowVehicleLimitSheet(false)}>Not now</button>
        </section>
      </div>}

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
