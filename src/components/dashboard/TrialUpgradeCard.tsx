import { name } from '../../config/brand';
import React from 'react';
import { ArrowRight } from 'lucide-react';
import './TrialUpgradeCard.css';

type SubscriptionStatus = {
  status: string;
  plan: 'free' | 'pro';
  pro_trial_ends_at: string | null;
  current_period_end: string | null;
};

type Props = {
  subscription: SubscriptionStatus | null;
  vehicleCount: number;
  maxVehicles: number;
  serverNow: number;
  onUpgrade: () => void;
};

const DAY = 86400000;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const TrialUpgradeCard: React.FC<Props> = ({ subscription, vehicleCount, maxVehicles, serverNow, onUpgrade }) => {
  const clock = React.useRef({ serverNow, monotonicNow: performance.now() });
  const [now, setNow] = React.useState(serverNow);

  React.useEffect(() => {
    clock.current = { serverNow, monotonicNow: performance.now() };
    setNow(serverNow);
  }, [serverNow]);

  React.useEffect(() => {
    const tick = () => setNow(clock.current.serverNow + (performance.now() - clock.current.monotonicNow));
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!subscription) return null;

  if (subscription.plan === 'free') {
    const trialEnded = !!subscription.pro_trial_ends_at && new Date(subscription.pro_trial_ends_at).getTime() <= now;
    return (
      <section className={`dl-plan-slim-card ${trialEnded ? 'is-urgent' : ''}`} aria-label="Free plan">
        <div className="dl-plan-slim-copy">
          <strong>{trialEnded ? 'Pro trial ended · Free plan' : `Free plan · ${Math.min(vehicleCount, maxVehicles)} of ${maxVehicles} vehicles`}</strong>
          <span>{trialEnded ? 'Your showroom stays active. Upgrade any time to restore Pro.' : 'Showroom, enquiries and WhatsApp included'}</span>
        </div>
        <button type="button" onClick={onUpgrade}>{trialEnded ? 'Keep Pro' : 'Upgrade'} <ArrowRight size={14}/></button>
      </section>
    );
  }

  const paid = subscription.status === 'active' && !!subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() > now;
  if (paid) {
    return (
      <section className="dl-plan-slim-card" aria-label={`${name} Pro subscription`}>
        <div className="dl-plan-slim-copy">
          <strong>{name} Pro</strong>
          <span>Renews manually on {dateLabel(subscription.current_period_end!)}</span>
        </div>
        <button type="button" onClick={onUpgrade}>Manage <ArrowRight size={14}/></button>
      </section>
    );
  }

  const end = subscription.pro_trial_ends_at ? new Date(subscription.pro_trial_ends_at).getTime() : now;
  const remaining = end - now;
  const days = Math.max(0, Math.ceil(remaining / DAY));
  const urgent = days <= 3;
  return (
    <section className={`dl-plan-slim-card ${urgent ? 'is-urgent' : ''}`} aria-label="Pro trial">
      <div className="dl-plan-slim-copy">
        <strong>Pro trial · {days} {days === 1 ? 'day' : 'days'} left</strong>
        <span>{urgent ? 'Your Pro trial is nearly over' : 'Enjoy unlimited vehicles and full analytics'}</span>
      </div>
      <button type="button" onClick={onUpgrade}>Keep Pro <ArrowRight size={14}/></button>
    </section>
  );
};
