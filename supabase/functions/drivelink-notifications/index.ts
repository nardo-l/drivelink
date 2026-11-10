import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";
import { NOTIFICATION_EVENTS, NOTIFICATION_PREFERENCE_COLUMNS, NON_URGENT_PUSH_DAILY_LIMIT, PUSH_RETRY_DELAYS_MINUTES, HARARE_TIMED_SEND_START_HOUR, HARARE_TIMED_SEND_END_HOUR } from "./_shared/notificationEvents.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@lotle.app";
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const pushReady = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushReady) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const parts = (date = new Date()) => {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
};
const harareDate = (date = new Date()) => {
  const p = parts(date);
  return p.year + "-" + p.month + "-" + p.day;
};
const harareHour = (date = new Date()) => Number(parts(date).hour);
const harareMinute = (date = new Date()) => Number(parts(date).minute);
const harareWeekday = (date = new Date()) => parts(date).weekday;
const harareDayStart = (date = new Date()) => {
  const [year, month, day] = harareDate(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 2 * 60 * 60 * 1000).toISOString();
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" },
});
const categoryForDb = (category: string) => ({
  enquiries: "enquiry", reminders: "inventory", summaries: "daily_summary", account_billing: "subscription",
} as Record<string, string>)[category] || "system";

async function insertEventNotification(dealershipId: string, eventId: string, entityId: string, values: Record<string, string | number>, occurrence = "") {
  const event = NOTIFICATION_EVENTS[eventId];
  if (!event) throw new Error("Unknown notification event: " + eventId);
  if (eventId !== "payment_confirmed") {
    const { data: prefs } = await db.from("notification_preferences").select("*").eq("dealership_id", dealershipId).maybeSingle();
    const preferenceFields = NOTIFICATION_PREFERENCE_COLUMNS[event.category] || [];
    if (preferenceFields.some((field) => prefs?.[field] === false)) return null;
  }
  const key = event.dedupe(entityId, occurrence || undefined);
  const row = {
    dealership_id: dealershipId,
    category: categoryForDb(event.category),
    title: event.title,
    body: event.body(values),
    data: { eventId, entityId, url: event.link({ ...values, id: entityId }), priority: event.priority, channels: event.channels },
    dedupe_key: key,
  };
  const { data, error } = await db.from("notifications").upsert(row, {
    onConflict: "dealership_id,dedupe_key", ignoreDuplicates: true,
  }).select("id").maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

function isInsideTimeRange(start: string | null, end: string | null, date = new Date()) {
  if (!start || !end) return false;
  const now = harareHour(date) * 60 + harareMinute(date);
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const a = toMinutes(start), b = toMinutes(end);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}
function canSendPushNow(prefs: Record<string, unknown>, notification: any, date = new Date()) {
  if (isInsideTimeRange(prefs.quiet_hours_start as string | null, prefs.quiet_hours_end as string | null, date)) return false;
  const eventId = String(notification.data?.eventId || "");
  const event = NOTIFICATION_EVENTS[eventId];
  const immediate = event?.timing === "immediate" || eventId === "new_enquiry" || eventId === "payment_confirmed";
  if (!immediate) {
    const hour = harareHour(date);
    if (hour < HARARE_TIMED_SEND_START_HOUR || hour >= HARARE_TIMED_SEND_END_HOUR) return false;
  }
  return true;
}
function preferenceAllows(prefs: Record<string, unknown>, notification: any) {
  if (prefs.push_enabled === false) return false;
  const eventId = String(notification.data?.eventId || "");
  if (eventId === "payment_confirmed" || eventId === "test_notification") return true;
  const event = NOTIFICATION_EVENTS[eventId];
  if (event && !event.channels.includes("push")) return false;
  const category = event?.category || ({
    enquiry: "enquiries", inventory: "reminders", daily_summary: "summaries", subscription: "account_billing",
  } as Record<string, string>)[notification.category] || "reminders";
  const fields = NOTIFICATION_PREFERENCE_COLUMNS[category as keyof typeof NOTIFICATION_PREFERENCE_COLUMNS] || [];
  return fields.every((field) => prefs[field] !== false);
}
function isUrgent(notification: any) {
  const eventId = String(notification.data?.eventId || "");
  const event = NOTIFICATION_EVENTS[eventId];
  return event?.priority === "urgent" || eventId === "test_notification"
    || ["new_enquiry", "payment_confirmed", "pro_trial_ending", "pro_renewal_due"].includes(eventId)
    || (notification.category === "enquiry" && !String(notification.title).toLowerCase().includes("waiting"));
}

async function createScheduledNotifications() {
  const now = new Date();
  const nowIso = now.toISOString();
  const timedWindow = harareHour(now) >= HARARE_TIMED_SEND_START_HOUR && harareHour(now) < HARARE_TIMED_SEND_END_HOUR;
  const { data: dealers, error } = await db.from("dealerships").select("id,created_at");
  if (error) throw error;
  let created = 0;
  for (const dealer of dealers || []) {
    const [{ data: prefs }, { data: subscription }, { data: vehicles }, { data: enquiries }, { data: payments }] = await Promise.all([
      db.from("notification_preferences").select("*").eq("dealership_id", dealer.id).maybeSingle(),
      db.from("dealership_subscriptions").select("status,trial_ends_at,current_period_end").eq("dealership_id", dealer.id).maybeSingle(),
      db.from("vehicles").select("id,status").eq("dealership_id", dealer.id),
      db.from("enquiries").select("id,buyer_name,vehicle_id,stage,created_at").eq("dealership_id", dealer.id).eq("stage", "new").lte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString()),
      db.from("dealership_subscription_payments").select("id,amount,currency,status,created_at").eq("dealership_id", dealer.id).in("status", ["created", "pending"]).lte("created_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString()),
    ]);
    const preferences = prefs || {};
    const activeVehicles = vehicles || [];
    if (timedWindow && !activeVehicles.length && now.getTime() - new Date(dealer.created_at).getTime() >= 24 * 60 * 60 * 1000) {
      if (await insertEventNotification(dealer.id, "add_first_car", dealer.id, {})) created++;
    }
    for (const enquiry of (timedWindow ? enquiries : []) || []) {
      let vehicleLabel = "vehicle";
      if (enquiry.vehicle_id) {
        const { data: vehicle } = await db.from("vehicles").select("year,make,model").eq("id", enquiry.vehicle_id).maybeSingle();
        if (vehicle) vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
      }
      if (await insertEventNotification(dealer.id, "unanswered_enquiry", enquiry.id, { buyer: enquiry.buyer_name || "A buyer", vehicle: vehicleLabel, id: enquiry.id })) created++;
    }
    if (timedWindow && subscription?.status === "trial" && subscription.trial_ends_at) {
      const remaining = new Date(subscription.trial_ends_at).getTime() - now.getTime();
      if (remaining <= 72 * 60 * 60 * 1000 && remaining > 48 * 60 * 60 * 1000) {
        if (await insertEventNotification(dealer.id, "pro_trial_ending", dealer.id, { when: "Your Pro trial ends in 3 days" }, "3d")) created++;
      }
      if (harareDate(new Date(subscription.trial_ends_at)) === harareDate(now)) {
        if (await insertEventNotification(dealer.id, "pro_trial_ending", dealer.id, { when: "Your Pro trial ends today" }, "last_day")) created++;
      }
    }
    if (timedWindow && subscription?.status === "active" && subscription.current_period_end) {
      const end = new Date(subscription.current_period_end);
      const remaining = end.getTime() - now.getTime();
      if (remaining <= 5 * 24 * 60 * 60 * 1000 && remaining > 4 * 24 * 60 * 60 * 1000) {
        if (await insertEventNotification(dealer.id, "pro_renewal_due", dealer.id, { when: "Your Pro renewal is due in 5 days" }, "5d")) created++;
      }
      if (harareDate(end) === harareDate(now)) {
        if (await insertEventNotification(dealer.id, "pro_renewal_due", dealer.id, { when: "Your Pro renewal is due today" }, "due_day")) created++;
      }
    }
    for (const payment of (timedWindow ? payments : []) || []) {
      if (await insertEventNotification(dealer.id, "payment_pending", payment.id, { amount: payment.amount, currency: payment.currency }, "15m")) created++;
    }
    if (harareWeekday(now) === "Mon" && harareHour(now) === 8 && harareMinute(now) === 0) {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: visits }, { count: enquiryCount }] = await Promise.all([
        db.from("notification_events").select("id", { count: "exact", head: true }).eq("dealership_id", dealer.id).eq("event_type", "showroom_view").gte("occurred_at", weekStart),
        db.from("notification_events").select("id", { count: "exact", head: true }).eq("dealership_id", dealer.id).eq("event_type", "enquiry_created").gte("occurred_at", weekStart),
      ]);
      if ((visits || 0) + (enquiryCount || 0) > 0) {
        if (await insertEventNotification(dealer.id, "weekly_summary", dealer.id, { visits: visits || 0, enquiries: enquiryCount || 0 }, harareDate(now))) created++;
      }
    }
  }
  return { created, checked: dealers?.length || 0, at: nowIso };
}

