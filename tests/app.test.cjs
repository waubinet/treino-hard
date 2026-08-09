const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {TextEncoder, TextDecoder} = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const MODULES = [
  'js/workouts.js',
  'js/core.js',
  'js/storage.js',
  'js/measurements.js'
];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSvgNode(name) {
  const attributes = new Map();
  const classes = new Set();
  return {
    nodeName: name,
    children: [],
    attributes,
    classList: {
      add(...names) {
        names.forEach(item => classes.add(item));
      },
      contains(item) {
        return classes.has(item);
      }
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(key, value) {
      attributes.set(key, String(value));
      if (key === 'class') {
        String(value).split(/\s+/).filter(Boolean).forEach(item => classes.add(item));
      }
    },
    getAttribute(key) {
      return attributes.has(key) ? attributes.get(key) : null;
    }
  };
}

function boot(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  let uuid = 0;
  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
  const document = {
    createElementNS(_namespace, name) {
      return createSvgNode(name);
    }
  };
  const crypto = {
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    subtle: webcrypto.subtle
  };
  const context = vm.createContext({
    console,
    localStorage,
    document,
    crypto,
    TextEncoder,
    TextDecoder
  });
  MODULES.forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, {filename: file});
  });
  return {
    context,
    store,
    Data: context.THFData,
    Core: context.THFCore,
    Storage: context.THFStorage,
    Measurements: context.THFMeasurements,
    run(source) {
      return vm.runInContext(source, context);
    }
  };
}

function cloneIntoContext(app, value) {
  app.context.__jsonFixture = JSON.stringify(value);
  const cloned = app.run('JSON.parse(__jsonFixture)');
  delete app.context.__jsonFixture;
  return cloned;
}

function alteredBase64(value, byteIndex = 0) {
  const bytes = Buffer.from(value, 'base64');
  bytes[Math.min(byteIndex, bytes.length - 1)] ^= 0x01;
  return bytes.toString('base64');
}

async function encryptedRawJson(app, plaintext, password, options = {}) {
  const iterations = options.iterations || app.Core.PBKDF2_ITERATIONS;
  const schemaVersion = options.schemaVersion || app.Core.SCHEMA_VERSION;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const saltBase64 = Buffer.from(salt).toString('base64');
  const ivBase64 = Buffer.from(iv).toString('base64');
  const header = {
    app: app.Core.APP_ID,
    format: app.Core.ENCRYPTED_FORMAT,
    formatVersion: app.Core.ENCRYPTED_FORMAT_VERSION,
    schemaVersion,
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations, salt: saltBase64},
    cipher: {name: 'AES-GCM', length: 256, tagBits: 128, iv: ivBase64}
  };
  const aad = new TextEncoder().encode([
    header.app, header.format, header.formatVersion, header.schemaVersion,
    header.kdf.name, header.kdf.hash, header.kdf.iterations, header.kdf.salt,
    header.cipher.name, header.cipher.length, header.cipher.tagBits, header.cipher.iv
  ].join('|'));
  const material = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const key = await webcrypto.subtle.deriveKey(
    {name: 'PBKDF2', salt, iterations, hash: 'SHA-256'},
    material,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt']
  );
  const ciphertext = await webcrypto.subtle.encrypt(
    {name: 'AES-GCM', iv, tagLength: 128, additionalData: aad},
    key,
    new TextEncoder().encode(plaintext)
  );
  return Object.assign({}, header, {
    createdAt: '2026-08-09T00:00:00.000Z',
    ciphertext: Buffer.from(ciphertext).toString('base64')
  });
}

function completedLog(app, exerciseId, week, reps, rir, status = 'completed') {
  app.context.__exerciseId = exerciseId;
  app.context.__week = week;
  app.context.__reps = reps;
  app.context.__rir = rir;
  app.context.__status = status;
  return app.run(`(() => {
    const exercise = THFData.CATALOG[__exerciseId];
    const log = THFCore.createExerciseLog(exercise, __week);
    log.sets.filter(set => set.type === 'work').forEach(set => {
      set.reps = String(__reps);
      set.rir = __rir;
      set.status = __status;
      set.completedAt = '2026-08-08T12:00:00.000Z';
    });
    return THFCore.doubleProgressionRecommendation(exercise, log, __week);
  })()`);
}

test('catálogo contém seis treinos com os volumes declarados', () => {
  const app = boot();
  const summary = plain(app.Data.WORKOUTS.map(workout => ({
    id: workout.id,
    weekday: workout.weekday,
    declared: workout.workSetTotal,
    calculated: app.Core.workoutVolume(workout)
  })));
  assert.deepEqual(summary, [
    {id: 'push_a', weekday: 1, declared: 17, calculated: 17},
    {id: 'pull_a', weekday: 2, declared: 15, calculated: 15},
    {id: 'legs_a', weekday: 3, declared: 14, calculated: 14},
    {id: 'push_b', weekday: 4, declared: 15, calculated: 15},
    {id: 'pull_b', weekday: 5, declared: 14, calculated: 14},
    {id: 'legs_b', weekday: 6, declared: 14, calculated: 14}
  ]);
  assert.equal(new Set(summary.map(item => item.id)).size, 6);
});

test('calendário distribui segunda a sábado e deixa domingo sem treino', () => {
  const app = boot();
  const dates = [
    ['2026-08-03', 'push_a'],
    ['2026-08-04', 'pull_a'],
    ['2026-08-05', 'legs_a'],
    ['2026-08-06', 'push_b'],
    ['2026-08-07', 'pull_b'],
    ['2026-08-08', 'legs_b'],
    ['2026-08-09', '']
  ];
  dates.forEach(([date, expected]) => assert.equal(app.Data.workoutForDate(date), expected));
  assert.equal(Object.prototype.hasOwnProperty.call(app.Data.DAY_WORKOUT, 0), false);
});

test('Pernas A e B começam com a mesma mobilidade e não contêm stiff', () => {
  const app = boot();
  const mobility = plain(app.Data.MOBILITY_SEQUENCE.map(exercise => exercise.id));
  const legsA = app.Data.WORKOUT_BY_ID.legs_a;
  const legsB = app.Data.WORKOUT_BY_ID.legs_b;
  assert.deepEqual(plain(legsA.exercises.slice(0, mobility.length).map(item => item.id)), mobility);
  assert.deepEqual(plain(legsB.exercises.slice(0, mobility.length).map(item => item.id)), mobility);
  assert.deepEqual(
    plain(legsA.exercises.slice(0, mobility.length)),
    plain(legsB.exercises.slice(0, mobility.length))
  );
  const strengthText = app.Data.WORKOUTS
    .flatMap(workout => workout.exercises)
    .filter(exercise => exercise.type === 'strength')
    .map(exercise => `${exercise.id} ${exercise.name}`)
    .join(' ');
  assert.doesNotMatch(strengthText, /\bstiff\b/i);
});

test('as duas exposições de empurrar usam supinos em máquina', () => {
  const app = boot();
  ['push_a', 'push_b'].forEach(workoutId => {
    const workout = app.Data.WORKOUT_BY_ID[workoutId];
    assert.deepEqual(
      plain(workout.exercises.slice(0, 2).map(exercise => exercise.id)),
      ['chest_press_machine', 'incline_press_machine']
    );
    workout.exercises.slice(0, 2).forEach(exercise => assert.match(exercise.name, /máquina/i));
  });
  const pressIds = app.Data.WORKOUTS
    .flatMap(workout => workout.exercises)
    .filter(exercise => /supino/i.test(exercise.name))
    .map(exercise => exercise.id);
  assert.equal(pressIds.every(id => id.endsWith('_machine')), true);
});

