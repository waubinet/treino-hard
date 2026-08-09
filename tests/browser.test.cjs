'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png'
});

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const requested = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = requested === '/' ? 'index.html' : decodeURIComponent(requested.slice(1));
    const absolute = path.resolve(ROOT, relative);
    if (!absolute.startsWith(`${ROOT}${path.sep}`) && absolute !== path.join(ROOT, 'index.html')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(absolute, (error, bytes) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, {'Content-Type': 'text/plain; charset=utf-8'}).end(error.message);
        return;
      }
      response.writeHead(200, {'Content-Type': MIME[path.extname(absolute)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(bytes);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function waitAppReady(page) {
  await page.locator('#save-state').waitFor({state: 'visible'});
  await page.waitForFunction(() => /Salvo|Somente leitura|Importação concluída|Snapshot restaurado|Dados recarregados|Falha/
    .test(document.getElementById('save-state')?.textContent || ''));
}

// Abre o app num servidor efêmero próprio e devolve tudo o que os cenários usam.
// `fixedTime` só congela Date/new Date(); os temporizadores continuam reais.
async function openApp(t, options) {
  const settings = options || {};
  const server = await startStaticServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless: true, executablePath: CHROME});
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: settings.viewport || {width: 1280, height: 800},
    serviceWorkers: settings.serviceWorkers || 'allow',
    reducedMotion: settings.reducedMotion,
    acceptDownloads: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  if (settings.fixedTime) await page.clock.setFixedTime(settings.fixedTime);
  if (!settings.skipGoto) {
    await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
    await waitAppReady(page);
  }
  return {server, baseUrl, browser, context, page, errors};
}

async function reloadApp(page) {
  await page.reload({waitUntil: 'domcontentloaded'});
  await waitAppReady(page);
}

// Lê o documento persistido diretamente do IndexedDB, sem passar pela interface.
function readStoredDocument(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('treino-hard-v3');
    request.onerror = () => reject(request.error || new Error('IndexedDB indisponível.'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('documents', 'readonly');
      const get = transaction.objectStore('documents').get('current');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    };
  }));
}

function openTab(page, label) {
  return page.getByRole('tab', {name: label, exact: true}).click();
}

function statusPill(page) {
  return page.locator('.status-pill').first();
}

async function waitStatus(page, expected) {
  await page.waitForFunction(
    value => document.querySelector('.status-pill')?.textContent.trim() === value,
    expected,
    {timeout: 15000}
  );
}

// Abre o bloco "Mais" de uma série, onde ficam status, descanso e observação.
async function openSetMore(row) {
  const details = row.locator('details.setmore');
  if (await details.evaluate(node => node.open)) return;
  await details.locator('summary').click();
}

// Preenche repetições e status de todas as séries de trabalho visíveis.
async function fillWorkSets(page, reps) {
  const rows = page.locator('.set-row:not(.is-warmup)');
  const total = await rows.count();
  for (let index = 0; index < total; index += 1) {
    const row = rows.nth(index);
    await row.locator('input').nth(1).fill(String(reps == null ? 12 : reps));
    // Status fica no bloco recolhido "Mais" de cada série.
    await openSetMore(row);
    await row.locator('select').nth(1).selectOption('completed');
  }
  return total;
}

async function completeMobilityItems(page) {
  for (let guard = 0; guard < 12; guard += 1) {
    const locator = page.getByRole('button', {name: 'Marcar mobilidade concluída', exact: true});
    if (await locator.count() === 0) return guard;
    await locator.first().click();
    await page.waitForTimeout(120);
  }
  return 12;
}

async function finishSessionCompletely(page, workoutLabel) {
  await openTab(page, workoutLabel);
  const start = page.getByRole('button', {name: 'Iniciar treino', exact: true});
  if (await start.count()) await start.click();
  await waitStatus(page, 'Iniciado');
  await completeMobilityItems(page);
  await fillWorkSets(page, 12);
  await page.getByRole('button', {name: 'Finalizar treino', exact: true}).click();
  await waitStatus(page, 'Concluído');
}

test('fluxos essenciais funcionam em Chrome, responsivo e offline', {timeout: 90000}, async t => {
  assert.equal(fs.existsSync(CHROME), true, `Chrome não encontrado em ${CHROME}`);
  const server = await startStaticServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  const browser = await chromium.launch({headless: true, executablePath: CHROME});
  t.after(() => browser.close());
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'allow'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await page.locator('#save-state').waitFor({state: 'visible'});
  await page.waitForFunction(() => /Salvo|Somente leitura/.test(document.getElementById('save-state')?.textContent || ''));
  assert.match(await page.locator('#save-state').innerText(), /Salvo|Somente leitura/);
  assert.deepEqual(await page.getByRole('tab').allTextContents(), [
    'Hoje', 'Empurrar A', 'Puxar A', 'Pernas A', 'Empurrar B', 'Puxar B', 'Pernas B',
    'Caminhada', 'Rotina em casa', 'Evolução', 'Medidas', 'Ciclos', 'Ajustes'
  ]);
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);

  await page.getByRole('tab', {name: 'Empurrar A', exact: true}).click();
  await page.locator('[role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Puxar A');
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), 'Empurrar A');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), 'Puxar A');

  const reschedule = page.getByRole('button', {name: 'Remarcar', exact: true});
  await reschedule.click();
  assert.equal(await page.locator('#app-modal').isVisible(), true);
  await page.locator('#reschedule-date').press('Escape');
  assert.equal(await page.locator('#app-modal').isHidden(), true);
  assert.equal(await reschedule.evaluate(element => document.activeElement === element), true);

  await page.getByRole('tab', {name: 'Empurrar A', exact: true}).click();
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  const firstExercise = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first();
  const firstWorkSet = firstExercise.locator('.set-row').nth(3);
  await firstWorkSet.locator('input').nth(0).fill('52');
  await firstWorkSet.locator('input').nth(1).fill('13');
  await firstWorkSet.locator('select').nth(0).selectOption('3');
  await firstWorkSet.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await assert.doesNotReject(() => firstWorkSet.waitFor({state: 'visible'}));
  assert.match(await firstWorkSet.getAttribute('class'), /is-complete/);
  assert.equal(await page.locator('#timer-bar').isHidden(), true, 'cronômetro não deve iniciar com a configuração padrão');
  await firstWorkSet.getByRole('button', {name: 'Iniciar descanso', exact: true}).click();
  assert.equal(await page.locator('#timer-bar').isVisible(), true);
  await page.locator('#timer-bar').getByRole('button', {name: 'Desfazer série', exact: true}).click();
  await page.waitForTimeout(400);
  assert.doesNotMatch(await firstWorkSet.getAttribute('class'), /is-complete/);
  assert.equal(await firstWorkSet.locator('select').nth(1).inputValue(), '');
  assert.equal(await page.locator('#timer-bar').isHidden(), true);

  await page.getByRole('button', {name: 'Encerrar como parcial', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Encerrar como parcial', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.status-pill')?.textContent.trim() === 'Parcial');
  assert.equal(await page.getByRole('button', {name: 'Reabrir sessão', exact: true}).isVisible(), true);
  await page.getByRole('button', {name: 'Reabrir sessão', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.status-pill')?.textContent.trim() === 'Iniciado');

  await page.getByRole('tab', {name: 'Puxar A', exact: true}).click();
  await page.getByRole('button', {name: 'Pular', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Registrar como pulada', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.status-pill')?.textContent.trim() === 'Pulado');
  await page.getByRole('button', {name: 'Reabrir sessão', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.status-pill')?.textContent.trim() === 'Planejado');

  await page.getByRole('tab', {name: 'Hoje', exact: true}).click();
  for (const width of [320, 360, 430, 1280]) {
    await page.setViewportSize({width, height: 800});
    const responsive = await page.evaluate(() => ({client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth}));
    assert.equal(responsive.scroll, responsive.client, `overflow horizontal global em ${width}px`);
  }

  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.locator('#save-state').waitFor({state: 'visible'});
    await page.waitForFunction(() => /Salvo|Somente leitura/.test(document.getElementById('save-state')?.textContent || ''));
  }
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, 'service worker não controlou a página');
  await context.setOffline(true);
  await page.reload({waitUntil: 'domcontentloaded'});
  assert.equal(await page.getByRole('heading', {name: 'Treino Hard (Fofo)', exact: true}).isVisible(), true);
  await page.locator('#app-notice').waitFor({state: 'visible', timeout: 5000});
  assert.match(await page.locator('#app-notice').innerText(), /offline/i);
  await context.setOffline(false);

  assert.deepEqual(errors, []);
});

