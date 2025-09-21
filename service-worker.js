// Cache-first SW (final v3)
const CACHE = 'rischio-impresa-final-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=3',
  './app.js?v=3',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k)))) .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(r=> r || fetch(e.request)));
});
