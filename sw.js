/* Wareamah Walk service worker — app shell + offline maps + opportunistic media cache */
const VERSION = '2.0.0';
const SHELL_CACHE = `wareamah-shell-${VERSION}`;
const MEDIA_CACHE = `wareamah-media-${VERSION}`;
const OFFLINE_URL = './offline.html';
const OFFLINE_IMAGE_URL = './assets/offline-media.svg';

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './styles.css',
  './tour-data.js',
  './app.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/offline-media.svg',
  './assets/convict-plateau-map.jpeg',
  './assets/dockyard-map.jpeg',
  './assets/icons/apple-touch-icon-180.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/screenshot-wide.png',
  './assets/icons/screenshot-mobile.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const expected = new Set([SHELL_CACHE, MEDIA_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wareamah-') && !expected.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'CACHE_URLS') {
    const port = event.ports && event.ports[0];
    event.waitUntil(cacheUrls(data.urls || [], port));
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./index.html', response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    return (await caches.match('./index.html')) || (await caches.match(OFFLINE_URL));
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(response => {
      if (isCacheable(response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

async function cacheFirstImage(request) {
  const shell = await caches.open(SHELL_CACHE);
  const media = await caches.open(MEDIA_CACHE);
  const cached = await media.match(request) || await shell.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheable(response)) media.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    return (await shell.match(OFFLINE_IMAGE_URL)) || Response.error();
  }
}

async function cacheUrls(urls, port) {
  const media = await caches.open(MEDIA_CACHE);
  let saved = 0;
  let failed = 0;
  const unique = [...new Set(urls)].filter(Boolean);

  for (const rawUrl of unique) {
    try {
      const absoluteUrl = new URL(rawUrl, self.location.href);
      const sameOrigin = absoluteUrl.origin === self.location.origin;
      const request = sameOrigin
        ? new Request(absoluteUrl.href, { cache: 'reload' })
        : new Request(absoluteUrl.href, { mode: 'no-cors', cache: 'reload' });
      const response = await fetch(request);
      if (!isCacheable(response)) throw new Error(`Not cacheable: ${response.status}`);
      await media.put(request, response.clone());
      saved += 1;
    } catch (error) {
      failed += 1;
    }
  }

  if (port) port.postMessage({ type: 'CACHE_URLS_DONE', saved, failed, total: unique.length });
}

function isCacheable(response) {
  return Boolean(response && (response.ok || response.type === 'opaque'));
}
