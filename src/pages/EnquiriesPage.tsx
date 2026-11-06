import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '../components/common/Select';
import {
  Search, MessageCircle, Phone, X, Share2,
  RefreshCw, Trash2, Check, CarFront,
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
const WhatsAppIcon: React.FC<{ size?: number }> = ({ size = 17 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.04 0C5.48 0 .14 5.34.14 11.9c0 2.1.55 4.15 1.6 5.96L.04 24l6.3-1.65a11.9 11.9 0 0 0 5.7 1.45h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42ZM12.05 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.38a9.86 9.86 0 0 1-1.52-5.26c0-5.47 4.45-9.92 9.93-9.92a9.85 9.85 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.94 9.92Zm5.45-7.43c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/></svg>;

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

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
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
        ) : error && leads.length === 0 ? (
          <section className="enquiries-no-results"><div className="enquiries-empty-icon small"><RefreshCw size={22}/></div><h2>Couldn’t load enquiries</h2><p>Your enquiries haven’t been changed. Check your connection and try again.</p><button type="button" onClick={() => void load()}>Try again</button></section>
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
              const contactUrl = whatsappUrl(enquiry);
              return (
                <article key={enquiry.id} className={`enquiry-card-wrap ${swipedId === enquiry.id ? 'is-swiped' : ''}`} onTouchStart={onTouchStart} onTouchEnd={event => onTouchEnd(event, enquiry.id)}>
                  <div className="enquiry-swipe-actions" aria-hidden={swipedId !== enquiry.id}>
                    <button type="button" onClick={() => { setSwipedId(null); void quickUpdateStage(enquiry, 'contacted'); }}><Check size={15}/> Contacted</button>
                    <button type="button" onClick={() => { setSwipedId(null); void quickUpdateStage(enquiry, 'sold'); }}><Check size={15}/> Converted</button>
                    <button type="button" className="delete" onClick={() => setDeleteTarget(enquiry)}><Trash2 size={15}/> Delete</button>
                  </div>
                  <div className={`enquiry-card ${enquiry.stage === 'new' ? 'is-new' : ''}`} role="button" tabIndex={0} onClick={() => open(enquiry)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(enquiry); } }} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                    <div className="enquiry-card-main">
                      <div className="enquiry-avatar">{initials(enquiry.buyerName)}</div>
                      <div className="enquiry-buyer">
                        <div className="enquiry-name-line"><strong>{enquiry.buyerName}</strong></div>
                        <p className="enquiry-car-line">Asked about {carName}</p>
                      </div>
                      <div className="enquiry-time-line"><span className="enquiry-time">{timeAgo(enquiry.createdAt)}</span>{enquiry.stage === 'new' && <i className="enquiry-unread-dot"/>}</div>
                    </div>
                    <div className="enquiry-vehicle-row">
                      {vehicle?.photos?.[0] ? <img className="enquiry-car-thumb" src={vehicle.photos[0]} alt="" loading="lazy"/> : <div className="enquiry-car-thumb enquiry-car-thumb-empty"><CarFront size={19}/></div>}
                      <span>Asked about {carName}</span>
                    </div>
                    <div className="enquiry-card-status"><span className={`enquiry-status ${statusClass(enquiry)}`}>{displayStage(enquiry)}</span></div>
                    <p className="enquiry-message-preview">{enquiry.message || 'No message provided.'}</p>
                    {contactUrl ? <div className="enquiry-contact-actions">
                      <a className="enquiry-whatsapp-cta" href={contactUrl} target="_blank" rel="noreferrer" onClick={event => { event.stopPropagation(); confirmContacted(enquiry); }}><WhatsAppIcon size={18}/> Reply on WhatsApp</a>
                      <a className="enquiry-call-cta" href={`tel:${enquiry.buyerPhone}`} aria-label={`Call ${enquiry.buyerName}`} onClick={event => { event.stopPropagation(); confirmContacted(enquiry); }}><Phone size={16}/></a>
                    </div> : <p className="enquiry-no-phone">No contact number</p>}
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
            <div className="enquiries-status-field"><span>Enquiry status</span><Select name="stage" aria-label="Enquiry status" value={stage} title="Enquiry status" options={[{value:'new',label:'New'},{value:active.stage === 'negotiating' ? 'negotiating' : 'contacted',label:'Contacted'},{value:'sold',label:'Converted'},{value:'lost',label:'Lost'}]} onChange={value=>setStage(value as EnquiryStage)}/></div>
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
