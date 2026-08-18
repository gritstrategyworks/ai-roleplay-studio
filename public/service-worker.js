const CACHE='ai-roleplay-studio-v1-54-announcer-avatar';
const BASE=new URL('./',self.location.href);
const CORE=['index.html','styles.css?v=1.54','auth.css?v=1.54','auth.js?v=1.54','app.js?v=1.54','advisor.js?v=1.54','scenario-design.js?v=1.54','manifest.webmanifest','robots.txt','sitemap.xml','assets/icon.svg','assets/og-image.png','assets/avatars/portraits/advisor.webp'].map(path=>new URL(path,BASE).href);
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
