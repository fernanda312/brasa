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
    addToCart: function(id, qty){
      var cart = window.brasa.getCart();
      var found = cart.find(function(i){ return i.id === id; });
      if (found) found.qty += (qty || 1); else cart.push({id: id, qty: qty || 1});
      window.brasa.saveCart(cart);
    },
    // Nobody adds to the cart without an account. Without a session,
    // the item is remembered and the visitor is sent to create or
    // start a session; conta.html adds the remembered item after
    // sign-in and then goes to the cart.
    requireAccountForCart: async function(id, qty){
      var session = await window.brasa.getSession();
      if (!session) {
        try { localStorage.setItem("brasa-pending-add", JSON.stringify({id: id, qty: qty || 1})); } catch (e) {}
        window.brasa.savePending("cart", "carrinho.html");
        location.href = "conta.html";
        return false;
      }
      window.brasa.addToCart(id, qty);
      return true;
    },
    bindAddButtons: function(){
      document.querySelectorAll("[data-add]").forEach(function(btn){
        if (btn.getAttribute("data-bound")) return;
        btn.setAttribute("data-bound", "1");
        btn.addEventListener("click", function(){
          window.brasa.requireAccountForCart(btn.getAttribute("data-add"), 1).then(function(added){
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
    cartSubtotal: function(){
      var cart = window.brasa.getCart();
      return cart.reduce(function(sum, item){
        var p = productById(item.id);
        return sum + (p ? p.price_mt * item.qty : 0);
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
