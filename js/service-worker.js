/* VERSION et PRECACHE sont injectés par sw.php. */
'use strict';

const BASE = self.registration.scope;
const PREFIX = 'wordox-' + encodeURIComponent(BASE) + '-';
const CACHE = PREFIX + VERSION;
const URLS = new Set(PRECACHE.map(path => new URL(path, BASE).href));
const HOME = new URL('index.php', BASE).href;

self.addEventListener('install', event => {
    // L'installation échoue si un fichier manque : le précédent cache reste actif.
    event.waitUntil(caches.open(CACHE).then(cache =>
        cache.addAll(Array.from(URLS, url => new Request(url, { cache: 'reload' })))
    ));
    // Ne pas interrompre une partie : activation à la fermeture des anciennes fenêtres.
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
            .map(key => caches.delete(key))
    )));
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    const home = new URL(HOME);
    const isHome = event.request.mode === 'navigate' && url.origin === home.origin &&
        (url.pathname === home.pathname || url.pathname === new URL(BASE).pathname);

    // Les invitations (?join=...) conservent leur URL. L'API et les autres routes
    // restent sur le réseau et ne sont jamais mises en cache.
    if (!isHome && !URLS.has(url.href)) return;
    event.respondWith(caches.open(CACHE).then(cache =>
        cache.match(isHome ? HOME : event.request).then(response => response || fetch(event.request))
    ));
});
