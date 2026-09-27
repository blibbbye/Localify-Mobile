// Localify Mobile no longer uses a service worker.
// This file intentionally unregisters itself and clears any old app-shell
// caches left by previous versions, without touching IndexedDB/library data.
self.addEventListener("install",function(event){
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate",function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.filter(function(k){return /^localify-mobile-/i.test(k)}).map(function(k){return caches.delete(k)}));
      })
      .then(function(){return self.registration.unregister()})
      .then(function(){return self.clients.claim()})
  );
});
self.addEventListener("fetch",function(event){
  // Do not intercept requests. The website should always use the live page.
  return;
});
