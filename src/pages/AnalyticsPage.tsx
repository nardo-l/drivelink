import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Car, MessageSquare, Eye, RefreshCw, TrendingUp, CircleHelp } from 'lucide-react';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { BottomNav } from '../components/layout/BottomNav';
import type { Dealership, Enquiry, Vehicle } from '../types';

type ViewHistoryRow = { view_date: string; views: number };
type TrendPoint = { key: string; label: string; views: number; enquiries: number };

export const AnalyticsPage: React.FC = () => {
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [viewHistory, setViewHistory] = useState<ViewHistoryRow[]>([]);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [d, v, e, history] = await Promise.all([
        storageService.getDealershipAsync(),
        storageService.getVehiclesAsync(),
        storageService.getEnquiriesAsync(),
        supabaseService.getStorefrontViewHistory(period),
      ]);
      setDealership(d);
      setVehicles(v);
      setEnquiries(e);
      setViewHistory(history);
    } catch (err) {
      console.error('Analytics load failed:', err);
      setError('We could not load your latest analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAnalytics(); }, [period]);

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
  const inventoryCounts = useMemo(() => [
    { label: 'Available', count: vehicles.filter(v => v.status === 'available').length },
    { label: 'Reserved', count: vehicles.filter(v => v.status === 'reserved').length },
    { label: 'Sold', count: vehicles.filter(v => v.status === 'sold').length },
    { label: 'Draft', count: vehicles.filter(v => v.status === 'draft').length },
  ], [vehicles]);
  const maxStage = Math.max(1, ...stageCounts.map(x => x.count));
  const maxSource = Math.max(1, ...sourceCounts.map(x => x.count));
  const maxInventory = Math.max(1, ...inventoryCounts.map(x => x.count));

  const trend = useMemo<TrendPoint[]>(() => {
    const viewsByDate = new Map(viewHistory.map(row => [row.view_date, row.views]));
    const enquiriesByDate = new Map<string, number>();
    enquiries.forEach(enquiry => {
      const key = harareDateKey(new Date(enquiry.createdAt));
      enquiriesByDate.set(key, (enquiriesByDate.get(key) || 0) + 1);
    });
    const todayKey = harareDateKey(new Date());
    const today = new Date(`${todayKey}T12:00:00+02:00`);
    return Array.from({ length: period }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (period - index - 1));
      const key = harareDateKey(day);
      return {
        key,
        label: day.toLocaleDateString('en', {
          timeZone: 'Africa/Harare', day: 'numeric',
          ...(period === 7 ? { month: 'short', weekday: 'short' } : {}),
        }),
        views: viewsByDate.get(key) || 0,
        enquiries: enquiriesByDate.get(key) || 0,
      };
    });
  }, [viewHistory, enquiries, period]);
  const recentEnquiries = useMemo(
    () => [...enquiries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [enquiries],
  );
  const maxTrend = Math.max(1, ...trend.flatMap(point => [point.views, point.enquiries]));

  return (
    <div className="dl-workspace relative min-h-full flex flex-col bg-[#F8F9FA] text-slate-900">
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
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="Enquiries per 100 views" value={loading ? '—' : views > 0 ? enquiryRate.toFixed(1) : '0.0'} note="All saved enquiries ÷ lifetime views × 100" />
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-sm">Activity over time</h2></div>
              <p className="text-xs text-slate-500 mt-1">Daily storefront views and saved enquiries</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1" aria-label="Analytics period">
              <PeriodButton active={period === 7} onClick={() => setPeriod(7)}>7 days</PeriodButton>
              <PeriodButton active={period === 30} onClick={() => setPeriod(30)}>30 days</PeriodButton>
            </div>
          </div>
          {loading ? <p className="text-sm text-slate-400 py-6">Loading daily activity…</p> : (
            <>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-4"><Legend color="bg-slate-800" label="Views" /><Legend color="bg-indigo-400" label="Enquiries" /></div>
              {period === 30 ? <div className="overflow-x-auto pb-1"><div className="min-w-[620px]"><TrendBars points={trend} max={maxTrend} compact /></div></div> : <TrendBars points={trend} max={maxTrend} />}
              <p className="text-[11px] text-slate-400 mt-3">View history starts when timestamp tracking was enabled. Earlier lifetime views remain in the total but cannot be assigned to past dates.</p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-sm">Enquiry pipeline</h2></div>
          {loading ? <p className="text-sm text-slate-400">Loading recorded enquiries…</p> : enquiries.length === 0 ? <EmptyState text="No enquiries recorded yet. Enquiries from your showroom will appear here." /> : <div className="space-y-3">{stageCounts.map(item => <BarRow key={item.label} label={item.label} count={item.count} max={maxStage} />)}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4"><MessageSquare className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-sm">Enquiry sources</h2></div>
          {loading ? <p className="text-sm text-slate-400">Loading enquiry sources…</p> : enquiries.length === 0 ? <EmptyState text="Source breakdown will appear when real enquiries are recorded." /> : <div className="space-y-3">{sourceCounts.map(item => <BarRow key={item.label} label={item.label} count={item.count} max={maxSource} />)}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4"><Car className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-sm">Inventory status</h2></div>
          {loading ? <p className="text-sm text-slate-400">Loading inventory…</p> : vehicles.length === 0 ? <EmptyState text="Add vehicles to your inventory to see availability here." /> : <div className="space-y-3">{inventoryCounts.map(item => <BarRow key={item.label} label={item.label} count={item.count} max={maxInventory} />)}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-4"><MessageSquare className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-sm">Recent enquiries</h2></div>
          {loading ? <p className="text-sm text-slate-400">Loading recent enquiries…</p> : recentEnquiries.length === 0 ? <EmptyState text="New enquiries will appear here once buyers contact you through tracked channels." /> : <div className="divide-y divide-slate-100">
            {recentEnquiries.map(enquiry => <div key={enquiry.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-800 truncate">{enquiry.buyerName || 'Buyer'}</p><span className="text-[10px] text-slate-400 shrink-0">{new Date(enquiry.createdAt).toLocaleDateString()}</span></div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{enquiry.message || 'No message provided'}</p>
              <div className="flex gap-2 mt-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] capitalize">{enquiry.stage}</span><span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-1 text-[10px]">{sourceLabel(enquiry.source)}</span></div>
            </div>)}
          </div>}
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 flex gap-2 text-xs leading-relaxed text-blue-950">
          <CircleHelp className="h-4 w-4 shrink-0 mt-0.5" /><p>Analytics only uses records saved to your dealership. DriveLink does not currently track individual vehicle views or WhatsApp clicks, so those metrics are not estimated.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

function harareDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Harare', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function sourceLabel(source: Enquiry['source']): string {
  if (source === 'whatsapp') return 'WhatsApp';
  if (source === 'call') return 'Phone call';
  return 'Website form';
}

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; note: string }> = ({ icon, label, value, note }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
    <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 mb-3">{icon}</div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-2xl font-extrabold tracking-tight tabular-nums mt-1">{value}</p><p className="text-[10px] leading-snug text-slate-400 mt-1">{note}</p>
  </div>
);

const PeriodButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{children}</button>
);

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>
);

const TrendBars: React.FC<{ points: TrendPoint[]; max: number; compact?: boolean }> = ({ points, max, compact = false }) => (
  <div className={`grid gap-2 ${compact ? 'grid-cols-[repeat(30,minmax(0,1fr))]' : 'grid-cols-7'}`}>
    {points.map(point => <div key={point.key} className="min-w-0 text-center">
      <div className={`h-32 flex items-end justify-center gap-1 border-b border-slate-100 ${compact ? 'px-0.5' : ''}`}>
        <div title={`${point.views} views`} className="w-1/2 max-w-5 rounded-t bg-slate-800" style={{ height: `${point.views ? Math.max(3, point.views / max * 100) : 0}%` }} />
        <div title={`${point.enquiries} enquiries`} className="w-1/2 max-w-5 rounded-t bg-indigo-400" style={{ height: `${point.enquiries ? Math.max(3, point.enquiries / max * 100) : 0}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-2 truncate">{point.label}</p><p className="text-[10px] text-slate-400 mt-1">{point.views} / {point.enquiries}</p>
    </div>)}
  </div>
);

const BarRow: React.FC<{ label: string; count: number; max: number }> = ({ label, count, max }) => (
  <div><div className="flex justify-between text-xs mb-1.5"><span className="text-slate-600">{label}</span><span className="font-bold tabular-nums">{count}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${count / max * 100}%` }} /></div></div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => <p className="text-sm text-slate-500 py-2">{text}</p>;
