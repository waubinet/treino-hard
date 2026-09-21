const CACHE_PREFIX = 'treino-hard-';
const CACHE_NAME = `${CACHE_PREFIX}v3.6.5`;
const OFFLINE_DOCUMENT = './index.html';

const APP_SHELL = Object.freeze([
  './',
  './index.html',
  './styles.css',
  './js/workouts.js',
  './js/legacy-v12.js',
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

async function updateRuntimeCache(resource, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(resource, response.clone());
  } catch (error) {
    // A cópia offline é opcional para uma resposta que já chegou da rede.
    // Quota ou indisponibilidade do Cache Storage não podem descartá-la.
    await notifyClients('SW_CACHE_ERROR', {
      operation: 'write',
      resource: typeof resource === 'string' ? resource : resource.url,
      message: 'Não foi possível atualizar a cópia offline. O conteúdo recebido da internet continua disponível.'
    });
  }
}

async function readRuntimeCache(resource) {
  try {
    const cache = await caches.open(CACHE_NAME);
    return {response: await cache.match(resource), unavailable: false};
  } catch (error) {
    await notifyClients('SW_CACHE_ERROR', {
      operation: 'read',
      resource: typeof resource === 'string' ? resource : resource.url,
      message: 'Não foi possível acessar a cópia offline. Verifique o espaço e as permissões de armazenamento do navegador.'
    });
    return {response: null, unavailable: true};
  }
}

async function networkFirstNavigation(request) {
  let response;

  try {
    response = await fetch(request);
    lastOfflineFallbackAt = 0;
  } catch (error) {
    lastOfflineFallbackAt = Date.now();
    console.warn('[Treino Hard SW] Rede indisponível; tentando o shell local.', error);
    await notifyClients('SW_OFFLINE_FALLBACK', {
      url: request.url,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  if (response && response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      await updateRuntimeCache(OFFLINE_DOCUMENT, response);
    }
    return response;
  }

  const fallback = await readRuntimeCache(OFFLINE_DOCUMENT);
  if (fallback.response) return fallback.response;
  if (response) return response;

  return new Response(
    fallback.unavailable
      ? 'A rede está indisponível e não foi possível acessar a cópia local do Treino Hard.'
      : 'O Treino Hard está offline e o pacote local ainda não foi instalado.',
    {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }
  );
}

async function revalidateAsset(request) {
  let response;

  try {
    response = await fetch(request, {cache: 'no-cache'});
  } catch (error) {
    console.warn('[Treino Hard SW] Não foi possível revalidar um recurso.', request.url, error);
    await notifyClients('SW_ASSET_REVALIDATION_ERROR', {
      url: request.url,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  if (response.ok) await updateRuntimeCache(request, response);
  return response;
}

async function networkFirstAsset(request) {
  const response = await revalidateAsset(request);
  if (response && response.ok) return response;

  const fallback = await readRuntimeCache(request);
  if (fallback.response) return fallback.response;
  if (response) return response;

  return new Response(fallback.unavailable
    ? 'A rede está indisponível e não foi possível acessar a cópia local deste recurso.'
    : 'Recurso indisponível enquanto o aplicativo está offline.', {
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

  // Os nomes dos arquivos são estáveis entre versões. Servir primeiro uma
  // cópia antiga enquanto o HTML já é novo poderia misturar esquemas de código
  // na mesma abertura. Online, a rede vence; offline, o shell versionado assume.
  event.respondWith(networkFirstAsset(request));
});
