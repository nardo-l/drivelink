import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentRow = {
  id: string; reference: string; dealership_id: string; user_id: string;
  amount: number; currency: string; plan_code: "monthly" | "yearly";
  status: string; paynow_reference: string | null;
};
const NARDOPAY_BASE = "https://mczqwqsvumfsneoknlep.supabase.co/functions/v1";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected.toLowerCase(), signature.toLowerCase().replace(/^sha256=/, ""));
}

function parseVerified(value: unknown): { status: string; amount: number | null; currency: string | null; transactionId: string | null } {
  if (!value || typeof value !== "object") return { status: "", amount: null, currency: null, transactionId: null };
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const transaction = data.transaction && typeof data.transaction === "object"
    ? data.transaction as Record<string, unknown> : data;
  const status = String(transaction.status ?? data.status ?? root.status ?? "").toLowerCase();
  const amountValue = transaction.amount ?? data.amount ?? root.amount;
  const amount = amountValue === undefined || amountValue === null ? null : Number(amountValue);
  return {
    status, amount: Number.isFinite(amount) ? amount : null,
    currency: String(transaction.currency ?? data.currency ?? root.currency ?? "").toUpperCase() || null,
    transactionId: String(transaction.transaction_id ?? data.transaction_id ?? root.transaction_id ?? "") || null,
  };
}

async function verifyAndApply(admin: ReturnType<typeof createClient>, payment: PaymentRow, transactionId: string) {
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
    throw new Error("NardoPay verification failed.");
  }
  const verified = parseVerified(payload);
  if (!["completed", "paid", "success"].includes(verified.status)) {
    await admin.from("dealership_subscription_payments").update({
      status: ["failed", "cancelled"].includes(verified.status) ? verified.status : "pending",
      paynow_reference: transactionId, raw_status: verified.status || "verification_pending",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    return false;
  }
  if (verified.amount === null || Math.abs(verified.amount - Number(payment.amount)) > 0.001 ||
      verified.currency !== payment.currency.toUpperCase() ||
      (verified.transactionId && verified.transactionId !== transactionId)) {
    console.error("NardoPay verification mismatch", {
      paymentId: payment.id, expectedAmount: payment.amount, actualAmount: verified.amount,
      expectedCurrency: payment.currency, actualCurrency: verified.currency,
    });
    throw new Error("Verified transaction did not match checkout.");
  }
  const { error: refError } = await admin.from("dealership_subscription_payments").update({
    paynow_reference: transactionId, raw_status: "NardoPay completed", updated_at: new Date().toISOString(),
  }).eq("id", payment.id);
  if (refError) throw new Error("Could not save verified transaction.");
  const { data: applied, error: applyError } = await admin.rpc("apply_dealership_subscription_payment", {
    p_reference: payment.reference, p_paynow_reference: transactionId, p_raw_status: "NardoPay completed",
  });
  if (applyError || applied !== true) {
    console.error("Subscription activation failed", applyError?.message ?? "RPC returned false");
    throw new Error("Could not activate subscription.");
  }
  const { error: notificationError } = await admin.from("notifications").upsert({
    dealership_id: payment.dealership_id, category: "subscription", title: "Payment confirmed",
    body: `Your DriveLink ${payment.plan_code} subscription payment has been confirmed. Your plan is now active.`,
    data: { url: "/app/billing", paymentReference: payment.reference },
    dedupe_key: `payment-confirmed:${payment.id}`,
  }, { onConflict: "dealership_id,dedupe_key", ignoreDuplicates: true });
  if (notificationError) console.error("Could not create payment confirmation notification", notificationError);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Webhook is not configured." }, 503);

  const rawBody = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch { return json({ error: "Invalid webhook payload." }, 400); }

  const webhookSecret = Deno.env.get("NARDOPAY_WEBHOOK_SECRET") || "";
  const webhookToken = Deno.env.get("NARDOPAY_WEBHOOK_TOKEN") || "";
  const suppliedToken = new URL(req.url).searchParams.get("token") || "";
  const suppliedSignature = req.headers.get("X-NardoPay-Signature") || "";
  const validSignature = webhookSecret ? await verifySignature(JSON.stringify(payload), suppliedSignature, webhookSecret) : false;
  const validToken = webhookToken ? constantTimeEqual(suppliedToken, webhookToken) : false;
  if (!validSignature && !validToken) return json({ error: "Unauthorized webhook." }, 401);

  const event = String(payload.event ?? "");
  const metadata = payload.metadata && typeof payload.metadata === "object"
    ? payload.metadata as Record<string, unknown> : {};
  const checkoutId = String(metadata.checkout_id ?? "");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (event === "payment.failed") {
    if (checkoutId) {
      const failedStatus = String(payload.status ?? "").toLowerCase() === "cancelled" ? "cancelled" : "failed";
      await admin.from("dealership_subscription_payments").update({
        status: failedStatus, raw_status: "NardoPay " + failedStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", checkoutId).neq("status", "paid");
    }
    return json({ received: true });
  }
  if (event !== "payment.completed" && event !== "subscription.renewed") return json({ received: true });

  const transactionId = String(payload.transaction_id ?? "");
  if (!transactionId || !checkoutId) return json({ received: true });
  const { data: payment, error } = await admin.from("dealership_subscription_payments")
    .select("id, reference, dealership_id, user_id, amount, currency, plan_code, status, paynow_reference")
    .eq("id", checkoutId).maybeSingle();
  if (error || !payment) return json({ received: true });
  if (payment.status === "paid") return json({ received: true, paid: true });

  try {
    const activated = await verifyAndApply(admin, payment as PaymentRow, transactionId);
    return json({ received: true, paid: activated });
  } catch (error) {
    console.error("NardoPay webhook processing failed", error instanceof Error ? error.message : error);
    return json({ received: true, retry: true }, 200);
  }
});
