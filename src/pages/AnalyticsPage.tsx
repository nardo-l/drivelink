import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Car, MessageSquare, Eye, RefreshCw, TrendingUp, CircleHelp } from 'lucide-react';
import { storageService } from '../services/storage';
import { BottomNav } from '../components/layout/BottomNav';
import type { Dealership, Enquiry, Vehicle } from '../types';

export const AnalyticsPage: React.FC = () => {
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [d, v, e] = await Promise.all([
        storageService.getDealershipAsync(),
        storageService.getVehiclesAsync(),
        storageService.getEnquiriesAsync(),
      ]);
      setDealership(d);
      setVehicles(v);
      setEnquiries(e);
    } catch (err) {
      console.error('Analytics load failed:', err);
      setError('We could not load your latest analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAnalytics(); }, []);

  const views = dealership?.storefrontViews ?? 0;
  const availableVehicles = vehicles.filter(v => v.status === 'available').length;
  const enquiryRate = views > 0 ? (enquiries.length / views) * 100 : 0;
  const stageCounts = useMemo(() => [
    { label: 'New', count: enquiries.filter(e => e.stage === 'new').length },
    { label: 'Contacted', count: enquiries.filter(e => e.stage === 'contacted').length },
    { label: 'Negotiating', count: enquiries.filter(e => e.stage === 'negotiating').length },
    { label: 'Sold', count: enquiries.filter(e => e.stage === 'sold').length },
    { label: 'Lost', count: enquiries.filter(e => e.stage === 'lost').length },
  ], [enquiries]);
  const sourceCounts = useMemo(() => [
    { label: 'Website form', count: enquiries.filter(e => e.source === 'form').length },
    { label: 'WhatsApp', count: enquiries.filter(e => e.source === 'whatsapp').length },
    { label: 'Phone call', count: enquiries.filter(e => e.source === 'call').length },
  ], [enquiries]);
  const maxStage = Math.max(1, ...stageCounts.map(x => x.count));
  const maxSource = Math.max(1, ...sourceCounts.map(x => x.count));

  return (
    <div className="relative min-h-full flex flex-col bg-[#F8F9FA] text-slate-900">
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-28">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Performance</p>
            <h1 className="text-2xl font-extrabold tracking-tight mt-1">Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">{dealership?.name || 'Your showroom'} · Real recorded activity</p>
          </div>
          <button onClick={() => void loadAnalytics()} disabled={loading} aria-label="Refresh analytics" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Metric icon={<Eye className="h-4 w-4" />} label="Total storefront views" value={loading ? '—' : views.toLocaleString()} note="Lifetime recorded views" />
          <Metric icon={<Car className="h-4 w-4" />} label="Available vehicles" value={loading ? '—' : availableVehicles.toLocaleString()} note={`${vehicles.length} total inventory items`} />
          <Metric icon={<MessageSquare className="h-4 w-4" />} label="Total enquiries" value={loading ? '—' : enquiries.length.toLocaleString()} note="Saved enquiries" />
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="Enquiries per 100 views" value={loading ? '—' : views > 0 ? enquiryRate.toFixed(1) : '0.0'} note="Enquiries ÷ views × 100" />
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <h2 className="font-bold text-sm">Enquiry pipeline</h2>
          </div>
          {loading ? <p className="text-sm text-slate-400">Loading recorded enquiries…</p> : enquiries.length === 0 ? (
            <EmptyState text="No enquiries recorded yet. Enquiries from your showroom will appear here." />
          ) : <div className="space-y-3">
            {stageCounts.map(item => <BarRow key={item.label} label={item.label} count={item.count} max={maxStage} />)}
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <h2 className="font-bold text-sm">Enquiry sources</h2>
          </div>
          {loading ? <p className="text-sm text-slate-400">Loading enquiry sources…</p> : enquiries.length === 0 ? (
            <EmptyState text="Source breakdown will appear when real enquiries are recorded." />
          ) : <div className="space-y-3">
            {sourceCounts.map(item => <BarRow key={item.label} label={item.label} count={item.count} max={maxSource} />)}
          </div>}
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 flex gap-2 text-xs leading-relaxed text-blue-950">
          <CircleHelp className="h-4 w-4 shrink-0 mt-0.5" />
          <p>These figures come from your saved dealership, vehicle, and enquiry records. DriveLink does not yet store daily view history, so this page does not invent daily trends or visitor counts.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; note: string }> = ({ icon, label, value, note }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
    <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 mb-3">{icon}</div>
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="text-2xl font-extrabold tracking-tight tabular-nums mt-1">{value}</p>
    <p className="text-[10px] leading-snug text-slate-400 mt-1">{note}</p>
  </div>
);

const BarRow: React.FC<{ label: string; count: number; max: number }> = ({ label, count, max }) => (
  <div>
    <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-600">{label}</span><span className="font-bold tabular-nums">{count}</span></div>
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${count / max * 100}%` }} /></div>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => <p className="text-sm text-slate-500 py-2">{text}</p>;
