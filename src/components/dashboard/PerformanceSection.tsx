import React, { memo, useEffect, useState, useRef } from 'react';
import { Select } from '../common/Select';
import { supabaseService } from '../../services/supabaseService';
import { useNavigation } from '../../context/NavigationContext';
import type { Enquiry, Vehicle } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PerformanceData = { visits: number; enquiries: number };
type Props = {
  dealershipId: string;
  period: 7 | 30 | 90;
  isLive: boolean;
  enquiries?: Enquiry[];
  vehicles?: Vehicle[];
  showroomUrl: string;
  onPeriodChange: (period: 7 | 30 | 90) => void;
  onData: (data: PerformanceData) => void;
  onInitialLoadComplete: () => void;
};

const CACHE_TTL = 60_000;
const performanceCache = new Map<string, { data: PerformanceData; updatedAt: number }>();

const PerformanceBars = memo(function PerformanceBars({ data }: { data: PerformanceData }) {
  const maxBar = Math.max(1, data.visits, data.enquiries);
  return (
    <div className="dl-bars">
      <div className="dl-bar-row">
        <span>Visits</span>
        <div><i style={{ width: (data.visits / maxBar * 100) + '%' }} /></div>
        <strong>{data.visits.toLocaleString()}</strong>
      </div>
      <div className="dl-bar-row is-light">
        <span>Enquiries</span>
        <div><i style={{ width: (data.enquiries / maxBar * 100) + '%' }} /></div>
        <strong>{data.enquiries.toLocaleString()}</strong>
      </div>
    </div>
  );
});

