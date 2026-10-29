import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, Search, Phone, MessageCircle, Clock, Car, ChevronRight,
  Edit2, X, Mail, RefreshCw, AlertCircle, CheckCircle2, Filter,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Enquiry, EnquiryStage, Vehicle } from '../types';
import { BottomNav } from '../components/layout/BottomNav';

const stages: { id: EnquiryStage | 'all'; label: string }[] = [
  { id: 'all', label: 'All leads' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'sold', label: 'Sold' },
  { id: 'lost', label: 'Lost' },
];

const stageStyles: Record<EnquiryStage, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  contacted: 'bg-violet-50 text-violet-700 border-violet-100',
  negotiating: 'bg-amber-50 text-amber-800 border-amber-100',
  sold: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  lost: 'bg-slate-100 text-slate-600 border-slate-200',
};

const stageLabels: Record<EnquiryStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  sold: 'Sold',
  lost: 'Lost',
};

const formatDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatPrice = (vehicle: Vehicle) =>
  `${vehicle.currency === 'ZAR' ? 'R' : '$'}${Number(vehicle.price || 0).toLocaleString()}`;

export const EnquiriesPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stageFilter, setStageFilter] = useState<EnquiryStage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [stageDraft, setStageDraft] = useState<EnquiryStage>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [liveEnquiries, liveVehicles] = await Promise.all([
        storageService.getEnquiriesAsync(),
        storageService.getVehiclesAsync(),
      ]);
      setEnquiries(liveEnquiries);
      setVehicles(liveVehicles);
    } catch (error) {
      console.error('Failed to load enquiries:', error);
      setLoadError('We couldn’t load your live enquiries. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const counts = useMemo(() => ({
    all: enquiries.length,
    new: enquiries.filter((item) => item.stage === 'new').length,
    contacted: enquiries.filter((item) => item.stage === 'contacted').length,
    negotiating: enquiries.filter((item) => item.stage === 'negotiating').length,
    sold: enquiries.filter((item) => item.stage === 'sold').length,
    lost: enquiries.filter((item) => item.stage === 'lost').length,
  }), [enquiries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enquiries.filter((item) => {
      if (stageFilter !== 'all' && item.stage !== stageFilter) return false;
      const vehicle = vehicles.find((v) => v.id === item.vehicleId);
      const haystack = [
        item.buyerName, item.buyerPhone, item.buyerEmail || '', item.message,
        item.notes || '', vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
      ].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [enquiries, vehicles, stageFilter, search]);

  const openManage = (enquiry: Enquiry) => {
    setActiveEnquiry(enquiry);
    setNotesDraft(enquiry.notes || '');
    setStageDraft(enquiry.stage);
  };

  const saveEnquiry = async () => {
    if (!activeEnquiry || saving) return;
    setSaving(true);
    try {
      const updated = await storageService.updateEnquiryStageAsync(activeEnquiry.id, stageDraft, notesDraft);
      if (!updated) throw new Error('The enquiry could not be found. Refresh and try again.');
      setEnquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActiveEnquiry(null);
      showToast('Enquiry updated');
    } catch (error) {
      console.error('Failed to save enquiry:', error);
      showToast('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getVehicle = (enquiry: Enquiry) => vehicles.find((vehicle) => vehicle.id === enquiry.vehicleId);
  const getWhatsAppUrl = (enquiry: Enquiry, vehicle?: Vehicle) => {
    const phone = enquiry.buyerPhone.replace(/\D/g, '');
    const greeting = `Hi ${enquiry.buyerName}, thanks for your enquiry${vehicle ? ` about the ${vehicle.year} ${vehicle.make} ${vehicle.model}` : ''}. How can I help you?`;
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(greeting)}` : '';
  };

  return (
    <div className="relative min-h-full flex flex-col bg-[#F7F8FA] text-slate-900">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Sales workspace</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">Buyer enquiries</h1>
            <p className="mt-1 text-xs text-slate-500">Manage real buyer leads from your showroom.</p>
          </div>
          <button onClick={() => void loadData()} disabled={loading} aria-label="Refresh enquiries" className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5">
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'Total leads', count: counts.all, note: 'All enquiries', tone: 'text-slate-950', icon: MessageSquare },
            { label: 'Needs response', count: counts.new, note: 'New leads', tone: 'text-blue-700', icon: Clock },
            { label: 'In negotiation', count: counts.negotiating, note: 'Active deals', tone: 'text-amber-700', icon: Car },
            { label: 'Deals closed', count: counts.sold, note: 'Marked as sold', tone: 'text-emerald-700', icon: CheckCircle2 },
          ].map((stat) => {
            const Icon = stat.icon;
            return <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">{stat.label}</span>
                <Icon className={`h-4 w-4 ${stat.tone}`} />
              </div>
              <p className={`mt-2 text-2xl font-extrabold tracking-tight ${stat.tone}`}>{loading ? '—' : stat.count}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{stat.note}</p>
            </div>;
          })}
        </section>

        <section className="mt-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyer, phone, email or vehicle…" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
            {stages.map((tab) => {
              const active = stageFilter === tab.id;
              return <button key={tab.id} onClick={() => setStageFilter(tab.id)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition ${active ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {tab.label}{tab.id !== 'all' ? ` · ${counts[tab.id]}` : ''}
              </button>;
            })}
          </div>
        </section>

        {loadError && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1 text-xs">{loadError}</div>
          <button onClick={() => void loadData()} className="text-xs font-bold underline">Retry</button>
        </div>}

        {loading ? (
          <div className="mt-8 space-y-3" aria-label="Loading enquiries">
            {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
          </div>
        ) : !loadError && filtered.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><MessageSquare className="h-6 w-6" /></div>
            <h2 className="mt-4 text-sm font-bold text-slate-900">{enquiries.length === 0 ? 'No buyer enquiries yet' : 'No matching enquiries'}</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">{enquiries.length === 0 ? 'When a buyer contacts you through your showroom, their real enquiry will appear here. No sample leads are shown.' : 'Try another search or choose a different status filter.'}</p>
            {(search || stageFilter !== 'all') && <button onClick={() => { setSearch(''); setStageFilter('all'); }} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white">Clear filters</button>}
          </div>
        ) : !loadError && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-slate-600">{filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}</p>
              <p className="text-[11px] text-slate-400">Newest first</p>
            </div>
            {filtered.map((enquiry) => {
              const vehicle = getVehicle(enquiry);
              const waUrl = getWhatsAppUrl(enquiry, vehicle);
              return <article key={enquiry.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{(enquiry.buyerName || '?').trim().charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-950">{enquiry.buyerName || 'Buyer'}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${stageStyles[enquiry.stage] || stageStyles.new}`}>{stageLabels[enquiry.stage] || 'New'}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{enquiry.buyerPhone || 'No phone provided'}{enquiry.buyerEmail ? ` · ${enquiry.buyerEmail}` : ''}</p>
                  </div>
                  <button onClick={() => openManage(enquiry)} aria-label={`Manage ${enquiry.buyerName}'s enquiry`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Edit2 className="h-3.5 w-3.5" /></button>
                </div>

                {vehicle ? <button onClick={() => navigate(`/app/vehicles/${vehicle.id}`)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left hover:bg-slate-100">
                  {vehicle.photos?.[0] ? <img src={vehicle.photos[0]} alt="" className="h-12 w-16 shrink-0 rounded-lg bg-slate-200 object-cover" /> : <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500"><Car className="h-5 w-5" /></div>}
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{vehicle.year} {vehicle.make} {vehicle.model}</p><p className="mt-1 text-xs font-semibold text-slate-600">{formatPrice(vehicle)}</p></div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button> : <p className="mt-3 text-[11px] text-slate-400">General showroom enquiry</p>}

                <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50/70 px-3 py-2.5 text-xs leading-5 text-slate-700">{enquiry.message || 'No message provided.'}</p>
                {enquiry.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500"><span className="font-semibold text-slate-600">Your note:</span> {enquiry.notes}</p>}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{enquiry.source || 'Enquiry'}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(enquiry.createdAt)}</p></div>
                  <div className="flex items-center gap-2">
                    {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f766e]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
                    {enquiry.buyerPhone && <a href={`tel:${enquiry.buyerPhone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Phone className="h-3.5 w-3.5" /> Call</a>}
                    {enquiry.buyerEmail && <a href={`mailto:${enquiry.buyerEmail}`} aria-label="Email buyer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Mail className="h-3.5 w-3.5" /></a>}
                  </div>
                </div>
              </article>;
            })}
          </div>
        )}
      </main>

      {activeEnquiry && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setActiveEnquiry(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="manage-enquiry-title" className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Lead management</p><h2 id="manage-enquiry-title" className="mt-1 text-base font-extrabold text-slate-950">{activeEnquiry.buyerName}</h2><p className="mt-1 text-xs text-slate-500">{activeEnquiry.buyerPhone}</p></div>
            <button disabled={saving} onClick={() => setActiveEnquiry(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"><X className="h-4 w-4" /></button>
          </div>
          <label className="mt-5 block text-xs font-bold text-slate-700" htmlFor="enquiry-stage">Lead status</label>
          <select id="enquiry-stage" value={stageDraft} onChange={(event) => setStageDraft(event.target.value as EnquiryStage)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
            <option value="new">New — needs response</option><option value="contacted">Contacted</option><option value="negotiating">Negotiating / viewing</option><option value="sold">Sold / deal closed</option><option value="lost">Lost / inactive</option>
          </select>
          <label className="mt-4 block text-xs font-bold text-slate-700" htmlFor="enquiry-notes">Private notes</label>
          <textarea id="enquiry-notes" rows={4} value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="Add useful details, agreed price, viewing arrangements or next steps…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" />
          <p className="mt-1 text-[11px] text-slate-400">Notes are for your dealership team and are not shown to buyers.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button disabled={saving} onClick={() => setActiveEnquiry(null)} className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
            <button disabled={saving} onClick={() => void saveEnquiry()} className="rounded-xl bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </section>
      </div>}

      <BottomNav />
    </div>
  );
};
