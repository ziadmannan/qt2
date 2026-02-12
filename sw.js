const CACHE_NAME = 'quran-tracker-v1';
const ASSETS = [
    './',
    './index.html',
    './surahs.json',
    './manifest.json',
    './tick.svg',
    './book.svg',
    './restart.svg',
    './filter.svg',
    './manage.svg',
    './icon.png'
];

// Install event: Cache all files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching app shell...');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch event: Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});