const BarRow = ({ label, count, max }: { label: string; count: number; max: number }) => (
  <div className="py-1">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-[#68727f] font-medium">{label}</span>
      <span className="font-bold tabular-nums text-[#0A0F1E]">{count}</span>
    </div>
    <div className="h-2 rounded-full bg-[#eef0f3] overflow-hidden">
      <div className="h-full rounded-full bg-[#0A0F1E] transition-all" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
    </div>
  </div>
);

const categories = [
  { id: 'activity', title: 'Activity & Visits', subtitle: 'Showroom activity over time' },
  { id: 'pipeline', title: 'Enquiry Pipeline', subtitle: 'Stage breakdown of enquiries' },
  { id: 'sources', title: 'Enquiry Sources', subtitle: 'Where your leads come from' },
  { id: 'inventory', title: 'Inventory Status', subtitle: 'Vehicle availability breakdown' },
];

export const PerformanceSection = memo(function PerformanceSection({
  dealershipId,
  period,
  isLive,
  enquiries = [],
  vehicles = [],
  showroomUrl,
  onPeriodChange,
  onData,
  onInitialLoadComplete,
}: Props) {
  const { showToast } = useNavigation();
  const [data, setData] = useState<PerformanceData>({ visits: 0, enquiries: 0 });
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const key = `${dealershipId}:${period}`;

  useEffect(() => {
    if (!dealershipId) return;
    let active = true;

    if (!isLive) {
      const since = Date.now() - period * 24 * 60 * 60 * 1000;
      const next = {
        visits: 0,
        enquiries: (enquiries || []).filter(item => new Date(item.createdAt).getTime() >= since).length,
      };
      setData(next);
      setHasData(true);
      onData(next);
      onInitialLoadComplete();
      setLoading(false);
      setError('');
      return;
    }

    const cached = performanceCache.get(key);
    if (cached) {
      setData(cached.data);
      setHasData(true);
      onData(cached.data);
      onInitialLoadComplete();
    }
    const isFresh = !!cached && Date.now() - cached.updatedAt < CACHE_TTL;
    if (isFresh) {
      setLoading(false);
      setError('');
      return;
    }

    if (!hasData && !cached) setLoading(true);
    setError('');

    const load = async () => {
      try {
        const result = await supabaseService.getDealershipPerformance(dealershipId, period);
        if (!active) return;
        performanceCache.set(key, { data: result, updatedAt: Date.now() });
        setData(result);
        setHasData(true);
        onData(result);
        setError('');
      } catch (err: any) {
        if (active && !hasData && !cached) setError(err?.message || "Couldn't load performance");
      } finally {
        if (active) {
          setLoading(false);
          onInitialLoadComplete();
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [dealershipId, period, isLive, enquiries, retry, key, onData, onInitialLoadComplete]);

  const scrollToSlide = (index: number) => {
    setActiveSlide(index);
    if (carouselRef.current) {
      const slideWidth = carouselRef.current.clientWidth;
      carouselRef.current.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, clientWidth } = carouselRef.current;
      const index = Math.round(scrollLeft / clientWidth);
      if (index !== activeSlide && index >= 0 && index < categories.length) {
        setActiveSlide(index);
      }
    }
  };

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(showroomUrl);
      showToast('Showroom link copied');
    } catch {
      showToast('Unable to copy showroom link');
    }
  };

  const pipelineCounts = [
    { label: 'New', count: enquiries.filter(e => e.stage === 'new').length },
    { label: 'Contacted', count: enquiries.filter(e => e.stage === 'contacted').length },
    { label: 'Negotiating', count: enquiries.filter(e => e.stage === 'negotiating').length },
    { label: 'Sold', count: enquiries.filter(e => e.stage === 'sold').length },
    { label: 'Lost', count: enquiries.filter(e => e.stage === 'lost').length },
  ];
  const maxPipeline = Math.max(1, ...pipelineCounts.map(x => x.count));

  const sourceCounts = [
    { label: 'Website form', count: enquiries.filter(e => e.source === 'form').length },
    { label: 'WhatsApp', count: enquiries.filter(e => e.source === 'whatsapp').length },
    { label: 'Phone call', count: enquiries.filter(e => e.source === 'call').length },
  ];
  const maxSource = Math.max(1, ...sourceCounts.map(x => x.count));

  const inventoryCounts = [
    { label: 'Available', count: vehicles.filter(v => v.status === 'available').length },
    { label: 'Reserved', count: vehicles.filter(v => v.status === 'reserved').length },
    { label: 'Sold', count: vehicles.filter(v => v.status === 'sold').length },
    { label: 'Draft', count: vehicles.filter(v => v.status === 'draft').length },
  ];
  const maxInventory = Math.max(1, ...inventoryCounts.map(x => x.count));

  return (
    <section className="dl-performance-card mb-4 relative">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2>{categories[activeSlide].title}</h2>
          <p>{categories[activeSlide].subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeSlide === 0 && (
            <Select
              aria-label="Performance period"
              value={String(period)}
              compact
              title="Performance period"
              options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]}
              onChange={value => onPeriodChange(Number(value) as 7 | 30 | 90)}
            />
          )}
          <div className="flex items-center gap-1 bg-[#f1f3f5] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
              disabled={activeSlide === 0}
              aria-label="Previous metric category"
              className="p-1 rounded text-slate-600 disabled:opacity-30 hover:bg-white"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollToSlide(Math.min(categories.length - 1, activeSlide + 1))}
              disabled={activeSlide === categories.length - 1}
              aria-label="Next metric category"
              className="p-1 rounded text-slate-600 disabled:opacity-30 hover:bg-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth gap-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="w-full shrink-0 snap-start min-w-0">
          <div className="dl-performance-chart" aria-live="polite" aria-busy={loading && !hasData}>
            {loading && !hasData ? (
              <div className="w-full space-y-4 px-1 py-4">
                <div className="h-3 rounded bg-[#eef0f3] animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-[#eef0f3] animate-pulse" />
              </div>
            ) : error && !hasData ? (
              <div className="dl-performance-empty">
                <p>Couldn't load activity.</p>
                <button onClick={() => setRetry(value => value + 1)}>Retry</button>
              </div>
            ) : data.visits === 0 && data.enquiries === 0 ? (
              <div className="dl-performance-empty">
                <p>No activity yet. Share your showroom link to start getting visitors</p>
                <button onClick={shareLink}>Share link</button>
              </div>
            ) : (
              <PerformanceBars data={data} />
            )}
          </div>
        </div>

        <div className="w-full shrink-0 snap-start min-w-0">
          <div className="space-y-2 py-1">
            {pipelineCounts.map(item => (
              <BarRow key={item.label} label={item.label} count={item.count} max={maxPipeline} />
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 snap-start min-w-0">
          <div className="space-y-2 py-1">
            {sourceCounts.map(item => (
              <BarRow key={item.label} label={item.label} count={item.count} max={maxSource} />
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 snap-start min-w-0">
          <div className="space-y-2 py-1">
            {inventoryCounts.map(item => (
              <BarRow key={item.label} label={item.label} count={item.count} max={maxInventory} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 pt-2 border-t border-[#f1f3f5]">
        {categories.map((cat, idx) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => scrollToSlide(idx)}
            aria-label={`Go to ${cat.title}`}
            className={`h-2 rounded-full transition-all ${activeSlide === idx ? 'w-6 bg-[#0A0F1E]' : 'w-2 bg-[#d1d5db]'}`}
          />
        ))}
      </div>
    </section>
  );
});
