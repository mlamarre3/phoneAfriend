const CACHE_NAME = "phoneafriend-v1.1";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    ".db.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", (Event) => {
    Event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (Event) => {
    Event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (Event) => {
    const req = Event.request;
    const url = new URL(req.url);

    if (url.origin !== self.location.origin) return;

    Event.respondWith(
        caches.match(req).then(cached => cached || fetch(req))
    );

});
