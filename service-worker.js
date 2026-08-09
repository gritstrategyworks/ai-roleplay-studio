const CACHE='ai-roleplay-studio-v1-21-role-contract';
const BASE=new URL('./',self.location.href);
const CORE=['index.html','styles.css?v=1.21','auth.css?v=1.21','auth.js?v=1.21','app.js?v=1.21','local-ai.js?v=1.21','scenario-design.js?v=1.21','local-ai-worker.js?v=1.21','manifest.webmanifest','assets/icon.svg','assets/avatars/saito.svg','assets/avatars/yamamoto.svg','assets/avatars/suzuki.svg','assets/avatars/nakamura.svg','assets/avatars/kato.svg','assets/avatars/ito.svg'].map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(new URL('index.html',BASE).href,copy))}
      return response;
    }).catch(()=>caches.match(new URL('index.html',BASE).href)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
    return response;
  })));
});
