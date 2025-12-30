// Service Worker for مركز الصيانة PWA
// Version is based on build timestamp for automatic cache busting
const SW_VERSION = 'v2.0.0';
const CACHE_NAME = `service-center-${SW_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Resources to cache on install
const PRECACHE_RESOURCES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html',
    '/icons/android-chrome-192x192.png',
    '/icons/android-chrome-512x512.png'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${SW_VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_RESOURCES);
        })
    );
    // Don't skip waiting automatically - let the app control when to update
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${SW_VERSION}`);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('service-center-') && name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`[SW] Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Listen for skip waiting message from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting triggered by app');
        self.skipWaiting();
    }
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip API requests and external resources
    if (url.pathname.startsWith('/api') ||
        url.hostname.includes('supabase') ||
        !url.origin.includes(self.location.origin)) {
        return;
    }

    // For navigation requests, use network first strategy
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the response
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache, then offline page
                    return caches.match(event.request).then((response) => {
                        return response || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // For static assets, use stale-while-revalidate
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // Only cache if it's a valid response
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    // Return cached response immediately, or wait for network
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Default: Network first for everything else
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Listen for push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'إشعار جديد',
        icon: '/icons/android-chrome-192x192.png',
        badge: '/icons/favicon-32x32.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [100, 50, 100],
        data: data.url || '/',
        tag: data.tag || 'default',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'مركز الصيانة', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
