// Trusted price list (MT), mirrored from js/catalog.js and the seed.
// The server NEVER trusts a price or a total sent by the browser.
// A product absent here has no online price and cannot be paid online,
// and any attempt to pay for one is rejected with 400.
export const TRUSTED_PRICES: Record<string, number> = {
  "arrachera-piquin": 620,
  chilli: 580,
  "bacon-bbq": 580,
  supreme: 320,
  monterrey: 320,
  cali: 320,
  "tacos-3": 420,
  "coca-cola": 150,
  fanta: 150,
  sprite: 150,
  agua: 80,
  "batata-frita": 200,
};

// FALLBACK ONLY, for the unconfigured cart preview (js/catalog.js mirrors
// it as DEFAULT_DELIVERY_FEE_MT). This is NOT the server's fee source:
// create-payment always reads delivery_fee_mt from site_settings (id = 1)
// and fails honestly if it cannot — it never charges this fallback value.
export const DEFAULT_DELIVERY_FEE_MT = 150;

// Display names, so server-written order items keep the real product name
// (the browser-sent name is never trusted for price, but the name itself
// is only used for display in the order and receipt).
export const PRODUCT_NAMES: Record<string, string> = {
  "arrachera-piquin": "Arrachera Piquin",
  chilli: "Hambúrguer Chilli",
  "bacon-bbq": "BACON BBQ",
  supreme: "Supreme",
  monterrey: "Monterrey",
  cali: "Cali",
  "tacos-3": "3 Tacos",
  "coca-cola": "Coca-Cola (lata)",
  fanta: "Fanta Laranja (lata)",
  sprite: "Sprite (lata)",
  agua: "Água mineral (500 ml)",
  "batata-frita": "Batata frita",
};

// Extras, priced server-side like the products above. An extra is always
// attached to one base item and charged once per base item (extra qty =
// base qty). The browser never sends an extra price.
export const EXTRA_PRICES: Record<string, number> = {
  "extra-queijo": 100,
  "extra-bacon": 150,
  "extra-ovo": 100,
  "extra-molho": 50,
  "extra-batata": 150,
};

export const EXTRA_NAMES: Record<string, string> = {
  "extra-queijo": "Queijo extra",
  "extra-bacon": "Bacon extra",
  "extra-ovo": "Ovo extra",
  "extra-molho": "Molho da casa extra",
  "extra-batata": "Batata extra",
};

export function recalculateTotal(
  items: Array<{ id?: string; product_id?: string; qty: number; extras?: Array<{ id?: string; extra_id?: string }> }>,
): { total: number; lines: Array<{ product_id: string; qty: number; unit_price_mt: number }> } {
  const lines: Array<{ product_id: string; qty: number; unit_price_mt: number }> = [];
  for (const item of items) {
    const productId = item.product_id ?? item.id ?? "";
    const price = TRUSTED_PRICES[productId];
    if (price === undefined) {
      throw new Error(
        `Product ${productId} has no online price and cannot be paid online.`,
      );
    }
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1) throw new Error("Invalid quantity.");
    lines.push({ product_id: productId, qty, unit_price_mt: price });
    for (const ex of item.extras || []) {
      const extraId = ex.extra_id ?? ex.id ?? "";
      const extraPrice = EXTRA_PRICES[extraId];
      if (extraPrice === undefined) {
        throw new Error(`Extra ${extraId} has no online price.`);
      }
      lines.push({ product_id: extraId, qty, unit_price_mt: extraPrice });
    }
  }
  const total = lines.reduce((sum, l) => sum + l.unit_price_mt * l.qty, 0);
  return { total, lines };
}
