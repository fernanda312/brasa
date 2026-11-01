// BRASA — service worker. Pages always try the network first (so a new
// published version is never stuck behind an old cache); images, CSS and
// JS fall back to the cache so the app still opens offline.
var CACHE = "brasa-v2";
var CORE = [
  "index.html", "cardapio.html", "conta.html", "carrinho.html",
  "chat.html", "admin.html", "manifest.json",
  "css/index-Cs1L1Nxm.css", "css/brasa.css",
  "js/config.js", "js/catalog.js", "js/app.js",
  "images/brasa-icon-192.png", "images/brasa-icon-512.png",
  "images/brasa-logo.png"
];
self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(CORE); }).then(function() { return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  var isPage = e.request.mode === "navigate" || url.pathname.endsWith(".html");
  if (isPage) {
    e.respondWith(fetch(e.request).then(function(r) {
      var copy = r.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
      return r;
    }).catch(function() { return caches.match(e.request).then(function(m) { return m || caches.match("index.html"); }); }));
  } else {
    e.respondWith(caches.match(e.request).then(function(m) {
      return m || fetch(e.request).then(function(r) {
        var copy = r.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        return r;
      });
    }));
  }
});
