'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {TextEncoder, TextDecoder} = require('node:util');
const {readLegacyState, readLegacyBackup} = require('./legacy-fixture.cjs');

const ROOT = path.resolve(__dirname, '..');
const NOW = '2026-09-06T12:00:00.000Z';
const BACKUPS_KEY = 'treinohard_auto_backups_v11';
const SNAPSHOT_KEY = 'treinohard_snapshot_v11';
const plain = value => JSON.parse(JSON.stringify(value));

function boot(initial = {}, beforeCore = '') {
  const store = new Map(Object.entries(initial));
  let uuid = 0;
  let lockTail = Promise.resolve();
  const context = vm.createContext({
    console, TextEncoder, TextDecoder,
    crypto: {
      randomUUID: () => `20000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: webcrypto.subtle
    },
    localStorage: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key)
    },
    navigator: {locks: {request(_name, _options, callback) {
      const next = lockTail.then(callback);
      lockTail = next.catch(() => undefined);
      return next;
    }}}
  });
  for (const file of ['js/workouts.js', 'js/legacy-v12.js', 'js/core.js', 'js/storage.js']) {
    if (file === 'js/core.js' && beforeCore) vm.runInContext(beforeCore, context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, {filename: file});
  }
  return {context, store, Core: context.THFCore, Data: context.THFData, Storage: context.THFStorage,
    clone(value) {
      context.__fixture = JSON.stringify(value);
      const result = vm.runInContext('JSON.parse(__fixture)', context);
      delete context.__fixture;
      return result;
    }};
}

function stateWith(app, session) {
  const state = app.Core.defaultState();
  state.sessions.push(session);
  return state;
}

function group(session, id) { return session.exercises.filter(log => log.exerciseId === id); }
function sides(session, id) { return plain(group(session, id).map(log => log.side)); }
function allSessions(state) { return state.sessions.concat(state.archives.flatMap(archive => archive.sessions)); }
function fill(log, load = '40') {
  log.sets.filter(set => set.type === 'work').forEach(set => {
    Object.assign(set, {load, reps: String(log.prescriptionSnapshot.max), rir: String(log.prescriptionSnapshot.rirMin), status: 'completed', completedAt: NOW});
  });
}
function compareLegacySession(before, after) {
  for (const key of Object.keys(before).filter(key => key !== 'exercises')) {
    assert.deepEqual(plain(after[key]), before[key], `session ${before.id}.${key}`);
  }
  assert.equal(after.exercises.length, before.exercises.length);
  before.exercises.forEach((oldLog, index) => {
    const migrated = after.exercises[index];
    for (const key of Object.keys(oldLog)) assert.deepEqual(plain(migrated[key]), oldLog[key], `${oldLog.id}.${key}`);
    assert.equal(migrated.executionFeedback, null, 'a missing historical report is not invented');
    assert.equal(migrated.sideModeSnapshot, oldLog.side === 'bilateral' ? 'bilateral' : 'unilateral');
  });
  assert.equal(after.postLegCheck, null);
  assert.equal(after.workoutSnapshot.revision, '3.5.1');
}

async function encryptedFixture(app, payload, schemaVersion) {
  const password = 'fixture-synthetic-password';
  const iterations = 310000;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const header = {
    app: app.Core.APP_ID, format: app.Core.ENCRYPTED_FORMAT, formatVersion: 1, schemaVersion,
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations, salt: Buffer.from(salt).toString('base64')},
    cipher: {name: 'AES-GCM', length: 256, tagBits: 128, iv: Buffer.from(iv).toString('base64')}
  };
  const aad = new TextEncoder().encode([header.app, header.format, header.formatVersion, header.schemaVersion,
    header.kdf.name, header.kdf.hash, header.kdf.iterations, header.kdf.salt,
    header.cipher.name, header.cipher.length, header.cipher.tagBits, header.cipher.iv].join('|'));
  const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  const encrypted = await webcrypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad, tagLength: 128}, key,
    new TextEncoder().encode(JSON.stringify(payload)));
  return {password, document: app.clone({...header, createdAt: NOW, ciphertext: Buffer.from(encrypted).toString('base64')})};
}

test('schema 12 físico migra sem alterar qualquer campo histórico, inclusive arquivos e lados diferentes', () => {
  const app = boot();
  const original = readLegacyState();
  const input = app.clone(original);
  const migrated = app.Core.migratePayload(input);
  assert.deepEqual(plain(input), original, 'migration must not mutate its recovery source');
  assert.equal(migrated.schemaVersion, 13);
  assert.equal(migrated.revision, original.revision);
  assert.deepEqual(plain(migrated.settings.sideTracking), {enabled: true, affectedSide: 'right'});
  assert.deepEqual(plain(migrated.settings.equipmentLoadSteps), original.settings.equipmentLoadSteps);
  allSessions(original).forEach((oldSession, index) => compareLegacySession(oldSession, allSessions(migrated)[index]));
  assert.deepEqual(plain(migrated.measurements), original.measurements);
  assert.deepEqual(plain(migrated.archives.map(item => item.cycle)), original.archives.map(item => item.cycle));
  assert.equal(migrated.progressionDecisions[0].side, 'right');
  for (const key of Object.keys(original.progressionDecisions[0])) {
    assert.deepEqual(plain(migrated.progressionDecisions[0][key]), original.progressionDecisions[0][key]);
  }
  const standing = group(migrated.sessions.find(item => item.workoutId === 'legs_a'), 'leg_curl');
  assert.equal(standing.length, 1, 'legacy standing curl must never be split retrospectively');
  assert.equal(standing[0].side, 'bilateral');
  assert.equal(standing[0].variationId, 'standing_unilateral');
  const roundtrip = app.Core.migratePayload(app.Core.buildBackup(migrated));
  assert.deepEqual(plain(roundtrip), plain(migrated));
});

test('migração física é persistida antes do backup e sobrevive à reabertura sem migrar novamente', async () => {
  const source = JSON.stringify(readLegacyState());
  const app = boot({'treinohard_document_v11': source});
  const storage = new app.Storage.AppStorage();
  const state = await storage.init();
  assert.equal(storage.writeBlocked, false);
  assert.equal(JSON.parse(app.store.get(app.Storage.FALLBACK_KEY)).schemaVersion, 13);
  await storage.automaticBackup(state, true);
  assert.equal((await storage.listBackups())[0].state.schemaVersion, 13);
  assert.ok(app.store.get(app.Storage.FALLBACK_RECOVERY_KEY).includes('schemaVersion'), 'raw recovery source is present');
  const reload = new app.Storage.AppStorage();
  const reopened = await reload.init();
  assert.deepEqual(plain(reopened), plain(state));
  assert.equal(reopened.migrationLog.filter(item => item.from === 12 && item.to === 13).length, 1);
  allSessions(readLegacyState()).forEach((oldSession, index) => compareLegacySession(oldSession, allSessions(reopened)[index]));
});

for (const schema of [11, 12]) {
  test(`backup criptografado real do esquema ${schema} autentica, migra e preserva os registros`, async () => {
    const app = boot();
    const fixture = readLegacyBackup(schema);
    const {document, password} = await encryptedFixture(app, fixture, schema);
    const decrypted = await app.Core.decryptBackup(document, password);
    assert.deepEqual(plain(decrypted), fixture);
    const migrated = app.Core.migratePayload(decrypted);
    assert.equal(migrated.schemaVersion, 13);
    allSessions(fixture.state).forEach((oldSession, index) => compareLegacySession(oldSession, allSessions(migrated)[index]));
    const tampered = app.clone(document);
    tampered.schemaVersion = schema === 11 ? 12 : 11;
    await assert.rejects(app.Core.decryptBackup(tampered, password), /adulterado/);
  });
}

test('backup autenticado não pode declarar externamente esquema diferente do conteúdo interno', async () => {
  const app = boot();
  const {document, password} = await encryptedFixture(app, readLegacyBackup(12), 11);
  await assert.rejects(app.Core.decryptBackup(document, password), /esquema autenticado/);
});

test('backups automáticos e snapshots antigos são listados e restaurados sem editar a fonte', async () => {
  const fixture = readLegacyState();
  const oldBackup = {id: 'old-backup', savedAt: NOW, state: fixture};
  const oldSnapshot = {id: 'old-snapshot', savedAt: NOW, reason: 'Synthetic schema 12', state: fixture};
  const app = boot({[BACKUPS_KEY]: JSON.stringify([oldBackup]), [SNAPSHOT_KEY]: JSON.stringify(oldSnapshot)});
  const storage = new app.Storage.AppStorage();
  let state = await storage.init();
  assert.equal((await storage.listBackups())[0].state.schemaVersion, 12);
  assert.equal((await storage.latestSnapshot()).state.schemaVersion, 12);
  state = await storage.restoreLatestSnapshot(state);
  assert.equal(state.schemaVersion, 13);
  assert.deepEqual(JSON.parse(app.store.get(SNAPSHOT_KEY)), oldSnapshot);
  allSessions(fixture).forEach((oldSession, index) => compareLegacySession(oldSession, allSessions(state)[index]));
  state = await storage.restoreBackup('old-backup', state);
  assert.equal(state.schemaVersion, 13);
  assert.deepEqual(JSON.parse(app.store.get(BACKUPS_KEY))[0], oldBackup);
  await storage.automaticBackup(state, true);
  assert.ok((await storage.listBackups()).some(item => item.id === 'old-backup'));
});

test('backup antigo corrompido ou futuro não é promovido a cópia restaurável', async () => {
  const future = readLegacyState(); future.schemaVersion = 999;
  const corrupt = readLegacyState(); corrupt.sessions[0].exercises.pop();
  const app = boot({[BACKUPS_KEY]: JSON.stringify([
    {id: 'future', savedAt: NOW, state: future}, {id: 'corrupt', savedAt: NOW, state: corrupt},
    {id: 'valid', savedAt: NOW, state: readLegacyState()}
  ])});
  const storage = new app.Storage.AppStorage();
  const state = await storage.init();
  assert.deepEqual(plain((await storage.listBackups()).map(item => item.id)), ['valid']);
  await assert.rejects(storage.restoreBackup('corrupt', state), /não encontrada/);
  await assert.rejects(storage.restoreBackup('future', state), /não encontrada/);
});

test('sessões congeladas continuam válidas quando a ficha corrente muda de ordem e cardinalidade', () => {
  const first = boot();
  const migrated = first.Core.migratePayload(first.clone(readLegacyState()));
  const future = boot({}, `globalThis.THFData = Object.freeze(Object.assign({}, THFData, {
    WORKOUTS: [], WORKOUT_BY_ID: {}, WORKOUT_REVISION: 'future'
  }));`);
  const restored = future.Core.migratePayload(future.clone(first.Core.buildBackup(migrated)));
  assert.deepEqual(plain(restored), plain(migrated));
  assert.equal(future.Core.sessionWorkout(restored.sessions[0]).revision, '3.5.1');
});

test('histórico e degraus antigos sobrevivem à remoção de exercício do catálogo corrente', () => {
  const first = boot();
  const migrated = first.Core.migratePayload(first.clone(readLegacyState()));
  const future = boot({}, `globalThis.THFData = Object.freeze(Object.assign({}, THFData, {
    CATALOG: Object.fromEntries(Object.entries(THFData.CATALOG).filter(([id]) => id !== 'unilateral_row_machine'))
  }));`);
  const restored = future.Core.migratePayload(future.clone(first.Core.buildBackup(migrated)));
  assert.deepEqual(plain(restored), plain(migrated));
});

test('cardinalidade e identidade são validadas contra o snapshot, incluindo arquivo', () => {
  const app = boot();
  const baseline = app.Core.migratePayload(app.clone(readLegacyState()));
  for (const mutate of [
    state => { state.sessions[0].exercises.pop(); },
    state => { state.sessions[0].workoutSnapshot.exercises[0].sideModeSnapshot = 'unilateral'; },
    state => { state.sessions[0].exercises[0].sideModeSnapshot = 'unilateral'; },
    state => { state.archives[0].sessions[0].exercises[0].side = 'right'; },
    state => { state.sessions[0].workoutSnapshot.id = 'another'; }
  ]) {
    const tampered = app.clone(baseline); mutate(tampered);
    assert.throws(() => app.Core.migratePayload(tampered), /cardinalidade|modo diferente|identidade/);
  }
});

test('perfil prefere unilateral em leg press e extensora, lado afetado primeiro, sem mudar agachamento/terra', () => {
  const app = boot();
  const settings = app.Core.normalizeSettings();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1, settings);
  for (const id of ['leg_press_45', 'leg_extension']) assert.deepEqual(sides(session, id), ['right', 'left']);
  assert.deepEqual(sides(session, 'squat'), ['bilateral']);
  const legsB = app.Core.createSession('legs_b', '2026-09-07', 1, settings);
  assert.deepEqual(sides(legsB, 'deadlift_barbell'), ['bilateral']);
  settings.sideTracking.affectedSide = 'left';
  const left = app.Core.createSession('legs_a', '2026-09-08', 1, settings);
  assert.deepEqual(sides(left, 'leg_press_45'), ['left', 'right']);
  assert.deepEqual(sides(session, 'leg_press_45'), ['right', 'left'], 'profile cannot rewrite an existing session');
  app.Core.assertCurrentStateStructure(stateWith(app, session));
});

test('desativar o acompanhamento mantém opções bilaterais sem colapsar remada ou flexora necessariamente unilateral', () => {
  const app = boot();
  const settings = app.Core.normalizeSettings(app.clone({sideTracking: {enabled: false, affectedSide: 'left'}}));
  const legs = app.Core.createSession('legs_a', '2026-09-06', 1, settings);
  for (const id of ['leg_press_45', 'leg_extension']) assert.deepEqual(sides(legs, id), ['bilateral']);
  const pull = app.Core.createSession('pull_a', '2026-09-07', 1, settings);
  assert.deepEqual(sides(pull, 'unilateral_row_machine'), ['right', 'left']);
  const curl = app.Core.createExerciseLogs(app.Data.CATALOG.leg_curl, 1, {variationId: 'standing_unilateral', settings});
  assert.deepEqual(plain(curl.map(log => log.side)), ['right', 'left']);
  for (const id of ['seated', 'lying']) {
    const logs = app.Core.createExerciseLogs(app.Data.CATALOG.leg_curl, 1, {variationId: id, settings});
    assert.deepEqual(plain(logs.map(log => log.side)), ['bilateral']);
  }
});

test('variantes unilaterais condicionais de panturrilha criam dois registros sem aprovar vídeo pendente', () => {
  const app = boot();
  for (const [id, variant] of [
    ['calf_standing_or_leg_press', 'standing_machine_unilateral'],
    ['calf_standing_or_leg_press', 'leg_press_45_unilateral'],
    ['calf_seated', 'seated_machine_unilateral']
  ]) {
    const exercise = app.Data.CATALOG[id];
    const definition = exercise.variants.find(item => item.id === variant);
    assert.equal(definition.requiresUnilateralSupport, true);
    const logs = app.Core.createExerciseLogs(exercise, 1, {variationId: variant});
    assert.deepEqual(plain(logs.map(log => log.side)), ['right', 'left']);
    assert.equal(app.Data.VIDEOS[definition.videoKey].status, 'pending');
  }
});

test('trocar modo em exercício vazio altera o grupo atomicamente e mantém o snapshot coerente', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  const log = group(session, 'leg_press_45')[0];
  const result = app.Core.changeExerciseVariant(session, log.id, 'machine_unspecified');
  assert.equal(result.changed, true);
  assert.deepEqual(sides(session, 'leg_press_45'), ['bilateral']);
  assert.equal(app.Core.sessionExercise(session, 'leg_press_45').sideModeSnapshot, 'bilateral');
  assert.equal(app.Core.changeExerciseVariant(session, group(session, 'leg_press_45')[0].id, 'machine_unilateral').changed, true);
  assert.deepEqual(sides(session, 'leg_press_45'), ['right', 'left']);
  app.Core.assertCurrentStateStructure(stateWith(app, session));
});

test('qualquer execução em qualquer lado bloqueia colapso estrutural, mesmo com confirmação', () => {
  const app = boot();
  const mutations = [
    log => { log.sets[0].load = '0'; }, log => { log.sets[0].reps = '1'; }, log => { log.sets[0].rir = '0'; },
    log => { log.sets[0].status = 'interrupted'; }, log => { log.sets[0].note = 'note'; },
    log => { log.sets[0].completedAt = NOW; }, log => { log.completed = true; }, log => { log.skipped = true; },
    log => { log.feeling = 'good'; }, log => { log.feedback = 'observation'; },
    log => { log.executionFeedback = app.Core.normalizeExecutionFeedback(app.clone({note: 'descriptive only'})); },
    log => { log.executionFeedback = app.Core.normalizeExecutionFeedback(app.clone({controlDifficulty: true})); }
  ];
  for (const side of ['right', 'left']) for (const mutate of mutations) {
    const session = app.Core.createSession('legs_a', '2026-09-06', 1);
    mutate(group(session, 'leg_press_45').find(log => log.side === side));
    const before = plain(session);
    const result = app.Core.changeExerciseVariant(session, group(session, 'leg_press_45')[0].id, 'machine_unspecified', undefined, {confirmed: true});
    assert.equal(result.blocked, true, `record on ${side} must block`);
    assert.equal(result.changed, false);
    assert.deepEqual(plain(session), before);
  }
});

test('bilateral com execução não se divide, lados com aparelhos distintos não se juntam silenciosamente', () => {
  const app = boot();
  const bilateral = app.Core.createSession('legs_a', '2026-09-06', 1, app.clone({sideTracking: {enabled: false}}));
  const log = group(bilateral, 'leg_press_45')[0]; log.sets[0].load = '50';
  assert.equal(app.Core.changeExerciseVariant(bilateral, log.id, 'machine_unilateral').blocked, true);
  const unilateral = app.Core.createSession('legs_a', '2026-09-07', 1);
  const logs = group(unilateral, 'leg_press_45');
  logs[0].machineId = 'A'; logs[1].machineId = 'B';
  assert.equal(app.Core.changeExerciseVariant(unilateral, logs[0].id, 'machine_unspecified').blocked, true);
  assert.deepEqual(sides(unilateral, 'leg_press_45'), ['right', 'left']);
});

test('troca de variante no mesmo modo exige confirmação sem descartar a carga ou modificar outro lado', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  const log = group(session, 'leg_curl')[0];
  log.sets[0].load = '42.5';
  const before = plain(log);
  assert.equal(app.Core.changeExerciseVariant(session, log.id, 'lying').requiresConfirmation, true);
  assert.deepEqual(plain(log), before);
  assert.equal(app.Core.changeExerciseVariant(session, log.id, 'lying', undefined, {confirmed: true}).changed, true);
  assert.equal(log.sets[0].load, '42.5');
  assert.equal(log.variationId, 'lying');
  session.status = 'completed';
  const terminal = plain(session);
  assert.equal(app.Core.changeExerciseVariant(session, log.id, 'seated', undefined, {confirmed: true}).blocked, true);
  assert.deepEqual(plain(session), terminal);
});

test('trocar semana em plano vazio preserva ficha, lados, variantes, aparelhos e identidade dos registros', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  group(session, 'leg_press_45').forEach(log => { log.machineId = `Machine ${log.side}`; });
  const before = plain(session);
  const settings = app.clone({sideTracking: {enabled: false, affectedSide: 'left'}});
  assert.equal(app.Core.replaceSessionPrescription(session, 3, settings), true);
  assert.equal(session.week, 3);
  assert.deepEqual(plain(session.workoutSnapshot), before.workoutSnapshot);
  session.exercises.forEach((log, index) => {
    for (const key of ['id', 'exerciseId', 'variationId', 'machineId', 'side', 'sideModeSnapshot']) assert.equal(log[key], before.exercises[index][key]);
  });
  assert.deepEqual(sides(session, 'leg_press_45'), ['right', 'left']);
  app.Core.assertCurrentStateStructure(stateWith(app, session));
  group(session, 'leg_press_45')[1].sets[0].rir = '3';
  const executed = plain(session);
  assert.equal(app.Core.replaceSessionPrescription(session, 5, settings), false);
  assert.deepEqual(plain(session), executed);
});

test('trocar semana com faixa alta preserva descanso e categoria da prescrição', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  const calf = group(session, 'calf_standing_or_leg_press')[0];
  calf.highRepPreference = true;
  const rest = calf.prescriptionSnapshot.restSeconds;
  const category = calf.prescriptionSnapshot.category;
  assert.equal(app.Core.replaceSessionPrescription(session, 3), true);
  const updated = group(session, 'calf_standing_or_leg_press')[0];
  assert.equal(updated.prescriptionSnapshot.max, 20);
  assert.equal(updated.prescriptionSnapshot.restSeconds, rest);
  assert.equal(updated.prescriptionSnapshot.category, category);
});

test('reagendamento copia a ficha histórica, mantém modo e aparelho, mas não finge execução', () => {
  const app = boot();
  const state = app.Core.migratePayload(app.clone(readLegacyState()));
  const original = state.sessions.find(item => item.workoutId === 'legs_a');
  const before = plain(original);
  const copy = app.Core.createRescheduledSession(original, '2026-09-10', 5, app.Core.normalizeSettings());
  assert.deepEqual(plain(original), before);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.status, 'planned');
  assert.equal(copy.rescheduledFrom, original.plannedDate);
  assert.equal(copy.week, 5);
  assert.deepEqual(plain(copy.workoutSnapshot), before.workoutSnapshot);
  copy.exercises.forEach((log, index) => {
    assert.notEqual(log.id, original.exercises[index].id);
    assert.equal(log.variationId, original.exercises[index].variationId);
    assert.equal(log.side, original.exercises[index].side);
    assert.equal(log.machineId, original.exercises[index].machineId);
    assert.equal(app.Core.hasExerciseExecutionData(log), false);
  });
  assert.deepEqual(sides(copy, 'leg_curl'), ['bilateral']);
  app.Core.assertCurrentStateStructure(stateWith(app, copy));
});

test('flags de execução bloqueiam somente o lado informado; relato vazio não vira impedimento', () => {
  const app = boot();
  for (const flag of app.Core.EXECUTION_FEEDBACK_FLAGS) {
    const session = app.Core.createSession('legs_a', '2026-09-06', 1);
    const logs = group(session, 'leg_press_45'); logs.forEach(log => fill(log));
    const right = logs.find(log => log.side === 'right');
    const left = logs.find(log => log.side === 'left');
    const exercise = app.Core.sessionExercise(session, right.exerciseId);
    right.executionFeedback = app.Core.normalizeExecutionFeedback(app.clone({[flag]: true}));
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, right, session, null, [session], []).code, 'review', flag);
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, left, session, null, [session], []).code, 'increase', flag);
    right.executionFeedback = app.Core.normalizeExecutionFeedback(app.clone({note: 'observação neutra'}));
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, right, session, null, [session], []).code, 'increase');
  }
});

test('dor, técnica, interrupção, carga excessiva e RIR ausente impedem aumento por lado', () => {
  const app = boot();
  for (const status of ['pain', 'bad_technique', 'excessive_load', 'interrupted']) {
    const session = app.Core.createSession('pull_a', '2026-09-06', 1);
    const logs = group(session, 'unilateral_row_machine'); logs.forEach(log => fill(log));
    logs[0].sets.find(set => set.type === 'work').status = status;
    const exercise = app.Core.sessionExercise(session, logs[0].exerciseId);
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, logs[0], session).code, 'review');
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, logs[1], session).code, 'increase');
    logs[1].sets.find(set => set.type === 'work').rir = '';
    assert.equal(app.Core.sessionProgressionRecommendation(exercise, logs[1], session).code, 'review');
  }
});

test('relato após pernas e caminhada vinculada qualificam a sessão certa, não datas não relacionadas', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  const logs = group(session, 'leg_press_45'); logs.forEach(log => fill(log));
  const exercise = app.Core.sessionExercise(session, logs[0].exerciseId);
  const recommendation = cardio => app.Core.sessionProgressionRecommendation(exercise, logs[0], session, null, [session], cardio).code;
  for (const flag of app.Core.POST_LEG_CHECK_FLAGS) {
    session.postLegCheck = app.Core.normalizePostLegCheck(app.clone({[flag]: true, noRelevantChange: true, savedAt: NOW}));
    assert.equal(session.postLegCheck.noRelevantChange, false);
    assert.equal(recommendation([]), 'review', flag);
  }
  session.postLegCheck = app.Core.normalizePostLegCheck(app.clone({noRelevantChange: true, savedAt: NOW}));
  assert.equal(recommendation([]), 'increase');
  assert.equal(recommendation(app.clone([{relatedSessionId: 'unrelated', discomfort: 'pain', date: session.plannedDate}])), 'increase');
  assert.equal(recommendation(app.clone([{relatedSessionId: session.id, discomfort: 'pain'}])), 'review');
  for (const flag of ['rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop']) {
    assert.equal(recommendation(app.clone([{relatedSessionId: session.id, legDayFlags: {[flag]: true}}])), 'review', flag);
  }
});

test('volume unilateral soma os lados uma vez e mostra contribuição parcial sem converter em diagnóstico', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  session.status = 'partial';
  const logs = group(session, 'leg_extension');
  const quantity = logs[0].sets.filter(set => set.type === 'work').length;
  fill(logs[0]);
  let volume = app.Core.recordedMuscleVolume([session], 1).find(item => item.id === 'quadriceps').direct;
  assert.equal(volume, quantity / 2);
  fill(logs[1]);
  volume = app.Core.recordedMuscleVolume([session], 1).find(item => item.id === 'quadriceps').direct;
  assert.equal(volume, quantity, 'two sides are one whole-body set per pair');
  assert.equal(app.Core.recordedMuscleVolume([session], 2).find(item => item.id === 'quadriceps').direct, 0);
});

test('legado bilateral de flexora não tem seu volume dividido por regra unilateral nova', () => {
  const app = boot();
  const state = app.Core.migratePayload(app.clone(readLegacyState()));
  const session = state.sessions.find(item => item.workoutId === 'legs_a');
  const curl = group(session, 'leg_curl')[0];
  session.exercises.forEach(log => { if (log.id !== curl.id) log.sets.forEach(set => { set.completedAt = ''; }); });
  const expected = curl.sets.filter(set => set.type === 'work' && set.status === 'completed' && set.completedAt).length;
  assert.equal(app.Core.recordedMuscleVolume([session], session.week).find(item => item.id === 'hamstrings').direct, expected);
});

test('esquemas fracionários, inválidos e sessões sem versão são recusados sem apagar registros', () => {
  const app = boot();
  for (const version of [12.5, 0, -1, 'invalido', null]) {
    const input = app.clone({...readLegacyState(), schemaVersion: version});
    const before = plain(input);
    assert.throws(() => app.Core.migratePayload(input), /esquema inválido/);
    assert.deepEqual(plain(input), before);
  }
  const input = app.clone(readLegacyState());
  delete input.schemaVersion;
  assert.throws(() => app.Core.migratePayload(input), /não corresponde ao esquema/);
});

test('retrato incompleto nunca recria exercício sem séries ao atualizar a semana', () => {
  const app = boot();
  for (const missing of ['workSets', 'category', 'restSeconds', 'warmupSets']) {
    const session = app.Core.createSession('push_a', '2026-09-06', 1);
    delete session.workoutSnapshot.exercises[0][missing];
    assert.throws(() => app.Core.assertCurrentStateStructure(stateWith(app, session)), /prescrição de força completa/);
  }
});

test('mudança estrutural preserva faixa alta e recusa configurações divergentes entre lados', () => {
  const app = boot();
  const session = app.Core.createSession('legs_a', '2026-09-06', 1);
  const log = group(session, 'calf_standing_or_leg_press')[0];
  log.highRepPreference = true;
  Object.assign(log.prescriptionSnapshot, {min: 12, max: 20, label: '12–20'});
  assert.equal(app.Core.changeExerciseVariant(session, log.id, 'standing_machine_unilateral').changed, true);
  const logs = group(session, log.exerciseId);
  logs.forEach(item => { assert.equal(item.highRepPreference, true); assert.equal(item.prescriptionSnapshot.max, 20); assert.equal(item.prescriptionSnapshot.restSeconds, 90); });
  logs[1].highRepPreference = false;
  const before = plain(session);
  assert.equal(app.Core.changeExerciseVariant(session, logs[0].id, 'standing_machine').blocked, true);
  assert.deepEqual(plain(session), before);
});

for (const committed of [false, true]) {
  test(`staging legado12 ${committed ? 'já confirmado' : 'pendente'} é reconciliado antes da migração13`, async () => {
    const app = boot();
    const base = readLegacyState();
    const next = plain(base); next.revision += 1;
    next.settings.largeText = true;
    const baseRaw = JSON.stringify(base);
    const nextRaw = JSON.stringify(next);
    const hash = async text => {
      const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`present:${text}`));
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const staging = {app: app.Core.APP_ID, format: 'treino-hard-local-transaction-v1', txId: 'old-staging', baseHash: await hash(baseRaw), nextHash: await hash(nextRaw), nextRevision: next.revision, nextRaw};
    app.store.set(app.Storage.FALLBACK_KEY, committed ? nextRaw : baseRaw);
    app.store.set(app.Storage.FALLBACK_STAGING_KEY, JSON.stringify(staging));
    const storage = new app.Storage.AppStorage();
    const state = await storage.init();
    assert.equal(storage.writeBlocked, false, storage.lastError);
    assert.equal(state.schemaVersion, 13);
    assert.equal(state.settings.largeText, true);
    assert.equal(app.store.has(app.Storage.FALLBACK_STAGING_KEY), false);
    allSessions(next).forEach((old, index) => compareLegacySession(old, allSessions(state)[index]));
    assert.equal(JSON.parse(app.store.get(app.Storage.FALLBACK_KEY)).schemaVersion, 13);
  });
}