test('ciclo de vida da sessão persiste status, horários e séries após recarregar', {timeout: 120000}, async t => {
  const {page, errors} = await openApp(t);

  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');

  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  assert.equal(await statusPill(page).innerText(), 'Iniciado', 'o início não sobreviveu ao reload');
  const afterStart = await readStoredDocument(page);
  const trackedId = afterStart.sessions.find(session => session.workoutId === 'push_a' && session.status === 'started').id;
  assert.ok(afterStart.sessions.find(session => session.id === trackedId).startedAt, 'startedAt não foi persistido');

  const firstExercise = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first();
  const workSet = firstExercise.locator('.set-row').nth(3);
  await workSet.locator('input').nth(0).fill('52,5');
  await workSet.locator('input').nth(1).fill('13');
  await workSet.locator('select').nth(0).selectOption('3');
  await workSet.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(300);

  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  const reloadedSet = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(3);
  assert.equal(await reloadedSet.locator('input').nth(0).inputValue(), '52.5');
  assert.equal(await reloadedSet.locator('input').nth(1).inputValue(), '13');
  assert.equal(await reloadedSet.locator('select').nth(0).inputValue(), '3');
  assert.equal(await reloadedSet.locator('select').nth(1).inputValue(), 'completed');
  assert.match(await reloadedSet.getAttribute('class'), /is-complete/);

  await page.getByRole('button', {name: 'Pausar', exact: true}).click();
  await waitStatus(page, 'Pausado');
  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  assert.equal(await statusPill(page).innerText(), 'Pausado');
  const paused = await readStoredDocument(page);
  assert.ok(paused.sessions.find(session => session.id === trackedId).pausedAt, 'pausedAt não foi persistido');

  await page.getByRole('button', {name: 'Retomar', exact: true}).click();
  await waitStatus(page, 'Iniciado');

  await page.getByRole('button', {name: 'Finalizar treino', exact: true}).click();
  await page.locator('#app-notice').waitFor({state: 'visible'});
  assert.match(await page.locator('#app-notice').innerText(), /itens sem status/i);
  assert.equal(await statusPill(page).innerText(), 'Iniciado', 'sessão incompleta não pode virar concluída');

  await page.getByRole('button', {name: 'Encerrar como parcial', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Encerrar como parcial', exact: true}).click();
  await waitStatus(page, 'Parcial');
  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  assert.equal(await statusPill(page).innerText(), 'Parcial');
  const partial = await readStoredDocument(page);
  const partialSession = partial.sessions.find(session => session.id === trackedId);
  assert.equal(partialSession.status, 'partial');
  assert.ok(partialSession.completedAt, 'completedAt não foi persistido');
  assert.equal(
    partialSession.exercises.flatMap(exercise => exercise.sets).filter(set => set.status === 'completed').length,
    1,
    'a série registrada foi perdida ao encerrar como parcial'
  );

  await page.getByRole('button', {name: 'Reabrir sessão', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Cancelar sessão', exact: true}).click();
  await waitStatus(page, 'Cancelado');
  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  assert.equal(await statusPill(page).innerText(), 'Cancelado');

  await page.getByRole('button', {name: 'Reabrir sessão', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  await completeMobilityItems(page);
  const filled = await fillWorkSets(page, 14);
  assert.equal(filled, 17, 'Empurrar A deve expor 17 séries de trabalho');
  await page.getByRole('button', {name: 'Finalizar treino', exact: true}).click();
  await waitStatus(page, 'Concluído');

  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  assert.equal(await statusPill(page).innerText(), 'Concluído');
  const finished = await readStoredDocument(page);
  const finishedSession = finished.sessions.find(session => session.id === trackedId);
  assert.equal(finishedSession.status, 'completed');
  assert.ok(Number.isFinite(finishedSession.durationSeconds));
  assert.equal(finishedSession.exercises.flatMap(exercise => exercise.sets).filter(set => set.type === 'work' && set.status).length, 17);
  assert.equal(finished.sessions.length, 6, 'nenhuma sessão pode ser criada ou removida pelo ciclo de vida');

  assert.deepEqual(errors, []);
});

test('modo sequência não avança, não conclui nem reordena sessões sozinho', {timeout: 240000}, async t => {
  const monday = new Date(2026, 7, 10, 8, 0, 0);
  assert.equal(monday.getDay(), 1, 'a data escolhida precisa ser uma segunda-feira');
  const {page, errors} = await openApp(t, {fixedTime: monday});

  const initial = await readStoredDocument(page);
  assert.equal(initial.sessions.length, 6, 'a semana precisa nascer com seis sessões');
  assert.deepEqual(
    initial.sessions.map(session => `${session.workoutId}@${session.plannedDate}`),
    ['push_a@2026-08-10', 'pull_a@2026-08-11', 'legs_a@2026-08-12', 'push_b@2026-08-13', 'pull_b@2026-08-14', 'legs_b@2026-08-15']
  );

  await finishSessionCompletely(page, 'Empurrar A');
  await page.clock.setFixedTime(new Date(2026, 7, 11, 8, 0, 0));
  await reloadApp(page);
  await finishSessionCompletely(page, 'Puxar A');

  // Quarta-feira passa sem treino; o app é reaberto na quinta.
  await page.clock.setFixedTime(new Date(2026, 7, 13, 8, 0, 0));
  await reloadApp(page);

  const thursday = await readStoredDocument(page);
  assert.equal(thursday.sessions.length, 6, 'nenhuma sessão pode ser criada ou apagada ao reabrir o app');
  const byWorkout = Object.fromEntries(thursday.sessions.map(session => [session.workoutId, session]));
  assert.equal(byWorkout.push_a.status, 'completed');
  assert.equal(byWorkout.pull_a.status, 'completed');
  assert.equal(byWorkout.legs_a.status, 'planned', 'quarta não pode ser marcada como concluída');
  assert.equal(byWorkout.legs_a.startedAt, '', 'quarta não pode ganhar horário de início automático');
  assert.equal(byWorkout.push_b.status, 'planned');
  assert.deepEqual(
    thursday.sessions.map(session => session.workoutId),
    ['push_a', 'pull_a', 'legs_a', 'push_b', 'pull_b', 'legs_b'],
    'a ordem gravada das sessões não pode ser reorganizada'
  );

  // Calendário: hoje é quinta e a pendência de quarta continua explícita.
  await openTab(page, 'Hoje');
  assert.match(await page.locator('.today-card h3').innerText(), /Empurrar B/);
  assert.match(await page.locator('#panel-today').innerText(), /Pernas A/, 'a pendência de quarta deve aparecer como próxima');

  await openTab(page, 'Ajustes');
  await page.locator('select[data-action="setting-mode"]').selectOption('sequence');
  await page.waitForTimeout(300);
  await openTab(page, 'Hoje');
  assert.match(await page.locator('.today-card h3').innerText(), /Pernas A/, 'no modo sequência a pendência mais antiga vem primeiro');
  assert.match(await page.locator('.today-card').innerText(), /Pendente desde/);
  assert.equal(await page.locator('.today-card .status-pill').innerText(), 'Planejado');

  const afterModeSwitch = await readStoredDocument(page);
  assert.deepEqual(
    afterModeSwitch.sessions.map(session => `${session.workoutId}:${session.status}`),
    thursday.sessions.map(session => `${session.workoutId}:${session.status}`),
    'trocar o modo não pode alterar nenhum status'
  );

  await openTab(page, 'Pernas A');
  assert.equal(await statusPill(page).innerText(), 'Planejado');
  await page.getByRole('button', {name: 'Remarcar', exact: true}).click();
  await page.locator('#reschedule-date').fill('2026-08-14');
  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar remarcação', exact: true}).click();
  await page.waitForTimeout(500);

  const rescheduled = await readStoredDocument(page);
  assert.equal(rescheduled.sessions.length, 7, 'a remarcação precisa preservar a sessão original e criar outra');
  const original = rescheduled.sessions.find(session => session.workoutId === 'legs_a' && session.plannedDate === '2026-08-12');
  const replacement = rescheduled.sessions.find(session => session.workoutId === 'legs_a' && session.plannedDate === '2026-08-14');
  assert.equal(original.status, 'rescheduled');
  assert.equal(replacement.status, 'planned');
  assert.equal(replacement.rescheduledFrom, '2026-08-12');

  await openTab(page, 'Hoje');
  assert.match(await page.locator('.today-card h3').innerText(), /Empurrar B/, 'com quarta remarcada a pendência mais antiga passa a ser quinta');

  assert.deepEqual(errors, []);
});

// Regressão: em 2026-08-08 as abas Pernas A e Pernas B lançavam TypeError em
// renderVideoStatus e o app permanecia silenciosamente no painel anterior.
test('todas as treze abas montam o próprio painel sem erro de página', {timeout: 90000}, async t => {
  const {page, errors} = await openApp(t);
  const tabs = [
    ['Hoje', 'panel-today'], ['Empurrar A', 'panel-push_a'], ['Puxar A', 'panel-pull_a'],
    ['Pernas A', 'panel-legs_a'], ['Empurrar B', 'panel-push_b'], ['Puxar B', 'panel-pull_b'],
    ['Pernas B', 'panel-legs_b'], ['Caminhada', 'panel-cardio'], ['Rotina em casa', 'panel-home'],
    ['Evolução', 'panel-evolution'], ['Medidas', 'panel-measurements'], ['Ciclos', 'panel-cycles'],
    ['Ajustes', 'panel-settings']
  ];
  for (const [label, panelId] of tabs) {
    await openTab(page, label);
    await page.waitForTimeout(80);
    assert.equal(
      await page.evaluate(() => document.querySelector('#panels [role="tabpanel"]')?.id),
      panelId,
      `a aba ${label} não montou o próprio painel`
    );
    assert.equal(await page.locator(`#${panelId} .warning-box`).filter({hasText: 'não pôde ser montada'}).count(), 0);
  }
  // Os dois dias de pernas precisam expor a mobilidade completa e as séries.
  for (const label of ['Pernas A', 'Pernas B']) {
    await openTab(page, label);
    assert.equal(await page.getByRole('button', {name: 'Marcar mobilidade concluída', exact: true}).count(), 4, `${label} deve trazer as quatro mobilidades`);
    assert.equal(await page.locator('.set-row:not(.is-warmup)').count(), 14, `${label} deve trazer 14 séries de trabalho`);
  }
  assert.deepEqual(errors, []);
});

test('descanso padrão, personalizado, início manual e automático, +30 s e desfazer', {timeout: 120000}, async t => {
  const {page, errors} = await openApp(t);
  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');

  const exercise = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first();
  const firstWork = exercise.locator('.set-row').nth(3);
  assert.equal(await firstWork.locator('select').nth(2).inputValue(), '120', 'o descanso padrão do supino é 120 s');

  // Digitar e sair do campo nunca pode iniciar o cronômetro.
  await firstWork.locator('input').nth(1).fill('12');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#timer-bar').isHidden(), true, 'o cronômetro não pode iniciar por blur de campo');

  // Descanso personalizado de 45 s, no bloco "Mais".
  await openSetMore(firstWork);
  await firstWork.locator('select').nth(2).selectOption('custom');
  await firstWork.locator('input').nth(2).fill('45');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#timer-bar').isHidden(), true);

  await firstWork.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#timer-bar').isHidden(), true, 'sem início automático o cronômetro fica parado');

  await firstWork.getByRole('button', {name: 'Iniciar descanso', exact: true}).click();
  assert.equal(await page.locator('#timer-bar').isVisible(), true);
  assert.match(await page.locator('#timer-number').innerText(), /^0:4[0-5]$/, 'o cronômetro deve respeitar os 45 s personalizados');
  await page.locator('#timer-bar').getByRole('button', {name: '+30 s', exact: true}).click();
  assert.match(await page.locator('#timer-number').innerText(), /^1:1[0-5]$/);
  await page.locator('#timer-bar').getByRole('button', {name: 'Parar', exact: true}).click();
  assert.equal(await page.locator('#timer-bar').isHidden(), true);

  await reloadApp(page);
  await openTab(page, 'Empurrar A');
  const persisted = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(3);
  await openSetMore(persisted);
  assert.equal(await persisted.locator('select').nth(2).inputValue(), 'custom', 'o descanso personalizado deve sobreviver ao reload');
  assert.equal(await persisted.locator('input').nth(2).inputValue(), '45');

  await openTab(page, 'Ajustes');
  await page.locator('input[data-action="setting-toggle"][data-setting="autoStartRest"]').check();
  await page.waitForTimeout(300);
  await openTab(page, 'Empurrar A');
  const secondWork = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(4);
  await secondWork.locator('input').nth(1).fill('12');
  await secondWork.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.locator('#timer-bar').waitFor({state: 'visible', timeout: 5000});
  assert.match(await page.locator('#timer-number').innerText(), /^[12]:\d{2}$/);

  await page.locator('#timer-bar').getByRole('button', {name: 'Desfazer série', exact: true}).click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#timer-bar').isHidden(), true);
  const undone = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(4);
  assert.doesNotMatch(await undone.getAttribute('class'), /is-complete/);
  await openSetMore(undone);
  assert.equal(await undone.locator('select').nth(1).inputValue(), '');

  const stored = await readStoredDocument(page);
  const chest = stored.sessions.find(session => session.workoutId === 'push_a').exercises.find(item => item.exerciseId === 'chest_press_machine');
  const work = chest.sets.filter(set => set.type === 'work');
  assert.equal(work[0].nextRestSeconds, 45);
  assert.equal(work[0].status, 'completed');
  assert.equal(work[1].status, '', 'desfazer precisa devolver a série ao estado anterior');

  assert.deepEqual(errors, []);
});

test('caminhada e vacuum salvam todos os campos e sobrevivem ao reload', {timeout: 120000}, async t => {
  const {page, errors} = await openApp(t);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="startTime"]').fill('19:40');
  await page.locator('input[name="durationMinutes"]').fill('35');
  await page.locator('input[name="distanceKm"]').fill('3,2');
  await page.locator('input[name="pace"]').fill('10:56 min/km');
  await page.locator('input[name="effort"]').fill('4');
  await page.locator('select[name="status"]').selectOption('shorter');
  await page.locator('select[name="relatedSessionId"]').selectOption({index: 1});
  await page.locator('input[name="discomfort"]').fill('Panturrilha direita levemente tensa');
  await page.locator('textarea[name="note"]').fill('Caminhada leve várias horas depois do treino.');
  for (const name of ['fatigue', 'rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop']) {
    await page.locator(`input[name="${name}"]`).check();
  }
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(400);

  // Segundo registro num domingo, sem meta obrigatória.
  await page.locator('input[name="date"]').fill('2026-08-16');
  await page.locator('input[name="durationMinutes"]').fill('20');
  await page.locator('select[name="status"]').selectOption('not_pain');
  await page.locator('input[name="discomfort"]').fill('Dor no joelho');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(400);

  await openTab(page, 'Rotina em casa');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="time"]').fill('07:15');
  await page.locator('select[name="position"]').selectOption('all_fours');
  await page.locator('input[name="durationSeconds"]').fill('20');
  await page.locator('input[name="repetitions"]').fill('4');
  await page.locator('input[name="ease"]').fill('6');
  await page.locator('textarea[name="note"]').fill('Estômago vazio, sem desconforto.');
  await page.getByRole('button', {name: 'Salvar rotina', exact: true}).click();
  await page.waitForTimeout(400);

  await reloadApp(page);
  const stored = await readStoredDocument(page);
  assert.equal(stored.cardio.length, 2);
  const walk = stored.cardio[0];
  assert.equal(walk.date, '2026-08-12');
  assert.equal(walk.startTime, '19:40');
  assert.equal(walk.durationMinutes, 35);
  assert.equal(walk.distanceKm, '3.2');
  assert.equal(walk.pace, '10:56 min/km');
  assert.equal(walk.effort, 4);
  assert.equal(walk.status, 'shorter');
  assert.equal(walk.discomfort, 'Panturrilha direita levemente tensa');
  assert.equal(walk.note, 'Caminhada leve várias horas depois do treino.');
  assert.ok(walk.relatedSessionId, 'o treino relacionado precisa ser gravado');
  assert.deepEqual(walk.legDayFlags, {
    fatigue: true, rightCalfPain: true, gaitChange: true, kneePain: true, anklePain: true, performanceDrop: true
  });
  assert.equal(stored.cardio[1].status, 'not_pain');
  assert.equal(stored.cardio[1].discomfort, 'Dor no joelho');
  assert.equal(stored.sessions.find(session => session.id === walk.relatedSessionId).cardioId, walk.id);

  assert.equal(stored.homeRoutines.length, 1);
  const vacuum = stored.homeRoutines[0];
  assert.equal(vacuum.date, '2026-08-12');
  assert.equal(vacuum.time, '07:15');
  assert.equal(vacuum.position, 'all_fours');
  assert.equal(vacuum.durationSeconds, 20);
  assert.equal(vacuum.repetitions, 4);
  assert.equal(vacuum.ease, 6);
  assert.equal(vacuum.note, 'Estômago vazio, sem desconforto.');

  await openTab(page, 'Caminhada');
  assert.match(await page.locator('#panel-cardio .timeline').innerText(), /3\.2 km/);
  await openTab(page, 'Rotina em casa');
  assert.match(await page.locator('#panel-home .timeline').innerText(), /4 repetições de 20s/);

  // O vacuum nunca entra no volume nem nos gráficos de musculação.
  await openTab(page, 'Evolução');
  assert.doesNotMatch(await page.locator('#panel-evolution').innerText(), /[Vv]acuum/);

  assert.deepEqual(errors, []);
});

test('semana, deload, arquivamento e snapshot preservam o ciclo anterior', {timeout: 150000}, async t => {
  const {page, errors} = await openApp(t);

  // Uma sessão com dado registrado não pode ser reescrita pela troca de semana.
  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  const marker = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(3);
  await marker.locator('input').nth(0).fill('60');
  await marker.locator('input').nth(1).fill('12');
  await marker.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(300);

  await page.locator('button[data-action="cycle-week-set"][data-week="2"]').click();
  await page.waitForTimeout(500);
  let stored = await readStoredDocument(page);
  assert.equal(stored.cycle.currentWeek, 2);
  assert.equal(stored.sessions.find(session => session.workoutId === 'push_a').week, 1, 'sessão iniciada mantém a prescrição do dia');
  assert.equal(stored.sessions.find(session => session.workoutId === 'pull_a').week, 2, 'sessão vazia acompanha a semana nova');

  await page.locator('button[data-action="cycle-week-set"][data-week="8"]').click();
  await page.waitForTimeout(500);
  await openTab(page, 'Puxar A');
  // Deload: seis exercícios com no máximo 2 séries, e a remada unilateral
  // materializada nos dois lados (2 + 2 + 2×2 + 2 + 2 + 2 = 14 linhas).
  assert.equal(await page.locator('.set-row:not(.is-warmup)').count(), 14, 'no deload cada exercício cai para no máximo 2 séries');
  assert.ok(await page.locator('.badge.is-deload').count() > 0, 'o deload precisa estar sinalizado');

  await page.locator('button[data-action="cycle-week-set"][data-week="1"]').click();
  await page.waitForTimeout(500);
  await openTab(page, 'Ciclos');

  const beforeReset = await readStoredDocument(page);
  const beforeSessions = beforeReset.sessions.length;
  await page.getByRole('button', {name: 'Zerar e iniciar novo ciclo', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Arquivar e começar na semana 1', exact: true}).click();
  await page.waitForTimeout(700);

  const afterReset = await readStoredDocument(page);
  assert.equal(afterReset.archives.length, 1, 'o ciclo anterior precisa ser arquivado');
  assert.equal(afterReset.archives[0].sessions.length, beforeSessions, 'o arquivo precisa conter todas as sessões anteriores');
  assert.equal(
    afterReset.archives[0].sessions.find(session => session.workoutId === 'push_a').exercises
      .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.status === 'completed').length,
    1,
    'a série registrada precisa continuar no ciclo arquivado'
  );
  assert.equal(afterReset.cycle.currentWeek, 1);
  assert.equal(afterReset.sessions.length, 6, 'o ciclo novo recomeça com a semana completa');
  assert.equal(afterReset.sessions.every(session => session.status === 'planned'), true);

  await openTab(page, 'Ciclos');
  assert.match(await page.locator('#panel-cycles').innerText(), /Ciclos novos arquivados/i);
  await page.getByRole('button', {name: 'Desfazer última ação por snapshot', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Restaurar snapshot', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Snapshot restaurado'), null, {timeout: 15000});

  const restored = await readStoredDocument(page);
  assert.equal(restored.archives.length, 0, 'desfazer precisa remover o arquivamento');
  assert.equal(restored.sessions.length, beforeSessions);
  assert.equal(
    restored.sessions.find(session => session.workoutId === 'push_a').exercises
      .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.status === 'completed').length,
    1,
    'o registro anterior precisa voltar intacto'
  );

  await reloadApp(page);
  const afterReload = await readStoredDocument(page);
  assert.equal(afterReload.archives.length, 0);
  assert.equal(afterReload.sessions.find(session => session.workoutId === 'push_a').status, 'started');

  assert.deepEqual(errors, []);
});

const os = require('node:os');

const CSV_HEADERS = Object.freeze([
  'tipo_registro', 'sessao_id', 'data', 'horario', 'treino', 'semana', 'status_sessao', 'exercicio', 'variacao',
  'maquina', 'lado', 'serie', 'tipo_serie', 'carga_kg', 'repeticoes', 'rir', 'status_serie', 'descanso_segundos',
  'dor', 'feedback', 'cardio_minutos', 'cardio_distancia_km', 'cardio_esforco', 'medida', 'valor_medida', 'unidade', 'observacao'
]);

function scratchDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'treino-hard-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

async function downloadToDisk(page, directory, trigger) {
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 20000}), trigger()]);
  const target = path.join(directory, download.suggestedFilename());
  await download.saveAs(target);
  return {target, filename: download.suggestedFilename(), text: fs.readFileSync(target, 'utf8')};
}

