const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://example.test';
const NAVIGATION = {url: `${ORIGIN}/treino-hard/?v=new`, method: 'GET', mode: 'navigate'};
const ASSET = {url: `${ORIGIN}/treino-hard/js/app.js`, method: 'GET', mode: 'cors'};

function boot(options = {}) {
  const messages = [];
  const events = new Map();
  const opened = [];
  const writes = [];
  const deletions = [];
  let reads = 0;
  let claims = 0;
  const cache = {
    async put(resource, response) {
      if (options.failPut) throw new Error('QuotaExceededError');
      writes.push({resource, body: await response.text()});
    },
    async match() {
      reads++;
      if (options.failRead) throw new Error('Cache Storage inaccessible');
      return options.cached ? new Response('cached-v-old') : undefined;
    }
  };
  const context = vm.createContext({
    URL,
    Response,
    Date,
    console: {warn() {}, error() {}},
    caches: {
      async open(name) {
        opened.push(name);
        if (options.failOpen) throw new Error('Cache Storage inaccessible');
        return cache;
      },
      async keys() { return options.cacheNames || []; },
      async delete(name) { deletions.push(name); return true; }
    },
    async fetch(request, fetchOptions) {
      if (options.networkError) throw new Error('Network unavailable');
      if (request === ASSET) assert.equal(fetchOptions.cache, 'no-cache');
      return new Response('network-v-new', {
        status: options.httpStatus || 200,
        headers: {'content-type': options.contentType || 'text/html'}
      });
    },
    self: {
      location: {origin: ORIGIN},
      registration: {active: options.active || null},
      clients: {
        async matchAll() { return [{postMessage(message) { messages.push(message); }}]; },
        async claim() { claims++; }
      },
      addEventListener(name, listener) { events.set(name, listener); }
    }
  });
  vm.runInContext(`${SOURCE}\nglobalThis.worker = {networkFirstNavigation, networkFirstAsset, CACHE_NAME, APP_SHELL};`, context);
  return {
    worker: context.worker,
    messages,
    opened,
    writes,
    deletions,
    events,
    get reads() { return reads; },
    get claims() { return claims; },
    connectionState() {
      let message;
      events.get('message')({
        data: {type: 'GET_CONNECTION_STATE'},
        source: {postMessage(value) { message = value; }}
      });
      return message;
    },
    async dispatch(type) {
      let promise;
      events.get(type)({waitUntil(value) { promise = value; }});
      await promise;
    }
  };
}

for (const [name, method, request] of [
  ['navigation', 'networkFirstNavigation', NAVIGATION],
  ['asset', 'networkFirstAsset', ASSET]
]) {
  for (const failure of ['failOpen', 'failPut']) {
    for (const cached of [false, true]) {
      test(`${name}: valid network response survives ${failure}, cached=${cached}`, async () => {
        const app = boot({[failure]: true, cached});
        const response = await app.worker[method](request);
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'network-v-new');
        assert.equal(app.reads, 0, 'a successful fetch must not fall back to an older copy');
        assert.equal(app.connectionState().offline, false);
        assert.deepEqual(app.messages.map(item => item.type), ['SW_CACHE_ERROR']);
        assert.equal(app.messages[0].operation, 'write');
      });
    }
  }

  test(`${name}: offline request uses the current version cache`, async () => {
    const app = boot({networkError: true, cached: true});
    const response = await app.worker[method](request);
    assert.equal(await response.text(), 'cached-v-old');
    assert.deepEqual(app.opened, [app.worker.CACHE_NAME]);
    assert.equal(app.messages.some(item => item.type === 'SW_CACHE_ERROR'), false);
    if (name === 'navigation') assert.equal(app.connectionState().offline, true);
  });

  test(`${name}: offline without a local copy responds with 503`, async () => {
    const app = boot({networkError: true});
    const response = await app.worker[method](request);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /offline/);
  });

  for (const failure of ['failOpen', 'failRead']) {
    test(`${name}: offline cache ${failure} is caught and reported as storage failure`, async () => {
      const app = boot({networkError: true, [failure]: true});
      const response = await app.worker[method](request);
      assert.equal(response.status, 503);
      assert.match(await response.text(), /não foi possível acessar a cópia local/);
      assert.equal(app.messages.at(-1).type, 'SW_CACHE_ERROR');
      assert.equal(app.messages.at(-1).operation, 'read');
    });
  }

  test(`${name}: HTTP error falls back to an existing local copy`, async () => {
    const app = boot({httpStatus: 502, cached: true});
    const response = await app.worker[method](request);
    assert.equal(await response.text(), 'cached-v-old');
    assert.equal(app.writes.length, 0);
    assert.equal(app.connectionState().offline, false);
    assert.equal(app.messages.length, 0);
  });

  for (const failure of [null, 'failOpen', 'failRead']) {
    test(`${name}: HTTP error is preserved without fallback, failure=${failure}`, async () => {
      const app = boot({httpStatus: 502, ...(failure ? {[failure]: true} : {})});
      const response = await app.worker[method](request);
      assert.equal(response.status, 502);
      assert.equal(await response.text(), 'network-v-new');
      assert.equal(app.messages.some(item => item.type === 'SW_OFFLINE_FALLBACK'), false);
      assert.equal(app.messages.some(item => item.type === 'SW_ASSET_REVALIDATION_ERROR'), false);
      assert.equal(app.connectionState().offline, false);
    });
  }

  test(`${name}: successful caching does not consume the network response`, async () => {
    const app = boot();
    const response = await app.worker[method](request);
    assert.equal(await response.text(), 'network-v-new');
    assert.equal(app.writes.length, 1);
    assert.equal(app.writes[0].body, 'network-v-new');
    assert.equal(app.messages.length, 0);
  });
}

test('navigation does not cache a successful non-HTML document', async () => {
  const app = boot({contentType: 'application/json'});
  const response = await app.worker.networkFirstNavigation(NAVIGATION);
  assert.equal(await response.text(), 'network-v-new');
  assert.equal(app.opened.length, 0);
});

test('install still requires the complete app shell before reporting an update', async () => {
  const app = boot({active: {}});
  await app.dispatch('install');
  assert.equal(app.writes.length, app.worker.APP_SHELL.length);
  assert.deepEqual(app.messages.map(item => item.type), ['SW_UPDATE_READY']);
});

test('install still rejects incomplete caches after a quota failure', async () => {
  const app = boot({failPut: true, active: {}});
  await assert.rejects(app.dispatch('install'), /QuotaExceededError/);
  assert.deepEqual(app.deletions, [app.worker.CACHE_NAME]);
  assert.equal(app.messages.some(item => item.type === 'SW_UPDATE_READY'), false);
});

test('activation removes old app caches and preserves unrelated caches', async () => {
  const currentName = boot().worker.CACHE_NAME;
  const app = boot({cacheNames: ['treino-hard-v3.6.4', currentName, 'other-app-v1']});
  await app.dispatch('activate');
  assert.deepEqual(app.deletions, ['treino-hard-v3.6.4']);
  assert.equal(app.claims, 1);
  assert.deepEqual(app.messages.map(item => item.type), ['SW_OFFLINE_READY', 'SW_ACTIVATED']);
});
