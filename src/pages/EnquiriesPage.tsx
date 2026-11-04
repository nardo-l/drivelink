import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, MessageCircle, Phone, ChevronRight, X, Share2, Copy,
  RefreshCw, ArrowUpRight, Trash2, Check, UserRound, CarFront,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Enquiry, EnquiryStage, Vehicle } from '../types';
import './EnquiriesPage.css';

type EnquiryFilter = 'all' | 'new' | 'contacted' | 'converted' | 'lost';
const filters: { id: EnquiryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'converted', label: 'Converted' },
  { id: 'lost', label: 'Lost' },
];

const isContacted = (stage: EnquiryStage) => stage === 'contacted' || stage === 'negotiating';
const displayStage = (stage: EnquiryStage) => stage === 'negotiating' ? 'Contacted' : stage === 'sold' ? 'Converted' : stage.charAt(0).toUpperCase() + stage.slice(1);
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'B';
const timeAgo = (date: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 172800) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const EnquiriesPage: React.FC = () => {
  const { showToast, navigate } = useNavigation();
  const [leads, setLeads] = useState<Enquiry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<EnquiryFilter>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Enquiry | null>(null);
  const [stage, setStage] = useState<EnquiryStage>('new');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pullStartY = useRef<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [enquiries, inventory] = await Promise.all([
        storageService.getEnquiriesAsync(),
        storageService.getVehiclesAsync(),
      ]);
      setLeads(enquiries);
      setVehicles(inventory);
      window.dispatchEvent(new CustomEvent('drivelink:enquiries-updated', { detail: { unread: enquiries.filter(item => item.stage === 'new').length } }));
    } catch (e: any) {
      setError(e?.message || 'Could not load enquiries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(item => item.stage === 'new').length,
    contacted: leads.filter(item => isContacted(item.stage)).length,
    converted: leads.filter(item => item.stage === 'sold').length,
    lost: leads.filter(item => item.stage === 'lost').length,
  }), [leads]);

  const vehicleFor = (enquiry: Enquiry) => vehicles.find(vehicle => vehicle.id === enquiry.vehicleId);
  const visible = useMemo(() => leads.filter(item => {
    const statusMatch = filter === 'all'
      || (filter === 'new' && item.stage === 'new')
      || (filter === 'contacted' && isContacted(item.stage))
      || (filter === 'converted' && item.stage === 'sold')
      || (filter === 'lost' && item.stage === 'lost');
    if (!statusMatch) return false;
    const vehicle = vehicles.find(entry => entry.id === item.vehicleId);
    const query = search.toLowerCase().trim();
    return !query || [item.buyerName, item.buyerPhone, item.message, vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : ''].join(' ').toLowerCase().includes(query);
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [leads, vehicles, filter, search]);

  const open = (enquiry: Enquiry) => {
    setActive(enquiry);
    setStage(enquiry.stage);
    setNotes(enquiry.notes || '');
    setSwipedId(null);
  };

  const save = async (nextStage = stage) => {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await storageService.updateEnquiryStageAsync(active.id, nextStage, notes);
      if (!updated) throw new Error('Enquiry could not be updated.');
      setLeads(list => list.map(item => item.id === updated.id ? updated : item));
      setActive(updated);
      setStage(updated.stage);
      window.dispatchEvent(new CustomEvent('drivelink:enquiries-updated', { detail: { unread: leads.filter(item => item.id !== updated.id ? item.stage === 'new' : updated.stage === 'new').length } }));
      showToast('Enquiry updated');
    } catch (e: any) {
      showToast(e?.message || 'Could not update enquiry.');
    } finally { setSaving(false); }
  };

  const markContacted = async (enquiry: Enquiry) => {
    try {
      const updated = await storageService.updateEnquiryStageAsync(enquiry.id, 'contacted');
      if (updated) {
        setLeads(list => list.map(item => item.id === updated.id ? updated : item));
        window.dispatchEvent(new CustomEvent('drivelink:enquiries-updated', { detail: { unread: leads.filter(item => item.id !== updated.id && item.stage === 'new').length } }));
      }
    } catch (e: any) { showToast(e?.message || 'Could not update enquiry.'); }
  };

  const quickUpdateStage = async (enquiry: Enquiry, nextStage: EnquiryStage) => {
    try {
      const updated = await storageService.updateEnquiryStageAsync(enquiry.id, nextStage);
      if (updated) {
        const next = leads.map(item => item.id === updated.id ? updated : item);
        setLeads(next);
        window.dispatchEvent(new CustomEvent('drivelink:enquiries-updated', { detail: { unread: next.filter(item => item.stage === 'new').length } }));
      }
    } catch (e: any) { showToast(e?.message || 'Could not update enquiry.'); }
  };

  const handlePullStart = (event: React.TouchEvent<HTMLElement>) => {
    if (window.scrollY <= 0) pullStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handlePullMove = (event: React.TouchEvent<HTMLElement>) => {
    if (pullStartY.current === null || refreshing) return;
    const distance = Math.max(0, Math.min(90, (event.touches[0]?.clientY ?? 0) - pullStartY.current));
    if (distance > 0) setPullDistance(distance);
  };
  const handlePullEnd = () => {
    if (pullDistance > 62 && !refreshing) void load(true);
    pullStartY.current = null;
    setPullDistance(0);
  };

  const confirmContacted = (enquiry: Enquiry) => {
    if (enquiry.stage === 'new' && window.confirm('Mark this enquiry as Contacted?')) void markContacted(enquiry);
  };

  const whatsappUrl = (enquiry: Enquiry) => {
    const phone = enquiry.buyerPhone.replace(/\D/g, '');
    if (!phone) return '';
    const vehicle = vehicleFor(enquiry);
    const car = vehicle ? `the ${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'our showroom';
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${enquiry.buyerName}, thanks for your interest in ${car}. How can I help?`)}`;
  };

  const shareShowroom = async () => {
    try {
      const dealer = storageService.getDealership();
      const url = `${window.location.origin}/${dealer.slug}`;
      if (navigator.share) await navigator.share({ title: dealer.name, text: 'Browse our showroom', url });
      else { await navigator.clipboard.writeText(url); showToast('Showroom link copied'); }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        try { const url = `${window.location.origin}/${storageService.getDealership().slug}`; await navigator.clipboard.writeText(url); showToast('Showroom link copied'); }
        catch { showToast('Could not share the showroom link.'); }
      }
    }
  };

  const previewShowroom = () => {
    try { navigate(`/${storageService.getDealership().slug}`); }
    catch { navigate('/app/settings'); }
  };

  const deleteEnquiry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storageService.deleteEnquiryAsync(deleteTarget.id);
      const remaining = leads.filter(item => item.id !== deleteTarget.id);
      setLeads(remaining);
      window.dispatchEvent(new CustomEvent('drivelink:enquiries-updated', { detail: { unread: remaining.filter(item => item.stage === 'new').length } }));
      if (active?.id === deleteTarget.id) setActive(null);
      showToast('Enquiry deleted');
    } catch (e: any) { showToast(e?.message || 'Could not delete enquiry.'); }
    finally { setDeleting(false); setDeleteTarget(null); setSwipedId(null); }
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>, id: string) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent<HTMLElement>, id: string) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) setSwipedId(dx < 0 ? id : null);
    touchStart.current = null;
  };

  const statusClass = (enquiry: Enquiry) => enquiry.stage === 'new' ? 'new'
    : isContacted(enquiry.stage) ? 'contacted' : enquiry.stage === 'sold' ? 'converted' : 'lost';

  return (
    <div className="dl-workspace enquiries-page">
      <header className="enquiries-header">
        <div className="enquiries-header-inner">
          <p className="enquiries-eyebrow">ENQUIRIES</p>
          <h1>Enquiries</h1>
          <p className="enquiries-summary">{loading ? 'Loading enquiries…' : <>{counts.new} new <span>·</span> {counts.all} total</>}</p>
        </div>
      </header>

      <main className="enquiries-main" onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd}>
        {(refreshing || pullDistance > 12) && <div className="enquiries-pull-indicator" style={{ height: refreshing ? 36 : Math.min(36, pullDistance * .55) }}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/><span>{refreshing ? 'Refreshing enquiries…' : pullDistance > 62 ? 'Release to refresh' : 'Pull to refresh'}</span></div>}
        {counts.all > 0 && (
          <section className="enquiries-summary-strip" aria-label="Enquiry summary">
            <div><strong>{counts.new}</strong><span>New</span></div>
            <i/>
            <div><strong>{counts.contacted}</strong><span>Contacted</span></div>
            <i/>
            <div><strong>{counts.converted}</strong><span>Converted</span></div>
          </section>
        )}

        <div className="enquiries-search">
          <Search size={18}/>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, phone or car" aria-label="Search enquiries"/>
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={16}/></button>}
        </div>

        <div className="enquiries-filter-viewport">
          <div className="enquiries-filter-row" role="group" aria-label="Filter enquiries">
            {filters.map(item => (
              <button type="button" key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`enquiries-filter-chip ${filter === item.id ? 'is-selected' : ''}`}>
                <span>{item.label}</span>{item.id !== 'all' && <small>{counts[item.id]}</small>}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="enquiries-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}

        {loading ? (
          <div className="enquiries-skeleton-list" aria-label="Loading enquiries">
            {[1, 2, 3].map(index => <div className="enquiries-skeleton" key={index}><span/><div><i/><i/><b/></div></div>)}
          </div>
        ) : leads.length === 0 ? (
          <section className="enquiries-empty">
            <div className="enquiries-empty-icon"><MessageCircle size={34} strokeWidth={1.7}/></div>
            <h2>No enquiries yet</h2>
            <p>Share your showroom link and buyer messages will show up here.</p>
            <button type="button" className="enquiries-empty-cta" onClick={() => void shareShowroom()}><Share2 size={17}/> Share my showroom link</button>
            <button type="button" className="enquiries-preview-link" onClick={previewShowroom}>Preview my showroom <ArrowUpRight size={14}/></button>
          </section>
        ) : visible.length === 0 ? (
          <section className="enquiries-no-results">
            <div className="enquiries-empty-icon small"><Search size={23}/></div>
            <h2>No enquiries found</h2>
            <p>Try another search or clear your filters.</p>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>
          </section>
        ) : (
          <div className="enquiries-list">
            {visible.map((enquiry, index) => {
              const vehicle = vehicleFor(enquiry);
              const carName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'your showroom';
              return (
                <article key={enquiry.id} className={`enquiry-card-wrap ${swipedId === enquiry.id ? 'is-swiped' : ''}`} onTouchStart={event => onTouchStart(event, enquiry.id)} onTouchEnd={event => onTouchEnd(event, enquiry.id)}>
                  <div className="enquiry-swipe-actions" aria-hidden={swipedId !== enquiry.id}>
                    <button type="button" onClick={() => { setSwipedId(null); void quickUpdateStage(enquiry, 'contacted'); }}><Check size={15}/> Contacted</button>
                    <button type="button" onClick={() => { setSwipedId(null); void quickUpdateStage(enquiry, 'sold'); }}><Check size={15}/> Converted</button>
                    <button type="button" className="delete" onClick={() => setDeleteTarget(enquiry)}><Trash2 size={15}/> Delete</button>
                  </div>
                  <div className="enquiry-card" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                    <div className="enquiry-card-main" onClick={() => open(enquiry)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(enquiry); } }}>
                      <div className="enquiry-avatar">{initials(enquiry.buyerName)}</div>
                      <div className="enquiry-buyer">
                        <div className="enquiry-name-line"><strong>{enquiry.buyerName}</strong>{enquiry.stage === 'new' && <i className="enquiry-unread-dot"/>}</div>
                        <p>Asked about {carName}</p>
                      </div>
                      <div className="enquiry-time">{timeAgo(enquiry.createdAt)}</div>
                      <ChevronRight className="enquiry-chevron" size={15}/>
                    </div>
                    <div className="enquiry-card-footer">
                      <span className={`enquiry-status ${statusClass(enquiry)}`}>{displayStage(enquiry.stage)}</span>
                      <div className="enquiry-contact-actions">
                        {whatsappUrl(enquiry) && <a href={whatsappUrl(enquiry)} target="_blank" rel="noreferrer" onClick={() => confirmContacted(enquiry)}><MessageCircle size={13}/> WhatsApp</a>}
                        {enquiry.buyerPhone && <a href={`tel:${enquiry.buyerPhone}`} onClick={() => confirmContacted(enquiry)}><Phone size={13}/> Call</a>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {refreshing && <div className="enquiries-refreshing"><RefreshCw size={14} className="animate-spin"/> Updating enquiries…</div>}
      </main>

      {active && (
        <div className="enquiries-modal-backdrop" onClick={() => setActive(null)}>
          <section role="dialog" aria-modal="true" aria-label="Enquiry details" className="enquiries-detail-sheet" onClick={event => event.stopPropagation()}>
            <div className="enquiries-sheet-handle"/>
            <div className="enquiries-detail-heading">
              <div><p className="enquiries-detail-eyebrow">ENQUIRY DETAILS</p><h2>{active.buyerName}</h2><p>{active.buyerPhone}</p></div>
              <button type="button" onClick={() => setActive(null)} aria-label="Close details"><X size={19}/></button>
            </div>
            <div className="enquiries-detail-actions">
              {active.buyerPhone && <a href={`tel:${active.buyerPhone}`} onClick={() => confirmContacted(active)}><Phone size={15}/> Call</a>}
              {whatsappUrl(active) && <a href={whatsappUrl(active)} target="_blank" rel="noreferrer" onClick={() => confirmContacted(active)}><MessageCircle size={15}/> WhatsApp</a>}
            </div>
            {vehicleFor(active) && <div className="enquiries-vehicle-detail">
              {vehicleFor(active)?.photos?.[0] ? <img src={vehicleFor(active)?.photos[0]} alt={`${vehicleFor(active)?.make} ${vehicleFor(active)?.model}`}/> : <div className="enquiries-vehicle-placeholder"><CarFront size={25}/></div>}
              <div><small>INTERESTED VEHICLE</small><strong>{vehicleFor(active)?.year} {vehicleFor(active)?.make} {vehicleFor(active)?.model}</strong><b>{vehicleFor(active)?.currency === 'ZAR' ? 'R' : '$'}{vehicleFor(active)?.price.toLocaleString()}</b></div>
            </div>}
            <div className="enquiries-message-card"><small>BUYER MESSAGE</small><p>{active.message}</p><time>{new Date(active.createdAt).toLocaleString()}</time></div>
            <label className="enquiries-status-field">Enquiry status
              <select value={stage} onChange={event => setStage(event.target.value as EnquiryStage)}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                {active.stage === 'negotiating' && <option value="negotiating">Contacted</option>}
                <option value="sold">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </label>
            <label className="enquiries-status-field">Internal notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Add a note about this buyer…"/></label>
            <button type="button" disabled={saving} onClick={() => void save()} className="enquiries-save-button">{saving ? 'Saving…' : 'Save enquiry updates'}</button>
            <button type="button" className="enquiries-delete-detail" onClick={() => setDeleteTarget(active)}><Trash2 size={14}/> Delete enquiry</button>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="enquiries-confirm-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <section role="dialog" aria-modal="true" aria-label="Confirm enquiry deletion" className="enquiries-confirm-dialog" onClick={event => event.stopPropagation()}>
            <div className="enquiries-confirm-icon"><Trash2 size={20}/></div>
            <h2>Delete this enquiry?</h2>
            <p>This will permanently remove the enquiry from your inbox.</p>
            <div><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteEnquiry()}>{deleting ? 'Deleting…' : 'Delete enquiry'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
};