function parseCsvRow(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else current += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { cells.push(current); current = ''; }
    else current += character;
  }
  cells.push(current);
  return cells;
}

// Cria um estado com dados de todos os módulos para os testes de exportação.
async function seedSampleData(page) {
  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  const workSet = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first().locator('.set-row').nth(3);
  await workSet.locator('input').nth(0).fill('57,5');
  await workSet.locator('input').nth(1).fill('13');
  await workSet.locator('select').nth(0).selectOption('2');
  await openSetMore(workSet);
  await workSet.locator('input').nth(3).fill('=SOMA(1;2) sentou bem');
  await workSet.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(300);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="durationMinutes"]').fill('32');
  await page.locator('input[name="distanceKm"]').fill('2,8');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(300);

  await openTab(page, 'Rotina em casa');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.getByRole('button', {name: 'Salvar rotina', exact: true}).click();
  await page.waitForTimeout(300);

  await openTab(page, 'Medidas');
  await page.locator('input[name="weight"]').fill('110,4');
  await page.locator('input[name="height"]').fill('175');
  await page.locator('input[name="armLeft"]').fill('39');
  await page.locator('input[name="armRight"]').fill('40');
  await page.getByRole('button', {name: 'Salvar medidas', exact: true}).click();
  await page.waitForTimeout(300);
}

test('exportação JSON, reimportação, snapshot e CSV de 27 colunas pela interface', {timeout: 150000}, async t => {
  const {page, errors} = await openApp(t);
  const directory = scratchDir(t);
  await seedSampleData(page);

  const before = await readStoredDocument(page);
  assert.equal(before.cardio.length, 1);
  assert.equal(before.measurements.length, 1);
  assert.equal(before.homeRoutines.length, 1);

  await openTab(page, 'Ajustes');
  const json = await downloadToDisk(page, directory, () => page.getByRole('button', {name: 'Exportar JSON completo', exact: true}).click());
  assert.match(json.filename, /^treino-hard-backup-\d{8}\.json$/);
  const backup = JSON.parse(json.text);
  assert.equal(backup.app, 'treino-hard-fofo');
  assert.equal(backup.schemaVersion, 11);
  assert.equal(backup.format, 'treino-hard-backup');
  assert.equal(backup.state.sessions.length, before.sessions.length);
  assert.equal(backup.state.cardio.length, 1);
  assert.equal(backup.state.measurements.length, 1);

  const csv = await downloadToDisk(page, directory, () => page.getByRole('button', {name: 'Exportar CSV', exact: true}).click());
  assert.match(csv.filename, /^treino-hard-registros-\d{8}\.csv$/);
  assert.equal(csv.text.charCodeAt(0), 0xFEFF, 'o CSV precisa começar com BOM UTF-8');
  const lines = csv.text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  const header = parseCsvRow(lines[0]);
  assert.deepEqual(header, CSV_HEADERS.slice());
  assert.equal(header.length, 27);
  for (const line of lines) assert.equal(parseCsvRow(line).length, 27, 'toda linha do CSV precisa ter 27 colunas');
  const noteCell = lines.map(parseCsvRow).find(row => row[26].includes('SOMA'));
  assert.ok(noteCell, 'a observação com fórmula precisa aparecer no CSV');
  assert.equal(noteCell[26].startsWith("'="), true, 'a fórmula precisa ser neutralizada com apóstrofo');
  const types = new Set(lines.slice(1).map(line => parseCsvRow(line)[0]));
  assert.equal(types.has('musculacao'), true);
  assert.equal(types.has('cardio'), true);
  assert.equal(types.has('medida'), true);

  // Uma caminhada a mais depois da exportação distingue o estado atual do arquivo.
  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-13');
  await page.locator('input[name="durationMinutes"]').fill('18');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(300);
  assert.equal((await readStoredDocument(page)).cardio.length, 2);

  await openTab(page, 'Ajustes');
  await page.locator('#import-file').setInputFiles(json.target);
  await page.locator('#app-modal').waitFor({state: 'visible'});
  const previewText = await page.locator('#app-modal').innerText();
  assert.match(previewText, /Prévia da importação/);
  assert.match(previewText, /Versão de origem\s*11/);
  assert.match(previewText, new RegExp(`Sessões novas\\s*${before.sessions.length}`));
  assert.match(previewText, /Medições\s*1/);
  assert.equal((await readStoredDocument(page)).cardio.length, 2, 'a prévia não pode alterar nada');

  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar importação', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Importação concluída'), null, {timeout: 20000});
  const imported = await readStoredDocument(page);
  assert.equal(imported.cardio.length, 1, 'a importação precisa refletir o arquivo escolhido');
  assert.equal(imported.sessions.length, before.sessions.length);
  assert.equal(imported.measurements.length, 1);
  assert.equal(imported.homeRoutines.length, 1);
  const importedSet = imported.sessions.find(session => session.workoutId === 'push_a').exercises
    .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.type === 'work')[0];
  assert.equal(importedSet.load, '57.5');
  assert.equal(importedSet.reps, '13');
  assert.equal(importedSet.rir, '2');

  await openTab(page, 'Ciclos');
  await page.getByRole('button', {name: 'Desfazer última ação por snapshot', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Restaurar snapshot', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Snapshot restaurado'), null, {timeout: 20000});
  assert.equal((await readStoredDocument(page)).cardio.length, 2, 'o snapshot anterior à importação precisa voltar');

  assert.deepEqual(errors, []);
});

