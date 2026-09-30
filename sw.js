/* CyberZone — عامل الخدمة: يحفظ ملفات التطبيق ليعمل دون اتصال */
const CACHE = 'cyberzone-v2.2.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/css/fonts.css',
  './assets/js/billing.js',
  './assets/js/utils.js',
  './assets/js/icons.js',
  './assets/js/native.js',
  './assets/js/store.js',
  './assets/js/views.js',
  './assets/js/reports.js',
  './assets/js/actions.js',
  './assets/js/settings.js',
  './assets/js/cash.js',
  './assets/js/app.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ملفات التطبيق: الشبكة أولاً ثم النسخة المحفوظة (ليصل أي تحديث فوراً)
// الخطوط: النسخة المحفوظة أولاً
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isFont) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
    })
  );
});
