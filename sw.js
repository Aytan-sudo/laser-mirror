// Coquille statique, réseau d'abord et cache en secours : une version publiée
// arrive sans manœuvre du joueur, et le cache ne sert qu'hors ligne. Le nom du
// cache suit la version du jeu, si bien qu'une mise à jour ne conserve jamais
// un ancien moteur.

const VERSION = 'laser-mirror-1.4.1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/palettes.css',
  'css/board.css',
  'css/features.css',
  'js/app.js',
  'js/config.js',
  'js/engine.js',
  'js/generator.js',
  'js/rng.js',
  'js/share.js',
  'js/sound.js',
  'js/storage.js',
  'assets/icon.svg',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./'))),
  );
});
