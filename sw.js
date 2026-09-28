/* Offline support: keeps a copy of the app so it opens without internet.
   Change VERSION whenever you upload new files so visitors get the update. */
const VERSION = 'pd-v1';
const FILES = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png',
  'js/icons.js', 'js/i18n.js', 'js/data.js', 'js/utils.js', 'js/ui.js', 'js/views.js',
  'js/projects.js', 'js/tasks.js', 'js/team.js', 'js/calendar.js', 'js/export.js', 'js/pwa.js', 'js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Show the saved copy straight away, and quietly fetch a fresh one for next time
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
