// BRASA — catalogue. Prices in MT only, exactly the live menu.
// The server never trusts a price sent by the browser: the same prices
// live in supabase/functions/_shared/trusted-prices.ts and in the seed
// migration, and the payment function recalculates from its own list.
const PRODUCTS = [
  {id: "arrachera-piquin", slug: "arrachera-piquin", name: "Arrachera Piquin", category: "Hambúrgueres da Brasa", price_mt: 620, image_url: "images/brasa-menu-burgers.jpg", description: "Carne suculenta, queijo americano, fraldinha, guacamole, chipotle, cebola grelhada, molho da casa, alface"},
  {id: "chilli", slug: "chilli", name: "Hambúrguer Chilli", category: "Hambúrgueres da Brasa", price_mt: 580, image_url: "images/brasa-menu-cachorros.jpg", description: "Carne suculenta com queijo americano duplo, bacon, anel de cebola, chilli delicioso, molho chipotle, alface"},
  {id: "bacon-bbq", slug: "bacon-bbq", name: "BACON BBQ", category: "Hambúrgueres da Brasa", price_mt: 580, image_url: "images/brasa-menu-tacos.jpg", description: "Carne suculenta, molho BBQ, bacon crocante, molho chipotle, queijo americano, cebola grelhada, alface"},
  {id: "supreme", slug: "supreme", name: "Supreme", category: "Cachorros", price_mt: 320, image_url: "images/photo-1586816001966-79b736744398.jpg", description: "Salsicha, chilli, queijo americano derretido, frita, mostarda e ketchup"},
  {id: "monterrey", slug: "monterrey", name: "Monterrey", category: "Cachorros", price_mt: 320, image_url: "images/photo-1568901346375-23c9450c58cd.jpg", description: "Salsicha, bife, queijo mozzarella, cebola grelhada, maionese"},
  {id: "cali", slug: "cali", name: "Cali", category: "Cachorros", price_mt: 320, image_url: "images/photo-1550547660-d9450f859349.jpg", description: "Salsicha, carne al pastor, alface, tomate, queijo mozzarella, maionese"},
  {id: "tacos-3", slug: "tacos-3", name: "3 Tacos", category: "Tacos", price_mt: 420, image_url: "images/photo-1551504734-5ee1c4a1479b.jpg", description: "À escolha da carne, servidos com arroz e feijão. Inclui cebola e coentros"}
];
// Default delivery fee (MT), used in the cart before the backend is linked.
// Once configured, the cart reads site_settings.delivery_fee_mt instead,
// and the payment function ALWAYS reads it from site_settings on the server.
// The admin changes it in Admin > Definições > Taxa de entrega.
const DEFAULT_DELIVERY_FEE_MT = 150;
// Trusted price list, mirrored server-side in the payment Edge Function.
const TRUSTED_PRICES = {};
PRODUCTS.forEach(function(p){ if (p.price_mt !== null) TRUSTED_PRICES[p.id] = p.price_mt; });
function fmtMT(v){ return v.toLocaleString("pt-PT").replace(/,/g, ".") + " MT"; }
function productById(id){ return PRODUCTS.find(function(x){ return x.id === id; }); }
