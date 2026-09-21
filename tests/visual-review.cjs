'use strict';

// Developer QA only: a disposable browser context and entirely fictitious data.
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {readLegacyState} = require('./legacy-fixture.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(os.tmpdir(), 'treino-hard-3.6-visual-review');

async function main() {
  let server;
  let baseUrl = process.env.REVIEW_URL;
  if (!baseUrl) {
    server = http.createServer((request, response) => {
      const resource = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(ROOT, resource === '/' ? 'index.html' : resource.slice(1));
      if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
      fs.readFile(file, (error, bytes) => {
        if (error) return response.writeHead(404).end();
        const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json'}[path.extname(file)] || 'application/octet-stream';
        response.writeHead(200, {'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-store'}).end(bytes);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
  }
  fs.mkdirSync(OUTPUT, {recursive: true});
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'allow'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.clock.setFixedTime(new Date(2026, 8, 7, 8, 0, 0));
    await page.goto(baseUrl, {waitUntil: 'networkidle'});
    const ready = () => page.waitForFunction(() => /Salvo neste aparelho/.test(document.querySelector('#save-state').textContent));
    await ready();
    const legacy = readLegacyState();
    await page.evaluate(value => new Promise((resolve, reject) => {
      const request = indexedDB.open('treino-hard-v3');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(value, 'current');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), legacy);
    await page.reload({waitUntil: 'networkidle'});
    await ready();
    const migration = await page.evaluate(async () => {
      const storage = new THFStorage.AppStorage();
      const state = await storage.init();
      await storage.automaticBackup(state, true);
      const data = {version: THFCore.APP_VERSION, schema: state.schemaVersion, revision: state.revision, history: state.sessions.filter(s => s.id.startsWith('fixture-')).length, curl: state.sessions.find(s => s.id === 'fixture-session-legs-partial').exercises.filter(log => log.exerciseId === 'leg_curl').map(log => log.side), backups: (await storage.listBackups()).length};
      state.measurements = [
        THFCore.normalizeMeasurement({id: 'qa-first', date: '2026-08-01', thighRight: '58', thighLeft: '61.5', calfRight: '39', calfLeft: '40', height: '180', weight: '110', waist: '112', savedAt: '2026-08-01T12:00:00.000Z'}, 0),
        THFCore.normalizeMeasurement({id: 'qa-second', date: '2026-09-01', thighRight: '59', thighLeft: '62', calfRight: '39.5', calfLeft: '40.2', height: '180', weight: '108', waist: '110', savedAt: '2026-09-01T12:00:00.000Z'}, 1)
      ];
      await storage.writeDocument(state, state.revision, {});
      storage.close();
      return data;
    });
    assert.equal(migration.version, '3.6.5');
    assert.equal(migration.schema, 13);
    assert.equal(migration.history, 4);
    assert.deepEqual(migration.curl, ['bilateral']);
    assert.ok(migration.backups > 0);
    await page.reload({waitUntil: 'networkidle'});
    await ready();
    await page.getByRole('tab', {name: 'Empurrar A', exact: true}).click();
    const load = page.locator('#exercicio-chest_press_machine .set-row:not(.is-warmup) .set-field-load input').first();
    await load.fill('37');
    await ready();
    assert.equal(await load.evaluate(el => document.activeElement === el), true);
    await page.reload({waitUntil: 'networkidle'});
    await ready();
    await page.getByRole('tab', {name: 'Empurrar A', exact: true}).click();
    assert.equal(await load.inputValue(), '37', 'autosave deve sobreviver ao reload sem blur');
    await page.getByRole('tab', {name: 'Pernas A', exact: true}).click();
    await page.locator('#exercicio-leg_press_45').screenshot({path: path.join(OUTPUT, 'mobile-leg-press.png')});
    await page.getByRole('tab', {name: 'Medidas', exact: true}).click();
    await page.locator('#measurement-pair-thigh > summary').click();
    await page.locator('.measurement-side-history').screenshot({path: path.join(OUTPUT, 'mobile-measures.png')});
    await page.locator('.table-scroll').first().focus();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({width, height: 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true, `global overflow at ${width}`);
    }
    await page.locator('.measurement-side-history').screenshot({path: path.join(OUTPUT, 'desktop-measures.png')});
    await page.getByRole('tab', {name: 'Evolução', exact: true}).click();
    await page.locator('#mobility-history-details > summary').click();
    await page.locator('.mobility-history-card').screenshot({path: path.join(OUTPUT, 'mobility.png')});
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({waitUntil: 'networkidle'});
    const caches = await page.evaluate(() => globalThis.caches.keys());
    assert.ok(caches.includes('treino-hard-v3.6.5'));
    await context.setOffline(true);
    await page.reload({waitUntil: 'domcontentloaded'});
    await ready();
    await page.getByRole('tab', {name: 'Medidas', exact: true}).click();
    assert.equal(await page.locator('.measurement-side-history').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({url: baseUrl, migration, autosaveWithoutBlur: true, caches, offline: true, errors, screenshots: fs.readdirSync(OUTPUT).map(file => path.join(OUTPUT, file))}, null, 2));
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
