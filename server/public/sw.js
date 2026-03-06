const CACHE_NAME = 'ritaj-pos-v4-6';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/pos.css',
    './js/core/api.js',
    './js/core/app.js',
    './js/core/sounds.js',
    './js/core/state.js',
    './js/core/ui.js',
    './js/modules/admin.js',
    './js/modules/cart.js',
    './js/modules/catalog.js',
    './js/modules/clients.js',
    './js/modules/dashboard.js',
    './js/modules/delivery.js',
    './js/modules/discount.js',
    './js/modules/history.js',
    './js/modules/numpad.js',
    './js/modules/payment.js',
    './js/modules/pos.js',
    './js/modules/register.js',
    './js/modules/setup.js',
    './js/modules/shortcuts.js',
    './js/modules/stats.js',
    './js/modules/stock.js',
    './js/modules/ticket.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/api/')) return;

    e.respondWith(
        caches.match(e.request).then((response) => {
            if (response) return response;
            return fetch(e.request).then(
                function (response) {
                    if (!response || response.status !== 200 || response.type !== 'basic' || !e.request.url.startsWith('http')) {
                        return response;
                    }
                    var responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(e.request, responseToCache).catch(function (err) {
                            console.warn('Erreur SW Cache Put:', err);
                        });
                    }).catch(function (err) {
                        console.warn('Erreur SW Cache Open:', err);
                    });
                    return response;
                }
            );
        }).catch(() => {
            // Offline
        })
    );
});
