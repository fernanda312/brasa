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
  {id: "tacos-3", slug: "tacos-3", name: "3 Tacos", category: "Tacos", price_mt: 420, image_url: "images/photo-1551504734-5ee1c4a1479b.jpg", description: "À escolha da carne, servidos com arroz e feijão. Inclui cebola e coentros"},
  {id: "coca-cola", slug: "coca-cola", name: "Coca-Cola (lata)", category: "Bebidas", price_mt: 150, image_url: "", description: "Refrigerante gelado, lata de 330 ml"},
  {id: "fanta", slug: "fanta", name: "Fanta Laranja (lata)", category: "Bebidas", price_mt: 150, image_url: "", description: "Refrigerante de laranja gelado, lata de 330 ml"},
  {id: "sprite", slug: "sprite", name: "Sprite (lata)", category: "Bebidas", price_mt: 150, image_url: "", description: "Refrigerante de limão gelado, lata de 330 ml"},
  {id: "agua", slug: "agua", name: "Água mineral (500 ml)", category: "Bebidas", price_mt: 80, image_url: "", description: "Água mineral fresca, garrafa de 500 ml"},
  {id: "batata-frita", slug: "batata-frita", name: "Batata frita", category: "Acompanhamentos", price_mt: 200, image_url: "", description: "Batata frita crocante com sal, porção individual"}
];
// Extras (server-trusted prices, mirrored in the payment function).
// Added to a burger, cachorro or tacos at order time, in the customizer.
const BRASA_EXTRAS = [
  {id: "extra-queijo", name: "Queijo extra", price_mt: 100},
  {id: "extra-bacon", name: "Bacon extra", price_mt: 150},
  {id: "extra-ovo", name: "Ovo extra", price_mt: 100},
  {id: "extra-molho", name: "Molho da casa extra", price_mt: 50},
  {id: "extra-batata", name: "Batata extra", price_mt: 150}
];
// Removals: no price, they only go into the order note ("Sem cebola").
const BRASA_REMOVALS = ["cebola", "tomate", "alface", "picles", "molho", "queijo"];
const FOOD_CATEGORIES = ["Hambúrgueres da Brasa", "Cachorros", "Tacos"];
function extraById(id){ return BRASA_EXTRAS.find(function(x){ return x.id === id; }); }
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