test('backup criptografado: ida e volta, senha errada e arquivo adulterado', {timeout: 180000}, async t => {
  const {page, errors} = await openApp(t);
  const directory = scratchDir(t);
  await seedSampleData(page);
  const before = await readStoredDocument(page);

  await openTab(page, 'Ajustes');
  await page.getByRole('button', {name: 'Exportar JSON criptografado', exact: true}).click();
  await page.locator('#backup-password').fill('curto');
  await page.locator('#backup-password-confirm').fill('curto');
  await page.locator('#app-modal').getByRole('button', {name: 'Criptografar e baixar', exact: true}).click();
  await page.locator('#app-notice').waitFor({state: 'visible'});
  assert.match(await page.locator('#app-notice').innerText(), /ao menos 8 caracteres/i);
  assert.equal(await page.locator('#app-modal').isVisible(), true, 'a janela precisa continuar aberta para corrigir a senha');

  // Senhas divergentes.
  await page.locator('#backup-password').fill('senha-muito-boa-2026');
  await page.locator('#backup-password-confirm').fill('senha-diferente-2026');
  await page.locator('#app-modal').getByRole('button', {name: 'Criptografar e baixar', exact: true}).click();
  await page.waitForTimeout(300);
  assert.match(await page.locator('#app-notice').innerText(), /não coincidem/i);
  assert.equal(await page.locator('#backup-password').inputValue(), '', 'os campos de senha precisam ser limpos após a tentativa');
  await page.locator('#app-modal').getByRole('button', {name: 'Cancelar', exact: true}).click();
  await page.locator('#app-modal').waitFor({state: 'hidden'});

  await page.getByRole('button', {name: 'Exportar JSON criptografado', exact: true}).click();
  await page.locator('#backup-password').fill('senha-muito-boa-2026');
  await page.locator('#backup-password-confirm').fill('senha-muito-boa-2026');
  const encrypted = await downloadToDisk(page, directory, () => page.locator('#app-modal').getByRole('button', {name: 'Criptografar e baixar', exact: true}).click());
  assert.match(encrypted.filename, /^treino-hard-backup-cifrado-\d{8}\.json$/);
  await page.locator('#app-modal').waitFor({state: 'hidden'});

  const envelope = JSON.parse(encrypted.text);
  assert.equal(envelope.app, 'treino-hard-fofo');
  assert.equal(envelope.format, 'treino-hard-encrypted-backup');
  assert.equal(envelope.formatVersion, 1);
  assert.equal(envelope.kdf.name, 'PBKDF2');
  assert.equal(envelope.kdf.hash, 'SHA-256');
  assert.equal(envelope.kdf.iterations, 310000);
  assert.equal(envelope.cipher.name, 'AES-GCM');
  assert.equal(envelope.cipher.length, 256);
  assert.equal(Buffer.from(envelope.kdf.salt, 'base64').length, 16);
  assert.equal(Buffer.from(envelope.cipher.iv, 'base64').length, 12);
  assert.equal(encrypted.text.includes('senha-muito-boa-2026'), false, 'a senha não pode aparecer no arquivo');
  assert.equal(encrypted.text.includes('SOMA'), false, 'nenhum texto do usuário pode aparecer em claro');
  assert.equal(encrypted.text.includes('chest_press_machine'), false, 'nenhum identificador do estado pode vazar');

  // Dois arquivos seguidos precisam usar salt e IV diferentes.
  await page.getByRole('button', {name: 'Exportar JSON criptografado', exact: true}).click();
  await page.locator('#backup-password').fill('senha-muito-boa-2026');
  await page.locator('#backup-password-confirm').fill('senha-muito-boa-2026');
  const second = await downloadToDisk(page, directory, () => page.locator('#app-modal').getByRole('button', {name: 'Criptografar e baixar', exact: true}).click());
  await page.locator('#app-modal').waitFor({state: 'hidden'});
  const secondEnvelope = JSON.parse(second.text);
  assert.notEqual(secondEnvelope.kdf.salt, envelope.kdf.salt);
  assert.notEqual(secondEnvelope.cipher.iv, envelope.cipher.iv);
  assert.notEqual(secondEnvelope.ciphertext, envelope.ciphertext);

  const tampered = path.join(directory, 'adulterado.json');
  const brokenBytes = Buffer.from(envelope.ciphertext, 'base64');
  brokenBytes[7] ^= 0x01;
  fs.writeFileSync(tampered, JSON.stringify(Object.assign({}, envelope, {ciphertext: brokenBytes.toString('base64')})));

  const badIv = path.join(directory, 'iv-alterado.json');
  const ivBytes = Buffer.from(envelope.cipher.iv, 'base64');
  ivBytes[0] ^= 0x01;
  fs.writeFileSync(badIv, JSON.stringify(Object.assign({}, envelope, {cipher: Object.assign({}, envelope.cipher, {iv: ivBytes.toString('base64')})})));

  const badSalt = path.join(directory, 'salt-alterado.json');
  const saltBytes = Buffer.from(envelope.kdf.salt, 'base64');
  saltBytes[0] ^= 0x01;
  fs.writeFileSync(badSalt, JSON.stringify(Object.assign({}, envelope, {kdf: Object.assign({}, envelope.kdf, {salt: saltBytes.toString('base64')})})));

  const truncated = path.join(directory, 'truncado.json');
  fs.writeFileSync(truncated, JSON.stringify(Object.assign({}, envelope, {ciphertext: envelope.ciphertext.slice(0, 40)})));

  const cases = [
    ['senha incorreta', encrypted.target, 'senha-errada-2026'],
    ['ciphertext adulterado', tampered, 'senha-muito-boa-2026'],
    ['IV alterado', badIv, 'senha-muito-boa-2026'],
    ['salt alterado', badSalt, 'senha-muito-boa-2026'],
    ['ciphertext truncado', truncated, 'senha-muito-boa-2026']
  ];
  for (const [label, file, password] of cases) {
    await page.locator('#import-file').setInputFiles(file);
    await page.locator('#import-password').waitFor({state: 'visible', timeout: 10000});
    await page.locator('#import-password').fill(password);
    await page.locator('#app-modal').getByRole('button', {name: 'Descriptografar e ver prévia', exact: true}).click();
    await page.locator('#app-modal .warning-box').first().waitFor({state: 'visible', timeout: 20000});
    assert.match(await page.locator('#app-modal').innerText(), /Senha incorreta ou arquivo adulterado/, `${label} precisa ser recusado`);
    assert.equal(await page.locator('#app-modal').innerText().then(text => text.includes('Confirmar importação')), false, `${label} não pode chegar à prévia`);
    await page.locator('#app-modal').getByRole('button', {name: 'Cancelar', exact: true}).click();
    await page.waitForTimeout(150);
    const untouched = await readStoredDocument(page);
    assert.equal(untouched.cardio.length, before.cardio.length, `${label} não pode alterar o documento`);
  }

  // Estado modificado para provar que a importação correta realmente restaura.
  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-14');
  await page.locator('input[name="durationMinutes"]').fill('12');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(300);
  assert.equal((await readStoredDocument(page)).cardio.length, 2);

  await page.locator('#import-file').setInputFiles(encrypted.target);
  await page.locator('#import-password').waitFor({state: 'visible', timeout: 10000});
  await page.locator('#import-password').fill('senha-muito-boa-2026');
  await page.locator('#app-modal').getByRole('button', {name: 'Descriptografar e ver prévia', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar importação', exact: true}).waitFor({state: 'visible', timeout: 30000});
  assert.match(await page.locator('#app-modal').innerText(), /criptografado, já autenticado/);
  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar importação', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Importação concluída'), null, {timeout: 20000});

  const restored = await readStoredDocument(page);
  assert.equal(restored.cardio.length, 1);
  assert.equal(restored.measurements.length, 1);
  assert.equal(restored.sessions.length, before.sessions.length);
  assert.equal(
    restored.sessions.find(session => session.workoutId === 'push_a').exercises
      .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.type === 'work')[0].load,
    '57.5'
  );

  // O material bruto preservado antes da importação continua cifrado.
  await openTab(page, 'Ajustes');
  await page.waitForTimeout(400);
  const rawExport = await downloadToDisk(page, directory, () => page.getByRole('button', {name: 'Exportar arquivo bruto', exact: true}).first().click());
  assert.equal(rawExport.text.includes('treino-hard-encrypted-backup'), true);
  assert.equal(rawExport.text.includes('senha-muito-boa-2026'), false);

  assert.deepEqual(errors, []);
});

function writeScratchFile(directory, name, content) {
  const target = path.join(directory, name);
  fs.writeFileSync(target, content);
  return target;
}

test('importações hostis e malformadas são recusadas sem tocar no documento', {timeout: 180000}, async t => {
  const {page, errors} = await openApp(t);
  const directory = scratchDir(t);
  await seedSampleData(page);
  const before = await readStoredDocument(page);
  const envelope = {app: 'treino-hard-fofo', schemaVersion: 11, format: 'treino-hard-backup', exportedAt: new Date().toISOString(), state: before};

  const withState = extra => JSON.stringify(Object.assign({}, envelope, {state: Object.assign({}, before, extra)}));
  let deep = {value: 1};
  for (let level = 0; level < 40; level += 1) deep = {nested: deep};

  const cases = [
    ['arquivo acima de 5 MiB', writeScratchFile(directory, 'grande.json', `{"app":"treino-hard-fofo","padding":"${'x'.repeat(6 * 1024 * 1024)}"}`), /excede o limite/i],
    ['JSON inválido', writeScratchFile(directory, 'invalido.json', '{isto não é json}'), /Importação rejeitada/i],
    ['documento truncado', writeScratchFile(directory, 'truncado.json', JSON.stringify(envelope).slice(0, 800)), /Importação rejeitada/i],
    ['array em vez de objeto', writeScratchFile(directory, 'array.json', '[1,2,3]'), /objeto JSON/i],
    ['chave __proto__', writeScratchFile(directory, 'proto.json', '{"app":"treino-hard-fofo","schemaVersion":11,"state":{"__proto__":{"poluido":true}}}'), /propriedades proibidas|profundidade/i],
    ['chave constructor', writeScratchFile(directory, 'ctor.json', '{"app":"treino-hard-fofo","schemaVersion":11,"state":{"sessions":[{"constructor":{"x":1}}]}}'), /propriedades proibidas|profundidade/i],
    ['profundidade excessiva', writeScratchFile(directory, 'fundo.json', JSON.stringify({app: 'treino-hard-fofo', schemaVersion: 11, state: deep})), /propriedades proibidas|profundidade/i],
    ['campo inesperado no estado', writeScratchFile(directory, 'extra.json', withState({campoDesconhecido: 1})), /Campos inesperados/i],
    ['esquema futuro', writeScratchFile(directory, 'futuro.json', JSON.stringify(Object.assign({}, envelope, {schemaVersion: 12}))), /versão mais nova/i],
    ['outro aplicativo', writeScratchFile(directory, 'outro.json', JSON.stringify(Object.assign({}, envelope, {app: 'outro-app'}))), /não pertence ao Treino Hard/i]
  ];

  for (const [label, file, expected] of cases) {
    await openTab(page, 'Ajustes');
    await page.locator('#import-file').setInputFiles(file);
    await page.locator('#app-notice').waitFor({state: 'visible', timeout: 20000});
    assert.match(await page.locator('#app-notice').innerText(), expected, `mensagem inesperada para: ${label}`);
    assert.equal(await page.locator('#app-modal').isHidden(), true, `${label} não pode abrir prévia`);
    const after = await readStoredDocument(page);
    assert.equal(after.revision, before.revision, `${label} não pode gravar revisão nova`);
    assert.equal(after.cardio.length, before.cardio.length, `${label} não pode mudar os dados`);
    assert.equal(after.sessions.length, before.sessions.length, `${label} não pode mudar as sessões`);
  }

  assert.equal(await page.evaluate(() => ({}).poluido === undefined && Object.prototype.poluido === undefined), true, 'o prototype global não pode ser poluído');

  // Texto muito longo é aceito, porém truncado pelos limites do esquema.
  const longNote = 'á'.repeat(4000);
  const clone = JSON.parse(JSON.stringify(before));
  clone.cardio[0].note = longNote;
  const longFile = writeScratchFile(directory, 'texto-longo.json', JSON.stringify(Object.assign({}, envelope, {state: clone})));
  await page.locator('#import-file').setInputFiles(longFile);
  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar importação', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Importação concluída'), null, {timeout: 20000});
  const clamped = await readStoredDocument(page);
  assert.equal(clamped.cardio[0].note.length, 500, 'a observação precisa ser cortada no limite do esquema');

  assert.deepEqual(errors, []);
});

