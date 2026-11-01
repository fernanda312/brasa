// BRASA — payment webhook Edge Function (server only, Deno).
// Verifies the provider signature (HMAC-SHA256 over the raw body) with the
// secret stored as an Edge Function secret. Only a verified, successful
// payment marks an order paid, and only then is a receipt written to the
// customer's chat. Anything unsigned, unknown or unsuccessful is ignored
// without changing any order.
//
// Owner configuration (Supabase > Edge Functions > Secrets, never in code):
//   ZUMBO_WEBHOOK_SECRET
// The provider dashboard must point its webhook at:
//   <SUPABASE_URL>/functions/v1/zumbopay-webhook
// The signature header name used here follows the provider's usual header
// (x-zumbopay-signature); if the merchant dashboard shows a different
// header name for this account, change ONLY the header lookup below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: corsHeaders });
  }
  const secret = Deno.env.get("ZUMBO_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Webhook is not configured yet." }), { status: 503, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const given = req.headers.get("x-zumbopay-signature") ?? "";
  const cleanGiven = given.replace(/^sha256=/i, "").toLowerCase();
  const expected = await hmacHex(secret, rawBody);
  if (!cleanGiven || !timingSafeEqual(cleanGiven, expected)) {
    return new Response(JSON.stringify({ error: "Invalid signature." }), { status: 401, headers: corsHeaders });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid payload." }), { status: 400, headers: corsHeaders });
  }
  // Provider events include payment.succeeded / payment.failed, etc.
  // The payload may carry the event at top level and the details under
  // data, or the older flat shape — accept both, change nothing on doubt.
  const event = String(payload.event ?? payload.type ?? "");
  const data = (payload.data && typeof payload.data === "object"
    ? payload.data
    : payload) as Record<string, unknown>;
  const status = String(data.status ?? payload.status ?? payload.payment_status ?? "").toLowerCase();
  const isPaid = event === "payment.succeeded" ||
    ["paid", "success", "successful", "completed"].includes(status);
  if (!isPaid) {
    // Not a successful payment: acknowledge, change nothing.
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: corsHeaders });
  }
  const orderId = String(data.source_id ?? data.reference ?? payload.reference ?? payload.order_id ?? payload.merchant_reference ?? "");
  const providerReference = String(data.reference ?? data.payment_id ?? data.transaction_id ?? payload.reference ?? "");
  if (!orderId) {
    return new Response(JSON.stringify({ error: "No order reference." }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, total_mt")
    .eq("id", orderId)
    .single();
  if (!order) {
    return new Response(JSON.stringify({ error: "Order not found." }), { status: 404, headers: corsHeaders });
  }
  if (order.status === "paid") {
    return new Response(JSON.stringify({ ok: true, already_paid: true }), { status: 200, headers: corsHeaders });
  }
  await supabase.from("orders").update({
    status: "paid",
    provider_reference: providerReference || null,
  }).eq("id", orderId);

  // Stock: take the bought quantities out of stock, only where the
  // product has a controlled stock (stock_qty not null). Products
  // without a stock number are not affected.
  const { data: items } = await supabase
    .from("order_items").select("product_id, qty").eq("order_id", orderId);
  for (const item of items || []) {
    const { data: prod } = await supabase
      .from("products").select("stock_qty").eq("slug", item.product_id).maybeSingle();
    if (prod && prod.stock_qty !== null && prod.stock_qty !== undefined) {
      await supabase.from("products").update({
        stock_qty: Math.max(0, prod.stock_qty - (item.qty || 1)),
      }).eq("slug", item.product_id);
    }
  }

  // Receipt in the customer's chat (the shop's own conversation).
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", order.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let conversationId = conv?.id as string | undefined;
  if (!conversationId) {
    const created = await supabase.from("conversations").insert({ user_id: order.user_id }).select().single();
    conversationId = created.data?.id as string | undefined;
  }
  if (conversationId) {
    const totalText = order.total_mt ? `${order.total_mt} MT` : "o valor da encomenda";
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender: "shop",
      body: `Pagamento confirmado. Recibo da sua encomenda: ${totalText}, paga por M-Pesa. A BRASA vai preparar a sua encomenda e confirmar a entrega aqui no chat.`,
    });
  }
  return new Response(JSON.stringify({ ok: true, order_id: orderId }), { status: 200, headers: corsHeaders });
});
