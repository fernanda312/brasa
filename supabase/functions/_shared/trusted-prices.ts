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
};

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
};

export function recalculateTotal(
  items: Array<{ id?: string; product_id?: string; qty: number }>,
): { total: number; lines: Array<{ product_id: string; qty: number; unit_price_mt: number }> } {
  const lines = items.map((item) => {
    const productId = item.product_id ?? item.id ?? "";
    const price = TRUSTED_PRICES[productId];
    if (price === undefined) {
      throw new Error(
        `Product ${productId} has no online price and cannot be paid online.`,
      );
    }
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1) throw new Error("Invalid quantity.");
    return { product_id: productId, qty, unit_price_mt: price };
  });
  const total = lines.reduce((sum, l) => sum + l.unit_price_mt * l.qty, 0);
  return { total, lines };
}
