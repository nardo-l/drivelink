import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const appUrl = (Deno.env.get("DRIVELINK_APP_URL") ?? "").replace(/\/$/, "");
const cors = {
  "Access-Control-Allow-Origin": appUrl || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha512(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function parsePaynowForm(text: string) {
  const params = new URLSearchParams(text);
  const values = [...params.entries()];
  const fields: Record<string, string> = {};
  for (const [key, value] of values) fields[key.toLowerCase()] = value;
  return { fields, values };
}
async function verifyPaynowForm(values: [string, string][], suppliedHash: string, key: string) {
  const signedValues = values.filter(([name]) => name.toLowerCase() !== "hash").map(([, value]) => value);
  const expected = await sha512(signedValues.join("") + key);
  return expected.toLowerCase() === (suppliedHash || "").toLowerCase();
}
function isPaynowPollUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      (url.hostname === "paynow.co.zw" || url.hostname.endsWith(".paynow.co.zw"));
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const integrationId = Deno.env.get("PAYNOW_INTEGRATION_ID") || "27789";
  const integrationKey = Deno.env.get("PAYNOW_INTEGRATION_KEY");
  const configuredAppUrl = Deno.env.get("DRIVELINK_APP_URL");
  if (!supabaseUrl || !serviceKey || !integrationKey || !configuredAppUrl) {
    return json({ error: "Payment service is not configured. Contact DriveLink support." }, 503);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const contentType = req.headers.get("content-type") || "";

  // Paynow server notification: validate its hash, then independently poll Paynow.
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const { fields, values } = parsePaynowForm(await req.text());
    const reference = fields.reference || "";
    const amount = fields.amount || "";
    const paynowReference = fields.paynowreference || "";
    const pollUrl = fields.pollurl || "";
    if (!reference || !pollUrl || !isPaynowPollUrl(pollUrl) ||
        !await verifyPaynowForm(values, fields.hash || "", integrationKey)) {
      return new Response("Invalid notification", { status: 400 });
    }

    const { data: payment, error: paymentError } = await admin
      .from("dealership_subscription_payments")
      .select("id, reference, amount, status")
      .eq("reference", reference)
      .maybeSingle();
    if (paymentError || !payment) return new Response("Unknown payment", { status: 404 });
    if (Number(amount) !== Number(payment.amount)) return new Response("Amount mismatch", { status: 400 });

    const pollResponse = await fetch(pollUrl, { method: "POST" });
    const poll = parsePaynowForm(await pollResponse.text());
    const polled = poll.fields;
    const pollValid = await verifyPaynowForm(poll.values, polled.hash || "", integrationKey);
    if (!pollResponse.ok || !pollValid || polled.reference !== reference ||
        Number(polled.amount) !== Number(payment.amount) || polled.status?.toLowerCase() !== "paid") {
      await admin.from("dealership_subscription_payments").update({
        status: polled.status?.toLowerCase() === "cancelled" ? "cancelled" : "pending",
        raw_status: polled.status || fields.status || "Unconfirmed",
        updated_at: new Date().toISOString(),
      }).eq("reference", reference);
      return new Response("Payment not confirmed", { status: 200 });
    }

    const { error: activationError } = await admin.rpc("apply_dealership_subscription_payment", {
      p_reference: reference,
      p_paynow_reference: polled.paynowreference || paynowReference,
      p_raw_status: polled.status,
    });
    if (activationError) return new Response("Could not activate subscription", { status: 500 });
    return new Response("OK", { status: 200 });
  }

  let body: { action?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const user = authData.user;

  const { data: dealership, error: dealershipError } = await admin
    .from("dealerships").select("id, email").eq("user_id", user.id).maybeSingle();
  if (dealershipError || !dealership) return json({ error: "No dealership profile was found." }, 404);

  if (body.action === "initiate") {
    const reference = `DL-${crypto.randomUUID()}`;
    const email = user.email || dealership.email || "";
    const returnUrl = `${configuredAppUrl.replace(/\/$/, "")}/#/app/billing`;
    const resultUrl = `${supabaseUrl}/functions/v1/drivelink-payments`;
    const fields: Record<string, string> = {
      id: integrationId,
      reference,
      amount: "3.99",
      additionalinfo: "DriveLink monthly subscription",
      returnurl: returnUrl,
      resulturl: resultUrl,
      authemail: email,
      status: "Message",
    };
    fields.hash = await sha512(
      [fields.id, fields.reference, fields.amount, fields.additionalinfo, fields.returnurl,
        fields.resulturl, fields.authemail, fields.status].join("") + integrationKey,
    );

    const { error: insertError } = await admin.from("dealership_subscription_payments").insert({
      dealership_id: dealership.id, user_id: user.id, reference, amount: 3.99,
      currency: "USD", payment_method: "EcoCash", status: "created",
    });
    if (insertError) return json({ error: "Could not create payment record." }, 500);

    const paynowResponse = await fetch("https://www.paynow.co.zw/interface/initiatetransaction", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
    const response = parsePaynowForm(await paynowResponse.text());
    const responseFields = response.fields;
    const responseValid = await verifyPaynowForm(response.values, responseFields.hash || "", integrationKey);
    if (!paynowResponse.ok || !responseValid || responseFields.status?.toLowerCase() !== "ok" ||
        !responseFields.browserurl || !responseFields.pollurl) {
      await admin.from("dealership_subscription_payments").update({
        status: "failed",
        raw_status: responseFields.error || responseFields.status || "Paynow initiation failed",
        updated_at: new Date().toISOString(),
      }).eq("reference", reference);
      return json({ error: responseFields.error || responseFields.status || "Paynow could not start the payment." }, 502);
    }

    await admin.from("dealership_subscription_payments").update({
      status: "pending", poll_url: responseFields.pollurl, browser_url: responseFields.browserurl,
      raw_status: responseFields.status, updated_at: new Date().toISOString(),
    }).eq("reference", reference);
    return json({ redirectUrl: responseFields.browserurl, reference });
  }

  if (body.action === "status") {
    const { data: subscription, error } = await admin.from("dealership_subscriptions")
      .select("status, amount, currency, current_period_start, current_period_end, grace_until")
      .eq("dealership_id", dealership.id).maybeSingle();
    if (error) return json({ error: "Could not load subscription." }, 500);
    const { data: payments } = await admin.from("dealership_subscription_payments")
      .select("reference, amount, currency, status, paid_at, created_at")
      .eq("dealership_id", dealership.id).order("created_at", { ascending: false }).limit(8);
    return json({ subscription, payments: payments || [] });
  }
  return json({ error: "Unknown action." }, 400);
});
