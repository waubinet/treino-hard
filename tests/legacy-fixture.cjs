'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');

const BASELINE_COMMIT = 'bcef68ea252bad5a71e7ef4e92bfedcb01bfa5c1';
const FIXED_NOW = '2026-08-31T20:00:00.000Z';
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'schema12-real-backup.json');
const ROOT = path.resolve(__dirname, '..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Tests read a frozen payload. They must not derive an old format from today's
// createSession/normalizeState, otherwise the migration test follows new bugs.
function readLegacyBackup(schemaVersion = 12) {
  if (![11, 12].includes(schemaVersion)) throw new Error('Fixture supports schema 11 or 12.');
  const backup = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  if (schemaVersion === 11) {
    // This is the sole persisted field introduced by the real 11 -> 12 change.
    backup.schemaVersion = 11;
    backup.state.schemaVersion = 11;
    delete backup.state.settings.equipmentLoadSteps;
  }
  return backup;
}

function readLegacyState(schemaVersion = 12) {
  return readLegacyBackup(schemaVersion).state;
}

// Explicit regeneration only: execute the ACTUAL pre-change source from Git.
// This function is read-only; its output is persisted through apply_patch.
function generateLegacyFixture() {
  let uuid = 0;
  const source = file => execFileSync('git', ['show', `${BASELINE_COMMIT}:${file}`], {cwd: ROOT, encoding: 'utf8'});
  const workoutsSource = source('js/workouts.js');
  const coreSource = source('js/core.js');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
    static now() { return Date.parse(FIXED_NOW); }
  }
  const context = vm.createContext({
    Date: FixedDate,
    crypto: {randomUUID: () => `10000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`}
  });
  vm.runInContext(workoutsSource, context, {filename: 'baseline-v12/workouts.js'});
  vm.runInContext(coreSource, context, {filename: 'baseline-v12/core.js'});
  vm.runInContext(`
    const state = THFCore.defaultState('2026-08-01T12:00:00.000Z');
    state.revision = 23;
    state.updatedAt = '2026-08-31T20:00:00.000Z';
    state.cycle.id = 'fixture-cycle-current';
    state.cycle.currentWeek = 3;
    state.settings.mode = 'sequence';
    state.settings.videoMode = 'inline';
    state.settings.equipmentLoadSteps = [
      {exerciseId: 'unilateral_row_machine', variationId: 'machine_left_right', machineId: 'Remada fixture', step: 2.5, updatedAt: '2026-08-10T12:00:00.000Z'},
      {exerciseId: 'leg_press_45', variationId: 'machine_unspecified', machineId: 'Leg press fixture', step: 5, updatedAt: '2026-08-12T12:00:00.000Z'}
    ];
    function fixtureSession(workoutId, date, week, status, suffix) {
      const session = THFCore.createSession(workoutId, date, week);
      session.id = 'fixture-session-' + suffix;
      session.createdAt = date + 'T12:00:00.000Z';
      session.updatedAt = date + 'T13:00:00.000Z';
      session.status = status;
      session.note = 'Dados fictícios congelados; ' + suffix + '.';
      if (status !== 'planned') {
        session.actualDate = date;
        session.startedAt = date + 'T12:00:00.000Z';
        session.completedAt = date + 'T13:00:00.000Z';
        session.durationSeconds = 3600;
      }
      session.exercises.forEach((log, logIndex) => {
        log.id = 'fixture-log-' + suffix + '-' + logIndex;
        log.sets.forEach((set, setIndex) => {set.id = 'fixture-set-' + suffix + '-' + logIndex + '-' + setIndex;});
        if (status === 'completed') {
          log.completed = true;
          log.sets.forEach(set => {
            set.load = set.type === 'work' ? '25' : '10';
            set.reps = set.type === 'work' ? String(log.prescriptionSnapshot.max) : '10';
            set.rir = '3';
            set.status = 'completed';
            set.completedAt = date + 'T12:30:00.000Z';
          });
        }
      });
      return session;
    }
    const pull = fixtureSession('pull_a', '2026-08-11', 1, 'completed', 'pull-completed');
    pull.exercises.filter(log => log.exerciseId === 'unilateral_row_machine').forEach(log => {
      const right = log.side === 'right';
      log.machineId = 'Remada fixture';
      log.feedback = right ? 'Direito: controle observado no registro antigo.' : 'Esquerdo: registro independente.';
      log.feeling = right ? 'awkward' : 'good';
      log.sets.forEach((set, index) => {
        set.load = right ? String(17.5 + index * 2.5) : String(25 + index * 2.5);
        set.reps = right ? String(12 - index) : String(15 - index);
        set.rir = right ? '2' : '3';
        set.note = right ? 'Série direita antiga ' + index : 'Série esquerda antiga ' + index;
      });
    });
    const legs = fixtureSession('legs_a', '2026-08-12', 2, 'partial', 'legs-partial');
    legs.exercises.forEach(log => {
      if (log.exerciseId === 'leg_curl') log.variationId = 'standing_unilateral';
      if (log.exerciseId === 'leg_press_45') log.machineId = 'Leg press fixture';
      if (['leg_curl', 'leg_press_45', 'leg_extension'].includes(log.exerciseId)) {
        log.completed = log.exerciseId !== 'leg_extension';
        log.sets.forEach((set, index) => {
          set.load = log.exerciseId === 'leg_press_45' ? '120' : (log.exerciseId === 'leg_curl' ? '15' : '35');
          set.reps = String(12 - index);
          set.rir = '2';
          set.status = log.exerciseId === 'leg_extension' && index === 1 ? 'interrupted' : 'completed';
          set.completedAt = '2026-08-12T12:40:00.000Z';
        });
      }
      if (log.exerciseId === 'mob_ankle') {
        log.completed = true;
        log.mobilityFeedback.right.stiffness = true;
        log.mobilityFeedback.right.range_limit = true;
        log.mobilityFeedback.note = 'Registro fictício de mobilidade à direita.';
      }
    });
    const cancelled = fixtureSession('pull_b', '2026-08-14', 2, 'cancelled', 'pull-cancelled');
    cancelled.exercises[0].sets[0].load = '42.5';
    cancelled.exercises[0].sets[0].reps = '6';
    cancelled.exercises[0].sets[0].rir = '1';
    cancelled.exercises[0].sets[0].status = 'interrupted';
    cancelled.exercises[0].sets[0].completedAt = '2026-08-14T12:05:00.000Z';
    const planned = fixtureSession('push_a', '2026-08-17', 3, 'planned', 'push-planned');
    planned.exercises[0].machineId = 'Máquina fixture sem execução';
    const archived = fixtureSession('legs_b', '2026-07-25', 8, 'completed', 'legs-archived');
    archived.exercises.find(log => log.exerciseId === 'leg_curl').variationId = 'lying';
    state.sessions = [pull, legs, cancelled, planned];
    state.archives = [{
      id: 'fixture-archive-one', archivedAt: '2026-07-26T12:00:00.000Z',
      cycle: {id: 'fixture-cycle-archived', startedAt: '2026-06-01T12:00:00.000Z', currentWeek: 8, status: 'archived'},
      sessions: [archived]
    }];
    state.measurements = [THFCore.normalizeMeasurement({
      id: 'fixture-measurement-one', date: '2026-08-10', weight: '95.4', height: '175',
      thighRight: '58', thighLeft: '61.5', calfRight: '38', calfLeft: '40',
      note: 'Medidas fictícias, sem interpretação clínica.', measuredAt: '2026-08-10T07:00:00.000Z', savedAt: '2026-08-10T07:05:00.000Z'
    }, 0)];
    const rowRight = pull.exercises.find(log => log.exerciseId === 'unilateral_row_machine' && log.side === 'right');
    state.progressionDecisions = [{
      id: 'fixture-decision-right', sessionId: pull.id, exerciseId: rowRight.exerciseId,
      seriesKey: THFCore.comparableSeriesKey(rowRight.exerciseId, rowRight.variationId, rowRight.machineId, rowRight.side, rowRight.prescriptionSnapshot.label),
      date: pull.actualDate, recommendation: 'maintain', message: 'Decisão fictícia preservada.', load: '17.5', result: '12 / 11', rir: '2 / 2', decision: 'maintained', nextLoad: '', savedAt: '2026-08-11T13:00:00.000Z'
    }];
    globalThis.fixtureBackup = THFCore.buildBackup(state);
    THFCore.assertCurrentStateStructure(fixtureBackup.state);
  `, context, {filename: 'generate-real-v12-fixture'});
  const hash = text => createHash('sha256').update(text).digest('hex');
  return {
    backup: clone(context.fixtureBackup),
    workouts: clone(context.THFData.WORKOUTS),
    metadata: {
      sourceCommit: BASELINE_COMMIT, appVersion: context.THFCore.APP_VERSION, schemaVersion: context.THFCore.SCHEMA_VERSION,
      sourceSha256: {'js/core.js': hash(coreSource), 'js/workouts.js': hash(workoutsSource)},
      fixedClock: FIXED_NOW, syntheticData: true,
      generation: 'Real baseline Core.defaultState/createSession/buildBackup in VM; no current schema objects.'
    }
  };
}

module.exports = {BASELINE_COMMIT, FIXED_NOW, FIXTURE_PATH, readLegacyBackup, readLegacyState, generateLegacyFixture};

if (require.main === module) {
  const kind = process.argv[3];
  if (process.argv[2] !== '--generate' || !['backup', 'workouts', 'metadata'].includes(kind)) {
    throw new Error('Use: node tests/legacy-fixture.cjs --generate backup|workouts|metadata');
  }
  process.stdout.write(JSON.stringify(generateLegacyFixture()[kind], null, 2));
}
