// BRASA — shared frontend logic: Supabase client, account, cart, settings.
// No Google sign-in anywhere. No password is ever stored here.
// Cart buttons are bound only once per button (data-bound guard): the
// home page binds its static buttons on load, and cardapio.html calls
// bindAddButtons() again after rendering its cards.
(function(){
  var cfg = window.BRASA_CONFIG || {};
  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_URL !== "SUPABASE_URL" && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== "SUPABASE_ANON_KEY";
  var sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  window.brasa = {
    configured: configured,
    supabase: sb,
    // ---- cart (local until checkout; the order itself lives in Supabase) ----
    getCart: function(){
      try { return JSON.parse(localStorage.getItem("brasa-cart") || "[]"); }
      catch (e) { return []; }
    },
    saveCart: function(cart){
      localStorage.setItem("brasa-cart", JSON.stringify(cart));
      window.brasa.updateCartCount();
    },
    // Cart items carry an optional key so the same burger with different
    // extras/notes stays a separate line (like the big ordering apps).
    cartKey: function(item){
      var ex = (item.extras || []).slice().sort().join(",");
      return item.id + "|" + ex + "|" + (item.note || "");
    },
    addToCart: function(id, qty, opts){
      var cart = window.brasa.getCart();
      var item = {id: id, qty: qty || 1};
      if (opts) {
        if (opts.extras && opts.extras.length) item.extras = opts.extras.slice();
        if (opts.note) item.note = opts.note;
      }
      item.key = window.brasa.cartKey(item);
      var found = null;
      for (var i = 0; i < cart.length; i++) {
        var k = cart[i].key || window.brasa.cartKey(cart[i]);
        if (k === item.key) { found = cart[i]; break; }
      }
      if (found) found.qty += item.qty; else cart.push(item);
      window.brasa.saveCart(cart);
    },
    // Line total for one cart item: base + extras, times quantity.
    lineTotal: function(item){
      var p = productById(item.id);
      if (!p) return 0;
      var unit = p.price_mt;
      (item.extras || []).forEach(function(eid){
        var ex = extraById(eid);
        if (ex) unit += ex.price_mt;
      });
      return unit * item.qty;
    },
    // Customizer sheet: what the dish comes with, extras, removals,
    // observations and quantity — then it goes to the cart.
    openCustomizer: function(id){
      var p = productById(id);
      if (!p) return;
      var old = document.getElementById("customizer-sheet");
      if (old) old.remove();
      var sheet = document.createElement("div");
      sheet.id = "customizer-sheet";
      sheet.className = "sheet-backdrop";
      var extrasHtml = BRASA_EXTRAS.map(function(ex){
        return "<label class='sheet-check'><input type='checkbox' data-extra='" + ex.id + "'> " + ex.name + " (+" + fmtMT(ex.price_mt) + ")</label>";
      }).join("");
      var removalsHtml = BRASA_REMOVALS.map(function(r){
        return "<label class='sheet-check'><input type='checkbox' data-remove-ing='" + r + "'> Sem " + r + "</label>";
      }).join("");
      sheet.innerHTML = "<div class='sheet-panel'><button class='sheet-close' type='button'>×</button>" +
        "<h3 style='color:#fff;margin:0 0 6px'>" + p.name + "</h3>" +
        "<p style='margin:0 0 4px'><strong style='color:#fff'>O que vem:</strong> " + (p.description || "") + "</p>" +
        "<p style='margin:0 0 16px'><strong style='color:#fff'>Preço:</strong> " + fmtMT(p.price_mt) + "</p>" +
        "<p class='sheet-title'>Adicionar</p><div class='sheet-grid'>" + extrasHtml + "</div>" +
        "<p class='sheet-title'>Tirar</p><div class='sheet-grid'>" + removalsHtml + "</div>" +
        "<label class='field-label' for='sheet-obs'>Observações</label><input class='field' id='sheet-obs' type='text' placeholder='Ex.: pouco sal, bem passado'>" +
        "<div style='display:flex;gap:10px;align-items:center;margin-top:16px'><button class='btn-outline' id='sheet-dec' type='button'>−</button><span id='sheet-qty' style='color:#fff;font-size:18px'>1</span><button class='btn-outline' id='sheet-inc' type='button'>+</button>" +
        "<span id='sheet-total' style='color:#fff;margin-left:auto'></span></div>" +
        "<button class='gradient-bg px-8 py-3 rounded-full text-white font-bold' id='sheet-add' type='button' style='margin-top:16px;width:100%'>Adicionar ao carrinho</button></div>";
      document.body.appendChild(sheet);
      var qty = 1;
      function total(){
        var t = p.price_mt;
        sheet.querySelectorAll("[data-extra]:checked").forEach(function(c){
          var ex = extraById(c.getAttribute("data-extra"));
          if (ex) t += ex.price_mt;
        });
        document.getElementById("sheet-total").textContent = fmtMT(t * qty);
      }
      total();
      sheet.querySelectorAll("[data-extra]").forEach(function(c){ c.addEventListener("change", total); });
      document.getElementById("sheet-dec").onclick = function(){ if (qty > 1) { qty--; document.getElementById("sheet-qty").textContent = qty; total(); } };
      document.getElementById("sheet-inc").onclick = function(){ qty++; document.getElementById("sheet-qty").textContent = qty; total(); };
      sheet.querySelector(".sheet-close").onclick = function(){ sheet.remove(); };
      sheet.addEventListener("click", function(e){ if (e.target === sheet) sheet.remove(); });
      document.getElementById("sheet-add").onclick = async function(){
        var extras = [];
        sheet.querySelectorAll("[data-extra]:checked").forEach(function(c){ extras.push(c.getAttribute("data-extra")); });
        var notes = [];
        sheet.querySelectorAll("[data-remove-ing]:checked").forEach(function(c){ notes.push("Sem " + c.getAttribute("data-remove-ing")); });
        var obs = document.getElementById("sheet-obs").value.trim();
        if (obs) notes.push(obs);
        var added = await window.brasa.requireAccountForCart(id, qty, {extras: extras, note: notes.join("; ")});
        sheet.remove();
        if (added) location.href = "carrinho.html";
      };
    },
    // Nobody adds to the cart without an account. Without a session,
    // the item is remembered and the visitor is sent to create or
    // start a session; conta.html adds the remembered item after
    // sign-in and then goes to the cart.
    requireAccountForCart: async function(id, qty, opts){
      var session = await window.brasa.getSession();
      if (!session) {
        try { localStorage.setItem("brasa-pending-add", JSON.stringify({id: id, qty: qty || 1, extras: (opts && opts.extras) || [], note: (opts && opts.note) || ""})); } catch (e) {}
        window.brasa.savePending("cart", "carrinho.html");
        location.href = "conta.html";
        return false;
      }
      window.brasa.addToCart(id, qty, opts);
      return true;
    },
    bindAddButtons: function(){
      document.querySelectorAll("[data-add]").forEach(function(btn){
        if (btn.getAttribute("data-bound")) return;
        btn.setAttribute("data-bound", "1");
        btn.addEventListener("click", async function(){
          var pid = btn.getAttribute("data-add");
          var prod = productById(pid);
          if (prod && FOOD_CATEGORIES.indexOf(prod.category) !== -1) {
            var session = await window.brasa.getSession();
            if (!session) {
              window.brasa.savePending("cart", "carrinho.html");
              location.href = "conta.html";
              return;
            }
            window.brasa.openCustomizer(pid);
            return;
          }
          window.brasa.requireAccountForCart(pid, 1).then(function(added){
            if (added) {
              var old = btn.textContent;
              btn.textContent = "Adicionado!";
              setTimeout(function(){ btn.textContent = old; }, 1200);
            }
          });
        });
      });
    },
    // Delivery fee: the site_settings value when configured, otherwise
    // the DEFAULT_DELIVERY_FEE_MT preview constant. Never a client guess
    // at payment time — the server reads site_settings itself.
    getDeliveryFee: async function(){
      if (!sb) return DEFAULT_DELIVERY_FEE_MT;
      try {
        var r = await sb.from("site_settings").select("delivery_fee_mt").eq("id", 1).maybeSingle();
        if (r.data && r.data.delivery_fee_mt !== null && r.data.delivery_fee_mt !== undefined) return r.data.delivery_fee_mt;
      } catch (e) {}
      return DEFAULT_DELIVERY_FEE_MT;
    },
    // Delivery zones (Maputo + Matola), admin-editable. Returns [] when
    // the zones table does not exist yet (pre-migration checkout falls
    // back to the flat site_settings fee).
    getDeliveryZones: async function(){
      if (!sb) return [];
      try {
        var r = await sb.from("delivery_zones").select("id, name, fee_mt").eq("active", true).order("sort_order", {ascending: true});
        if (r.error) return [];
        return r.data || [];
      } catch (e) { return []; }
    },
    cartSubtotal: function(){
      var cart = window.brasa.getCart();
      return cart.reduce(function(sum, item){
        return sum + window.brasa.lineTotal(item);
      }, 0);
    },
    updateCartCount: function(){
      var n = window.brasa.getCart().reduce(function(s, i){ return s + i.qty; }, 0);
      document.querySelectorAll(".cart-count").forEach(function(el){ el.textContent = n; });
    },
    // ---- pending intent: cart/chat intent saved BEFORE account, resumed after ----
    savePending: function(kind, target){
      localStorage.setItem("brasa-pending", JSON.stringify({kind: kind, target: target || "carrinho.html", at: Date.now()}));
    },
    takePending: function(){
      try {
        var p = JSON.parse(localStorage.getItem("brasa-pending") || "null");
        localStorage.removeItem("brasa-pending");
        return p;
      } catch (e) { return null; }
    },
    // ---- account ----
    getSession: async function(){
      if (!sb) return null;
      var r = await sb.auth.getSession();
      return r.data.session || null;
    },
    // Sign-in: if the email is not found, the caller creates the account
    // on the same page, same email + password, no verification, no Google.
    signIn: async function(email, password){
      var r = await sb.auth.signInWithPassword({email: email, password: password});
      if (r.error) {
        var msg = (r.error.message || "").toLowerCase();
        if (msg.indexOf("invalid login credentials") !== -1 || msg.indexOf("user not found") !== -1 || msg.indexOf("email not confirmed") !== -1) {
          return {notFound: true};
        }
        return {error: r.error.message};
      }
      // Every signed-in account gets a profile row, even with email
      // and password only — without it, the admin grant and the
      // customers list have no row to work on.
      if (r.data.session) {
        await sb.from("profiles").upsert({id: r.data.session.user.id, email: email});
      }
      return {session: r.data.session};
    },
    signUp: async function(email, password, whatsapp){
      var r = await sb.auth.signUp({email: email, password: password});
      if (r.error) return {error: r.error.message};
      // With "Confirm email" OFF, sign-up returns a session directly.
      // If it does not, sign in immediately with the same credentials.
      var session = r.data.session;
      if (!session) {
        var s2 = await sb.auth.signInWithPassword({email: email, password: password});
        if (s2.error) return {needsOwnerStep: true, detail: s2.error.message};
        session = s2.data.session;
      }
      if (session) {
        await sb.from("profiles").upsert({id: session.user.id, email: email, whatsapp: whatsapp || null});
      }
      return {session: session};
    },
    signOut: async function(){
      if (sb) await sb.auth.signOut();
      location.href = "index.html";
    },
    // ---- site settings (admin-editable; logo/hero video/promos/texts) ----
    getSettings: async function(){
      if (!sb) return null;
      var r = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
      return r.data || null;
    },
    applySettings: async function(){
      var s = await window.brasa.getSettings();
      if (!s) return null;
      document.querySelectorAll("img.site-logo").forEach(function(img){ if (s.logo_url) img.src = s.logo_url; });
      document.querySelectorAll("[data-hero-video]").forEach(function(v){ if (s.hero_video_url) v.src = s.hero_video_url; });
      var heroTitle = document.querySelector("[data-hero-title]");
      if (heroTitle && s.hero_title) heroTitle.textContent = s.hero_title;
      var heroText = document.querySelector("[data-hero-text]");
      if (heroText && s.hero_text) heroText.textContent = s.hero_text;
      var storeText = document.querySelector("[data-store-text]");
      if (storeText && s.store_text) storeText.textContent = s.store_text;
      var howText = document.querySelector("[data-how-text]");
      if (howText && s.how_text) howText.textContent = s.how_text;
      var contactText = document.querySelector("[data-contact-text]");
      if (contactText && s.contact_text) contactText.textContent = s.contact_text;
      var ctaText = document.querySelector("[data-cta-text]");
      if (ctaText && s.cta_text) ctaText.textContent = s.cta_text;
      var contactPhone = document.querySelector("[data-contact-phone]");
      if (contactPhone && s.contact_phone) contactPhone.textContent = s.contact_phone;
      document.querySelectorAll("[data-whatsapp-link]").forEach(function(a){
        if (s.whatsapp_url) { a.href = s.whatsapp_url; a.style.display = "inline-block"; }
      });
      if (s.whatsapp_url && !document.getElementById("wa-fab")) {
        var wa = document.createElement("a");
        wa.id = "wa-fab";
        wa.className = "wa-fab";
        wa.href = s.whatsapp_url;
        wa.target = "_blank";
        wa.rel = "noopener";
        wa.setAttribute("aria-label", "Falar no WhatsApp");
        wa.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
        document.body.appendChild(wa);
      }
      var deliveryText = document.querySelector("[data-delivery-text]");
      if (deliveryText && s.delivery_text) deliveryText.textContent = s.delivery_text;
      var trustText = document.querySelector("[data-trust-text]");
      if (trustText && s.trust_text) trustText.textContent = s.trust_text;
      for (var i = 1; i <= 3; i++) {
        document.querySelectorAll("[data-promo-img-" + i + "]").forEach(function(img){ if (s["promo" + i + "_url"]) img.src = s["promo" + i + "_url"]; });
      }
      document.querySelectorAll("[data-promo-text]").forEach(function(el){ if (s.promo_text) el.textContent = s.promo_text; });
      document.querySelectorAll("[data-group-link]").forEach(function(a){ if (s.whatsapp_group_url) a.href = s.whatsapp_group_url; });
      document.querySelectorAll("[data-whatsapp-link]").forEach(function(a){ if (s.whatsapp_url) a.href = s.whatsapp_url; });
      return s;
    }
  };
  document.addEventListener("DOMContentLoaded", function(){
    window.brasa.updateCartCount();
    window.brasa.bindAddButtons();
    window.brasa.applySettings();
    // Header: the same labels everywhere. "Conta" never changes name,
    // and "Admin" only appears for the admin account, never for customers.
    window.brasa.getSession().then(async function(session){
      document.querySelectorAll("[data-account-link]").forEach(function(a){
        a.textContent = "Conta";
        a.href = "conta.html";
      });
      if (session) {
        document.querySelectorAll("[data-chat-fab]").forEach(function(a){ a.style.display = "flex"; });
        var adminEmail = (cfg.ADMIN_EMAIL || "").toLowerCase();
        var isAdmin = adminEmail && adminEmail !== "ADMIN_EMAIL_POR_DEFINIR" && session.user.email.toLowerCase() === adminEmail;
        if (!isAdmin && sb) {
          var prof = await sb.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
          isAdmin = !!(prof.data && prof.data.is_admin);
        }
        if (isAdmin) document.querySelectorAll("[data-admin-link]").forEach(function(a){ a.style.display = ""; });
      }
      document.querySelectorAll("[data-chat-link]").forEach(function(a){
        a.addEventListener("click", function(e){
          if (!session) {
            e.preventDefault();
            window.brasa.savePending("chat", "chat.html");
            location.href = "conta.html";
          }
        });
      });
    });
  });
})();

// Installable app: register the service worker (pages stay network-first,
// so updates are never stuck behind an old version).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("sw.js").catch(function() {});
  });
}