test('cópias automáticas e recuperação bruta podem ser listadas, restauradas e exportadas', {timeout: 150000}, async t => {
  const {page, errors} = await openApp(t);
  const directory = scratchDir(t);
  await seedSampleData(page);

  await openTab(page, 'Ajustes');
  await page.getByRole('button', {name: 'Criar cópia automática agora', exact: true}).click();
  await page.waitForTimeout(600);
  const restoreButtons = page.getByRole('button', {name: 'Restaurar esta cópia', exact: true});
  assert.ok(await restoreButtons.count() >= 1, 'a cópia automática precisa aparecer na lista');

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-15');
  await page.locator('input[name="durationMinutes"]').fill('25');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(300);
  assert.equal((await readStoredDocument(page)).cardio.length, 2);

  await openTab(page, 'Ajustes');
  await page.waitForTimeout(400);
  await page.getByRole('button', {name: 'Restaurar esta cópia', exact: true}).first().click();
  await page.locator('#app-modal').getByRole('button', {name: 'Restaurar cópia', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Cópia automática restaurada'), null, {timeout: 20000});
  assert.equal((await readStoredDocument(page)).cardio.length, 1, 'a restauração precisa devolver o estado da cópia');

  // Restaurar precisa ter criado um snapshot de segurança do estado descartado.
  await openTab(page, 'Ciclos');
  await page.getByRole('button', {name: 'Desfazer última ação por snapshot', exact: true}).click();
  await page.locator('#app-modal').getByRole('button', {name: 'Restaurar snapshot', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Snapshot restaurado'), null, {timeout: 20000});
  assert.equal((await readStoredDocument(page)).cardio.length, 2, 'o snapshot criado antes da restauração precisa desfazê-la');

  // Uma importação registra material bruto recuperável.
  const source = writeScratchFile(directory, 'origem.json', JSON.stringify({
    app: 'treino-hard-fofo', schemaVersion: 11, format: 'treino-hard-backup', state: await readStoredDocument(page)
  }));
  await openTab(page, 'Ajustes');
  await page.locator('#import-file').setInputFiles(source);
  await page.locator('#app-modal').getByRole('button', {name: 'Confirmar importação', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Importação concluída'), null, {timeout: 20000});

  await openTab(page, 'Ajustes');
  await page.waitForTimeout(500);
  const rawButtons = page.getByRole('button', {name: 'Exportar arquivo bruto', exact: true});
  assert.ok(await rawButtons.count() >= 1, 'o material bruto da importação precisa ficar disponível');
  const raw = await downloadToDisk(page, directory, () => rawButtons.first().click());
  assert.match(raw.filename, /^treino-hard-recuperacao-\d{8}\.json$/);
  const rawItem = JSON.parse(raw.text);
  assert.match(String(rawItem.reason), /Arquivo bruto antes da importação/);
  assert.equal(typeof rawItem.raw, 'string');
  assert.equal(JSON.parse(rawItem.raw).app, 'treino-hard-fofo');

  assert.deepEqual(errors, []);
});

test('duas abas detectam conflito de revisão e não sobrescrevem em silêncio', {timeout: 150000}, async t => {
  const {page, context, baseUrl, errors} = await openApp(t);
  const second = await context.newPage();
  const secondErrors = [];
  second.on('pageerror', error => secondErrors.push(`pageerror: ${error.message}`));
  second.on('console', message => {
    if (message.type() === 'error') secondErrors.push(`console: ${message.text()}`);
  });
  await second.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(second);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="durationMinutes"]').fill('40');
  await page.locator('input[name="discomfort"]').fill('registro da aba um');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(400);
  const afterFirst = await readStoredDocument(page);
  assert.equal(afterFirst.cardio.length, 1);

  await second.locator('#app-notice').waitFor({state: 'visible', timeout: 15000});
  assert.match(await second.locator('#app-notice').innerText(), /Outra aba alterou os registros/i);

  await openTab(second, 'Caminhada');
  await second.locator('input[name="date"]').fill('2026-08-13');
  await second.locator('input[name="durationMinutes"]').fill('10');
  await second.locator('input[name="discomfort"]').fill('registro da aba dois');
  await second.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await second.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Falha ao salvar'), null, {timeout: 15000});
  assert.match(await second.locator('#app-notice').innerText(), /Outra aba alterou os dados|Recarregue antes de salvar/i);

  const afterConflict = await readStoredDocument(page);
  assert.equal(afterConflict.cardio.length, 1, 'a aba atrasada não pode sobrescrever a revisão mais nova');
  assert.equal(afterConflict.cardio[0].discomfort, 'registro da aba um');
  assert.equal(afterConflict.revision, afterFirst.revision);

  await second.getByRole('button', {name: 'Recarregar dados', exact: true}).first().click();
  await second.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Dados recarregados'), null, {timeout: 15000});
  await openTab(second, 'Caminhada');
  await second.locator('input[name="date"]').fill('2026-08-13');
  await second.locator('input[name="durationMinutes"]').fill('10');
  await second.locator('input[name="discomfort"]').fill('registro da aba dois');
  await second.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await second.waitForTimeout(500);
  const merged = await readStoredDocument(page);
  assert.equal(merged.cardio.length, 2, 'depois de recarregar a segunda aba consegue gravar sem perder nada');
  assert.deepEqual(merged.cardio.map(item => item.discomfort).sort(), ['registro da aba dois', 'registro da aba um']);

  assert.deepEqual(errors, []);
  assert.deepEqual(secondErrors, []);
});

test('sem IndexedDB o app cai para localStorage e nunca mostra falha de gravação como sucesso', {timeout: 150000}, async t => {
  const {page, context, baseUrl, errors} = await openApp(t, {skipGoto: true});
  await context.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() { throw new Error('IndexedDB indisponível neste teste.'); }
    });
  });
  await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(page);

  await openTab(page, 'Ajustes');
  assert.match(await page.locator('#panel-settings').innerText(), /localStorage de fallback/);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="durationMinutes"]').fill('27');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(400);

  const stored = () => page.evaluate(() => {
    const text = localStorage.getItem('treinohard_document_v11');
    return text ? JSON.parse(text) : null;
  });
  assert.equal((await stored()).cardio.length, 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('treinohard_document_v11_staging')), null, 'o staging precisa ser removido após a gravação');

  await reloadApp(page);
  assert.equal((await stored()).cardio.length, 1, 'o fallback precisa sobreviver ao reload');
  await openTab(page, 'Caminhada');
  assert.match(await page.locator('#panel-cardio .timeline').innerText(), /27 min/);

  // Quota esgotada: a falha precisa aparecer como falha.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patched(key, value) {
      if (String(key).startsWith('treinohard_document_v11')) {
        const error = new Error('A cota do armazenamento local foi excedida.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return original.call(this, key, value);
    };
  });
  await page.locator('input[name="date"]').fill('2026-08-13');
  await page.locator('input[name="durationMinutes"]').fill('11');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('save-state')?.textContent.includes('Falha ao salvar'), null, {timeout: 15000});
  assert.match(await page.locator('#app-notice').innerText(), /cota do armazenamento local/i);
  assert.doesNotMatch(await page.locator('#save-state').innerText(), /Salvo neste aparelho/);
  assert.equal((await stored()).cardio.length, 1, 'a gravação que falhou não pode corromper o documento existente');

  assert.deepEqual(errors, []);
});

const XSS_PAYLOADS = Object.freeze([
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'><iframe src=javascript:alert(1)>",
  '<a href="javascript:alert(1)">clique</a>',
  '__proto__',
  'constructor prototype',
  'texto com emoji e acentos 🏋️ ção'
]);

function hasControlCharacters(text) {
  return [...String(text)].some(character => {
    const code = character.codePointAt(0);
    return code < 32 || code === 127;
  });
}

test('nenhuma entrada do usuário vira HTML executável', {timeout: 180000}, async t => {
  const {page, errors} = await openApp(t);
  await page.addInitScript(() => { window.__xssDisparado = false; window.alert = () => { window.__xssDisparado = true; }; });
  await page.evaluate(() => { window.__xssDisparado = false; window.alert = () => { window.__xssDisparado = true; }; });
  const scriptsBefore = await page.evaluate(() => document.querySelectorAll('script').length);
  const payload = XSS_PAYLOADS.join(' ');

  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  const card = page.locator('article.section-card').filter({hasText: '1. Supino reto na máquina'}).first();
  await card.getByText('Detalhes do exercício', {exact: true}).click();
  await card.locator('input[data-field="machineId"]').fill(payload);
  const notaRow = card.locator('.set-row').nth(3);
  await openSetMore(notaRow);
  await notaRow.locator('input').nth(3).fill(payload);
  await card.getByText('Como me senti neste exercício', {exact: true}).click();
  await card.locator('textarea[data-field="feedback"]').fill(payload);
  await page.waitForTimeout(400);

  await openTab(page, 'Pernas A');
  const mobilityCard = page.locator('article.section-card').first();
  await mobilityCard.getByText('Feedback opcional por lado', {exact: true}).click();
  await mobilityCard.locator('textarea[data-action="mobility-note"]').fill(payload);
  await page.waitForTimeout(300);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="discomfort"]').fill(payload);
  await page.locator('textarea[name="note"]').fill(payload);
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(300);

  await openTab(page, 'Rotina em casa');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('textarea[name="note"]').fill(payload);
  await page.getByRole('button', {name: 'Salvar rotina', exact: true}).click();
  await page.waitForTimeout(300);

  await openTab(page, 'Medidas');
  await page.locator('input[name="weight"]').fill('110');
  await page.locator('input[name="height"]').fill('175');
  await page.locator('textarea[name="note"]').fill(payload);
  await page.getByRole('button', {name: 'Salvar medidas', exact: true}).click();
  await page.waitForTimeout(300);

  await reloadApp(page);
  for (const label of ['Hoje', 'Empurrar A', 'Pernas A', 'Caminhada', 'Rotina em casa', 'Medidas', 'Evolução', 'Ciclos', 'Ajustes']) {
    await openTab(page, label);
    await page.waitForTimeout(120);
    const audit = await page.evaluate(() => ({
      scripts: document.querySelectorAll('script').length,
      inlineHandlers: document.querySelectorAll('[onerror], [onload], [onclick], [onmouseover], [onfocus]').length,
      injected: document.querySelectorAll('#panels img[src="x"], #panels svg[onload], #panels iframe').length,
      javascriptLinks: [...document.querySelectorAll('a[href]')].filter(node => String(node.getAttribute('href')).toLowerCase().startsWith('javascript:')).length,
      triggered: window.__xssDisparado === true
    }));
    assert.equal(audit.scripts, scriptsBefore, `a aba ${label} não pode criar elementos script`);
    assert.equal(audit.inlineHandlers, 0, `a aba ${label} não pode conter manipuladores inline`);
    assert.equal(audit.injected, 0, `a aba ${label} não pode materializar a carga injetada`);
    assert.equal(audit.javascriptLinks, 0);
    assert.equal(audit.triggered, false, `alert foi disparado na aba ${label}`);
  }

  // O texto continua visível como texto, não como marcação.
  await openTab(page, 'Caminhada');
  const timeline = page.locator('#panel-cardio .timeline');
  assert.match(await timeline.innerText(), /<script>alert\(1\)<\/script>/);
  assert.equal(await timeline.evaluate(node => node.querySelectorAll('script, img, svg, iframe').length), 0);

  await openTab(page, 'Empurrar A');
  await page.locator('#panels article.section-card').first().getByText('Detalhes do exercício', {exact: true}).click();
  assert.match(await page.locator('input[data-field="machineId"]').first().inputValue(), /<script>alert\(1\)<\/script>/);

  // As chaves proibidas digitadas como texto não alcançam o protótipo.
  assert.equal(await page.evaluate(() => Object.prototype.poluido === undefined && ({}).constructor === Object), true);

  const stored = await readStoredDocument(page);
  assert.match(stored.cardio[0].discomfort, /<script>/);
  assert.equal(stored.cardio[0].note.length <= 500, true);
  assert.equal(stored.measurements[0].note.length <= 300, true);
  const machineStored = stored.sessions.find(session => session.workoutId === 'push_a').exercises
    .find(item => item.exerciseId === 'chest_press_machine').machineId;
  assert.equal(machineStored.length <= 80, true, 'a identificação da máquina precisa respeitar o limite');
  assert.equal(hasControlCharacters(machineStored), false, 'caracteres de controle precisam ser removidos');

  assert.deepEqual(errors, []);
});

test('a Content Security Policy declarada bloqueia script inline e origens externas', {timeout: 90000}, async t => {
  const {page} = await openApp(t);
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/, 'a CSP não pode ser enfraquecida');
  const frameSources = csp.split(';').map(part => part.trim()).find(part => part.startsWith('frame-src'));
  assert.equal(frameSources, 'frame-src https://www.youtube-nocookie.com', 'só o domínio sem cookies do YouTube pode ser permitido');

  const outcome = await page.evaluate(() => new Promise(resolve => {
    const script = document.createElement('script');
    script.textContent = 'window.__cspFurou = true;';
    document.body.appendChild(script);
    setTimeout(() => resolve(window.__cspFurou === true ? 'executou' : 'bloqueado'), 250);
  }));
  assert.equal(outcome, 'bloqueado', 'a CSP precisa bloquear script inline injetado');
});

test('navegação completa por teclado nas abas e retenção cíclica de foco no modal', {timeout: 120000}, async t => {
  const {page, errors} = await openApp(t);
  const activeText = () => page.evaluate(() => (document.activeElement?.textContent || '').trim());
  const selectedText = () => page.locator('[role="tab"][aria-selected="true"]').innerText();

  assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
  await page.locator('#tab-today').focus();

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(60);
  assert.equal(await activeText(), 'Ajustes', 'ArrowLeft na primeira aba precisa dar a volta');
  assert.equal(await selectedText(), 'Hoje', 'mover o foco não pode selecionar sozinho');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  assert.equal(await activeText(), 'Hoje', 'ArrowRight na última aba precisa dar a volta');

  await page.keyboard.press('End');
  await page.waitForTimeout(60);
  assert.equal(await activeText(), 'Ajustes');
  await page.keyboard.press('Home');
  await page.waitForTimeout(60);
  assert.equal(await activeText(), 'Hoje');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  assert.equal(await selectedText(), 'Empurrar A', 'Espaço precisa ativar a aba com foco');
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('[role="tab"][tabindex="0"]').getAttribute('id')), 'tab-push_a');

  // Tab sai da lista de abas: as demais abas não são tabuláveis.
  await page.locator('#tab-push_a').focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab'), false, 'Tab não pode percorrer aba por aba');
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tab-push_a', 'Shift+Tab precisa voltar para a aba selecionada');

  // Modal: foco inicial, ciclo completo com Tab e Shift+Tab, Escape e retorno.
  const trigger = page.getByRole('button', {name: 'Remarcar', exact: true});
  await trigger.click();
  await page.locator('#app-modal').waitFor({state: 'visible'});
  const focusables = await page.evaluate(() => [...document.querySelectorAll('#app-modal button:not([disabled]), #app-modal input:not([disabled]), #app-modal select:not([disabled]), #app-modal textarea:not([disabled]), #app-modal a[href]')].filter(node => !node.hidden).map(node => node.id || node.textContent.trim()));
  assert.ok(focusables.length >= 3, 'o modal precisa ter controles focáveis');
  const currentFocus = () => page.evaluate(() => document.activeElement?.id || (document.activeElement?.textContent || '').trim());
  // Campos de data no Chromium consomem vários Tab entre os próprios segmentos,
  // então avançamos até o foco realmente mudar de controle.
  const advanceFocus = async key => {
    const before = await currentFocus();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.keyboard.press(key);
      await page.waitForTimeout(40);
      const now = await currentFocus();
      if (now !== before) return now;
    }
    return currentFocus();
  };
  assert.equal(await currentFocus(), focusables[0], 'o foco inicial precisa ir para o primeiro controle do modal');

  for (let index = 1; index < focusables.length; index += 1) {
    assert.equal(await advanceFocus('Tab'), focusables[index], `Tab precisa avançar para ${focusables[index]}`);
  }
  assert.equal(await advanceFocus('Tab'), focusables[0], 'a retenção cíclica precisa voltar ao primeiro controle');
  assert.equal(await advanceFocus('Shift+Tab'), focusables[focusables.length - 1], 'Shift+Tab no primeiro controle precisa ir ao último');
  for (let index = focusables.length - 2; index >= 0; index -= 1) {
    assert.equal(await advanceFocus('Shift+Tab'), focusables[index], `Shift+Tab precisa retroceder para ${focusables[index]}`);
  }

  assert.equal(await page.evaluate(() => document.querySelector('#app-modal').getAttribute('aria-modal')), 'true');
  assert.equal(await page.evaluate(() => document.querySelector('#app-modal').getAttribute('aria-hidden')), 'false');
  await page.keyboard.press('Escape');
  await page.locator('#app-modal').waitFor({state: 'hidden'});
  assert.equal(await trigger.evaluate(node => document.activeElement === node), true, 'o foco precisa voltar ao acionador');
  assert.equal(await page.evaluate(() => document.querySelector('#app-modal').getAttribute('aria-hidden')), 'true');

  assert.deepEqual(errors, []);
});

