import React from 'react';
import { ArrowRight } from 'lucide-react';
import './TrialUpgradeCard.css';

type SubscriptionStatus = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

type Props = {
  subscription: SubscriptionStatus | null;
  serverNow: number;
  vehiclePhoto?: string;
  defaultPhoto: string;
  onUpgrade: () => void;
};

const DAY = 86400000;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const TrialUpgradeCard: React.FC<Props> = ({ subscription, serverNow, vehiclePhoto, defaultPhoto, onUpgrade }) => {
  const clockAnchor = React.useRef({ serverNow, monotonicNow: performance.now() });
  const [now, setNow] = React.useState(serverNow);

  React.useEffect(() => {
    clockAnchor.current = { serverNow, monotonicNow: performance.now() };
    setNow(serverNow);
  }, [serverNow]);

  React.useEffect(() => {
    const tick = () => setNow(clockAnchor.current.serverNow + (performance.now() - clockAnchor.current.monotonicNow));
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!subscription) return null;

  const subscribed = subscription.status === 'active' || subscription.status === 'grace_period';
  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : 0;
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;

  if (subscribed) {
    const remaining = periodEnd ? periodEnd - now : 0;
    const daysRemaining = periodEnd ? Math.max(0, Math.ceil(remaining / DAY)) : Infinity;
    return (
      <section className="dl-plan-slim-card" aria-label="DriveLink Pro subscription">
        <div className="dl-plan-slim-copy">
          <strong>DriveLink Pro</strong>
          <span>{periodEnd ? `Renews on ${dateLabel(subscription.current_period_end!)}` : 'Your Pro subscription is active'}</span>
        </div>
        {daysRemaining <= 5 && <button type="button" onClick={onUpgrade}>Renew <ArrowRight size={14}/></button>}
      </section>
    );
  }

  const remaining = trialEnd ? trialEnd - now : 0;
  const expired = !trialEnd || remaining <= 0 || subscription.status === 'expired';
  const urgent = !expired && remaining < 6 * 60 * 60 * 1000;
  const headline = expired ? 'Trial ended' : urgent ? 'Ends today' : remaining < DAY
    ? `${Math.max(1, Math.ceil(remaining / 3600000))} hours left`
    : `${Math.ceil(remaining / DAY)} days left`;

  return (
    <section className={`dl-trial-upgrade-card ${urgent ? 'is-urgent' : ''}`} aria-label="Free trial status">
      <img className="dl-trial-car-image" src={vehiclePhoto || defaultPhoto} alt="" aria-hidden="true"/>
      <div className="dl-trial-image-gradient"/>
      <div className="dl-trial-content">
        <div className="dl-trial-label"><i/>Free trial</div>
        <h2>{headline}</h2>
        <p>{expired ? 'Upgrade to bring your showroom back online.' : 'Upgrade to keep your showroom live.'}</p>
        <button type="button" onClick={onUpgrade}>
          <span>Upgrade to Pro</span><i><ArrowRight size={15}/></i>
        </button>
      </div>
    </section>
  );
};