test('periodização aplica faixas e RIR por semana aos exercícios principais', () => {
  const app = boot();
  const exercise = app.Data.CATALOG.chest_press_machine;
  const expected = [
    [1, 12, 15, 3, 3],
    [2, 12, 15, 2, 2],
    [3, 10, 12, 2, 2],
    [4, 10, 12, 1, 2],
    [5, 8, 10, 2, 2],
    [6, 8, 10, 1, 2],
    [7, 6, 8, 1, 2],
    [8, 8, 12, 4, 5]
  ];
  const actual = expected.map(([week]) => {
    const value = app.Data.prescriptionFor(exercise, week, false);
    return [week, value.min, value.max, value.rirMin, value.rirMax];
  });
  assert.deepEqual(actual, expected);
  // Faixa alta opcional da ficha canônica: 12–20 repetições.
  const highRep = app.Data.prescriptionFor(app.Data.CATALOG.lateral_raise_dumbbell, 7, true);
  assert.deepEqual([highRep.min, highRep.max, highRep.rirMin, highRep.rirMax], [12, 20, 1, 2]);
});

test('terra tem progressão própria e deload reduz séries e esforço', () => {
  const app = boot();
  const deadlift = app.Data.CATALOG.deadlift_barbell;
  const expected = [
    [1, 2, 6, 8, 3, 3],
    [2, 2, 6, 8, 2, 3],
    [3, 2, 6, 8, 2, 2],
    [4, 2, 6, 8, 2, 2],
    [5, 2, 5, 7, 2, 2],
    [6, 2, 5, 7, 2, 2],
    [7, 2, 4, 6, 2, 3],
    [8, 1, 6, 8, 4, 5]
  ];
  const actual = expected.map(([week]) => {
    const value = app.Data.prescriptionFor(deadlift, week, false);
    return [week, value.sets, value.min, value.max, value.rirMin, value.rirMax];
  });
  assert.deepEqual(actual, expected);
  const deloadDeadlift = app.Data.prescriptionFor(deadlift, 8, false);
  assert.equal(deloadDeadlift.deload, true);
  assert.equal(deloadDeadlift.optionalDeloadRemoval, true);
  app.Data.WORKOUTS.flatMap(workout => workout.exercises)
    .filter(exercise => exercise.type === 'strength')
    .forEach(exercise => {
      const deload = app.Data.prescriptionFor(exercise, 8, true);
      assert.equal(deload.deload, true, exercise.id);
      assert.ok(deload.sets <= 2, exercise.id);
      assert.ok(deload.rirMin >= 4, exercise.id);
    });
});

test('cada série de trabalho recebe o descanso específico do exercício', () => {
  const app = boot();
  const session = app.Core.createSession('legs_b', '2026-08-08', 3);
  const expectedRest = {
    deadlift_barbell: 180,
    leg_press_45: 150,
    leg_curl: 90,
    leg_extension: 90,
    calf_seated: 90
  };
  Object.entries(expectedRest).forEach(([exerciseId, seconds]) => {
    const log = session.exercises.find(item => item.exerciseId === exerciseId);
    assert.ok(log, exerciseId);
    const workSets = log.sets.filter(set => set.type === 'work');
    assert.ok(workSets.length > 0, exerciseId);
    assert.equal(workSets.every(set => set.nextRestSeconds === seconds), true, exerciseId);
    assert.equal(log.sets.filter(set => set.type === 'warmup').every(set => set.nextRestSeconds === 0), true, exerciseId);
  });
});

test('progressão dupla aumenta, mantém ou pede revisão conforme repetições, RIR e segurança', () => {
  const app = boot();
  assert.equal(completedLog(app, 'chest_press_machine', 3, 12, '2').code, 'increase');
  assert.equal(completedLog(app, 'chest_press_machine', 3, 10, '2').code, 'maintain');
  assert.equal(completedLog(app, 'chest_press_machine', 3, 9, '2').code, 'review');
  assert.equal(completedLog(app, 'chest_press_machine', 3, 12, '2', 'pain').code, 'review');
  assert.equal(completedLog(app, 'chest_press_machine', 3, 12, '').code, 'review');
  assert.equal(completedLog(app, 'chest_press_machine', 8, 12, '5').code, 'none');
  assert.equal(app.Core.rirNumber(''), null);
  assert.equal(app.Core.rirNumber('5+'), 5);
});

test('vídeos aprovados têm curadoria auditável e variantes ambíguas permanecem separadas', () => {
  const app = boot();
  const videos = plain(app.run('THFData.VIDEOS'));
  const accepted = Object.entries(videos).filter(([, video]) => video.status === 'accepted');
  const approvedClasses = new Set(['technical_guide', 'objective_demo', 'visual_reference']);

  assert.ok(accepted.length >= 29, 'a primeira rodada audiovisual precisa manter os candidatos efetivamente assistidos');
  accepted.forEach(([key, video]) => {
    assert.equal(approvedClasses.has(video.classification), true, `${key}: classificação`);
    assert.equal(video.exactMatch, true, `${key}: correspondência exata`);
    assert.match(video.youtubeId, /^[\w-]{11}$/, `${key}: ID do YouTube`);
    assert.match(video.url, /^https:\/\/www\.youtube\.com\/watch\?v=/, `${key}: URL canônica`);
    assert.ok(video.title && video.channel && video.duration && video.language, `${key}: metadados públicos`);
    assert.match(video.reviewedAt, /^2026-08-09$/, `${key}: data da revisão visual`);
    assert.equal(video.availability, 'available_external', `${key}: disponibilidade externa`);
    assert.ok(video.positives && video.limitations && video.decision, `${key}: justificativa e limitações`);
    assert.equal(video.embedCompatible, null, `${key}: embed só muda após teste real no app`);
  });

  const row = app.run(`THFData.CATALOG.seated_row_triangle.variants.map(item => [item.id, item.videoKey])`);
  assert.deepEqual(plain(row), [
    ['cable_triangle', 'seated_row_triangle'],
    ['machine_supported', 'seated_row_supported']
  ]);
  const choices = app.run(`THFData.CATALOG.row_machine_choice.variants.map(item => [item.id, item.videoKey])`);
  assert.deepEqual(plain(choices), [
    ['seated_cable_triangle', 'seated_row_triangle'],
    ['articulated_supported', 'row_articulated_supported'],
    ['articulated_unsupported', 'row_articulated_unsupported']
  ]);
  assert.equal(videos.triceps_overhead.status, 'pending', 'equipamento não definido não pode receber vídeo genérico');
  assert.equal(videos.vacuum.status, 'pending', 'vacuum genérico não representa as quatro posições');
});

test('confirmação explícita e snapshot histórico governam a progressão', () => {
  const app = boot();
  const result = app.run(`(() => {
    const exercise = THFData.CATALOG.chest_press_machine;
    const log = THFCore.createExerciseLog(exercise, 3);
    log.sets.filter(set => set.type === 'work').forEach(set => {
      set.reps = '12';
      set.rir = '2';
      set.status = 'completed';
    });
    const beforeConfirmation = THFCore.doubleProgressionRecommendation(exercise, log, 7);
    log.sets.filter(set => set.type === 'work').forEach(set => { set.completedAt = '2026-08-08T12:00:00.000Z'; });
    const afterConfirmation = THFCore.doubleProgressionRecommendation(exercise, log, 7);
    return {beforeConfirmation, afterConfirmation, snapshot: log.prescriptionSnapshot};
  })()`);
  assert.equal(result.beforeConfirmation.code, 'review');
  assert.match(result.beforeConfirmation.message, /confirme/);
  assert.equal(result.afterConfirmation.code, 'increase', 'a recomendação deve usar a faixa 10–12 guardada na sessão, não a semana 7 atual');
  assert.deepEqual(plain([result.snapshot.min, result.snapshot.max]), [10, 12]);
  assert.equal(app.run(`THFCore.isSetConfirmed({status: 'completed', completedAt: ''})`), false);
  assert.equal(app.run(`THFCore.isSetConfirmed({status: 'completed', completedAt: '2026-08-08T12:00:00.000Z'})`), true);
});

