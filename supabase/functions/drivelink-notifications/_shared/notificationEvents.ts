export type NotificationChannel = 'push' | 'in_app';
export type NotificationPriority = 'urgent' | 'normal' | 'low';
export type NotificationCategory = 'enquiries' | 'reminders' | 'summaries' | 'account_billing';

export interface NotificationEventDefinition {
  id: string;
  category: NotificationCategory;
  channels: NotificationChannel[];
  plans: ('free' | 'pro' | 'pro_trial' | 'all')[];
  priority: NotificationPriority;
  timing: 'immediate' | 'scheduled';
  dedupe: (entityId: string, occurrence?: string) => string;
  title: string;
  body: (values: Record<string, string | number>) => string;
  link: (values: Record<string, string | number>) => string;
}

export const NOTIFICATION_EVENTS: Record<string, NotificationEventDefinition> = {
  new_enquiry: {
    id: 'new_enquiry', category: 'enquiries', channels: ['push', 'in_app'],
    plans: ['free', 'pro_trial', 'pro'], priority: 'urgent', timing: 'immediate',
    dedupe: (id) => 'new_enquiry:' + id,
    title: 'New enquiry',
    body: (v) => String(v.buyer || 'A buyer') + ' asked about your ' + String(v.vehicle || 'vehicle'),
    link: (v) => '/app/enquiries?enquiry=' + String(v.id || ''),
  },
  unanswered_enquiry: {
    id: 'unanswered_enquiry', category: 'enquiries', channels: ['push', 'in_app'],
    plans: ['free', 'pro_trial', 'pro'], priority: 'normal', timing: 'scheduled',
    dedupe: (id) => 'unanswered_enquiry:' + id,
    title: 'Enquiry needs a reply',
    body: (v) => String(v.buyer || 'A buyer') + ' is waiting for a reply about your ' + String(v.vehicle || 'vehicle'),
    link: (v) => '/app/enquiries?enquiry=' + String(v.id || ''),
  },
  pro_trial_ending: {
    id: 'pro_trial_ending', category: 'account_billing', channels: ['push', 'in_app'],
    plans: ['pro_trial'], priority: 'urgent', timing: 'scheduled',
    dedupe: (id, occurrence) => 'pro_trial_ending:' + id + ':' + String(occurrence || 'due'),
    title: 'Your Lotlé Pro trial is ending',
    body: (v) => String(v.when || 'Your trial is nearly over') + '. Review your plan to keep your Pro features.',
    link: () => '/app/billing',
  },
  payment_confirmed: {
    id: 'payment_confirmed', category: 'account_billing', channels: ['push', 'in_app'],
    plans: ['all'], priority: 'urgent', timing: 'immediate',
    dedupe: (id) => 'payment_confirmed:' + id,
    title: 'Payment confirmed',
    body: (v) => 'Your Lotlé payment of ' + String(v.amount || '') + ' ' + String(v.currency || 'USD') + ' was confirmed.',
    link: () => '/app/billing',
  },
  payment_pending: {
    id: 'payment_pending', category: 'account_billing', channels: ['in_app'],
    plans: ['all'], priority: 'low', timing: 'scheduled',
    dedupe: (id) => 'payment_pending:' + id,
    title: 'Payment still pending',
    body: (v) => 'Your payment of ' + String(v.amount || '') + ' ' + String(v.currency || 'USD') + ' has not been confirmed yet.',
    link: () => '/app/billing',
  },
  pro_renewal_due: {
    id: 'pro_renewal_due', category: 'account_billing', channels: ['push', 'in_app'],
    plans: ['pro'], priority: 'urgent', timing: 'scheduled',
    dedupe: (id, occurrence) => 'pro_renewal_due:' + id + ':' + String(occurrence || 'due'),
    title: 'Your Lotlé Pro renewal is due',
    body: (v) => String(v.when || 'Your renewal is due') + '. Review your subscription in Lotlé.',
    link: () => '/app/billing',
  },
  plan_limit_reached: {
    id: 'plan_limit_reached', category: 'reminders', channels: ['in_app'],
    plans: ['free', 'pro_trial', 'pro'], priority: 'low', timing: 'immediate',
    dedupe: (id, occurrence) => 'plan_limit_reached:' + id + ':' + String(occurrence || 'limit'),
    title: 'Plan limit reached',
    body: (v) => String(v.message || 'You have reached the limit on your current plan.'),
    link: () => '/app/billing',
  },
  add_first_car: {
    id: 'add_first_car', category: 'reminders', channels: ['push'],
    plans: ['free', 'pro_trial', 'pro'], priority: 'low', timing: 'scheduled',
    dedupe: (id) => 'add_first_car:' + id,
    title: 'Add your first vehicle',
    body: () => 'Your Lotlé showroom is ready. Add your first vehicle so buyers can browse your stock.',
    link: () => '/app/vehicles/new',
  },
  weekly_summary: {
    id: 'weekly_summary', category: 'summaries', channels: ['push', 'in_app'],
    plans: ['free', 'pro_trial', 'pro'], priority: 'low', timing: 'scheduled',
    dedupe: (id, occurrence) => 'weekly_summary:' + id + ':' + String(occurrence || 'week'),
    title: 'Your weekly showroom summary',
    body: (v) => 'Your showroom had ' + String(v.visits || 0) + ' visits and ' + String(v.enquiries || 0) + ' enquiries this week.',
    link: () => '/app/analytics',
  },
};

export const NOTIFICATION_PREFERENCE_COLUMNS: Record<NotificationCategory, string[]> = {
  enquiries: ['new_enquiries'],
  reminders: ['vehicle_reminders', 'share_reminders', 'showroom_activity'],
  summaries: ['daily_summary'],
  account_billing: ['subscription_reminders'],
};

export const NON_URGENT_PUSH_DAILY_LIMIT = 1;
export const PUSH_RETRY_DELAYS_MINUTES = [1, 5] as const;
export const HARARE_TIMED_SEND_START_HOUR = 7;
export const HARARE_TIMED_SEND_END_HOUR = 20;
