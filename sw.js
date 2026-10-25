/* 沖繩小旅行 offline cache. Bump VER when you want every phone to drop old files. */
var VER = "okinawa-v1";
var FONTS = "okinawa-fonts-v1";
var CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(VER).then(function(c){
      return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==VER && k!==FONTS; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function pageFirstTry(req){
  /* try network for a few seconds so updates arrive; fall back to the saved copy */
  return new Promise(function(resolve){
    var settled = false;
    function done(r){ if(!settled && r){ settled = true; resolve(r); } }
    var timer = setTimeout(function(){
      caches.match(req, {ignoreSearch:true}).then(done);
    }, 3500);
    fetch(req).then(function(r){
      clearTimeout(timer);
      if(r && r.ok){ var copy = r.clone(); caches.open(VER).then(function(c){ c.put(req, copy); }); }
      done(r);
    }).catch(function(){
      clearTimeout(timer);
      caches.match(req, {ignoreSearch:true}).then(function(m){
        return m || caches.match("./index.html");
      }).then(function(m){ if(m) done(m); else { settled = true; resolve(Response.error()); } });
    });
  });
}

function staleWhileRevalidate(req, cacheName){
  return caches.open(cacheName).then(function(c){
    return c.match(req).then(function(hit){
      var net = fetch(req).then(function(r){
        if(r && (r.ok || r.type==="opaque")) c.put(req, r.clone());
        return r;
      }).catch(function(){ return hit; });
      return hit || net;
    });
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === "navigate" || /\.html?$/.test(url.pathname) || url.pathname.endsWith("/")){
      e.respondWith(pageFirstTry(req));
    }else{
      e.respondWith(staleWhileRevalidate(req, VER));
    }
    return;
  }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(staleWhileRevalidate(req, FONTS));
  }
  /* weather / exchange-rate calls go straight to the network; the page keeps its own last copy */
});