test('normalização rejeita limites excedidos sem truncar os registros mais novos', () => {
  const app = boot();
  assert.throws(
    () => app.run(`(() => {
      const state = THFCore.defaultState();
      state.sessions = Array(THFCore.MAX_SESSIONS + 1).fill({});
      return THFCore.normalizeState(state);
    })()`),
    /excede o limite seguro.*nada foi truncado/
  );
  assert.throws(
    () => app.run(`(() => {
      const state = THFCore.defaultState();
      const session = THFCore.createSession('push_a', '2026-08-03', 1);
      session.exercises[0].sets = Array.from({length: THFCore.MAX_SERIES_PER_EXERCISE + 1}, (_, index) => ({id: 'set-' + index}));
      state.sessions = [session];
      return THFCore.normalizeState(state);
    })()`),
    /excede 64 séries.*nada foi truncado/
  );
});

test('documento atual estruturalmente corrompido é preservado na recuperação', async () => {
  const seed = boot();
  const corrupted = plain(seed.Core.defaultState('2026-08-08T12:00:00.000Z'));
  corrupted.sessions = 'corrompido';
  const raw = JSON.stringify(corrupted);
  const app = boot({treinohard_document_v11: raw});
  const storage = new app.Storage.AppStorage();
  storage.mode = 'localstorage';
  const value = await storage.readDocument();
  assert.equal(value, null);
  assert.match(storage.lastError, /sessions.*formato inválido/);
  assert.equal(app.store.get(app.Storage.FALLBACK_KEY), raw, 'o documento original não pode ser sobrescrito durante a leitura');
  const recovery = JSON.parse(app.store.get('treinohard_recovery_v11'));
  assert.equal(recovery.raw, raw);
});

test('preferência de vídeo é opcional, compatível e usa abertura externa por padrão', () => {
  const app = boot();
  assert.equal(app.run(`THFCore.normalizeSettings({}).videoMode`), 'external');
  assert.equal(app.run(`THFCore.normalizeSettings({videoMode: 'inline'}).videoMode`), 'inline');
  assert.equal(app.run(`THFCore.normalizeSettings({videoMode: 'ask'}).videoMode`), 'ask');
  assert.equal(app.run(`THFCore.normalizeSettings({videoMode: 'oauth'}).videoMode`), 'external');
});

test('chave de comparação separa variação, máquina, lado e faixa', () => {
  const app = boot();
  const base = app.Core.comparableSeriesKey('leg_curl', 'seated', 'Flexora 1', 'bilateral', '10–12');
  const keys = [
    base,
    app.Core.comparableSeriesKey('leg_curl', 'lying', 'Flexora 1', 'bilateral', '10–12'),
    app.Core.comparableSeriesKey('leg_curl', 'seated', 'Flexora 2', 'bilateral', '10–12'),
    app.Core.comparableSeriesKey('leg_curl', 'seated', 'Flexora 1', 'left', '10–12'),
    app.Core.comparableSeriesKey('leg_curl', 'seated', 'Flexora 1', 'bilateral', '8–10')
  ];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(base, 'leg_curl|seated|flexora 1|bilateral|10–12');
  assert.equal(
    app.Core.comparableSeriesKey('squat', '', '', 'invalid', ''),
    'squat|default|machine-unspecified|bilateral|range-unspecified'
  );
});

test('migração 9 para 10 preserva duas ocorrências, ambiguidades e medidas legadas', () => {
  const app = boot();
  const migrated = app.run(`THFCore.migrate9To10({
    schemaVersion: 9,
    cycleStartedAt: '2026-01-01T12:00:00.000Z',
    data: {
      1: {
        1: {
          a_puxada_supinada: {sets: [{kg: '70', reps: '10'}], done: true},
          b_supino_inclinado: {variant: 'smith', sets: [{kg: '50', reps: '8'}]}
        },
        2: {a_puxada_supinada: {sets: [{kg: '75', reps: '8'}]}}
      }
    },
    measurements: [{date: '2026-01-02', weight: '110', arm: '40', thigh: '65'}],
    settings: {mode: 'sequence'}
  })`);
  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.legacyCycles.length, 1);
  const records = migrated.legacyCycles[0].records;
  assert.equal(records.length, 3);
  const recognized = records.filter(record => record.legacyExerciseId === 'a_puxada_supinada');
  assert.deepEqual(plain(recognized.map(record => record.occurrence)), [1, 2]);
  assert.equal(recognized[0].canonicalId, 'pulldown_supinated');
  assert.equal(recognized[0].sets[0].load, '70');
  const ambiguous = records.find(record => record.legacyExerciseId === 'b_supino_inclinado');
  assert.equal(ambiguous.canonicalId, '');
  assert.equal(ambiguous.variationId, 'smith');
  assert.equal(ambiguous.equipmentKey, 'legacy:b_supino_inclinado:smith');
  assert.deepEqual(
    plain(['armLeft', 'armRight', 'thighLeft', 'thighRight'].map(key => migrated.measurements[0][key])),
    ['40', '40', '65', '65']
  );
  assert.equal(migrated.settings.mode, 'sequence');
  assert.equal(migrated.migrationLog.some(item => item.from === 9 && item.to === 10), true);
});

test('migração preserva metadados, arquivos, IDs desconhecidos e IDs estáveis', () => {
  const app = boot();
  const payload = {
    schemaVersion: 9,
    cycleStartedAt: '2026-01-01T12:00:00.000Z',
    data: {1: {1: {
      a_remada_unilateral: {sets: [{kg: '45', reps: '10'}]},
      exercicio_desconhecido: {sets: [{kg: '10', reps: '15'}], extra: 'preservado na fonte bruta'}
    }}},
    meta: {1: {1: {a: {startedAt: '2026-01-03T10:00:00.000Z', completedAt: '2026-01-03T11:00:00.000Z', manualCompleted: true}}}},
    archives: [{id: 'ciclo-antigo', startedAt: '2025-10-01T12:00:00.000Z', data: {2: {1: {c_leg_press: {sets: [{kg: '120', reps: '12'}]}}}}, meta: {}}]
  };
  app.context.__migrationPayloadJson = JSON.stringify(payload);
  const first = app.run('THFCore.migrate9To10(JSON.parse(__migrationPayloadJson))');
  const second = app.run('THFCore.migrate9To10(JSON.parse(__migrationPayloadJson))');
  assert.equal(first.legacyCycles.length, 2);
  assert.equal(first.legacyCycles[0].sessionMeta.length, 1);
  assert.equal(first.legacyCycles[0].sessionMeta[0].manualCompleted, true);
  assert.equal(first.legacyCycles[1].records[0].canonicalId, 'leg_press_45');
  const ambiguous = first.legacyCycles[0].records.find(item => item.legacyExerciseId === 'a_remada_unilateral');
  const unknown = first.legacyCycles[0].records.find(item => item.legacyExerciseId === 'exercicio_desconhecido');
  assert.equal(ambiguous.mappingStatus, 'ambiguous');
  assert.equal(ambiguous.canonicalId, '');
  assert.equal(unknown.mappingStatus, 'unmapped');
  assert.equal(unknown.canonicalId, '');
  assert.deepEqual(
    plain(first.legacyCycles.flatMap(cycle => cycle.records.map(record => record.id))),
    plain(second.legacyCycles.flatMap(cycle => cycle.records.map(record => record.id)))
  );
});

test('inicialização migra cópias automáticas antigas sem apagar a fonte', async () => {
  const legacyData = JSON.stringify({schemaVersion: 9, data: {1: {1: {a_puxada_neutra: {sets: [{kg: '60', reps: '12'}]}}}}});
  const autoBackups = JSON.stringify([{app: 'treino-hard-fofo', schemaVersion: 9, id: 'auto-2026-01-02', day: '2026-01-02', savedAt: '2026-01-02T20:00:00.000Z', data: {1: {1: {b_crossover: {sets: [{kg: '15', reps: '15'}]}}}}}]);
  const app = boot({jovilite_data: legacyData, jovilite_auto_backups: autoBackups});
  const storage = new app.Storage.AppStorage();
  const migrated = await storage.init();
  assert.equal(migrated.legacyCycles[0].records[0].canonicalId, 'pulldown_neutral');
  assert.equal(app.store.get('jovilite_data'), legacyData);
  assert.equal(app.store.get('jovilite_auto_backups'), autoBackups);
  const converted = JSON.parse(app.store.get('treinohard_auto_backups_v11'));
  assert.equal(converted.length, 1);
  assert.equal(converted[0].legacy, true);
  assert.equal(converted[0].state.schemaVersion, 11);
  assert.ok(app.store.get('treinohard_recovery_v11'));
});