test('estrutura acessível: papéis, relações ARIA, regiões vivas e rótulos', {timeout: 120000}, async t => {
  const {page, errors} = await openApp(t);

  const audit = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    return {
      tabCount: tabs.length,
      tablist: document.querySelector('[role="tablist"]')?.getAttribute('aria-label') || '',
      selected: tabs.filter(tab => tab.getAttribute('aria-selected') === 'true').length,
      roving: tabs.filter(tab => tab.getAttribute('tabindex') === '0').length,
      controlsOnSelected: tabs.filter(tab => tab.getAttribute('aria-selected') === 'true' && document.getElementById(tab.getAttribute('aria-controls') || '')).length,
      danglingControls: tabs.filter(tab => tab.hasAttribute('aria-controls') && !document.getElementById(tab.getAttribute('aria-controls'))).length,
      namesMissing: tabs.filter(tab => !(tab.textContent || '').trim()).length,
      liveRegions: [...document.querySelectorAll('[aria-live]')].map(node => `${node.id}:${node.getAttribute('aria-live')}`),
      timerRole: document.getElementById('timer-number')?.getAttribute('role'),
      timerLabel: document.getElementById('timer-number')?.getAttribute('aria-label'),
      noticeRole: document.getElementById('app-notice')?.getAttribute('role'),
      saveStateRole: document.getElementById('save-state')?.getAttribute('role'),
      lang: document.documentElement.lang
    };
  });
  assert.equal(audit.tabCount, 13);
  assert.equal(audit.selected, 1);
  assert.equal(audit.roving, 1);
  assert.equal(audit.controlsOnSelected, 1, 'a aba selecionada precisa apontar para o painel visível');
  assert.equal(audit.danglingControls, 0, 'nenhuma aba pode apontar para um painel ausente');
  assert.equal(audit.namesMissing, 0);
  assert.ok(audit.tablist.length > 0, 'a lista de abas precisa de rótulo acessível');
  assert.equal(audit.timerRole, 'timer');
  assert.ok(audit.timerLabel);
  assert.equal(audit.noticeRole, 'status');
  assert.equal(audit.saveStateRole, 'status');
  assert.equal(audit.lang, 'pt-BR');
  assert.ok(audit.liveRegions.includes('live-region:polite'));
  assert.ok(audit.liveRegions.includes('timer-announcement:assertive'));

  for (const label of ['Hoje', 'Empurrar A', 'Pernas A', 'Caminhada', 'Rotina em casa', 'Evolução', 'Medidas', 'Ciclos', 'Ajustes']) {
    await openTab(page, label);
    await page.waitForTimeout(120);
    const problems = await page.evaluate(() => {
      const report = {duplicateIds: [], unlabeled: [], danglingAria: [], inlineHandlers: 0};
      const seen = new Set();
      document.querySelectorAll('[id]').forEach(node => {
        if (seen.has(node.id)) report.duplicateIds.push(node.id);
        seen.add(node.id);
      });
      document.querySelectorAll('[aria-controls], [aria-labelledby]').forEach(node => {
        ['aria-controls', 'aria-labelledby'].forEach(attribute => {
          const value = node.getAttribute(attribute);
          if (value && !document.getElementById(value)) report.danglingAria.push(`${attribute}=${value}`);
        });
      });
      document.querySelectorAll('button, input, select, textarea, a[href]').forEach(node => {
        if (node.hidden || node.type === 'hidden' || node.offsetParent === null && node.closest('[hidden]')) return;
        const named = node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || node.getAttribute('title')
          || (node.textContent || '').trim() || node.closest('label') || (node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`));
        if (!named) report.unlabeled.push(node.outerHTML.slice(0, 140));
      });
      report.inlineHandlers = document.querySelectorAll('[onclick], [onload], [onerror], [onchange], [onsubmit], [oninput]').length;
      return report;
    });
    assert.deepEqual(problems.duplicateIds, [], `IDs duplicados na aba ${label}`);
    assert.deepEqual(problems.unlabeled, [], `controles sem rótulo na aba ${label}`);
    assert.deepEqual(problems.danglingAria, [], `relações ARIA quebradas na aba ${label}`);
    assert.equal(problems.inlineHandlers, 0, `manipuladores inline na aba ${label}`);
    const panelId = await page.evaluate(() => document.querySelector('#panels [role="tabpanel"]')?.id);
    const labelledBy = await page.evaluate(id => document.getElementById(id)?.getAttribute('aria-labelledby'), panelId);
    assert.equal(labelledBy, panelId.replace('panel-', 'tab-'), `o painel ${panelId} precisa apontar para a própria aba`);
  }

  assert.deepEqual(errors, []);
});

test('contraste das combinações de texto atende ao mínimo aplicável do WCAG AA', {timeout: 150000}, async t => {
  const {page, errors} = await openApp(t);
  await seedSampleData(page);

  const measure = () => page.evaluate(() => {
    const parseColor = value => {
      const match = String(value).match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,/]/).map(item => parseFloat(item.trim()));
      return {r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1};
    };
    const channel = value => {
      const ratio = value / 255;
      return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
    };
    const luminance = color => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    const blend = (top, bottom) => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1
    });
    const effectiveBackground = node => {
      let stack = [];
      let current = node;
      while (current && current !== document.documentElement.parentNode) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color && color.a > 0) {
          stack.push(color);
          if (color.a === 1) break;
        }
        current = current.parentElement;
      }
      let result = {r: 10, g: 9, b: 11, a: 1};
      for (let index = stack.length - 1; index >= 0; index -= 1) result = blend(stack[index], result);
      return result;
    };
    const failures = [];
    document.querySelectorAll('body *').forEach(node => {
      const hasOwnText = [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim().length > 0);
      if (!hasOwnText) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const style = getComputedStyle(node);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) return;
      const color = parseColor(style.color);
      if (!color) return;
      const background = effectiveBackground(node);
      const foreground = color.a < 1 ? blend(color, background) : color;
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      const ratio = (lighter + 0.05) / (darker + 0.05);
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const required = large ? 3 : 4.5;
      if (ratio + 0.005 < required) {
        failures.push({
          selector: `${node.tagName.toLowerCase()}.${String(node.className || '').split(' ').filter(Boolean).join('.')}`,
          text: node.textContent.trim().slice(0, 40),
          ratio: Math.round(ratio * 100) / 100,
          required,
          size
        });
      }
    });
    return failures;
  });

  const seen = new Map();
  for (const label of ['Hoje', 'Empurrar A', 'Pernas A', 'Caminhada', 'Rotina em casa', 'Evolução', 'Medidas', 'Ciclos', 'Ajustes']) {
    await openTab(page, label);
    await page.waitForTimeout(150);
    for (const failure of await measure()) seen.set(`${label} · ${failure.selector} · ${failure.text}`, failure);
  }
  assert.deepEqual([...seen.entries()].map(([key, value]) => `${key} = ${value.ratio}:1 (mínimo ${value.required})`), []);

  assert.deepEqual(errors, []);
});

test('larguras móveis, zoom de 200%, texto ampliado e movimento reduzido mantêm os fluxos utilizáveis', {timeout: 180000}, async t => {
  const {page, errors} = await openApp(t, {reducedMotion: 'reduce', viewport: {width: 320, height: 800}});

  const noHorizontalOverflow = async (width, step) => {
    const metrics = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      const offenders = [];
      document.querySelectorAll('body *').forEach(node => {
        if (node.closest('.tabs')) return; // a barra de abas rola dentro do próprio contêiner
        const rect = node.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        if (rect.right > limit + 0.5) {
          offenders.push(`${node.tagName.toLowerCase()}.${String(node.className || '').split(' ').filter(Boolean).join('.')} → ${Math.round(rect.right)}px`);
        }
      });
      return {client: limit, scroll: document.documentElement.scrollWidth, offenders: offenders.slice(0, 6)};
    });
    assert.equal(
      metrics.scroll,
      metrics.client,
      `transbordamento horizontal em ${width}px (${step}): ${metrics.offenders.join(' | ') || 'sem elemento identificado'}`
    );
  };

  // 640 px equivale à largura efetiva de uma janela de 1280 px com zoom de 200%.
  for (const width of [320, 360, 430, 640, 1280]) {
    await page.setViewportSize({width, height: 800});
    await page.waitForTimeout(150);

    await openTab(page, 'Empurrar A');
    await noHorizontalOverflow(width, 'ficha aberta');
    const start = page.getByRole('button', {name: 'Iniciar treino', exact: true});
    if (await start.count()) {
      await start.click();
      await waitStatus(page, 'Iniciado');
    }
    const row = page.locator('.set-row:not(.is-warmup)').first();
    await row.locator('input').nth(0).scrollIntoViewIfNeeded();
    await row.locator('input').nth(0).fill(String(40 + width / 100));
    await row.locator('input').nth(1).fill('12');
    await row.getByRole('button', {name: /Concluir série|Atualizar série/}).click();
    await page.waitForTimeout(400);
    await noHorizontalOverflow(width, 'série concluída');

    await row.getByRole('button', {name: 'Iniciar descanso', exact: true}).click();
    assert.equal(await page.locator('#timer-bar').isVisible(), true, `cronômetro invisível em ${width}px`);
    await noHorizontalOverflow(width, 'cronômetro visível');
    await page.locator('#timer-bar').getByRole('button', {name: 'Parar', exact: true}).click();

    await page.getByRole('button', {name: 'Remarcar', exact: true}).click();
    await page.locator('#app-modal').waitFor({state: 'visible'});
    assert.equal(await page.locator('#reschedule-date').isVisible(), true, `campo do modal invisível em ${width}px`);
    await noHorizontalOverflow(width, 'modal aberto');
    await page.keyboard.press('Escape');
    await page.locator('#app-modal').waitFor({state: 'hidden'});

    for (const label of ['Caminhada', 'Medidas', 'Ciclos', 'Ajustes', 'Evolução', 'Hoje']) {
      await openTab(page, label);
      await page.waitForTimeout(120);
      await noHorizontalOverflow(width, `aba ${label}`);
    }
    await openTab(page, 'Caminhada');
    assert.equal(await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).isVisible(), true);
    await openTab(page, 'Medidas');
    assert.equal(await page.locator('input[name="weight"]').isVisible(), true);
    await openTab(page, 'Ajustes');
    assert.equal(await page.getByRole('button', {name: 'Exportar JSON completo', exact: true}).isVisible(), true);
    assert.equal(await page.getByRole('button', {name: 'Exportar JSON criptografado', exact: true}).isVisible(), true);
  }

  // Movimento reduzido precisa desligar transições e a rolagem suave.
  const motion = await page.evaluate(() => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    transition: parseFloat(getComputedStyle(document.querySelector('.tab')).transitionDuration),
    animation: parseFloat(getComputedStyle(document.querySelector('.tab')).animationDuration)
  }));
  assert.equal(motion.reduced, true);
  assert.equal(motion.scrollBehavior, 'auto', 'com movimento reduzido a rolagem suave precisa ser desligada');
  assert.ok(motion.transition <= 0.001, `transição não neutralizada: ${motion.transition}s`);
  assert.ok(motion.animation <= 0.001, `animação não neutralizada: ${motion.animation}s`);

  // Texto ampliado precisa aumentar de fato e continuar sem transbordamento.
  await page.setViewportSize({width: 360, height: 800});
  await openTab(page, 'Ajustes');
  const baseSize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  await page.locator('input[data-action="setting-toggle"][data-setting="largeText"]').check();
  await page.waitForTimeout(300);
  const largeSize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  assert.ok(largeSize > baseSize, `texto ampliado não aumentou: ${baseSize} → ${largeSize}`);
  for (const label of ['Hoje', 'Empurrar A', 'Caminhada', 'Medidas', 'Ajustes']) {
    await openTab(page, label);
    await page.waitForTimeout(120);
    await noHorizontalOverflow(360, `texto ampliado · ${label}`);
  }

  assert.deepEqual(errors, []);
});

// Servidor com sw.js reescrito sob demanda, para exercitar duas versões reais de cache.
function startVersionedServer(state) {
  const server = http.createServer((request, response) => {
    const requested = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = requested === '/' ? 'index.html' : decodeURIComponent(requested.slice(1));
    const absolute = path.resolve(ROOT, relative);
    if (!absolute.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (state.missing && state.missing.includes(relative)) {
      response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('ausente de propósito');
      return;
    }
    fs.readFile(absolute, (error, bytes) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, {'Content-Type': 'text/plain; charset=utf-8'}).end(error.message);
        return;
      }
      let body = bytes;
      if (relative === 'sw.js' && state.version) {
        // O sw.js monta o nome do cache por template: `${CACHE_PREFIX}v3.0.1`.
        body = Buffer.from(bytes.toString('utf8').replace(/(\$\{CACHE_PREFIX\})v[\d.]+/, `$1${state.version}`), 'utf8');
      }
      response.writeHead(200, {'Content-Type': MIME[path.extname(absolute)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(body);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('manifesto e ícones da PWA existem, têm as dimensões declaradas e o maskable respeita a zona segura', {timeout: 120000}, async t => {
  const {page, baseUrl, errors} = await openApp(t);

  const manifestResponse = await page.request.get(`${baseUrl}manifest.webmanifest`);
  assert.equal(manifestResponse.status(), 200);
  assert.match(manifestResponse.headers()['content-type'], /application\/manifest\+json/);
  const manifest = JSON.parse(await manifestResponse.text());
  assert.equal(manifest.name, 'Treino Hard (Fofo)');
  assert.equal(manifest.short_name, 'Treino Hard');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'pt-BR');
  assert.ok(manifest.background_color && manifest.theme_color);

  const declared = manifest.icons.map(icon => `${icon.sizes}:${icon.purpose}`);
  assert.ok(declared.includes('192x192:any'), 'falta o ícone 192×192');
  assert.ok(declared.includes('512x512:any'), 'falta o ícone 512×512');
  assert.ok(declared.includes('512x512:maskable'), 'falta a arte maskable');

  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, baseUrl).href);
    assert.equal(response.status(), 200, `${icon.src} respondeu ${response.status()}`);
    assert.match(response.headers()['content-type'], /image\/png/, `${icon.src} não é servido como PNG`);
    const measured = await page.evaluate(source => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
      image.onerror = () => reject(new Error(`falha ao carregar ${source}`));
      image.src = source;
    }), icon.src);
    assert.equal(measured, icon.sizes, `${icon.src} tem ${measured} e declara ${icon.sizes}`);
  }

  // O maskable precisa ser realmente preparado: conteúdo dentro do círculo central de 80%.
  const safety = await page.evaluate(async () => {
    const load = source => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(source));
      image.src = source;
    });
    const inspect = async source => {
      const image = await load(source);
      const size = image.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, size, size).data;
      const corner = [data[4], data[5], data[6]];
      let outside = 0;
      let inside = 0;
      let maxRadius = 0;
      const center = size / 2;
      const safeRadius = size * 0.4;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const offset = (y * size + x) * 4;
          if (data[offset + 3] < 16) continue;
          const distinct = Math.abs(data[offset] - corner[0]) + Math.abs(data[offset + 1] - corner[1]) + Math.abs(data[offset + 2] - corner[2]) > 24;
          if (!distinct) continue;
          const radius = Math.hypot(x - center, y - center);
          if (radius > maxRadius) maxRadius = radius;
          if (radius > safeRadius) outside += 1; else inside += 1;
          const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
          if (edge) outside += 1;
        }
      }
      return {size, safeRadius, maxRadius, outside, inside, transparentCorner: data[3] < 16};
    };
    return {maskable: await inspect('./icon-maskable-512.png'), any: await inspect('./icon-512.png')};
  });

  assert.equal(safety.maskable.outside, 0, `há conteúdo do maskable fora da zona segura (raio máximo ${Math.round(safety.maskable.maxRadius)} de ${safety.maskable.safeRadius})`);
  assert.ok(safety.maskable.inside > 1000, 'o maskable precisa conter o desenho');
  assert.equal(safety.maskable.transparentCorner, false, 'o maskable precisa sangrar a cor de fundo até as bordas');
  assert.ok(safety.any.maxRadius > safety.maskable.maxRadius + 20, 'o maskable não pode ser uma cópia do ícone comum');

  const links = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(node => node.getAttribute('href')));
  for (const href of links) {
    const response = await page.request.get(new URL(href, baseUrl).href);
    assert.equal(response.status(), 200, `${href} referenciado no HTML respondeu ${response.status()}`);
  }

  assert.deepEqual(errors, []);
});

test('offline: recarregar, registrar série, salvar caminhada, fechar e reabrir', {timeout: 150000}, async t => {
  const {page, context, baseUrl, errors} = await openApp(t);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await reloadApp(page);
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);

  await context.setOffline(true);
  await reloadApp(page);
  assert.equal(await page.getByRole('heading', {name: 'Treino Hard (Fofo)', exact: true}).isVisible(), true);
  await page.locator('#app-notice').waitFor({state: 'visible', timeout: 8000});
  assert.match(await page.locator('#app-notice').innerText(), /offline/i);

  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  const row = page.locator('.set-row:not(.is-warmup)').first();
  await row.locator('input').nth(0).fill('48');
  await row.locator('input').nth(1).fill('14');
  await row.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(400);
  assert.match(await row.getAttribute('class'), /is-complete/);

  await openTab(page, 'Caminhada');
  await page.locator('input[name="date"]').fill('2026-08-12');
  await page.locator('input[name="durationMinutes"]').fill('26');
  await page.getByRole('button', {name: 'Salvar caminhada', exact: true}).click();
  await page.waitForTimeout(400);

  await openTab(page, 'Evolução');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#panel-evolution').count(), 1, 'o histórico precisa continuar consultável offline');

  // Fechar e reabrir sem rede.
  await page.close();
  const reopened = await context.newPage();
  const reopenedErrors = [];
  reopened.on('pageerror', error => reopenedErrors.push(`pageerror: ${error.message}`));
  reopened.on('console', message => {
    if (message.type() === 'error') reopenedErrors.push(`console: ${message.text()}`);
  });
  await reopened.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(reopened);
  const stored = await readStoredDocument(reopened);
  assert.equal(stored.cardio.length, 1);
  assert.equal(stored.cardio[0].durationMinutes, 26);
  const offlineSet = stored.sessions.find(session => session.workoutId === 'push_a').exercises
    .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.type === 'work')[0];
  assert.equal(offlineSet.load, '48');
  assert.equal(offlineSet.reps, '14');
  assert.equal(offlineSet.status, 'completed');

  await context.setOffline(false);
  await reloadApp(reopened);
  assert.equal((await readStoredDocument(reopened)).cardio.length, 1, 'voltar a ter rede não pode descartar o que foi salvo offline');

  assert.deepEqual(errors.filter(item => !/Failed to fetch|net::ERR/i.test(item)), []);
  assert.deepEqual(reopenedErrors.filter(item => !/Failed to fetch|net::ERR/i.test(item)), []);
});

test('atualização da PWA avisa, espera confirmação, troca de cache e preserva os dados', {timeout: 180000}, async t => {
  // A versão de partida vem do próprio sw.js publicado; a versão seguinte é
  // derivada dela, para o teste não envelhecer a cada publicação.
  const declared = /\$\{CACHE_PREFIX\}v(\d+)\.(\d+)\.(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'));
  assert.ok(declared, 'sw.js precisa declarar um cache versionado');
  const baseVersion = `v${declared[1]}.${declared[2]}.${declared[3]}`;
  const nextVersion = `v${declared[1]}.${declared[2]}.${Number(declared[3]) + 1}`;
  const state = {version: baseVersion, missing: []};
  const server = await startVersionedServer(state);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless: true, executablePath: CHROME});
  t.after(() => browser.close());
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'allow'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await reloadApp(page);
  assert.deepEqual(await page.evaluate(() => caches.keys()), [`treino-hard-${baseVersion}`]);

  // Treino em andamento e marcador para provar que ninguém recarregou sozinho.
  await openTab(page, 'Empurrar A');
  await page.getByRole('button', {name: 'Iniciar treino', exact: true}).click();
  await waitStatus(page, 'Iniciado');
  const row = page.locator('.set-row:not(.is-warmup)').first();
  await row.locator('input').nth(0).fill('61');
  await row.locator('input').nth(1).fill('11');
  await row.getByRole('button', {name: 'Concluir série', exact: true}).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__semRecarga = true; });

  state.version = nextVersion;
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(registration => registration.update()));

  await page.waitForFunction(
    () => /nova versão do aplicativo está pronta/i.test(document.getElementById('app-notice')?.textContent || ''),
    null,
    {timeout: 30000}
  );
  assert.equal(await page.evaluate(() => window.__semRecarga === true), true, 'o app não pode recarregar antes da confirmação');
  assert.equal(await page.locator('#tab-push_a').getAttribute('aria-selected'), 'true', 'a aba aberta precisa continuar a mesma');
  assert.equal(await page.locator('.set-row:not(.is-warmup)').first().locator('input').nth(0).inputValue(), '61');
  const caches1 = await page.evaluate(() => caches.keys());
  assert.deepEqual(caches1.sort(), [`treino-hard-${baseVersion}`, `treino-hard-${nextVersion}`].sort(), 'a versão nova instala em cache próprio antes de ativar');

  await Promise.all([
    page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 30000}),
    page.getByRole('button', {name: 'Atualizar agora', exact: true}).click()
  ]);
  await waitAppReady(page);

  assert.equal(await page.evaluate(() => window.__semRecarga === undefined), true, 'a confirmação precisa recarregar a página');
  await page.waitForFunction(async () => (await caches.keys()).length === 1, null, {timeout: 20000});
  assert.deepEqual(await page.evaluate(() => caches.keys()), [`treino-hard-${nextVersion}`], 'o cache antigo precisa ser removido na ativação');
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);

  const stored = await readStoredDocument(page);
  const preserved = stored.sessions.find(session => session.workoutId === 'push_a').exercises
    .find(item => item.exerciseId === 'chest_press_machine').sets.filter(set => set.type === 'work')[0];
  assert.equal(preserved.load, '61', 'a atualização não pode perder o registro do treino');
  assert.equal(preserved.reps, '11');
  assert.equal(stored.sessions.find(session => session.workoutId === 'push_a').status, 'started');

  assert.deepEqual(errors, []);
});

test('falha de cache do service worker é avisada em vez de silenciada', {timeout: 120000}, async t => {
  const state = {version: 'v3.0.9', missing: ['styles.css']};
  const server = await startVersionedServer(state);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless: true, executablePath: CHROME});
  t.after(() => browser.close());
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'allow'});
  const page = await context.newPage();

  await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(page);
  await page.waitForFunction(
    () => /Falha da PWA/i.test(document.getElementById('app-notice')?.textContent || ''),
    null,
    {timeout: 30000}
  );
  assert.match(await page.locator('#app-notice').innerText(), /Falha da PWA/i);
  assert.match(await page.locator('#app-notice').getAttribute('class'), /is-error/);
  assert.deepEqual(await page.evaluate(() => caches.keys()), [], 'um shell incompleto não pode ficar registrado como cache válido');
  // O aplicativo continua utilizável mesmo sem o pacote offline.
  await openTab(page, 'Empurrar A');
  assert.equal(await page.getByRole('button', {name: 'Iniciar treino', exact: true}).isVisible(), true);
});

// Ficha canônica conferida na interface real, e não apenas no catálogo.
const FICHA_NA_TELA = Object.freeze({
  'Empurrar A': {total: 17, linhas: 17, itens: [
    '1. Supino reto na máquina', '2. Supino inclinado na máquina', '3. Crossover na polia',
    '4. Desenvolvimento na máquina', '5. Elevação lateral com halteres',
    '6. Tríceps testa com halteres', '7. Tríceps na polia com corda'
  ]},
  'Puxar A': {total: 15, linhas: 17, itens: [
    '1. Puxada frontal com pegada supinada', '2. Remada sentada com triângulo',
    '3. Remada unilateral na máquina — lado esquerdo', '3. Remada unilateral na máquina — lado direito',
    '4. Crucifixo invertido no aparelho', '5. Rosca direta com barra W', '6. Rosca martelo em pé'
  ]},
  'Pernas A': {total: 14, linhas: 14, itens: [
    '1. Alongamento de adutores em borboleta', '2. Mobilidade de quadril em borboleta',
    '3. Alongamento de posterior da coxa sentado', '4. Mobilidade de tornozelo',
    '5. Agachamento', '6. Leg press 45°', '7. Cadeira extensora', '8. Flexora',
    '9. Panturrilha em pé ou no leg press'
  ]},
  'Empurrar B': {total: 15, linhas: 15, itens: [
    '1. Supino reto na máquina', '2. Supino inclinado na máquina', '3. Crucifixo no aparelho',
    '4. Desenvolvimento na máquina', '5. Elevação lateral com halteres',
    '6. Tríceps testa ou extensão acima da cabeça', '7. Tríceps na polia com corda'
  ]},
  'Puxar B': {total: 14, linhas: 16, itens: [
    '1. Puxada frontal com pegada neutra', '2. Remada sentada ou articulada',
    '3. Remada unilateral na máquina — lado esquerdo', '3. Remada unilateral na máquina — lado direito',
    '4. Crucifixo invertido no aparelho', '5. Rosca direta com barra W', '6. Rosca martelo em pé'
  ]},
  'Pernas B': {total: 14, linhas: 14, itens: [
    '1. Alongamento de adutores em borboleta', '2. Mobilidade de quadril em borboleta',
    '3. Alongamento de posterior da coxa sentado', '4. Mobilidade de tornozelo',
    '5. Levantamento terra com barra', '6. Leg press 45°', '7. Flexora',
    '8. Cadeira extensora', '9. Panturrilha sentada'
  ]}
});

test('ficha canônica aparece na interface dos seis treinos', {timeout: 180000}, async t => {
  const {page, errors} = await openApp(t);

  for (const [aba, esperado] of Object.entries(FICHA_NA_TELA)) {
    await openTab(page, aba);
    await page.waitForTimeout(120);
    const titulos = await page.locator('#panels article.section-card .card-title h3').allInnerTexts();
    assert.deepEqual(titulos.map(item => item.trim()), esperado.itens, `lista ou ordem divergente em ${aba}`);
    assert.equal(await page.locator('#panels .set-row:not(.is-warmup)').count(), esperado.linhas, `séries de trabalho divergentes em ${aba}`);
    assert.match(await page.locator('#panels .card p').first().innerText(), new RegExp(`${esperado.total} séries de trabalho planejadas`), `volume anunciado divergente em ${aba}`);
    const texto = await page.locator('#panels').innerText();
    assert.doesNotMatch(texto, /stiff|romen/i, `exercício proibido visível em ${aba}`);
  }

  // Remada unilateral: dois cartões, um por lado, com duas séries cada.
  await openTab(page, 'Puxar A');
  const unilaterais = page.locator('#panels article.section-card').filter({hasText: 'Remada unilateral na máquina'});
  assert.equal(await unilaterais.count(), 2);
  assert.equal(await unilaterais.nth(0).locator('.set-row:not(.is-warmup)').count(), 2);
  assert.equal(await unilaterais.nth(1).locator('.set-row:not(.is-warmup)').count(), 2);
  assert.deepEqual(
    (await unilaterais.locator('.badge.is-side').allInnerTexts()).map(item => item.trim().toLocaleLowerCase('pt-BR')),
    ['esquerdo', 'direito']
  );

  // Cargas dos dois lados não se misturam.
  await unilaterais.nth(0).getByText('Detalhes do exercício', {exact: true}).click();
  await unilaterais.nth(0).locator('input[data-field="machineId"]').fill('articulada 2');
  await unilaterais.nth(1).getByText('Detalhes do exercício', {exact: true}).click();
  await unilaterais.nth(1).locator('input[data-field="machineId"]').fill('articulada 2');
  await page.waitForTimeout(300);
  const armazenado = await readStoredDocument(page);
  const registros = armazenado.sessions.find(session => session.workoutId === 'pull_a').exercises
    .filter(log => log.exerciseId === 'unilateral_row_machine');
  assert.deepEqual(registros.map(log => log.side), ['left', 'right']);
  assert.equal(new Set(registros.map(log => log.id)).size, 2);

  // Tríceps de Empurrar B oferece as duas execuções da ficha.
  await openTab(page, 'Empurrar B');
  const triceps = page.locator('#panels article.section-card').filter({hasText: 'Tríceps testa ou extensão acima da cabeça'});
  assert.equal(await triceps.count(), 1);
  const chips = triceps.locator('button[data-action="variation-pick"]');
  assert.deepEqual(
    (await chips.allInnerTexts()).map(item => item.trim()),
    ['Extensão acima da cabeça', 'Tríceps testa com halteres']
  );
  assert.equal(await chips.nth(0).getAttribute('aria-pressed'), 'true');
  await chips.nth(1).click();
  await page.waitForTimeout(400);
  assert.equal(
    (await readStoredDocument(page)).sessions.find(session => session.workoutId === 'push_b').exercises
      .find(log => log.exerciseId === 'triceps_overhead').variationId,
    'skull_crusher'
  );

  // Periodização visível: semana 1 e semana 7 nas metas dos cartões.
  await openTab(page, 'Empurrar A');
  assert.match(await page.locator('#panels article.section-card').first().innerText(), /3 × 12–15 · 3 RIR/);
  await page.locator('button[data-action="cycle-week-set"][data-week="7"]').click();
  await page.waitForTimeout(500);
  await openTab(page, 'Empurrar A');
  assert.match(await page.locator('#panels article.section-card').first().innerText(), /3 × 6–8 · 1–2 RIR/);
  await openTab(page, 'Pernas B');
  assert.match(await page.locator('#panels article.section-card').filter({hasText: 'Levantamento terra'}).innerText(), /2 × 4–6 · 2–3 RIR/);

  assert.deepEqual(errors, []);
});

test('versão do app e esquema aparecem em Ajustes e no rodapé', {timeout: 90000}, async t => {
  const {page, errors} = await openApp(t);
  const esperada = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  const esquema = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8').match(/SCHEMA_VERSION = (\d+)/)[1];

  await openTab(page, 'Ajustes');
  await page.locator('#about-card').waitFor({state: 'visible'});
  const sobre = await page.locator('#about-card').innerText();
  assert.match(sobre, /Treino Hard \(Fofo\)/);
  assert.equal(await page.locator('#about-card [data-about="app-version"]').innerText(), esperada);
  assert.equal(await page.locator('#about-card [data-about="schema"]').innerText(), esquema);
  assert.match(sobre, /Cache do pacote offline/);
  assert.match(await page.locator('#footer-version').innerText(), new RegExp(`versão ${esperada.replace(/\./g, '\\.')} · esquema ${esquema}`));

  assert.deepEqual(errors, []);
});

// Caminho real de atualização de quem já tinha a versão 2.2 instalada como PWA.
// A 2.2 é reconstruída a partir do commit publicado anteriormente.
test('quem tem a 2.2 instalada recebe a 3.x e mantém o histórico legado', {timeout: 240000}, async t => {
  const {execFileSync} = require('node:child_process');
  const os = require('node:os');
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'treino-hard-v22-'));
  t.after(() => fs.rmSync(legacyRoot, {recursive: true, force: true}));
  for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', 'logo.png']) {
    const bytes = execFileSync('git', ['show', `ad2e552:${file}`], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer'});
    fs.writeFileSync(path.join(legacyRoot, file), bytes);
  }
  assert.match(fs.readFileSync(path.join(legacyRoot, 'sw.js'), 'utf8'), /treino-hard-v2\.2/);

  const state = {root: legacyRoot};
  const server = await new Promise(resolve => {
    const instance = http.createServer((request, response) => {
      const requested = new URL(request.url, 'http://127.0.0.1').pathname;
      const relative = requested === '/' ? 'index.html' : decodeURIComponent(requested.slice(1));
      fs.readFile(path.resolve(state.root, relative), (error, bytes) => {
        if (error) {
          response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end(error.message);
          return;
        }
        response.writeHead(200, {'Content-Type': MIME[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(bytes);
      });
    });
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;

  const browser = await chromium.launch({headless: true, executablePath: CHROME});
  t.after(() => browser.close());
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'allow'});

  // 1. Versão antiga instalada, com dados reais do esquema 9.
  const antiga = await context.newPage();
  await antiga.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await antiga.evaluate(() => navigator.serviceWorker.ready);
  // A 2.2 recarrega sozinha quando o service worker assume o controle — o
  // comportamento que a 3.x corrigiu. Espera passar para ter contexto estável.
  await antiga.waitForTimeout(1500);
  await antiga.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await antiga.evaluate(() => navigator.serviceWorker.ready);
  await antiga.evaluate(() => {
    localStorage.setItem('jovilite_data', JSON.stringify({
      1: {1: {a_puxada_supinada: {done: true, sets: [{kg: 40, reps: 12}, {kg: 40, reps: 11}]},
              a_remada_smith: {done: true, sets: [{kg: 30, reps: 10}]}}}
    }));
    localStorage.setItem('jovilite_body_measurements', JSON.stringify([{date: '2026-07-01', weight: 112, arm: 39}]));
    localStorage.setItem('jovilite_cycle_started', '2026-06-01T09:00:00.000Z');
  });
  assert.deepEqual(await antiga.evaluate(() => caches.keys()), ['treino-hard-v2.2'], 'a 2.2 precisa estar em cache');

  // 2. Publicação da versão nova na mesma origem.
  state.root = ROOT;
  await antiga.evaluate(() => navigator.serviceWorker.getRegistration().then(registration => registration.update()));
  await antiga.waitForFunction(async () => (await caches.keys()).length >= 2, null, {timeout: 30000});

  // 3. O usuário fecha o aplicativo e abre de novo: a versão nova assume.
  await antiga.close();
  const nova = await context.newPage();
  const erros = [];
  nova.on('pageerror', error => erros.push(`pageerror: ${error.message}`));
  nova.on('console', message => {
    if (message.type() === 'error') erros.push(`console: ${message.text()}`);
  });
  await nova.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await waitAppReady(nova);

  // O service worker da 2.2 busca a navegação na rede antes do cache, então a
  // interface nova já aparece; o worker antigo, porém, continua no controle e o
  // novo fica em espera. É exatamente aí que o aviso de atualização precisa
  // existir, em vez de um reload forçado no meio de um treino.
  const esperada = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  await openTab(nova, 'Ajustes');
  await nova.locator('#about-card').waitFor({state: 'visible'});
  assert.equal(await nova.locator('#about-card [data-about="app-version"]').innerText(), esperada, 'a interface nova precisa aparecer ao reabrir');

  await nova.waitForFunction(
    () => /nova versão do aplicativo está pronta/i.test(document.getElementById('app-notice')?.textContent || ''),
    null,
    {timeout: 30000}
  );
  await Promise.all([
    nova.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 30000}),
    nova.getByRole('button', {name: 'Atualizar agora', exact: true}).click()
  ]);
  await waitAppReady(nova);
  assert.equal(await nova.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);

  let caches1 = [];
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    caches1 = await nova.evaluate(() => caches.keys());
    if (caches1.length === 1) break;
    await nova.waitForTimeout(500);
  }
  assert.deepEqual(caches1, [`treino-hard-v${esperada}`], 'só o cache da versão nova pode sobrar depois de atualizar');

  // 4. O histórico do esquema 9 vira ciclo legado, sem virar treino atual.
  const documento = await readStoredDocument(nova);
  assert.equal(documento.schemaVersion, 11);
  assert.equal(documento.legacyCycles.length >= 1, true, 'o ciclo ABC precisa ser preservado');
  const registros = documento.legacyCycles.flatMap(cycle => cycle.records);
  assert.equal(registros.length >= 2, true);
  const supinada = registros.find(record => record.legacyExerciseId === 'a_puxada_supinada');
  assert.equal(supinada.canonicalId, 'pulldown_supinated');
  assert.equal(supinada.sets.map(set => `${set.load}x${set.reps}`).join(','), '40x12,40x11');
  const ambiguo = registros.find(record => record.legacyExerciseId === 'a_remada_smith');
  assert.equal(ambiguo.mappingStatus, 'ambiguous', 'IDs ambíguos continuam ambíguos');
  assert.equal(ambiguo.canonicalId, '', 'ID ambíguo não pode virar exercício atual');
  assert.equal(documento.measurements.length, 1);
  assert.equal(documento.measurements[0].armLeft, '39');
  assert.equal(documento.measurements[0].armRight, '39');
  assert.ok(documento.measurements[0].quality.warnings.includes('legacy_single_arm_copied_to_both_sides'));
  assert.equal(documento.sessions.length, 6, 'a semana nova é criada sem apagar o legado');

  // 5. A fonte bruta anterior continua recuperável.
  await openTab(nova, 'Ajustes');
  await nova.waitForTimeout(600);
  assert.ok(await nova.getByRole('button', {name: 'Exportar arquivo bruto', exact: true}).count() >= 1, 'a fonte local anterior precisa ficar recuperável');

  assert.deepEqual(erros, []);
});
