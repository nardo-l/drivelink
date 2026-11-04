import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PlanCode = "monthly" | "yearly";
type PaymentRow = {
  id: string;
  reference: string;
  dealership_id: string;
  user_id: string;
  amount: number;
  currency: string;
  plan_code: PlanCode;
  status: string;
  paynow_reference: string | null;
};

const NARDOPAY_BASE = "https://mczqwqsvumfsneoknlep.supabase.co/functions/v1";
const appUrl = (Deno.env.get("DRIVELINK_APP_URL") ?? "").replace(/\/$/, "");
const cors = {
  "Access-Control-Allow-Origin": appUrl || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function unwrap(value: Record<string, unknown>): Record<string, unknown> {
  const data = value.data;
  return data && typeof data === "object" ? data as Record<string, unknown> : value;
}

function parseVerified(value: unknown): { status: string; amount: number | null; currency: string | null; transactionId: string | null } {
  if (!value || typeof value !== "object") return { status: "", amount: null, currency: null, transactionId: null };
  const root = value as Record<string, unknown>;
  const data = unwrap(root);
  const transaction = data.transaction && typeof data.transaction === "object"
    ? data.transaction as Record<string, unknown> : data;
  const status = String(transaction.status ?? data.status ?? root.status ?? "").toLowerCase();
  const amountValue = transaction.amount ?? data.amount ?? root.amount;
  const amount = amountValue === undefined || amountValue === null ? null : Number(amountValue);
  return {
    status,
    amount: Number.isFinite(amount) ? amount : null,
    currency: String(transaction.currency ?? data.currency ?? root.currency ?? "").toUpperCase() || null,
    transactionId: String(transaction.transaction_id ?? data.transaction_id ?? root.transaction_id ?? "") || null,
  };
}

async function verifyAndApply(
  admin: ReturnType<typeof createClient>,
  payment: PaymentRow,
  transactionId: string,
): Promise<{ status: string; activated: boolean }> {
  const apiKey = Deno.env.get("NARDOPAY_API_KEY");
  if (!apiKey) throw new Error("NARDOPAY_API_KEY is not configured.");

  const response = await fetch(`${NARDOPAY_BASE}/verify-payment-status`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
  const raw = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = { message: raw }; }
  if (!response.ok) {
    console.error("NardoPay verification request failed", response.status, raw.slice(0, 1500));
    throw new Error("NardoPay could not verify this payment.");
  }

  const verified = parseVerified(payload);
  if (verified.status !== "completed" && verified.status !== "paid" && verified.status !== "success") {
    await admin.from("dealership_subscription_payments").update({
      status: verified.status === "failed" || verified.status === "cancelled" ? verified.status : "pending",
      paynow_reference: transactionId,
      raw_status: verified.status || "verification_pending",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    return { status: verified.status || "pending", activated: false };
  }

  if (verified.amount === null || Math.abs(verified.amount - Number(payment.amount)) > 0.001 ||
      verified.currency !== payment.currency.toUpperCase() ||
      (verified.transactionId && verified.transactionId !== transactionId)) {
    console.error("NardoPay verification mismatch", {
      paymentId: payment.id, expectedAmount: payment.amount, actualAmount: verified.amount,
      expectedCurrency: payment.currency, actualCurrency: verified.currency,
    });
    throw new Error("Verified payment details did not match the checkout.");
  }

  const { error: updateError } = await admin.from("dealership_subscription_payments").update({
    paynow_reference: transactionId,
    raw_status: "NardoPay completed",
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id);
  if (updateError) throw new Error("Could not save the verified transaction reference.");

  const { data: applied, error: applyError } = await admin.rpc("apply_dealership_subscription_payment", {
    p_reference: payment.reference,
    p_paynow_reference: transactionId,
    p_raw_status: "NardoPay completed",
  });
  if (applyError || applied !== true) {
    console.error("Subscription activation failed", applyError?.message ?? "RPC returned false");
    throw new Error("Payment was verified, but subscription activation needs attention.");
  }
  return { status: "completed", activated: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("NARDOPAY_API_KEY");
  if (!supabaseUrl || !serviceKey || !apiKey || !appUrl) {
    return json({ error: "Payment service is not configured. Contact DriveLink support." }, 503);
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const user = authData.user;

  let body: { action?: string; plan_code?: string; checkout_id?: string; transaction_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }

  const { data: dealership, error: dealershipError } = await admin
    .from("dealerships").select("id, email").eq("user_id", user.id).maybeSingle();
  if (dealershipError || !dealership) return json({ error: "No dealership profile was found." }, 404);

  if (body.action === "initiate") {
    if (body.plan_code !== "monthly" && body.plan_code !== "yearly") {
      return json({ error: "Choose a valid subscription plan." }, 400);
    }
    const planCode: PlanCode = body.plan_code;
    const amount = planCode === "yearly" ? 32.00 : 3.99;
    const label = planCode === "yearly" ? "Yearly" : "Monthly";
    const reference = `DL-${crypto.randomUUID()}`;

    const { data: payment, error: insertError } = await admin
      .from("dealership_subscription_payments")
      .insert({
        dealership_id: dealership.id, user_id: user.id, reference, amount,
        plan_code: planCode, currency: "USD", payment_method: "NardoPay", status: "created",
      })
      .select("id, reference")
      .single();
    if (insertError || !payment) {
      console.error("Could not create subscription payment record", insertError?.message);
      return json({ error: "Could not create your payment record. Please try again." }, 500);
    }

    const webhookToken = Deno.env.get("NARDOPAY_WEBHOOK_TOKEN");
    const webhookUrl = `${supabaseUrl}/functions/v1/nardopay-webhook${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : ""}`;
    const payload = {
      link_type: "payment",
      product_name: `Drive Link Pro – ${label}`,
      amount,
      currency: "USD",
      description: `DriveLink Pro ${label.toLowerCase()} subscription`,
      webhook_url: webhookUrl,
      redirect_url: `${appUrl}/#/app/billing?checkout=${encodeURIComponent(payment.id)}`,
      metadata: { checkout_id: payment.id, reference, dealership_id: dealership.id, plan_code: planCode },
    };

    const response = await fetch(`${NARDOPAY_BASE}/create-payment-link-api`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let result: Record<string, unknown>;
    try { result = JSON.parse(raw) as Record<string, unknown>; } catch { result = { message: raw }; }
    const checkoutUrl = typeof result.url === "string" ? result.url : "";
    if (!response.ok || result.success === false || !checkoutUrl || !/^https:\/\//i.test(checkoutUrl)) {
      console.error("NardoPay payment-link creation failed", response.status, raw.slice(0, 1500));
      await admin.from("dealership_subscription_payments").update({
        status: "failed", raw_status: "NardoPay link creation failed", updated_at: new Date().toISOString(),
      }).eq("id", payment.id);
      return json({ error: "NardoPay could not start the payment. Please try again." }, 502);
    }

    await admin.from("dealership_subscription_payments").update({
      status: "pending", browser_url: checkoutUrl, raw_status: "NardoPay checkout created",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    return json({ url: checkoutUrl, checkout_id: payment.id });
  }

  if (body.action === "check") {
    if (!body.checkout_id) return json({ error: "Checkout reference is required." }, 400);
    const { data: payment, error } = await admin.from("dealership_subscription_payments")
      .select("id, reference, dealership_id, user_id, amount, currency, plan_code, status, paynow_reference")
      .eq("id", body.checkout_id).eq("dealership_id", dealership.id).eq("user_id", user.id).maybeSingle();
    if (error || !payment) return json({ error: "Checkout not found." }, 404);
    if (payment.status === "paid") return json({ status: "completed", paid: true });
    const transactionId = body.transaction_id || payment.paynow_reference;
    if (transactionId) {
      try {
        const result = await verifyAndApply(admin, payment as PaymentRow, transactionId);
        return json({ status: result.status, paid: result.activated });
      } catch (error) {
        console.error("Checkout verification failed", error instanceof Error ? error.message : error);
        return json({ error: "We could not confirm the payment yet. Please try again shortly.", status: "pending" }, 200);
      }
    }
    return json({ status: payment.status === "failed" || payment.status === "cancelled" ? payment.status : "pending", paid: false });
  }

  if (body.action === "status") {
    const { data: subscription, error } = await admin.from("dealership_subscriptions")
      .select("status, amount, currency, plan_code, trial_started_at, trial_ends_at, trial_used, current_period_start, current_period_end, grace_until")
      .eq("dealership_id", dealership.id).maybeSingle();
    if (error) return json({ error: "Could not load subscription." }, 500);
    if (subscription) {
      const now = Date.now();
      const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : 0;
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
      const graceEnd = subscription.grace_until ? new Date(subscription.grace_until).getTime() : 0;
      const nextStatus = trialEnd && !periodEnd && now <= trialEnd ? "trial"
        : periodEnd && now <= periodEnd ? "active"
        : periodEnd && graceEnd && now <= graceEnd ? "grace_period" : "expired";
      if (subscription.status !== nextStatus) {
        await admin.from("dealership_subscriptions").update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq("dealership_id", dealership.id);
        subscription.status = nextStatus;
      }
    }
    const { data: payments } = await admin.from("dealership_subscription_payments")
      .select("reference, amount, currency, status, payment_method, paid_at, created_at")
      .eq("dealership_id", dealership.id).order("created_at", { ascending: false }).limit(8);
    return json({ subscription, payments: payments || [] });
  }
  return json({ error: "Unknown action." }, 400);
});
