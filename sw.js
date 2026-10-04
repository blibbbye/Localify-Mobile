const CACHE="localify-mobile-v17-20261004-player-covers";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(e.request.mode==="navigate" || u.pathname.endsWith("/index.html")){
    e.respondWith(
      fetch(e.request,{cache:"no-store"}).then(r=>{
        const c=r.clone();caches.open(CACHE).then(x=>x.put("./index.html",c)).catch(()=>{});
        return r;
      }).catch(()=>caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    if(u.origin===location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});}
    return r;
  })));
});
// Force an updated worker to take over immediately after a new deployment.
self.addEventListener("message",e=>{if(e.data==="SKIP_WAITING")self.skipWaiting()});
