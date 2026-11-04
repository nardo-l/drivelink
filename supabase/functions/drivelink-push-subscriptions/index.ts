import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Push subscription service is not configured." }, 503);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: "Invalid or expired session." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const dealershipId = String(body.dealershipId || "");
  if (!dealershipId) return json({ error: "Dealership is required." }, 400);
  const { data: dealer, error: dealerError } = await admin.from("dealerships").select("id,user_id").eq("id", dealershipId).maybeSingle();
  if (dealerError || !dealer || dealer.user_id !== user.id) return json({ error: "You do not have access to this dealership." }, 403);

  if (body.action === "upsert") {
    const sub = body.subscription as Record<string, unknown> | undefined;
    const keys = sub?.keys as Record<string, unknown> | undefined;
    const endpoint = String(sub?.endpoint || "");
    const p256dh = String(keys?.p256dh || "");
    const auth = String(keys?.auth || "");
    if (!endpoint.startsWith("https://") || !p256dh || !auth) return json({ error: "Incomplete push subscription." }, 400);
    const { error } = await admin.from("push_subscriptions").upsert({
      dealership_id: dealershipId, user_id: user.id, endpoint, p256dh, auth,
      user_agent: String(body.userAgent || "").slice(0, 500), updated_at: new Date().toISOString(), last_error: null,
    }, { onConflict: "endpoint" });
    if (error) return json({ error: "Could not save push subscription." }, 500);
    const { error: prefError } = await admin.from("notification_preferences").upsert({
      dealership_id: dealershipId, push_enabled: true,
    }, { onConflict: "dealership_id" });
    if (prefError) return json({ error: "Subscription saved but notification preferences could not be updated." }, 500);
    return json({ ok: true });
  }

  if (body.action === "delete") {
    const endpoint = String(body.endpoint || "");
    if (!endpoint.startsWith("https://")) return json({ error: "Invalid subscription endpoint." }, 400);
    const { error } = await admin.from("push_subscriptions").delete()
      .eq("dealership_id", dealershipId).eq("user_id", user.id).eq("endpoint", endpoint);
    if (error) return json({ error: "Could not remove push subscription." }, 500);
    return json({ ok: true });
  }
  return json({ error: "Unsupported action." }, 400);
});
