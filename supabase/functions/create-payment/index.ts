// BRASA — create-payment Edge Function (server only, Deno).
// Customer-facing copy never names the payment provider and never offers
// anything except M-Pesa. Provider key names appear ONLY here (env reads)
// and in README.md, never in customer copy.
// Behaviour:
//  * requires a signed-in user and an order belonging to that user;
//  * recalculates the total server-side from TRUSTED_PRICES, plus the
//    delivery fee read from site_settings (id = 1) for delivery orders;
//    pickup orders pay no fee. The fee is NEVER taken from the browser:
//    if the settings read fails or the fee is missing/invalid, the
//    function returns 500 and creates no payment.
//  * rejects unpriced items with 400 (they cannot be paid online);
//  * returns 503 — never a fake success — when the payment secrets are missing;
//  * M-PESA ONLY, via direct STK push: POST {base}/charges with the M-Pesa
//    wallet_id. The customer stays on the BRASA site and confirms the PIN
//    on their own phone. There is NO redirect to a hosted checkout page:
//    checkout_url is always null and redirect is always false.
//  * stores the provider reference on the order, status stays pending_payment
//    until the webhook confirms payment.
//
// Owner configuration (Supabase > Edge Functions > Secrets, never in code):
//   ZUMBO_API_KEY, ZUMBO_MERCHANT_ID, ZUMBO_WEBHOOK_SECRET
//   (plus SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)
// The M-Pesa wallet is chosen AUTOMATICALLY: the function calls
// GET /wallets and picks the M-Pesa wallet itself — the owner never
// has to type a wallet_id. ZUMBO_WALLET_MPESA is now only an optional
// override: if it is set, it wins; if it is not set, auto-selection runs.
// Base URL (provider docs): https://zumbopay.com/api/public/v1
// ZUMBO_API_URL may override it only if the merchant docs show otherwise.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EXTRA_NAMES, PRODUCT_NAMES, recalculateTotal } from "../_shared/trusted-prices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const zumboKey = Deno.env.get("ZUMBO_API_KEY") ?? "";
  const zumboMerchant = Deno.env.get("ZUMBO_MERCHANT_ID") ?? "";
  const zumboWalletMpesa = Deno.env.get("ZUMBO_WALLET_MPESA") ?? "";
  const zumboBase = (Deno.env.get("ZUMBO_API_URL") ?? "https://zumbopay.com/api/public/v1").replace(/\/$/, "");

  // 503, never a fake payment, when the payment secrets are not configured.
  // The wallet_id is NOT required here any more: it is chosen
  // automatically from GET /wallets below, unless the optional
  // ZUMBO_WALLET_MPESA override is set.
  if (!zumboKey || !zumboMerchant) {
    return json(
      { error: "Payment is not configured yet. Your order is saved as pending and has not been charged." },
      503,
    );
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured yet." }, 503);
  }

  // Verify the caller with the anon client + their JWT; write with the
  // service client (RLS would otherwise block the server-side writes).
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "Sign-in required." }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: { order_id?: string; phone?: string; items?: Array<{ id?: string; product_id?: string; qty: number }>; delivery_type?: string; delivery_address?: string | null; delivery_zone_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!body.order_id || !body.phone || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: "order_id, phone and items are required." }, 400);
  }
  // M-Pesa only: prefixes 84/85. Accept 9 digits (84xxxxxxx) or the
  // international form (25884xxxxxxx) and normalise to 25884/25885 for /charges.
  const rawPhone = String(body.phone).replace(/[\s+]/g, "");
  let msisdn = "";
  if (/^8[45]\d{7}$/.test(rawPhone)) msisdn = `258${rawPhone}`;
  else if (/^2588[45]\d{7}$/.test(rawPhone)) msisdn = rawPhone;
  else {
    return json({ error: "Enter a valid M-Pesa number (84 or 85)." }, 400);
  }

  // Delivery choice: 'delivery' pays the site_settings fee and needs an
  // address; 'pickup' pays no fee and needs no address. Anything else is
  // rejected — the browser's choice is validated, never trusted blindly.
  const deliveryType = body.delivery_type ?? "pickup";
  if (deliveryType !== "delivery" && deliveryType !== "pickup") {
    return json({ error: "Invalid delivery choice." }, 400);
  }
  const deliveryAddress = deliveryType === "delivery" ? String(body.delivery_address ?? "").trim() : null;
  if (deliveryType === "delivery" && !deliveryAddress) {
    return json({ error: "A delivery address is required for home delivery." }, 400);
  }

  // The order must belong to the caller and still be unpaid.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .eq("id", body.order_id)
    .single();
  if (orderError || !order || order.user_id !== user.id) {
    return json({ error: "Order not found." }, 404);
  }
  if (order.status !== "pending_payment") {
    return json({ error: "This order is no longer pending payment." }, 400);
  }

  let subtotal: number;
  let lines: Array<{ product_id: string; qty: number; unit_price_mt: number }>;
  try {
    ({ total: subtotal, lines } = recalculateTotal(body.items));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  // Delivery fee: read from the database, never from the browser, never
  // guessed. Delivery orders use the chosen delivery zone's fee
  // (Admin > Definições > Zonas de entrega); without a zone, the legacy
  // site_settings fee applies. If the fee cannot be read, stop honestly
  // with 500 — no payment is created and nothing is charged.
  let deliveryFee = 0;
  let deliveryZoneId = null;
  let deliveryZoneName = null;
  if (deliveryType === "delivery") {
    var zoneId = body.delivery_zone_id ? String(body.delivery_zone_id) : "";
    if (zoneId) {
      var zoneRes = await supabase
        .from("delivery_zones")
        .select("id, name, fee_mt, active")
        .eq("id", zoneId)
        .maybeSingle();
      var zfee = zoneRes.data?.fee_mt as unknown;
      if (zoneRes.error || !zoneRes.data || !zoneRes.data.active || typeof zfee !== "number" || !Number.isFinite(zfee) || zfee < 0 || Math.floor(zfee) !== zfee) {
        return json({ error: "The delivery zone is not configured yet. Your order is saved as pending and has not been charged." }, 500);
      }
      deliveryFee = zfee;
      deliveryZoneId = zoneRes.data.id;
      deliveryZoneName = zoneRes.data.name;
    } else {
      var settingsRes = await supabase
        .from("site_settings")
        .select("delivery_fee_mt")
        .eq("id", 1)
        .maybeSingle();
      var fee = settingsRes.data?.delivery_fee_mt as unknown;
      if (settingsRes.error || !settingsRes.data || typeof fee !== "number" || !Number.isFinite(fee) || fee < 0 || Math.floor(fee) !== fee) {
        return json({ error: "The delivery fee is not configured yet. Your order is saved as pending and has not been charged." }, 500);
      }
      deliveryFee = fee;
    }
  }
  const total = subtotal + deliveryFee;

  // Persist the server-calculated breakdown and the priced lines.
  await supabase.from("orders").update({
    subtotal_mt: subtotal,
    delivery_fee_mt: deliveryFee,
    total_mt: total,
    delivery_type: deliveryType,
    delivery_address: deliveryAddress,
    delivery_zone_id: deliveryZoneId,
    delivery_zone_name: deliveryZoneName,
  }).eq("id", order.id);
  await supabase.from("order_items").delete().eq("order_id", order.id);
  await supabase.from("order_items").insert(
    lines.map((l) => ({ order_id: order.id, product_id: l.product_id, name: PRODUCT_NAMES[l.product_id] ?? EXTRA_NAMES[l.product_id] ?? l.product_id, qty: l.qty, unit_price_mt: l.unit_price_mt })),
  );

  // M-Pesa only, direct STK push. No hosted checkout, no redirect:
  // the provider prompts the PIN on the customer's own phone.
  // wallet_id is mandatory for /charges, but the owner never types it:
  // it is either the optional ZUMBO_WALLET_MPESA override, or it is
  // chosen automatically from GET /wallets (the M-Pesa wallet; if there
  // is only one wallet in the account, that one). The channel is
  // inferred from the msisdn prefix (84/85 = M-Pesa), so no other
  // channel is ever sent.
  let walletId = zumboWalletMpesa;
  if (!walletId) {
    const walletsRes = await fetch(`${zumboBase}/wallets`, {
      headers: { Authorization: `Bearer ${zumboKey}`, "X-Merchant-Id": zumboMerchant },
    });
    if (!walletsRes.ok) {
      return json({ error: "Payment is not configured yet. Your order is saved as pending and has not been charged." }, 503);
    }
    const walletsData: Record<string, unknown> = await walletsRes.json().catch(() => ({}));
    const rawList = walletsData.wallets ?? walletsData.data ?? [];
    const wallets = Array.isArray(rawList) ? rawList as Array<Record<string, unknown>> : [];
    const isMpesa = (w: Record<string, unknown>) =>
      ["method", "payment_method", "channel", "type", "provider", "name", "code", "wallet_id", "id"]
        .map((k) => String(w[k] ?? "").toLowerCase().replace(/[-_\s]/g, ""))
        .some((v) => v.includes("mpesa"));
    const mpesaWallet = wallets.find(isMpesa);
    const chosen = mpesaWallet ?? (wallets.length === 1 ? wallets[0] : undefined);
    walletId = String(
      chosen?.wallet_id ?? chosen?.id ?? chosen?.code ?? "",
    );
    if (!walletId) {
      return json({ error: "Payment is not configured yet. Your order is saved as pending and has not been charged." }, 503);
    }
  }
  const customerName =
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined ??
    (user.user_metadata as Record<string, unknown> | undefined)?.name as string | undefined;
  const providerRes = await fetch(`${zumboBase}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${zumboKey}`,
      "X-Merchant-Id": zumboMerchant,
      "Idempotency-Key": order.id,
    },
    body: JSON.stringify({
      wallet_id: walletId,
      amount: total,
      msisdn,
      ...(customerName ? { customer_name: customerName } : {}),
      source_id: order.id,
    }),
  });
  const providerData: Record<string, unknown> = await providerRes.json().catch(() => ({}));
  const data = (providerData.data && typeof providerData.data === "object"
    ? providerData.data
    : providerData) as Record<string, unknown>;
  if (!providerRes.ok) {
    const code = providerRes.status === 402 ? 402 : 502;
    return json({ error: "Payment could not be created. Your order is saved as pending and has not been charged." }, code);
  }
  const reference =
    (data.reference as string) ??
    (data.payment_id as string) ??
    (data.id as string) ??
    null;
  if (reference) {
    await supabase.from("orders").update({ provider_reference: String(reference) }).eq("id", order.id);
  }
  return json({
    ok: true,
    order_id: order.id,
    subtotal_mt: subtotal,
    delivery_fee_mt: deliveryFee,
    delivery_type: deliveryType,
    total_mt: total,
    provider_reference: reference,
    provider_status: (data.status as string) ?? null,
    // STK push: PIN is confirmed on the customer's phone, on the site.
    // Never redirect anywhere.
    phone_prompt: true,
    checkout_url: null,
    redirect: false,
  }, 200);
});