async function recordAttempt(notificationId: string, subscriptionId: string, attemptNumber: number, status: string, responseStatus: number | null, errorMessage: string | null, nextAttemptAt: string | null) {
  const { error } = await db.from("notification_attempts").upsert({
    notification_id: notificationId, push_subscription_id: subscriptionId,
    attempt_number: attemptNumber, status, response_status: responseStatus,
    error_message: errorMessage, next_attempt_at: nextAttemptAt, attempted_at: new Date().toISOString(),
  }, { onConflict: "notification_id,push_subscription_id,attempt_number" });
  if (error) throw error;
}
async function deliverOne(notification: any, prefs: Record<string, unknown>, subscriptions: any[]) {
  if (!preferenceAllows(prefs, notification)) {
    const now = new Date().toISOString();
    await db.from("notifications").update({ push_sent_at: now, push_attempted_at: now }).eq("id", notification.id);
    return { sent: 0, removed: 0 };
  }
  const urgent = isUrgent(notification);
  if (notification.data?.eventId !== "test_notification" && !canSendPushNow(prefs, notification)) return { sent: 0, removed: 0 };
  if (!urgent) {
    const dayStart = harareDayStart();
    const { data: recentAttempts } = await db.from("notification_attempts")
      .select("notification_id,notifications!inner(id,data,category,dealership_id)")
      .eq("status", "sent").gte("attempted_at", dayStart)
      .eq("notifications.dealership_id", notification.dealership_id);
    const alreadySent = new Set((recentAttempts || [])
      .filter((row: any) => row.notification_id !== notification.id && !isUrgent(row.notifications))
      .map((row: any) => row.notification_id));
    if (alreadySent.size >= NON_URGENT_PUSH_DAILY_LIMIT) return { sent: 0, removed: 0 };
  }
  if (!pushReady || !subscriptions.length) return { sent: 0, removed: 0 };
  let sent = 0, removed = 0, allTerminal = true;
  for (const sub of subscriptions) {
    const { data: history } = await db.from("notification_attempts").select("attempt_number,status,next_attempt_at")
      .eq("notification_id", notification.id).eq("push_subscription_id", sub.id).order("attempt_number", { ascending: false }).limit(1);
    const last = history?.[0];
    if (last?.status === "sent" || last?.status === "gone" || last?.status === "skipped") continue;
    const nextAttempt = last?.next_attempt_at ? new Date(last.next_attempt_at).getTime() : 0;
    if (nextAttempt > Date.now()) { allTerminal = false; continue; }
    const attemptNumber = (last?.attempt_number || 0) + 1;
    if (attemptNumber > 3) continue;
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
        title: notification.title, body: notification.body,
        data: { ...notification.data, notificationId: notification.id, url: notification.data?.url || "/app/notifications" },
        tag: notification.data?.eventId === "new_enquiry" ? "lotle-enquiries-" + notification.dealership_id : (notification.data?.eventId || notification.category), renotify: false,
      }));
      await recordAttempt(notification.id, sub.id, attemptNumber, "sent", 201, null, null);
      await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), last_error: null }).eq("id", sub.id);
      sent++;
    } catch (error) {
      const status = Number((error as any)?.statusCode || 0);
      if (status === 404 || status === 410) {
        await recordAttempt(notification.id, sub.id, attemptNumber, "gone", status, "Subscription expired", null);
        await db.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      } else {
        const delay = PUSH_RETRY_DELAYS_MINUTES[attemptNumber - 1];
        const retryAt = attemptNumber < 3 ? new Date(Date.now() + delay * 60000).toISOString() : null;
        await recordAttempt(notification.id, sub.id, attemptNumber, "failed", status || null, String(error).slice(0, 500), retryAt);
        await db.from("push_subscriptions").update({ last_error: String(error).slice(0, 500) }).eq("id", sub.id);
        if (attemptNumber < 3) allTerminal = false;
      }
    }
  }
  if (allTerminal) {
    await db.from("notifications").update({ push_sent_at: new Date().toISOString(), push_attempted_at: new Date().toISOString() }).eq("id", notification.id);
  }
  return { sent, removed };
}
async function deliverPendingPush() {
  const { data: pending, error } = await db.from("notifications").select("id,dealership_id,category,title,body,data,created_at")
    .is("push_sent_at", null).order("created_at", { ascending: true }).limit(300);
  if (error) throw error;
  const handled = new Set<string>();
  let sent = 0, removed = 0, batched = 0;
  for (const notification of pending || []) {
    if (handled.has(notification.id)) continue;
    const { data: prefs } = await db.from("notification_preferences").select("*").eq("dealership_id", notification.dealership_id).maybeSingle();
    const { data: subscriptions } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("dealership_id", notification.dealership_id);
    let pushNotification = notification;
    if (notification.data?.eventId === "new_enquiry") {
      const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recentEnquiries } = await db.from("notifications").select("id")
        .eq("dealership_id", notification.dealership_id)
        .contains("data", { eventId: "new_enquiry" })
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true });
      if ((recentEnquiries || []).length >= 3) {
        const ids = (recentEnquiries || []).map((row: any) => row.id);
        pushNotification = {
          ...notification,
          title: ids.length + " new enquiries",
          body: ids.length + " buyers have asked about vehicles in your Lotlé showroom.",
          data: { ...notification.data, url: "/app/enquiries", notificationIds: ids },
        };
        batched++;
      }
    }
    const result = await deliverOne(pushNotification, prefs || {}, subscriptions || []);
    sent += result.sent; removed += result.removed; handled.add(notification.id);
  }
  return { pending: pending?.length || 0, sent, removed, batched };
}

