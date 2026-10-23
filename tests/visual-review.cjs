'use strict';

// Developer QA only: a disposable browser context and entirely fictitious data.
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {readLegacyState} = require('./legacy-fixture.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output', 'playwright', process.env.REVIEW_URL ? '3.7.2-public' : '3.7.2-local');

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
    const theme = await page.evaluate(async () => {
      const css = getComputedStyle(document.documentElement);
      const manifest = await fetch(document.querySelector('link[rel="manifest"]').href).then(r => r.json());
      const logo = document.querySelector('.brand-logo img');
      return {
        background: css.getPropertyValue('--bg').trim(), action: css.getPropertyValue('--action').trim(),
        meta: document.querySelector('meta[name="theme-color"]').content,
        manifest: {theme: manifest.theme_color, background: manifest.background_color},
        logo: {loaded: logo.complete && logo.naturalWidth === 512, width: logo.naturalWidth, height: logo.naturalHeight}
      };
    });
    assert.deepEqual(theme, {
      background: '#111315', action: '#ccd2d9', meta: '#111315',
      manifest: {theme: '#111315', background: '#111315'},
      logo: {loaded: true, width: 512, height: 512}
    });
    const assetNames = ['logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
    const expectedAssets = Object.fromEntries(assetNames.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, name))).digest('hex')]));
    const assetHashes = await page.evaluate(async names => Object.fromEntries(await Promise.all(names.map(async name => {
      const response = await fetch(new URL(name, location.href));
      if (!response.ok) throw new Error(`Asset indisponível: ${name}`);
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      return [name, Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')];
    }))), assetNames);
    assert.deepEqual(assetHashes, expectedAssets, 'logo e ícones servidos devem corresponder exatamente ao pacote revisado');
    await page.screenshot({path: path.join(OUTPUT, 'mobile-today.png')});
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
    assert.equal(migration.version, '3.7.2');
    assert.equal(migration.schema, 13);
    assert.equal(migration.history, 4);
    assert.deepEqual(migration.curl, ['bilateral']);
    assert.ok(migration.backups > 0);
    const reviewedVideos = await page.evaluate(() => Object.fromEntries(
      ['leg_press_45_unilateral', 'leg_extension_unilateral', 'calf_standing_unilateral', 'vacuum_standing', 'vacuum_all_fours', 'calf_leg_press_unilateral', 'calf_seated_unilateral', 'mob_hip_butterfly', 'unilateral_row_plate_loaded', 'chest_press_barbell', 'incline_press_dumbbell']
        .map(key => {const v = THFData.VIDEOS[key]; return [key, {id: v.youtubeId, scope: v.coverageScope, available: v.availability, embed: v.embedCompatible, start: v.startSeconds, end: v.endSeconds}];})
    ));
    assert.deepEqual(Object.values(reviewedVideos).map(v => v.id), ['ausscKK91R8', '7HcK7fmYJP0', 'fSQ5LGWfnYU', 'TU9XSn6TYxs', 'TU9XSn6TYxs', 'm4ky4df0t4Y', 'MhUzkSK2Slk', 'VFd1fO_H7do', 'rXAP7YQF6ps', 'EZMYCLKuGow', 'ZvNNhS9csqw']);
    assert.ok(Object.values(reviewedVideos).every(v => v.scope === 'exact' && v.available === 'available' && v.embed === true));
    assert.deepEqual([reviewedVideos.vacuum_standing.start, reviewedVideos.vacuum_standing.end, reviewedVideos.vacuum_all_fours.start, reviewedVideos.vacuum_all_fours.end], [138, 153, 154, 167]);
    assert.deepEqual(['calf_leg_press_unilateral', 'calf_seated_unilateral', 'mob_hip_butterfly', 'unilateral_row_plate_loaded'].map(key => [reviewedVideos[key].start, reviewedVideos[key].end]), [[25, 55], [0, 10], [0, 17], [3, 15]]);
    assert.equal(await page.evaluate(() => THFData.CATALOG.unilateral_row_machine.variants.find(v => v.id === 'plate_loaded').videoKey), 'unilateral_row_plate_loaded');
    assert.deepEqual([reviewedVideos.chest_press_barbell.start, reviewedVideos.chest_press_barbell.end, reviewedVideos.incline_press_dumbbell.start, reviewedVideos.incline_press_dumbbell.end], [2, 24, 0, 0]);
    await page.reload({waitUntil: 'networkidle'});
    await ready();
    await page.getByRole('tab', {name: 'Empurrar A', exact: true}).click();
    const guide = page.locator('.session-effort-guide');
    const uiRefinements = {
      guideCollapsed: await guide.evaluate(node => !node.open),
      actionsLayout: await page.locator('.session-actions').evaluate(node => getComputedStyle(node).display),
      videoClipsAreBlocks: await page.locator('.vclip').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => getComputedStyle(node).display === 'block'))
    };
    assert.deepEqual(uiRefinements, {guideCollapsed: true, actionsLayout: 'grid', videoClipsAreBlocks: true});
    await page.locator('.session-card').screenshot({path: path.join(OUTPUT, 'mobile-session-actions.png')});
    await guide.locator('summary').press('Enter');
    assert.match(await guide.innerText(), /RIR 0 não é obrigatório/);
    await guide.screenshot({path: path.join(OUTPUT, 'mobile-effort-guide.png')});
    await guide.locator('summary').press('Enter');
    await page.getByRole('button', {name: 'Ir ao próximo pendente', exact: true}).click();
    assert.equal(await page.locator('#exercicio-chest_press_machine .set-row:not(.is-warmup) .set-field-load input').first().evaluate(node => node === document.activeElement), true);
    await page.screenshot({path: path.join(OUTPUT, 'mobile-next-pending.png')});
    await page.locator('#exercicio-chest_press_machine [data-action="timer-start-rest"]').click();
    assert.equal(await page.locator('#timer-bar [data-action="timer-undo"]').isDisabled(), true, 'descanso manual sem série confirmada não oferece desfazer');
    await page.locator('#timer-bar').screenshot({path: path.join(OUTPUT, 'mobile-timer-context.png')});
    await page.locator('#timer-bar [data-action="timer-stop"]').click();
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
    await page.getByRole('tab', {name: 'Puxar B', exact: true}).click();
    await page.locator('#exercicio-unilateral_row_machine [data-action="variation-pick"][data-variation-id="plate_loaded"]').click();
    await ready();
    assert.equal(await page.locator('#exercicio-unilateral_row_machine [data-video-key="unilateral_row_plate_loaded"]').count(), 1);
    await page.locator('#exercicio-unilateral_row_machine').screenshot({path: path.join(OUTPUT, 'mobile-plate-loaded-row.png')});
    await page.getByRole('tab', {name: 'Empurrar B', exact: true}).click();
    for (const [exerciseId, variantId, videoKey, file] of [
      ['chest_press_machine', 'barbell', 'chest_press_barbell', 'mobile-bench-barbell.png'],
      ['incline_press_machine', 'dumbbell', 'incline_press_dumbbell', 'mobile-incline-dumbbell.png']
    ]) {
      const card = page.locator(`#exercicio-${exerciseId}`);
      await card.locator(`[data-variation-id="${variantId}"]`).click();
      await ready();
      assert.equal(await card.locator(`[data-video-key="${videoKey}"]`).count(), 1);
      await card.screenshot({path: path.join(OUTPUT, file)});
    }
    await page.getByRole('tab', {name: 'Medidas', exact: true}).click();
    assert.equal(await page.locator('.measurement-form').evaluate(node => getComputedStyle(node).rowGap), '16px');
    await page.locator('.measurement-form').screenshot({path: path.join(OUTPUT, 'mobile-measurement-form.png')});
    await page.locator('.measurement-form [name="weight"]').fill('107,5');
    await page.getByRole('tab', {name: 'Hoje', exact: true}).click();
    await page.getByRole('tab', {name: 'Medidas', exact: true}).click();
    assert.equal(await page.locator('.measurement-form [name="weight"]').inputValue(), '107,5');
    assert.equal(await page.locator('#measurement-draft-status').getAttribute('data-dirty'), 'true');
    await page.locator('.measurement-form').screenshot({path: path.join(OUTPUT, 'mobile-measurement-draft.png')});
    await page.getByRole('button', {name: 'Limpar formulário', exact: true}).click();
    await page.getByRole('button', {name: 'Descartar rascunho', exact: true}).click();
    assert.equal(await page.locator('.measurement-form [name="weight"]').inputValue(), '');
    await page.locator('#measurement-pair-thigh > summary').click();
    await page.locator('.measurement-side-history').screenshot({path: path.join(OUTPUT, 'mobile-measures.png')});
    await page.locator('.body-map-stage').screenshot({path: path.join(OUTPUT, 'mobile-body-map.png')});
    const bodyComparison = await page.evaluate(() => ({
      current: getComputedStyle(document.querySelector('.body-current .body-mass')).strokeDasharray,
      previous: getComputedStyle(document.querySelector('.body-previous .body-mass')).strokeDasharray
    }));
    assert.equal(bodyComparison.current, 'none');
    assert.notEqual(bodyComparison.previous, 'none', 'a comparação precisa diferenciar as linhas sem depender de cor');
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
    assert.ok(caches.includes('treino-hard-v3.7.2'));
    await context.setOffline(true);
    await page.reload({waitUntil: 'domcontentloaded'});
    await ready();
    await page.getByRole('tab', {name: 'Medidas', exact: true}).click();
    assert.equal(await page.locator('.measurement-side-history').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({url: baseUrl, theme, assetHashes, uiRefinements, bodyComparison, migration, reviewedVideos, autosaveWithoutBlur: true, caches, offline: true, errors, screenshots: fs.readdirSync(OUTPUT).map(file => path.join(OUTPUT, file))}, null, 2));
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
