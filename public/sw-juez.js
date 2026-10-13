// Service worker de la tablet del juez (alcance /juez).
// Permite abrir la tablet sin red. No toca Firestore ni Firebase Auth: esas
// conexiones van a otros dominios y pasan directo a la red.
//
// - Página (/juez): primero la red; sin red, la última versión guardada.
//   Así, con conexión siempre se carga la versión publicada más nueva.
// - /assets/*: nombres con hash que nunca cambian, se sirven desde la caché.
// - Íconos y manifiesto: desde la caché, actualizándose en segundo plano.

const CACHE = 'juez-v1';
const PAGINA = '/juez';

async function guardarPagina(respuesta) {
  const cache = await caches.open(CACHE);
  await cache.put(PAGINA, respuesta.clone());
  // Descarga los recursos que usa esta versión y borra los de versiones anteriores.
  const html = await respuesta.text();
  const recursos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(recursos.filter((url, i) => recursos.indexOf(url) === i));
  const guardados = await cache.keys();
  await Promise.all(guardados
    .filter((req) => new URL(req.url).pathname.startsWith('/assets/') && !recursos.includes(new URL(req.url).pathname))
    .map((req) => cache.delete(req)));
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(fetch(PAGINA, { cache: 'no-store' }).then(guardarPagina).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(caches.keys()
    .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    evento.respondWith(fetch(request, { cache: 'no-store' })
      .then((respuesta) => {
        if (respuesta.ok) evento.waitUntil(guardarPagina(respuesta.clone()));
        return respuesta;
      })
      .catch(async () => (await caches.match(PAGINA)) || Response.error()));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(caches.match(request).then((guardada) => guardada || fetch(request).then(async (respuesta) => {
      if (respuesta.ok) (await caches.open(CACHE)).put(request, respuesta.clone());
      return respuesta;
    })));
    return;
  }

  if (/^\/(juez[-.]|favicon)/.test(url.pathname)) {
    evento.respondWith(caches.open(CACHE).then(async (cache) => {
      const guardada = await cache.match(request);
      const red = fetch(request).then((respuesta) => {
        if (respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
      }).catch(() => guardada);
      return guardada || red;
    }));
  }
});