test('migração 10 para 11 e fluxo completo produzem estado normalizado', () => {
  const app = boot();
  const result = app.run(`(() => {
    const v10 = THFCore.migrate9To10({
      schemaVersion: 9,
      data: {1: {a_puxada_neutra: {sets: [{kg: '60', reps: '12'}]}}}
    });
    const direct = THFCore.migrate10To11(v10);
    const wrapped = THFCore.migratePayload({app: THFCore.APP_ID, schemaVersion: 10, state: v10});
    const complete = THFCore.migratePayload({schemaVersion: 9, data: {1: {a_puxada_neutra: {sets: [{kg: '60', reps: '12'}]}}}});
    return {direct, wrapped, complete};
  })()`);
  ['direct', 'wrapped', 'complete'].forEach(key => {
    const state = result[key];
    assert.equal(state.schemaVersion, 11, key);
    assert.equal(state.app, app.Core.APP_ID, key);
    assert.equal(Array.isArray(state.progressionDecisions), true, key);
    assert.equal(Array.isArray(state.quarantine), true, key);
    assert.equal(state.legacyCycles[0].records[0].canonicalId, 'pulldown_neutral', key);
    assert.equal(state.migrationLog.some(item => item.from === 10 && item.to === 11), true, key);
  });
});

test('backup criptografado usa Web Crypto, não vaza conteúdo e faz ida e volta completa', async () => {
  const app = boot();
  const password = 'senha-muito-segura-2026';
  const state = app.run(`(() => {
    const value = THFCore.defaultState('2026-08-09T00:00:00.000Z');
    const session = THFCore.createSession('push_a', '2026-08-10', 3);
    session.note = 'conteúdo privado que não pode aparecer em claro';
    value.sessions = [session];
    return value;
  })()`);

  const first = await app.Core.encryptBackup(state, password);
  const second = await app.Core.encryptBackup(state, password);
  const serialized = JSON.stringify(first);

  assert.equal(first.app, app.Core.APP_ID);
  assert.equal(first.format, app.Core.ENCRYPTED_FORMAT);
  assert.equal(first.formatVersion, app.Core.ENCRYPTED_FORMAT_VERSION);
  assert.equal(first.schemaVersion, app.Core.SCHEMA_VERSION);
  assert.deepEqual(plain(first.kdf), {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 600000,
    salt: first.kdf.salt
  });
  assert.deepEqual(plain(first.cipher), {
    name: 'AES-GCM',
    length: 256,
    tagBits: 128,
    iv: first.cipher.iv
  });
  assert.equal(Buffer.from(first.kdf.salt, 'base64').length, 16);
  assert.equal(Buffer.from(first.cipher.iv, 'base64').length, 12);
  assert.equal(serialized.includes(password), false, 'a senha nunca pode entrar no envelope');
  assert.equal(serialized.includes('conteúdo privado'), false, 'o conteúdo do backup não pode ficar em claro');
  assert.notEqual(second.kdf.salt, first.kdf.salt, 'cada exportação precisa de salt novo');
  assert.notEqual(second.cipher.iv, first.cipher.iv, 'cada exportação precisa de IV novo');
  assert.notEqual(second.ciphertext, first.ciphertext, 'duas exportações não podem repetir o ciphertext');

  const decrypted = await app.Core.decryptBackup(first, password);
  assert.equal(decrypted.format, 'treino-hard-backup');
  assert.equal(decrypted.schemaVersion, app.Core.SCHEMA_VERSION);
  assert.deepEqual(plain(decrypted.state), plain(app.Core.normalizeState(state)));
});

test('backup criptografado rejeita senha errada, ciphertext, IV, salt e truncamento', async () => {
  const app = boot();
  const password = 'senha-muito-segura-2026';
  const envelope = await app.Core.encryptBackup(app.Core.defaultState('2026-08-09T00:00:00.000Z'), password);
  const source = plain(envelope);
  const cases = [
    ['ciphertext adulterado', Object.assign({}, source, {ciphertext: alteredBase64(source.ciphertext, 7)})],
    ['IV alterado', Object.assign({}, source, {cipher: Object.assign({}, source.cipher, {iv: alteredBase64(source.cipher.iv)})})],
    ['salt alterado', Object.assign({}, source, {kdf: Object.assign({}, source.kdf, {salt: alteredBase64(source.kdf.salt)})})],
    ['ciphertext truncado', Object.assign({}, source, {ciphertext: source.ciphertext.slice(0, -4)})],
    ['iterações adulteradas', Object.assign({}, source, {kdf: Object.assign({}, source.kdf, {iterations: source.kdf.iterations + 1})})]
  ];

  await assert.rejects(
    () => app.Core.decryptBackup(envelope, 'senha-incorreta-2026'),
    /Senha incorreta ou arquivo adulterado/
  );
  for (const [label, candidate] of cases) {
    await assert.rejects(
      () => app.Core.decryptBackup(cloneIntoContext(app, candidate), password),
      /Senha incorreta ou arquivo adulterado/,
      label
    );
  }
});

test('JSON interno inválido falha após autenticação e esquema futuro segue para a validação normal', async () => {
  const app = boot();
  const password = 'senha-muito-segura-2026';
  const malformed = await encryptedRawJson(app, '{"app":"treino-hard-fofo",', password);
  await assert.rejects(
    () => app.Core.decryptBackup(cloneIntoContext(app, malformed), password),
    /conteúdo interno.*não é JSON válido/i
  );

  const futureDocument = {
    app: app.Core.APP_ID,
    format: 'treino-hard-backup',
    schemaVersion: 99,
    exportedAt: '2026-08-09T00:00:00.000Z',
    state: {app: app.Core.APP_ID, schemaVersion: 99}
  };
  const futureEnvelope = await encryptedRawJson(app, JSON.stringify(futureDocument), password);
  const decrypted = await app.Core.decryptBackup(cloneIntoContext(app, futureEnvelope), password);
  assert.equal(decrypted.schemaVersion, 99, 'a criptografia não deve normalizar nem rebaixar o esquema interno');
  assert.throws(
    () => app.Core.importPreview(decrypted),
    /versão mais nova/,
    'a mesma validação do JSON comum deve recusar o esquema futuro depois da descriptografia'
  );
});

test('backup v1 anterior com 310 mil iterações continua compatível', async () => {
  const app = boot();
  const password = 'senha-muito-segura-2026';
  const normalBackup = plain(app.Core.buildBackup(app.Core.defaultState('2026-08-08T00:00:00.000Z')));
  const legacyEnvelope = await encryptedRawJson(app, JSON.stringify(normalBackup), password, {iterations: 310000});
  const decrypted = await app.Core.decryptBackup(cloneIntoContext(app, legacyEnvelope), password);

  assert.equal(legacyEnvelope.kdf.iterations, 310000);
  assert.equal(decrypted.schemaVersion, app.Core.SCHEMA_VERSION);
  assert.equal(decrypted.state.createdAt, '2026-08-08T00:00:00.000Z');
});

