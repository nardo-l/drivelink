import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@drivelink.app";
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const pushReady = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushReady) webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!);

const harareParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};
const localDate = () => { const p = harareParts(); return `${p.year}-${p.month}-${p.day}`; };
const localHour = () => Number(harareParts().hour);
const startOfHarareDay = () => {
  const [year, month, day] = localDate().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 2 * 60 * 60 * 1000).toISOString();
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function insertNotification(dealershipId: string, category: string, title: string, body: string, key: string, data: Record<string, unknown> = {}) {
  await db.from("notifications").upsert({ dealership_id: dealershipId, category, title, body, data, dedupe_key: key }, { onConflict: "dealership_id,dedupe_key", ignoreDuplicates: true });
}

async function createScheduledNotifications() {
  const now = new Date();
  const today = localDate();
  const { data: dealers, error } = await db.from("dealerships").select("id,name,slug,created_at");
  if (error) throw error;
  const dayStart = startOfHarareDay();

  for (const dealer of dealers || []) {
    const [{ data: vehicles }, { data: enquiries }, { data: events }, { data: prefs }] = await Promise.all([
      db.from("vehicles").select("id,status,created_at,updated_at").eq("dealership_id", dealer.id),
      db.from("enquiries").select("id,stage,created_at").eq("dealership_id", dealer.id),
      db.from("notification_events").select("event_type,occurred_at").eq("dealership_id", dealer.id).gte("occurred_at", dayStart),
      db.from("notification_preferences").select("*").eq("dealership_id", dealer.id).maybeSingle(),
    ]);
    const preferences = prefs || {};
    const activeVehicles = (vehicles || []).filter((v: any) => ["available", "reserved"].includes(v.status));
    const newLeads = (enquiries || []).filter((e: any) => e.created_at >= dayStart);
    const pendingLeads = (enquiries || []).filter((e: any) => e.stage === "new");
    const dayEvents = events || [];

    if (localHour() === 19 && preferences.daily_summary !== false) {
      const views = dayEvents.filter((e: any) => e.event_type === "showroom_view").length;
      const added = dayEvents.filter((e: any) => e.event_type === "vehicle_created").length;
      const sold = dayEvents.filter((e: any) => e.event_type === "vehicle_sold").length;
      const leadCount = newLeads.length;
      const summary = `Today: ${views} showroom views, ${leadCount} new enquiries, ${added} vehicles added and ${sold} vehicles sold. ${pendingLeads.length} enquiries still need a response.`;
      const next = pendingLeads.length ? "Follow up with your new buyers to keep conversations moving." : activeVehicles.length < 3 ? "Add more available vehicles to give buyers more choice." : "Share your showroom link to bring more buyers to your inventory.";
      await insertNotification(dealer.id, "daily_summary", "Your daily dealership summary", `${summary} ${next}`, `daily-summary:${today}`, { url: "/app/analytics", views, enquiries: leadCount, vehiclesAdded: added, vehiclesSold: sold, pendingEnquiries: pendingLeads.length });
    }

    const ageHours = (now.getTime() - new Date(dealer.created_at).getTime()) / 3600000;
    if (preferences.vehicle_reminders !== false && activeVehicles.length === 0 && ageHours >= 2 && ageHours < 24) {
      await insertNotification(dealer.id, "inventory", "Add your first vehicle", "Your showroom is ready. Add a vehicle so buyers have something to discover.", "first-vehicle:2h", { url: "/app/vehicles/new" });
    }
    if (preferences.vehicle_reminders !== false && activeVehicles.length === 0 && ageHours >= 24) {
      await insertNotification(dealer.id, "inventory", "Your showroom needs inventory", "Add your first vehicle to turn your showroom link into a place buyers can browse.", `first-vehicle:24h:${today}`, { url: "/app/vehicles/new" });
    }
    if (preferences.vehicle_reminders !== false && activeVehicles.length > 0 && activeVehicles.length < 3) {
      await insertNotification(dealer.id, "inventory", "Grow your vehicle selection", `You have ${activeVehicles.length} active vehicle(s). Add a few more to give buyers more options.`, `low-inventory:${today}`, { url: "/app/vehicles/new" });
    }
    if (preferences.share_reminders !== false) {
      const { count: shareCount } = await db.from("notification_events").select("id", { count: "exact", head: true }).eq("dealership_id", dealer.id).eq("event_type", "showroom_shared");
      if (!shareCount && ageHours >= 24) {
        await insertNotification(dealer.id, "sharing", "Share your showroom link", "Your online showroom is ready. Share its link on WhatsApp and social media to reach more buyers.", `share-reminder:${today}`, { url: "/app" });
      }
    }
    const { data: subscription } = await db.from("dealership_subscriptions")
      .select("status,trial_started_at,trial_ends_at,current_period_start,current_period_end,grace_until")
      .eq("dealership_id", dealer.id).maybeSingle();
    if (subscription) {
      const trialStart = subscription.trial_started_at ? new Date(subscription.trial_started_at) : null;
      const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
      const paidEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      const graceEnd = subscription.grace_until ? new Date(subscription.grace_until) : null;
      const trialHours = trialEnd ? (trialEnd.getTime() - now.getTime()) / 3600000 : null;
      const paidHours = paidEnd ? (paidEnd.getTime() - now.getTime()) / 3600000 : null;
      if (subscription.status === "trial" && trialStart && now.getTime() - trialStart.getTime() < 24 * 3600000) {
        await insertNotification(dealer.id, "subscription", "Your 3-day free trial has started", "You have full access to DriveLink for the next 72 hours. Add vehicles and share your showroom.", `trial-start:${trialStart.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "trial" && trialHours !== null && trialHours <= 24 && trialHours > 6) {
        await insertNotification(dealer.id, "subscription", "Your free trial ends tomorrow", "Your DriveLink trial has 24 hours remaining. Subscribe to keep adding vehicles and managing your showroom.", `trial-24h:${trialEnd!.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "trial" && trialHours !== null && trialHours <= 6 && trialHours > 0) {
        await insertNotification(dealer.id, "subscription", "Your free trial is nearly over", "Your DriveLink trial ends in 6 hours. Choose a plan to keep full access.", `trial-6h:${trialEnd!.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "trial" && trialHours !== null && trialHours <= 0) {
        await insertNotification(dealer.id, "subscription", "Your free trial has ended", "Your account is now in view-only mode. Subscribe to restore full access.", `trial-ended:${trialEnd!.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "active" && paidHours !== null && paidHours <= 120 && paidHours > 24) {
        await insertNotification(dealer.id, "subscription", "Your subscription renews in 5 days", "Renew your DriveLink subscription to keep your dealership tools active.", `renew-5d:${paidEnd!.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "active" && paidHours !== null && paidHours <= 24 && paidHours > 0) {
        await insertNotification(dealer.id, "subscription", "Your subscription expires tomorrow", "Renew now to avoid interruption to your dealership workspace.", `renew-1d:${paidEnd!.toISOString()}`, { url: "/app/billing" });
      }
      if (subscription.status === "grace_period" && graceEnd && graceEnd.getTime() <= now.getTime()) {
        await insertNotification(dealer.id, "subscription", "Your grace period has ended", "Your account is now view-only. Renew your subscription to restore full access.", `grace-ended:${graceEnd.toISOString()}`, { url: "/app/billing" });
      }
    }

    if (preferences.new_enquiries !== false) {
      const stale = pendingLeads.filter((e: any) => (now.getTime() - new Date(e.created_at).getTime()) >= 24 * 3600000);
      for (const lead of stale) {
        const hours = (now.getTime() - new Date(lead.created_at).getTime()) / 3600000;
        if (hours < 48) await insertNotification(dealer.id, "enquiry", "A buyer is waiting for a reply", "One of your enquiries has been waiting for more than 24 hours. Follow up while the buyer is still interested.", `enquiry-followup-24h:${lead.id}`, { url: "/app/enquiries", enquiryId: lead.id });
        else await insertNotification(dealer.id, "enquiry", "Enquiry follow-up needed", "A buyer has been waiting for over 48 hours. Follow up or update the enquiry status.", `enquiry-followup-48h:${lead.id}`, { url: "/app/enquiries", enquiryId: lead.id });
      }
    }
  }
}

async function deliverPendingPush() {
  const { data: pending, error } = await db.from("notifications").select("id,dealership_id,category,title,body,data,created_at")
    .is("push_sent_at", null).order("created_at", { ascending: true }).limit(300);
  if (error) throw error;
  let sent = 0; let removed = 0;
  for (const notification of pending || []) {
    const { data: prefs } = await db.from("notification_preferences").select("*").eq("dealership_id", notification.dealership_id).maybeSingle();
    const preferenceField: Record<string, string> = {
      daily_summary: "daily_summary", enquiry: "new_enquiries", inventory: "vehicle_reminders",
      sharing: "share_reminders", showroom: "showroom_activity", subscription: "subscription_reminders",
    };
    const prefKey = preferenceField[notification.category];
    if (prefs?.push_enabled === false || (prefKey && prefs?.[prefKey] === false)) {
      await db.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", notification.id);
      continue;
    }
    const urgent = notification.category === "enquiry" && !String(notification.title).toLowerCase().includes("waiting");
    if (!urgent) {
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const { count } = await db.from("notifications").select("id", { count: "exact", head: true })
        .eq("dealership_id", notification.dealership_id).not("push_sent_at", "is", null).gte("push_sent_at", since);
      if ((count || 0) >= 2) continue;
    }
    const { data: subscriptions } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("dealership_id", notification.dealership_id);
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
          title: notification.title, body: notification.body, data: { ...notification.data, url: notification.data?.url || "/app/notifications" }, tag: notification.category,
        }));
        sent++;
        await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), last_error: null }).eq("id", sub.id);
      } catch (err) {
        const status = (err as any)?.statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id); removed++;
        } else {
          await db.from("push_subscriptions").update({ last_error: String(err).slice(0, 500) }).eq("id", sub.id);
        }
      }
    }
    await db.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", notification.id);
  }
  return { pending: pending?.length || 0, sent, removed };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" || !cronSecret || req.headers.get("x-notification-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const hour = localHour();
    if (hour === 19) await createScheduledNotifications();
    const delivery = await deliverPendingPush();
    return json({ ok: true, harareDate: localDate(), harareHour: hour, delivery });
  } catch (error) {
    console.error("Notification worker failed", error);
    return json({ error: "Notification worker failed" }, 500);
  }
});
