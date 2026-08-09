const CACHE_PREFIX = 'treino-hard-';
const CACHE_NAME = `${CACHE_PREFIX}v3.2.1`;
const OFFLINE_DOCUMENT = './index.html';

const APP_SHELL = Object.freeze([
  './',
  './index.html',
  './styles.css',
  './js/workouts.js',
  './js/core.js',
  './js/storage.js',
  './js/measurements.js',
  './js/app.js',
  './manifest.webmanifest',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
]);

let lastOfflineFallbackAt = 0;

async function notifyClients(type, detail = {}) {
  let clients;

  try {
    clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
  } catch (error) {
    console.error('[Treino Hard SW] Falha ao localizar clientes para notificação.', error);
    return;
  }

  for (const client of clients) {
    try {
      client.postMessage({
        source: 'treino-hard-service-worker',
        type,
        ...detail
      });
    } catch (error) {
      console.error('[Treino Hard SW] Falha ao enviar mensagem para um cliente.', error);
    }
  }
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  for (const resource of APP_SHELL) {
    let response;

    try {
      response = await fetch(resource, { cache: 'reload' });
    } catch (error) {
      await notifyClients('SW_CACHE_ERROR', {
        resource,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    if (!response.ok) {
      const error = new Error(`Falha ao armazenar ${resource}: HTTP ${response.status}`);
      await notifyClients('SW_CACHE_ERROR', {
        resource,
        message: error.message
      });
      throw error;
    }

    await cache.put(resource, response);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      await cacheAppShell();

      if (self.registration.active) {
        await notifyClients('SW_UPDATE_READY', { version: CACHE_NAME });
      }
    } catch (error) {
      console.error('[Treino Hard SW] Falha ao instalar o pacote offline.', error);
      // Um shell pela metade não pode continuar registrado com o nome da versão:
      // ele fingiria um pacote offline completo.
      try {
        await caches.delete(CACHE_NAME);
      } catch (cleanupError) {
        console.error('[Treino Hard SW] Falha ao descartar o cache incompleto.', cleanupError);
      }
      throw error;
    }
  })());
});

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'GET_CONNECTION_STATE') {
    const source = event.source;
    if (source && typeof source.postMessage === 'function') {
      source.postMessage({
        source: 'treino-hard-service-worker',
        type: 'SW_CONNECTION_STATE',
        offline: Date.now() - lastOfflineFallbackAt < 15000
      });
    }
    return;
  }

  if (event.data.type !== 'SKIP_WAITING') return;

  event.waitUntil((async () => {
    try {
      await self.skipWaiting();
    } catch (error) {
      console.error('[Treino Hard SW] Falha ao ativar a atualização.', error);
      await notifyClients('SW_UPDATE_ERROR', {
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      const obsoleteAppCaches = cacheNames.filter(cacheName =>
        cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME
      );

      await Promise.all(obsoleteAppCaches.map(cacheName => caches.delete(cacheName)));
      await self.clients.claim();
      await notifyClients('SW_OFFLINE_READY', { version: CACHE_NAME });
      await notifyClients('SW_ACTIVATED', { version: CACHE_NAME });
    } catch (error) {
      console.error('[Treino Hard SW] Falha durante a ativação.', error);
      await notifyClients('SW_ACTIVATION_ERROR', {
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  })());
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      lastOfflineFallbackAt = 0;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(OFFLINE_DOCUMENT, response.clone());
      }
      return response;
    }

    const fallback = await caches.match(OFFLINE_DOCUMENT);
    return fallback || response;
  } catch (error) {
    lastOfflineFallbackAt = Date.now();
    console.warn('[Treino Hard SW] Navegação offline; usando o shell local.', error);
    await notifyClients('SW_OFFLINE_FALLBACK', {
      url: request.url,
      message: error instanceof Error ? error.message : String(error)
    });

    const fallback = await caches.match(OFFLINE_DOCUMENT);
    if (fallback) return fallback;

    return new Response(
      'O Treino Hard está offline e o pacote local ainda não foi instalado.',
      {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }
    );
  }
}

async function revalidateAsset(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) return null;

    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.warn('[Treino Hard SW] Não foi possível revalidar um recurso.', request.url, error);
    await notifyClients('SW_ASSET_REVALIDATION_ERROR', {
      url: request.url,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function cacheFirstAsset(request, revalidation) {
  const cached = await caches.match(request);

  if (cached) return cached;

  const response = await revalidation;
  if (response) return response;

  return new Response('Recurso indisponível enquanto o aplicativo está offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Conteúdo externo (incluindo YouTube) fica inteiramente fora do cache da PWA.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const revalidation = revalidateAsset(request);
  event.waitUntil(revalidation);
  event.respondWith(cacheFirstAsset(request, revalidation));
});