test('AAD autentica e valida todos os metadados externos do envelope v1', async () => {
  const app = boot();
  const password = 'senha-muito-segura-2026';
  const envelope = plain(await app.Core.encryptBackup(app.Core.defaultState(), password));
  const alteredHeaders = [
    ['aplicativo', Object.assign({}, envelope, {app: 'outro-aplicativo'}), /não pertence/],
    ['formato', Object.assign({}, envelope, {format: 'outro-formato'}), /formato.*não é reconhecido/i],
    ['versão do formato', Object.assign({}, envelope, {formatVersion: 2}), /versão do formato.*não é suportada/i],
    ['esquema externo', Object.assign({}, envelope, {schemaVersion: 99}), /esquema externo.*não é suportado/i],
    ['KDF', Object.assign({}, envelope, {kdf: Object.assign({}, envelope.kdf, {name: 'scrypt'})}), /derivação.*não suportada/i],
    ['hash', Object.assign({}, envelope, {kdf: Object.assign({}, envelope.kdf, {hash: 'SHA-1'})}), /derivação.*não suportada/i],
    ['tipo das iterações', Object.assign({}, envelope, {kdf: Object.assign({}, envelope.kdf, {iterations: String(envelope.kdf.iterations)})}), /iterações.*fora do intervalo/i],
    ['tipo do salt', Object.assign({}, envelope, {kdf: Object.assign({}, envelope.kdf, {salt: 123})}), /salt.*codificação inválida/i],
    ['cifra', Object.assign({}, envelope, {cipher: Object.assign({}, envelope.cipher, {name: 'AES-CBC'})}), /cifra não suportada/i],
    ['comprimento da chave', Object.assign({}, envelope, {cipher: Object.assign({}, envelope.cipher, {length: 128})}), /comprimento.*não suportado/i],
    ['tag', Object.assign({}, envelope, {cipher: Object.assign({}, envelope.cipher, {tagBits: 96})}), /tag.*não suportado/i],
    ['tipo do IV', Object.assign({}, envelope, {cipher: Object.assign({}, envelope.cipher, {iv: 123})}), /vetor de inicialização.*codificação inválida/i]
  ];
  for (const [label, candidate, message] of alteredHeaders) {
    await assert.rejects(
      () => app.Core.decryptBackup(cloneIntoContext(app, candidate), password),
      message,
      label
    );
  }
});

test('schemas futuros são rejeitados sem sobrescrever o documento local', async () => {
  const future = JSON.stringify({app: 'treino-hard-fofo', schemaVersion: 99, revision: 7, sessions: []});
  const app = boot({treinohard_document_v11: future});
  assert.throws(
    () => app.run(`THFCore.migratePayload(${JSON.stringify(JSON.parse(future))})`),
    /versão mais nova/
  );
  const storage = new app.Storage.AppStorage();
  storage.mode = 'localstorage';
  const value = await storage.readDocument();
  assert.equal(value, null);
  assert.match(storage.lastError, /versão futura/);
  assert.equal(app.store.get(app.Storage.FALLBACK_KEY), future);
  assert.equal(app.store.has('treinohard_recovery_v11'), false, 'schema futuro não deve causar nenhuma escrita');
});

test('bloqueia prototype pollution no núcleo e no parser do armazenamento', () => {
  const app = boot();
  const malicious = app.run(`JSON.parse('{"safe":1,"nested":{"__proto__":{"polluted":true}}}')`);
  assert.equal(app.Core.hasForbiddenKey(malicious), true);
  assert.throws(() => app.Core.assertSafeParsed(malicious), /propriedades proibidas/);
  app.context.__maliciousText = '{"constructor":{"prototype":{"polluted":true}}}';
  assert.equal(app.run(`THFStorage.parseJson(__maliciousText, 'fallback')`), 'fallback');
  assert.equal({}.polluted, undefined);
  const tooDeep = app.run(`(() => {
    const root = {};
    let cursor = root;
    for (let index = 0; index < 22; index += 1) cursor = cursor.next = {};
    return root;
  })()`);
  assert.equal(app.Core.hasForbiddenKey(tooDeep), true);
});

test('armazenamento local usa staging e detecta conflito de revisão', async () => {
  const app = boot();
  const storage = new app.Storage.AppStorage();
  storage.mode = 'localstorage';
  const original = app.Core.defaultState('2026-08-08T12:00:00.000Z');
  const first = await storage.writeDocument(original, null, {skipConflict: true});
  assert.equal(first.revision, 1);
  assert.equal(app.store.has('treinohard_document_v11_staging'), false);
  const persisted = JSON.parse(app.store.get(app.Storage.FALLBACK_KEY));
  assert.equal(persisted.revision, 1);
  await assert.rejects(
    storage.writeDocument(first, 0, {}),
    error => error && error.code === 'REVISION_CONFLICT'
  );
  assert.equal(JSON.parse(app.store.get(app.Storage.FALLBACK_KEY)).revision, 1);
});