async function authenticateRequest(req: Request) {
  const secret = req.headers.get("x-notification-secret");
  if (cronSecret && secret === cronSecret) return { kind: "worker" as const, userId: null };
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { kind: "user" as const, userId: data.user.id };
}
async function createTestNotification(dealershipId: string, userId: string) {
  const { data: dealer } = await db.from("dealerships").select("id,user_id").eq("id", dealershipId).maybeSingle();
  if (!dealer || dealer.user_id !== userId) return { error: "You do not have access to this dealership." };
  const key = "test_notification:" + new Date().toISOString();
  const { data, error } = await db.from("notifications").insert({
    dealership_id: dealershipId, category: "system", title: "Lotlé test notification",
    body: "Your Lotlé push and in-app notifications are connected.",
    data: { eventId: "test_notification", priority: "urgent", url: "/app/notifications", channels: ["push", "in_app"] }, dedupe_key: key,
  }).select("id").single();
  if (error) return { error: error.message };
  const { data: prefs } = await db.from("notification_preferences").select("*").eq("dealership_id", dealershipId).maybeSingle();
  const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("dealership_id", dealershipId);
  const result = await deliverOne({ id: data.id, dealership_id: dealershipId, category: "system", title: "Lotlé test notification", body: "Your Lotlé push and in-app notifications are connected.", data: { eventId: "test_notification", priority: "urgent", url: "/app/notifications", channels: ["push", "in_app"] } }, prefs || {}, subs || []);
  if (!pushReady || !subs?.length) {
    const now = new Date().toISOString();
    await db.from("notifications").update({ push_sent_at: now, push_attempted_at: now }).eq("id", data.id);
  }
  return { ok: true, pushSent: result.sent, pushReady, deviceCount: subs?.length || 0 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = await authenticateRequest(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  if (body.action === "plan_limit_reached") {
    if (auth.kind !== "user" || typeof body.dealershipId !== "string") return json({ error: "Authentication required" }, 401);
    const { data: dealer } = await db.from("dealerships").select("id,user_id").eq("id", body.dealershipId).maybeSingle();
    if (!dealer || dealer.user_id !== auth.userId) return json({ error: "You do not have access to this dealership." }, 403);
    try {
      const id = await insertEventNotification(dealer.id, "plan_limit_reached", String(body.limitKey || "limit"), { message: String(body.message || "You have reached your current plan limit.") }, String(body.limitKey || "limit"));
      return json({ ok: true, created: Boolean(id) });
    } catch (error) { console.error("Lotlé plan limit notification failed", error); return json({ error: "Could not create notification" }, 500); }
  }
  if (body.action === "test") {
    if (auth.kind !== "user" || typeof body.dealershipId !== "string") return json({ error: "Authentication required" }, 401);
    const result = await createTestNotification(body.dealershipId, auth.userId!);
    return json(result, "error" in result ? 403 : 200);
  }
  if (auth.kind !== "worker") return json({ error: "Forbidden" }, 403);
  try {
    const scheduled = body.action === "dispatch" ? { created: 0, checked: 0 } : await createScheduledNotifications();
    const delivery = await deliverPendingPush();
    return json({ ok: true, harareDate: harareDate(), harareHour: harareHour(), scheduled, delivery });
  } catch (error) {
    console.error("Lotlé notification worker failed", error);
    return json({ error: "Lotlé notification worker failed" }, 500);
  }
});
