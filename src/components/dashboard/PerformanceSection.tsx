import React, { memo, useEffect, useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { useNavigation } from '../../context/NavigationContext';

type PerformanceData = { visits: number; enquiries: number };
type EnquiryDate = { createdAt: string };
type Props = {
  dealershipId: string;
  period: 7 | 30 | 90;
  isLive: boolean;
  enquiries?: EnquiryDate[];
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

export const PerformanceSection = memo(function PerformanceSection({
  dealershipId,
  period,
  isLive,
  enquiries,
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
  const key = `${dealershipId}:${period}`;

  if (import.meta.env.DEV) console.debug('[Home Performance] render', { dealershipId, period });

  useEffect(() => {
    if (import.meta.env.DEV) console.debug('[Home Performance] mount', { dealershipId, period });
    return () => {
      if (import.meta.env.DEV) console.debug('[Home Performance] unmount', { dealershipId, period });
    };
  }, []);

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

    // Keep the previous period visible while a new/stale result is fetched.
    if (!hasData && !cached) setLoading(true);
    setError('');

    const load = async () => {
      if (import.meta.env.DEV) console.debug('[Home Performance] data fetch start', { dealershipId, period });
      try {
        const result = await supabaseService.getDealershipPerformance(dealershipId, period);
        if (!active) return;
        performanceCache.set(key, { data: result, updatedAt: Date.now() });
        setData(result);
        setHasData(true);
        onData(result);
        onInitialLoadComplete();
        setError('');
      } catch (err: any) {
        if (active && !hasData && !cached) setError(err?.message || "Couldn't load performance");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [dealershipId, period, isLive, enquiries, retry, key, onData, onInitialLoadComplete]);

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(showroomUrl);
      showToast('Showroom link copied');
    } catch {
      showToast('Unable to copy showroom link');
    }
  };

  return (
    <section className="dl-performance-card mb-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2>Performance</h2><p>Showroom activity over time</p></div>
        <select
          aria-label="Performance period"
          value={period}
          onChange={event => onPeriodChange(Number(event.target.value) as 7 | 30 | 90)}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      <div className="dl-performance-chart" aria-live="polite" aria-busy={loading && !hasData}>
        {loading && !hasData ? (
          <div className="w-full space-y-4 px-1">
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
    </section>
  );
});
