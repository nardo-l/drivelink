import React from 'react';
import { ArrowRight } from 'lucide-react';
import { name } from '../../config/brand';

type SubscriptionStatus = {
  status: string;
  plan: 'free' | 'pro';
  current_period_end: string | null;
  maxVehicles: number | null;
};

type Props = {
  subscription: SubscriptionStatus | null;
  vehicleCount: number;
  maxVehicles: number;
  onUpgrade: () => void;
};

const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const PlanSummaryCard: React.FC<Props> = ({ subscription, vehicleCount, maxVehicles, onUpgrade }) => {
  if (!subscription) return null;
  const isPro = subscription.plan === 'pro';
  return (
    <section className="mb-4 flex min-h-[62px] items-center justify-between gap-3 rounded-[18px] border border-[#E7EAF0] bg-white px-4 py-3" aria-label={isPro ? `${name} Pro subscription` : 'Free plan'}>
      <div className="flex min-w-0 flex-col gap-1">
        <strong className="text-xs font-extrabold text-[#0A0F1E]">{isPro ? `${name} Pro` : `Free plan · ${Math.min(vehicleCount, maxVehicles)} of ${maxVehicles} vehicles`}</strong>
        <span className="text-[10px] font-medium text-[#858D99]">{isPro
          ? (subscription.current_period_end ? `Renews manually on ${dateLabel(subscription.current_period_end)}` : 'Your paid Pro plan is active')
          : 'Showroom, enquiries and WhatsApp included'}</span>
      </div>
      <button type="button" onClick={onUpgrade} className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-[#0A0F1E] px-3 text-[10px] font-bold text-white">{isPro ? 'Manage' : 'Upgrade'} <ArrowRight size={14}/></button>
    </section>
  );
};