test('células CSV neutralizam fórmulas, quebras e aspas', () => {
  const app = boot();
  assert.equal(app.Core.csvCell('normal'), '"normal"');
  assert.equal(app.Core.csvCell('=2+2'), '"\'=2+2"');
  assert.equal(app.Core.csvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
  assert.equal(app.Core.csvCell('＠malicioso'), '"\'＠malicioso"');
  assert.equal(app.Core.csvCell('linha\ncom\ttab'), '"linha com tab"');
  assert.equal(app.Core.csvCell('ele disse "oi"'), '"ele disse ""oi"""');
});

test('medidas normalizam datas, lados, registros repetidos e valores inválidos', () => {
  const app = boot();
  const legacy = app.run(`THFCore.normalizeMeasurement({
    date: '2026-08-01', weight: '110,55', arm: '40', thigh: '65',
    calfLeft: '41', calfRight: '39', note: '  começo  '
  }, 0)`);
  assert.deepEqual(
    plain({
      weight: legacy.weight,
      armLeft: legacy.armLeft,
      armRight: legacy.armRight,
      thighLeft: legacy.thighLeft,
      thighRight: legacy.thighRight,
      calfLeft: legacy.calfLeft,
      calfRight: legacy.calfRight,
      note: legacy.note
    }),
    {weight: '110.55', armLeft: '40', armRight: '40', thighLeft: '65', thighRight: '65', calfLeft: '41', calfRight: '39', note: 'começo'}
  );
  assert.equal(app.run(`THFCore.normalizeMeasurement({date:'2026-02-30', weight:'100'}, 0)`), null);
  assert.equal(app.run(`THFCore.normalizeMeasurement({date:'2026-08-01', weight:'0'}, 0)`), null);
  const state = app.run(`THFCore.normalizeState({measurements: [
    {id:'morning', date:'2026-08-01', measuredAt:'2026-08-01T08:00:00.000Z', weight:'110'},
    {id:'next-day', date:'2026-08-02', measuredAt:'2026-08-02T08:00:00.000Z', weight:'109'},
    {id:'evening', date:'2026-08-01', measuredAt:'2026-08-01T20:00:00.000Z', weight:'108'}
  ]})`);
  assert.deepEqual(plain(state.measurements.map(item => [item.date, item.weight])), [
    ['2026-08-01', '110'],
    ['2026-08-01', '108'],
    ['2026-08-02', '109']
  ]);
  assert.deepEqual(
    plain(app.Core.MEASUREMENT_FIELDS),
    plain(Object.keys(app.Measurements.METRICS))
  );
});

test('geometria corporal reage proporcionalmente às medidas e preserva assimetria', () => {
  const app = boot();
  const compact = app.Measurements.bodyGeometry({
    height: '175', inseam: '82', neck: '40', shoulderWidth: '45', chest: '100',
    waist: '80', abdomen: '90', hip: '100', armLeft: '34', armRight: '44',
    forearmLeft: '28', forearmRight: '34', thighLeft: '55', thighRight: '65',
    calfLeft: '36', calfRight: '42'
  });
  const wider = app.Measurements.bodyGeometry({
    height: '175', waist: '140', abdomen: '150', hip: '145',
    armLeft: '34', armRight: '44', thighLeft: '55', thighRight: '65'
  });
  assert.equal(compact.scaleMode, 'height');
  assert.equal(compact.directCount, 16);
  assert.ok(wider.waist > compact.waist);
  assert.ok(wider.abdomen > compact.abdomen);
  assert.ok(wider.hip > compact.hip);
  assert.ok(compact.armRight > compact.armLeft);
  assert.ok(compact.forearmRight > compact.forearmLeft);
  assert.ok(compact.thighRight > compact.thighLeft);
  assert.ok(compact.calfRight > compact.calfLeft);
  assert.ok(compact.crotch > compact.hipY && compact.crotch < compact.kneeY);
  assert.ok(app.Measurements.ellipseBreadth(120, 0.8) > app.Measurements.ellipseBreadth(80, 0.8));
});

test('silhueta produz anatomia vetorial finita e SVG comparativo acessível', () => {
  const app = boot();
  const current = {
    date: '2026-08-08', height: '175', inseam: '82', neck: '41', shoulderWidth: '47',
    chest: '112', waist: '105', abdomen: '115', hip: '111', armLeft: '39', armRight: '41',
    forearmLeft: '31', forearmRight: '32', thighLeft: '61', thighRight: '64',
    calfLeft: '39', calfRight: '41'
  };
  const previous = Object.assign({}, current, {date: '2026-07-08', waist: '110', abdomen: '120'});
  const paths = app.Measurements.silhouettePaths(current);
  assert.equal(paths.mass.length, 3);
  assert.equal(paths.limbs.length, 6);
  paths.mass.concat(paths.limbs).forEach(pathData => {
    assert.match(pathData, /^M\s/);
    assert.doesNotMatch(pathData, /NaN|Infinity|undefined/);
  });
  const svg = app.Measurements.createSilhouetteSvg(current, previous);
  assert.equal(svg.nodeName, 'svg');
  assert.equal(svg.getAttribute('viewBox'), '0 0 400 640');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.match(svg.getAttribute('aria-label'), /2026-08-08/);
  assert.equal(svg.classList.contains('body-map-svg'), true);
  assert.equal(svg.children.length, 3);
  assert.equal(svg.children[1].classList.contains('body-previous'), true);
  assert.equal(svg.children[2].classList.contains('body-current'), true);
  assert.equal(svg.children[1].children.length, 9);
  assert.equal(svg.children[2].children.length, 9);
});

// ---------------------------------------------------------------------------
// Conformidade com a ficha canônica aprovada.
//
// Estas asserções descrevem a prescrição inteira, exercício por exercício. Se
// qualquer nome, ordem, número de séries, categoria, descanso ou faixa semanal
// divergir da ficha, o teste falha. Não altere a tabela abaixo para acomodar o
// código: ela é a ficha.
// ---------------------------------------------------------------------------

const MOBILIDADE_CANONICA = Object.freeze([
  ['mob_adductor_butterfly', 'Alongamento de adutores em borboleta', 2, '20–30 segundos'],
  ['mob_hip_butterfly', 'Mobilidade de quadril em borboleta', 2, '15 repetições'],
  ['mob_hamstring_seated', 'Alongamento de posterior da coxa sentado', 2, '20–30 segundos'],
  ['mob_ankle', 'Mobilidade de tornozelo', 2, '10 repetições']
]);

// [id, nome, séries, categoria, descanso em segundos, unilateral]
const FICHA_CANONICA = Object.freeze({
  push_a: {
    label: 'Empurrar A', weekday: 1, total: 17, mobilidade: [],
    exercicios: [
      ['chest_press_machine', 'Supino reto na máquina', 3, 'upper_compound', 120, false],
      ['incline_press_machine', 'Supino inclinado na máquina', 3, 'upper_compound', 120, false],
      ['cable_crossover', 'Crossover na polia', 2, 'accessory', 90, false],
      ['shoulder_press_machine', 'Desenvolvimento na máquina', 2, 'upper_compound', 120, false],
      ['lateral_raise_dumbbell', 'Elevação lateral com halteres', 3, 'accessory', 90, false],
      ['triceps_skull_dumbbell', 'Tríceps testa com halteres', 2, 'accessory', 90, false],
      ['triceps_rope', 'Tríceps na polia com corda', 2, 'accessory', 90, false]
    ]
  },
  pull_a: {
    label: 'Puxar A', weekday: 2, total: 15, mobilidade: [],
    exercicios: [
      ['pulldown_supinated', 'Puxada frontal com pegada supinada', 3, 'upper_compound', 120, false],
      ['seated_row_triangle', 'Remada sentada com triângulo', 3, 'upper_compound', 120, false],
      ['unilateral_row_machine', 'Remada unilateral na máquina', 2, 'upper_compound', 120, true],
      ['reverse_fly_machine', 'Crucifixo invertido no aparelho', 3, 'accessory', 90, false],
      ['ez_bar_curl', 'Rosca direta com barra W', 2, 'accessory', 90, false],
      ['hammer_curl_standing', 'Rosca martelo em pé', 2, 'accessory', 90, false]
    ]
  },
  legs_a: {
    label: 'Pernas A', weekday: 3, total: 14, mobilidade: MOBILIDADE_CANONICA,
    exercicios: [
      ['squat', 'Agachamento', 3, 'squat_press', 150, false],
      ['leg_press_45', 'Leg press 45°', 3, 'squat_press', 150, false],
      ['leg_extension', 'Cadeira extensora', 2, 'accessory', 90, false],
      ['leg_curl', 'Flexora', 3, 'accessory', 90, false],
      ['calf_standing_or_leg_press', 'Panturrilha em pé ou no leg press', 3, 'accessory', 90, false]
    ]
  },
  push_b: {
    label: 'Empurrar B', weekday: 4, total: 15, mobilidade: [],
    exercicios: [
      ['chest_press_machine', 'Supino reto na máquina', 2, 'upper_compound', 120, false],
      ['incline_press_machine', 'Supino inclinado na máquina', 2, 'upper_compound', 120, false],
      ['machine_fly', 'Crucifixo no aparelho', 2, 'accessory', 90, false],
      ['shoulder_press_machine', 'Desenvolvimento na máquina', 2, 'upper_compound', 120, false],
      ['lateral_raise_dumbbell', 'Elevação lateral com halteres', 3, 'accessory', 90, false],
      ['triceps_overhead', 'Tríceps testa ou extensão acima da cabeça', 2, 'accessory', 90, false],
      ['triceps_rope', 'Tríceps na polia com corda', 2, 'accessory', 90, false]
    ]
  },
  pull_b: {
    label: 'Puxar B', weekday: 5, total: 14, mobilidade: [],
    exercicios: [
      ['pulldown_neutral', 'Puxada frontal com pegada neutra', 3, 'upper_compound', 120, false],
      ['row_machine_choice', 'Remada sentada ou articulada', 3, 'upper_compound', 120, false],
      ['unilateral_row_machine', 'Remada unilateral na máquina', 2, 'upper_compound', 120, true],
      ['reverse_fly_machine', 'Crucifixo invertido no aparelho', 2, 'accessory', 90, false],
      ['ez_bar_curl', 'Rosca direta com barra W', 2, 'accessory', 90, false],
      ['hammer_curl_standing', 'Rosca martelo em pé', 2, 'accessory', 90, false]
    ]
  },
  legs_b: {
    label: 'Pernas B', weekday: 6, total: 14, mobilidade: MOBILIDADE_CANONICA,
    exercicios: [
      ['deadlift_barbell', 'Levantamento terra com barra', 2, 'deadlift', 180, false],
      ['leg_press_45', 'Leg press 45°', 3, 'squat_press', 150, false],
      ['leg_curl', 'Flexora', 4, 'accessory', 90, false],
      ['leg_extension', 'Cadeira extensora', 2, 'accessory', 90, false],
      ['calf_seated', 'Panturrilha sentada', 3, 'accessory', 90, false]
    ]
  }
});

// [semana, min, max, rirMin, rirMax]
const PERIODIZACAO_CANONICA = Object.freeze({
  upper_compound: [[1, 12, 15, 3, 3], [2, 12, 15, 2, 2], [3, 10, 12, 2, 2], [4, 10, 12, 1, 2], [5, 8, 10, 2, 2], [6, 8, 10, 1, 2], [7, 6, 8, 1, 2], [8, 8, 12, 4, 5]],
  squat_press: [[1, 12, 15, 3, 3], [2, 12, 15, 2, 2], [3, 10, 12, 2, 2], [4, 10, 12, 1, 2], [5, 8, 10, 2, 2], [6, 8, 10, 1, 2], [7, 8, 10, 1, 2], [8, 10, 12, 4, 5]],
  accessory: [[1, 12, 15, 3, 3], [2, 12, 15, 2, 2], [3, 10, 12, 2, 2], [4, 10, 12, 1, 2], [5, 10, 12, 2, 2], [6, 10, 12, 1, 2], [7, 8, 12, 1, 2], [8, 10, 15, 4, 5]],
  deadlift: [[1, 6, 8, 3, 3], [2, 6, 8, 2, 3], [3, 6, 8, 2, 2], [4, 6, 8, 2, 2], [5, 5, 7, 2, 2], [6, 5, 7, 2, 2], [7, 4, 6, 2, 3], [8, 6, 8, 4, 5]]
});

test('conformidade: cada treino traz exatamente os exercícios, a ordem e as séries da ficha', () => {
  const app = boot();
  assert.deepEqual(plain(app.Data.WORKOUTS.map(workout => workout.id)), Object.keys(FICHA_CANONICA));

  for (const [workoutId, esperado] of Object.entries(FICHA_CANONICA)) {
    const workout = app.Data.WORKOUT_BY_ID[workoutId];
    assert.ok(workout, `treino ausente: ${workoutId}`);
    assert.equal(workout.label, esperado.label);
    assert.equal(workout.weekday, esperado.weekday);

    const mobilidade = workout.exercises.filter(exercise => exercise.type === 'mobility');
    assert.deepEqual(
      plain(mobilidade.map(exercise => [exercise.id, exercise.name, exercise.sets, exercise.target])),
      esperado.mobilidade.map(item => item.slice()),
      `mobilidade divergente em ${workoutId}`
    );

    const forca = workout.exercises.filter(exercise => exercise.type === 'strength');
    assert.deepEqual(
      plain(forca.map(exercise => [exercise.id, exercise.name, exercise.workSets, exercise.category, exercise.restSeconds, Boolean(exercise.unilateral)])),
      esperado.exercicios.map(item => item.slice()),
      `exercícios divergentes em ${workoutId}`
    );

    const soma = forca.reduce((total, exercise) => total + exercise.workSets, 0);
    assert.equal(soma, esperado.total, `volume somado divergente em ${workoutId}`);
    assert.equal(workout.workSetTotal, esperado.total, `volume declarado divergente em ${workoutId}`);
  }
});

test('conformidade: totais planejados são 17, 15, 14, 15, 14 e 14', () => {
  const app = boot();
  assert.deepEqual(plain(app.Data.WORKOUTS.map(workout => workout.workSetTotal)), [17, 15, 14, 15, 14, 14]);
  assert.deepEqual(plain(app.Data.WORKOUTS.map(workout => app.Core.workoutVolume(workout))), [17, 15, 14, 15, 14, 14]);
});

test('conformidade: periodização das oito semanas por categoria', () => {
  const app = boot();
  const amostra = {
    upper_compound: app.Data.CATALOG.chest_press_machine,
    squat_press: app.Data.CATALOG.squat,
    accessory: app.Data.CATALOG.lateral_raise_dumbbell,
    deadlift: app.Data.CATALOG.deadlift_barbell
  };
  for (const [categoria, esperado] of Object.entries(PERIODIZACAO_CANONICA)) {
    const observado = esperado.map(([week]) => {
      const prescricao = app.Data.prescriptionFor(amostra[categoria], week, false);
      return [week, prescricao.min, prescricao.max, prescricao.rirMin, prescricao.rirMax];
    });
    assert.deepEqual(plain(observado), esperado.map(item => item.slice()), `periodização divergente em ${categoria}`);
  }

  // Deload: no máximo duas séries, e uma única no levantamento terra.
  for (const exercise of Object.values(app.Data.CATALOG)) {
    const deload = app.Data.prescriptionFor(exercise, 8, false);
    assert.equal(deload.deload, true, `semana 8 precisa ser deload em ${exercise.id}`);
    assert.ok(deload.sets <= 2, `deload com mais de duas séries em ${exercise.id}`);
    assert.ok(deload.rirMin >= 4, `deload com esforço alto demais em ${exercise.id}`);
  }
  assert.equal(app.Data.prescriptionFor(app.Data.CATALOG.deadlift_barbell, 8, false).sets, 1);
});

test('conformidade: faixa alta opcional é 12–20 e vale só para os exercícios previstos', () => {
  const app = boot();
  const permitidos = plain(Object.values(app.Data.CATALOG).filter(exercise => exercise.allowHighReps).map(exercise => exercise.id).sort());
  assert.deepEqual(permitidos, ['calf_seated', 'calf_standing_or_leg_press', 'lateral_raise_dumbbell', 'reverse_fly_machine']);

  for (const id of permitidos) {
    for (let week = 1; week <= 7; week += 1) {
      const alta = app.Data.prescriptionFor(app.Data.CATALOG[id], week, true);
      assert.deepEqual([alta.min, alta.max], [12, 20], `faixa alta divergente em ${id} na semana ${week}`);
    }
    assert.equal(app.Data.prescriptionFor(app.Data.CATALOG[id], 8, true).deload, true);
  }

  // Exercícios sem a permissão ignoram a preferência.
  const semPermissao = app.Data.prescriptionFor(app.Data.CATALOG.chest_press_machine, 3, true);
  assert.deepEqual([semPermissao.min, semPermissao.max], [10, 12]);
});

test('conformidade: descansos por categoria seguem 2:00, 2:30, 3:00 e 1:30', () => {
  const app = boot();
  const esperado = {upper_compound: 120, squat_press: 150, deadlift: 180, accessory: 90};
  for (const exercise of Object.values(app.Data.CATALOG)) {
    assert.equal(exercise.restSeconds, esperado[exercise.category], `descanso divergente em ${exercise.id}`);
  }
  // O descanso chega a cada série de trabalho materializada.
  for (const workout of app.Data.WORKOUTS) {
    const session = app.Core.createSession(workout.id, '2026-08-10', 1);
    session.exercises.forEach(log => {
      const exercise = app.Data.findExercise(workout.id, log.exerciseId);
      if (!exercise || exercise.type !== 'strength') return;
      log.sets.filter(set => set.type === 'work').forEach(set => {
        assert.equal(set.nextRestSeconds, exercise.restSeconds, `descanso da série divergente em ${exercise.id}`);
      });
    });
  }
});

test('conformidade: aquecimentos previstos aparecem como séries que não contam volume', () => {
  const app = boot();
  const esperado = {chest_press_machine: 3, pulldown_supinated: 2, squat: 3, leg_press_45: 1, deadlift_barbell: 3};
  for (const exercise of Object.values(app.Data.CATALOG)) {
    assert.equal(exercise.warmupSets, esperado[exercise.id] || 0, `aquecimento divergente em ${exercise.id}`);
  }
  // Em Empurrar B o supino reto entra sem aquecimento, porque já foi aquecido em A.
  const supinoB = app.Data.WORKOUT_BY_ID.push_b.exercises.find(exercise => exercise.id === 'chest_press_machine');
  assert.equal(supinoB.warmupSets, 0);

  const session = app.Core.createSession('push_a', '2026-08-10', 1);
  const supino = session.exercises.find(log => log.exerciseId === 'chest_press_machine');
  assert.equal(supino.sets.filter(set => set.type === 'warmup').length, 3);
  assert.equal(supino.sets.filter(set => set.type === 'work').length, 3);
  assert.equal(supino.sets.filter(set => set.type === 'warmup').every(set => set.nextRestSeconds === 0), true);
});

test('conformidade: remada unilateral gera registro separado para cada lado', () => {
  const app = boot();
  for (const workoutId of ['pull_a', 'pull_b']) {
    const session = app.Core.createSession(workoutId, '2026-08-10', 1);
    const lados = session.exercises.filter(log => log.exerciseId === 'unilateral_row_machine');
    assert.equal(lados.length, 2, `${workoutId} precisa registrar os dois lados`);
    assert.deepEqual(plain(lados.map(log => log.side).sort()), ['left', 'right']);
    lados.forEach(log => {
      assert.equal(log.sets.filter(set => set.type === 'work').length, 2, 'duas séries por lado');
    });
    // As chaves comparáveis dos dois lados nunca coincidem.
    const chaves = lados.map(log => app.Core.comparableSeriesKey(log.exerciseId, log.variationId, log.machineId, log.side, '12-15'));
    assert.notEqual(chaves[0], chaves[1]);

    // Nenhum outro exercício da ficha é duplicado.
    const contagem = new Map();
    session.exercises.forEach(log => contagem.set(log.exerciseId, (contagem.get(log.exerciseId) || 0) + 1));
    for (const [exerciseId, vezes] of contagem) {
      assert.equal(vezes, exerciseId === 'unilateral_row_machine' ? 2 : 1, `${exerciseId} duplicado indevidamente`);
    }
  }
});

test('conformidade: tríceps de Empurrar B oferece testa e extensão acima da cabeça', () => {
  const app = boot();
  const triceps = app.Data.WORKOUT_BY_ID.push_b.exercises.find(exercise => exercise.id === 'triceps_overhead');
  assert.deepEqual(plain(triceps.variants.map(variant => variant.id)), ['overhead', 'skull_crusher']);
  assert.deepEqual(plain(triceps.variants.map(variant => variant.label)), ['Extensão acima da cabeça', 'Tríceps testa com halteres']);
  assert.equal(triceps.defaultVariant, 'overhead');
  // Cada opção aponta para o próprio vídeo e não mistura cargas.
  assert.deepEqual(plain(triceps.variants.map(variant => variant.videoKey)), ['triceps_overhead', 'triceps_skull_dumbbell']);
  const session = app.Core.createSession('push_b', '2026-08-10', 1);
  const log = session.exercises.find(item => item.exerciseId === 'triceps_overhead');
  assert.equal(log.variationId, 'overhead');
  assert.notEqual(
    app.Core.comparableSeriesKey('triceps_overhead', 'overhead', '', 'bilateral', '10-12'),
    app.Core.comparableSeriesKey('triceps_overhead', 'skull_crusher', '', 'bilateral', '10-12')
  );
});

test('conformidade: variações permitidas por exercício', () => {
  const app = boot();
  const esperado = {
    seated_row_triangle: ['cable_triangle', 'machine_supported'],
    unilateral_row_machine: ['machine_left_right', 'plate_loaded'],
    row_machine_choice: ['seated_cable_triangle', 'articulated_supported', 'articulated_unsupported'],
    squat: ['free_barbell', 'smith'],
    leg_press_45: ['machine_unspecified'],
    leg_extension: ['machine_unspecified'],
    leg_curl: ['seated', 'lying', 'standing_unilateral'],
    calf_standing_or_leg_press: ['standing_machine', 'leg_press_45'],
    calf_seated: ['seated_machine'],
    triceps_overhead: ['overhead', 'skull_crusher']
  };
  for (const exercise of Object.values(app.Data.CATALOG)) {
    assert.deepEqual(
      plain(exercise.variants.map(variant => variant.id)),
      esperado[exercise.id] || [],
      `variações divergentes em ${exercise.id}`
    );
  }
});

test('conformidade: stiff e terra romeno estão ausentes e o terra fica só em Pernas B', () => {
  const app = boot();
  const proibidos = /stiff|romen|rdl/i;
  for (const exercise of Object.values(app.Data.CATALOG)) {
    assert.doesNotMatch(exercise.name, proibidos, `exercício proibido no catálogo: ${exercise.id}`);
    assert.doesNotMatch(exercise.id, proibidos, `identificador proibido no catálogo: ${exercise.id}`);
  }
  for (const workout of app.Data.WORKOUTS) {
    workout.exercises.forEach(exercise => assert.doesNotMatch(exercise.name, proibidos, `exercício proibido em ${workout.id}`));
  }
  const comTerra = app.Data.WORKOUTS.filter(workout => workout.exercises.some(exercise => exercise.id === 'deadlift_barbell'));
  assert.deepEqual(plain(comTerra.map(workout => workout.id)), ['legs_b']);
  // O terra nunca recomenda falha.
  for (let week = 1; week <= 8; week += 1) {
    const prescricao = app.Data.prescriptionFor(app.Data.CATALOG.deadlift_barbell, week, false);
    assert.ok(prescricao.rirMin >= 2, `terra com RIR mínimo abaixo de 2 na semana ${week}`);
  }
});

test('conformidade: semana canônica de segunda a sábado, domingo sem sessão', () => {
  const app = boot();
  assert.deepEqual(plain(app.Data.DAY_WORKOUT), {1: 'push_a', 2: 'pull_a', 3: 'legs_a', 4: 'push_b', 5: 'pull_b', 6: 'legs_b'});
  assert.equal(app.Data.DAY_WORKOUT[0], undefined);
  assert.equal(app.Data.workoutForDate('2026-08-16'), '', 'domingo não pode ter treino');
  const dias = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15'];
  assert.deepEqual(plain(dias.map(day => app.Data.workoutForDate(day))), ['push_a', 'pull_a', 'legs_a', 'push_b', 'pull_b', 'legs_b']);
});

test('conformidade: supinos em máquina nas duas exposições e mobilidade idêntica nas pernas', () => {
  const app = boot();
  for (const workoutId of ['push_a', 'push_b']) {
    const ids = app.Data.WORKOUT_BY_ID[workoutId].exercises.map(exercise => exercise.id);
    assert.ok(ids.includes('chest_press_machine'), `supino reto na máquina ausente em ${workoutId}`);
    assert.ok(ids.includes('incline_press_machine'), `supino inclinado na máquina ausente em ${workoutId}`);
    assert.equal(ids.some(id => /barbell/.test(id) && id !== 'deadlift_barbell'), false, `barra livre indevida em ${workoutId}`);
  }
  const mobilidade = workoutId => plain(app.Data.WORKOUT_BY_ID[workoutId].exercises
    .filter(exercise => exercise.type === 'mobility')
    .map(exercise => [exercise.id, exercise.sets, exercise.target, exercise.effort || '']));
  assert.deepEqual(mobilidade('legs_a'), mobilidade('legs_b'));
  assert.equal(mobilidade('legs_a').length, 4);
});

test('conformidade: bracing é orientação e vacuum fica fora do volume da musculação', () => {
  const app = boot();
  assert.equal(typeof app.Data.BRACING_TEXT, 'string');
  assert.ok(app.Data.BRACING_TEXT.length > 40);
  for (const workout of app.Data.WORKOUTS) {
    workout.exercises.forEach(exercise => {
      assert.doesNotMatch(exercise.name, /bracing|vacuum/i, `${exercise.id} não pode ser exercício da ficha`);
    });
  }
  // O vacuum vive no módulo separado de rotina em casa.
  const rotina = plain(app.run(`THFCore.normalizeHomeRoutine({date: '2026-08-12', position: 'lying', durationSeconds: 15, repetitions: 2}, 0)`));
  assert.equal(rotina.date, '2026-08-12');
  assert.equal(rotina.position, 'lying');
  const session = app.Core.createSession('legs_a', '2026-08-12', 1);
  assert.equal(session.exercises.some(log => /vacuum/i.test(log.exerciseId)), false);
});

test('conformidade: versão do app e esquema de dados são independentes', () => {
  const app = boot();
  assert.match(app.Core.APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(app.Core.SCHEMA_VERSION, 11);
  const backup = app.Core.buildBackup(app.Core.defaultState());
  assert.equal(backup.schemaVersion, 11);
  assert.equal(Object.prototype.hasOwnProperty.call(backup, 'appVersion'), false, 'a versão do app não entra no formato persistido');
});
