(function initCore(global) {
  'use strict';

  const Data = global.THFData;
  const LEGACY_WORKOUTS = global.THFSchema12Workouts;
  const APP_ID = 'treino-hard-fofo';
  // Versão do aplicativo: muda a cada publicação funcional.
  // O esquema persistido só muda quando o formato gravado realmente muda.
  const APP_VERSION = '3.6.1';
  const SCHEMA_VERSION = 13;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const MAX_SESSIONS = 5000;
  const MAX_SERIES_PER_EXERCISE = 64;
  const MAX_EQUIPMENT_LOAD_STEPS = 500;
  const STATE_LIMITS = Object.freeze({
    sessions: MAX_SESSIONS,
    cardio: 5000,
    homeRoutines: 5000,
    measurements: 2000,
    progressionDecisions: 10000,
    legacyCycles: 100,
    archives: 100,
    migrationLog: 200,
    quarantine: 20
  });
  const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const SESSION_STATUSES = new Set(['planned', 'started', 'paused', 'completed', 'partial', 'skipped', 'rescheduled', 'cancelled']);
  const SET_STATUSES = new Set(['completed', 'interrupted', 'not_done', 'pain', 'bad_technique', 'excessive_load', 'equipment_unavailable']);
  const VALID_RIR = new Set(['', '0', '1', '2', '3', '4', '5+']);
  const VALID_FEELINGS = new Set(['', 'good', 'awkward', 'pain', 'replace']);
  const SIDE_MODES = new Set(['bilateral', 'unilateral']);
  const EXECUTION_FEEDBACK_FLAGS = Object.freeze(['rangeBelowUsual', 'compensation', 'controlDifficulty', 'unusualStiffness']);
  const POST_LEG_CHECK_FLAGS = Object.freeze(['rightCalfPain', 'kneePain', 'anklePain', 'gaitChange', 'unusualStiffness', 'controlDrop']);
  const LEGACY_SCHEMA_12_UNILATERAL = new Set(['unilateral_row_machine']);
  const TOP_LEVEL_STATE_FIELDS = new Set([
    'schemaVersion', 'app', 'revision', 'createdAt', 'updatedAt', 'settings', 'cycle', 'sessions',
    'cardio', 'homeRoutines', 'measurements', 'progressionDecisions', 'legacyCycles', 'archives',
    'migrationLog', 'quarantine'
  ]);

  function isRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasForbiddenKey(value, depth) {
    const level = depth || 0;
    if (level > 20) return true;
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(item => hasForbiddenKey(item, level + 1));
    return Object.keys(value).some(key => FORBIDDEN_KEYS.has(key) || hasForbiddenKey(value[key], level + 1));
  }

  function assertSafeParsed(value) {
    if (!isRecord(value)) throw new Error('O arquivo precisa conter um objeto JSON.');
    if (hasForbiddenKey(value)) throw new Error('O arquivo contém propriedades proibidas ou profundidade excessiva.');
    return value;
  }

  function cleanText(value, maxLength) {
    const limit = Math.max(1, Math.min(2000, Number(maxLength) || 240));
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function cleanMultiline(value, maxLength) {
    const limit = Math.max(1, Math.min(5000, Number(maxLength) || 500));
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/\r\n?/g, '\n')
      .trim()
      .slice(0, limit);
  }

  function cleanId(value, fallback) {
    const clean = String(value || '').replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 100);
    const resolvedFallback = arguments.length >= 2 ? String(fallback == null ? '' : fallback) : 'item';
    return clean || resolvedFallback;
  }

  function validIso(value) {
    if (typeof value !== 'string' || value.length > 40) return '';
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
  }

  function validDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? match[0] : '';
  }

  function localDateKey(date) {
    const value = date instanceof Date ? date : new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  function numericString(value, options) {
    if (value == null || value === '') return '';
    const settings = options || {};
    const max = Number(settings.max) || 5000;
    const decimals = Number.isInteger(settings.decimals) ? settings.decimals : 2;
    const parsed = Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return '';
    const rounded = Math.round(parsed * (10 ** decimals)) / (10 ** decimals);
    return String(rounded);
  }

  function integerString(value, max) {
    if (value == null || value === '') return '';
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= (max || 1000) ? String(parsed) : '';
  }

  function uid(prefix) {
    const cryptoObject = global.crypto;
    if (cryptoObject && typeof cryptoObject.randomUUID === 'function') return `${prefix || 'id'}-${cryptoObject.randomUUID()}`;
    return `${prefix || 'id'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function stableId(prefix, parts) {
    const input = (Array.isArray(parts) ? parts : [parts]).map(item => String(item == null ? '' : item)).join('\u001F');
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }
    return `${cleanId(prefix, 'id')}-${first.toString(36)}${second.toString(36)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // O degrau pertence à configuração física do exercício (exercício,
  // variação e identificação da máquina), não ao lado executado nem à faixa da
  // periodização. Assim uma remada unilateral usa o mesmo degrau nos dois lados.
  function equipmentLoadStepKey(exerciseId, variationId, machineId) {
    return [
      cleanId(exerciseId, 'unknown'),
      cleanId(variationId, 'default') || 'default',
      cleanText(machineId, 80).toLocaleLowerCase('pt-BR') || 'machine-unspecified'
    ].join('|');
  }

  function configurationDefinitions(extraDefinitions) {
    return Object.values(Data.CATALOG).concat(Array.isArray(LEGACY_WORKOUTS) ? LEGACY_WORKOUTS.flatMap(workout => workout.exercises) : [], Array.isArray(extraDefinitions) ? extraDefinitions : []);
  }

  function isKnownEquipment(exerciseId, variationId, definitions) {
    return configurationDefinitions(definitions).some(exercise => exercise.id === exerciseId && exercise.type === 'strength'
      && (!variationId || (Array.isArray(exercise.variants) && exercise.variants.some(variant => variant.id === variationId))));
  }

  function snapshotDefinitions(state) {
    const sessions = (Array.isArray(state.sessions) ? state.sessions : []).concat(Array.isArray(state.archives) ? state.archives.flatMap(archive => Array.isArray(archive && archive.sessions) ? archive.sessions : []) : []);
    return sessions.flatMap(session => session && session.workoutSnapshot && Array.isArray(session.workoutSnapshot.exercises) ? session.workoutSnapshot.exercises : []);
  }

  function normalizeEquipmentLoadSteps(raw, definitions) {
    const entries = Array.isArray(raw) ? raw.slice(0, MAX_EQUIPMENT_LOAD_STEPS) : [];
    const normalized = new Map();
    entries.forEach(item => {
      if (!isRecord(item)) return;
      const exerciseId = cleanId(item.exerciseId, '');
      const variationId = cleanId(item.variationId, '');
      if (!isKnownEquipment(exerciseId, variationId, definitions)) return;
      const machineId = cleanText(item.machineId, 80);
      const stepText = numericString(item.step, {max: 1000, decimals: 2});
      if (!stepText || Number(stepText) <= 0) return;
      const entry = {
        exerciseId,
        variationId,
        machineId,
        step: Number(stepText),
        updatedAt: validIso(item.updatedAt) || new Date().toISOString()
      };
      normalized.set(equipmentLoadStepKey(exerciseId, variationId, machineId), entry);
    });
    return [...normalized.values()];
  }

  function normalizeSettings(raw, schemaVersion, definitions) {
    const value = isRecord(raw) ? raw : {};
    const targetSchema = Number(schemaVersion) || SCHEMA_VERSION;
    const vacuumFrequency = Math.max(1, Math.min(7, Number(value.vacuumFrequency) || 3));
    const vacuumRepetitions = Math.max(1, Math.min(10, Number(value.vacuumRepetitions) || 2));
    const vacuumDuration = Math.max(5, Math.min(120, Number(value.vacuumDuration) || 15));
    const normalized = {
      mode: value.mode === 'sequence' ? 'sequence' : 'calendar',
      sound: value.sound !== false,
      vibration: value.vibration !== false,
      largeText: value.largeText === true,
      keepAwake: value.keepAwake !== false,
      autoStartRest: value.autoStartRest === true,
      videoMode: ['external', 'inline', 'ask'].includes(value.videoMode) ? value.videoMode : 'external',
      defaultWeek: Math.max(1, Math.min(8, Number(value.defaultWeek) || 1)),
      vacuumFrequency,
      vacuumRepetitions,
      vacuumDuration,
      vacuumPosition: ['lying', 'all_fours', 'seated', 'standing'].includes(value.vacuumPosition) ? value.vacuumPosition : 'lying'
    };
    if (targetSchema >= 12) normalized.equipmentLoadSteps = normalizeEquipmentLoadSteps(value.equipmentLoadSteps, definitions);
    if (targetSchema >= 13) {
      const tracking = isRecord(value.sideTracking) ? value.sideTracking : {};
      normalized.sideTracking = {
        enabled: tracking.enabled !== false,
        affectedSide: ['right', 'left', 'unspecified'].includes(tracking.affectedSide) ? tracking.affectedSide : 'right'
      };
    }
    return normalized;
  }

  function defaultState(now) {
    const timestamp = validIso(now) || new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      app: APP_ID,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: normalizeSettings({}),
      cycle: {id: uid('cycle'), startedAt: timestamp, currentWeek: 1, status: 'active'},
      sessions: [],
      cardio: [],
      homeRoutines: [],
      measurements: [],
      progressionDecisions: [],
      legacyCycles: [],
      archives: [],
      migrationLog: [],
      quarantine: []
    };
  }

  function normalizeSet(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const type = value.type === 'warmup' ? 'warmup' : 'work';
    const status = SET_STATUSES.has(value.status) ? value.status : '';
    const rir = VALID_RIR.has(String(value.rir == null ? '' : value.rir)) ? String(value.rir == null ? '' : value.rir) : '';
    return {
      id: cleanId(value.id, `set-${index + 1}`),
      type,
      index: Math.max(0, Math.min(99, Number(value.index) || index)),
      load: numericString(value.load == null ? value.kg : value.load, {max: 5000, decimals: 2}),
      reps: integerString(value.reps, 1000),
      rir,
      status,
      note: cleanText(value.note, 200),
      completedAt: validIso(value.completedAt),
      nextRestSeconds: Math.max(0, Math.min(1800, Number(value.nextRestSeconds) || 0))
    };
  }

  function isSetConfirmed(set) {
    return isRecord(set) && SET_STATUSES.has(set.status) && Boolean(validIso(set.completedAt));
  }

  function assertStateLimits(raw) {
    const value = isRecord(raw) ? raw : {};
    Object.entries(STATE_LIMITS).forEach(([field, limit]) => {
      if (Array.isArray(value[field]) && value[field].length > limit) {
        throw new Error(`O campo ${field} excede o limite seguro de ${limit} registros; nada foi truncado.`);
      }
    });
    if (Array.isArray(value.archives)) {
      value.archives.forEach((archive, index) => {
        if (isRecord(archive) && Array.isArray(archive.sessions) && archive.sessions.length > MAX_SESSIONS) {
          throw new Error(`O ciclo arquivado ${index + 1} excede ${MAX_SESSIONS} sessões; nada foi truncado.`);
        }
      });
    }
    const sessions = Array.isArray(value.sessions) ? value.sessions : [];
    const archivedSessions = Array.isArray(value.archives)
      ? value.archives.flatMap(item => (isRecord(item) && Array.isArray(item.sessions) ? item.sessions : []))
      : [];
    sessions.concat(archivedSessions).forEach((session, sessionIndex) => {
      if (!isRecord(session)) return;
      if (Array.isArray(session.exercises)) {
        session.exercises.forEach((exercise, exerciseIndex) => {
          if (isRecord(exercise) && Array.isArray(exercise.sets) && exercise.sets.length > MAX_SERIES_PER_EXERCISE) {
            throw new Error(`A sessão ${sessionIndex + 1}, exercício ${exerciseIndex + 1}, excede ${MAX_SERIES_PER_EXERCISE} séries; nada foi truncado.`);
          }
        });
      }
    });
    return value;
  }

  function assertCurrentCollectionIntegrity(value) {
    const snapshotSchema = Number(value.schemaVersion) >= 13;
    const fail = message => { throw new Error(`O documento local contém ${message}; nenhum registro foi descartado.`); };
    const hasOwn = (item, key) => Object.prototype.hasOwnProperty.call(item, key);
    const requireRecord = (item, label) => {
      if (!isRecord(item)) fail(`${label} em formato inválido`);
    };
    const requireUniqueIds = (items, label) => {
      const seen = new Set();
      items.forEach((item, index) => {
        const id = item && item.id;
        if (typeof id !== 'string' || !id) return;
        if (seen.has(id)) fail(`${label} com ID duplicado em ${index + 1}: ${id}`);
        seen.add(id);
      });
    };
    const knownKeys = (item, allowed, label) => {
      const unknown = Object.keys(item).filter(key => !allowed.includes(key));
      if (unknown.length) fail(`${label} com campos inesperados: ${unknown.slice(0, 5).join(', ')}`);
    };
    const requireText = (item, key, label, maxLength, multiline) => {
      if (!hasOwn(item, key) || item[key] == null) return;
      if (typeof item[key] !== 'string') fail(`${label}.${key} em formato inválido`);
      const cleaned = multiline ? cleanMultiline(item[key], maxLength) : cleanText(item[key], maxLength);
      if (cleaned !== item[key]) fail(`${label}.${key} contém texto inválido ou acima do limite`);
    };
    const requireId = (item, key, label, required) => {
      if (!hasOwn(item, key) || item[key] == null) {
        if (required) fail(`${label}.${key} ausente`);
        return;
      }
      if (typeof item[key] !== 'string' || cleanId(item[key], '') !== item[key] || (required && !item[key])) {
        fail(`${label}.${key} em formato inválido`);
      }
    };
    const requireBoolean = (item, key, label) => {
      if (hasOwn(item, key) && typeof item[key] !== 'boolean') fail(`${label}.${key} precisa ser verdadeiro ou falso`);
    };
    const requireEnum = (item, key, allowed, label, allowEmpty) => {
      if (!hasOwn(item, key) || item[key] == null || (allowEmpty && item[key] === '')) return;
      if (!allowed.includes(item[key])) fail(`${label}.${key} possui valor inválido`);
    };
    const requireNumber = (item, key, label, minimum, maximum, integer, allowEmpty) => {
      if (!hasOwn(item, key) || item[key] == null || (allowEmpty && item[key] === '')) return;
      if (!['number', 'string'].includes(typeof item[key]) || String(item[key]).trim() === '') fail(`${label}.${key} em formato inválido`);
      const number = Number(item[key]);
      if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
        fail(`${label}.${key} fora do intervalo válido`);
      }
    };
    const requireNumericText = (item, key, label, normalizer) => {
      if (!hasOwn(item, key) || item[key] == null || item[key] === '') return;
      if (!['number', 'string'].includes(typeof item[key]) || normalizer(item[key]) === '') fail(`${label}.${key} em formato inválido`);
    };
    const requireDate = (item, key, label, required) => {
      if (!hasOwn(item, key) || item[key] == null || item[key] === '') {
        if (required) fail(`${label}.${key} ausente`);
        return;
      }
      if (typeof item[key] !== 'string' || !validDate(item[key])) fail(`${label}.${key} não é uma data válida`);
    };
    const requireIso = (item, key, label, required) => {
      if (!hasOwn(item, key) || item[key] == null || item[key] === '') {
        if (required) fail(`${label}.${key} ausente`);
        return;
      }
      if (typeof item[key] !== 'string' || !validIso(item[key])) fail(`${label}.${key} não é um horário válido`);
    };
    const validateSet = (set, label) => {
      requireRecord(set, label);
      knownKeys(set, ['id', 'type', 'index', 'load', 'kg', 'reps', 'rir', 'status', 'note', 'completedAt', 'nextRestSeconds'], label);
      requireId(set, 'id', label, true);
      requireEnum(set, 'type', ['warmup', 'work'], label, false);
      requireNumber(set, 'index', label, 0, 99, true, false);
      requireNumericText(set, hasOwn(set, 'load') ? 'load' : 'kg', label, item => numericString(item, {max: 5000, decimals: 2}));
      requireNumericText(set, 'reps', label, item => integerString(item, 1000));
      requireEnum(set, 'rir', [...VALID_RIR], label, true);
      requireEnum(set, 'status', [...SET_STATUSES], label, true);
      requireText(set, 'note', label, 200, false);
      requireIso(set, 'completedAt', label, false);
      requireNumber(set, 'nextRestSeconds', label, 0, 1800, false, false);
    };
    const validatePrescription = (snapshot, label) => {
      requireRecord(snapshot, label);
      knownKeys(snapshot, ['category', 'sets', 'workSets', 'min', 'max', 'repMin', 'repMax', 'label', 'rirMin', 'rirMax', 'restSeconds', 'restSec', 'deload'], label);
      requireEnum(snapshot, 'category', ['upper_compound', 'squat_press', 'accessory', 'deadlift', 'mobility'], label, false);
      requireNumber(snapshot, hasOwn(snapshot, 'sets') ? 'sets' : 'workSets', label, 0, MAX_SERIES_PER_EXERCISE, true, false);
      requireNumber(snapshot, hasOwn(snapshot, 'min') ? 'min' : 'repMin', label, 0, 1000, false, false);
      requireNumber(snapshot, hasOwn(snapshot, 'max') ? 'max' : 'repMax', label, 0, 1000, false, false);
      const min = Number(snapshot.min == null ? snapshot.repMin : snapshot.min);
      const max = Number(snapshot.max == null ? snapshot.repMax : snapshot.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max < min) fail(`${label} com faixa invertida`);
      requireText(snapshot, 'label', label, 50, false);
      requireNumber(snapshot, 'rirMin', label, 0, 5, false, true);
      requireNumber(snapshot, 'rirMax', label, 0, 5, false, true);
      if (snapshot.rirMin != null && snapshot.rirMin !== '' && snapshot.rirMax != null && snapshot.rirMax !== '' && Number(snapshot.rirMax) < Number(snapshot.rirMin)) {
        fail(`${label} com RIR invertido`);
      }
      requireNumber(snapshot, hasOwn(snapshot, 'restSeconds') ? 'restSeconds' : 'restSec', label, 0, 1800, false, false);
      requireBoolean(snapshot, 'deload', label);
    };
    const validateMobilityFeedback = (feedback, label) => {
      requireRecord(feedback, label);
      knownKeys(feedback, ['left', 'right', 'note'], label);
      ['left', 'right'].forEach(side => {
        requireRecord(feedback[side], `${label}, lado ${side}`);
        knownKeys(feedback[side], ['stiffness', 'pain', 'range_limit', 'support_difficulty'], `${label}, lado ${side}`);
        ['stiffness', 'pain', 'range_limit', 'support_difficulty'].forEach(key => requireBoolean(feedback[side], key, `${label}, lado ${side}`));
      });
      requireText(feedback, 'note', label, 300, false);
    };
    const validateFlags = (feedback, flags, label, postLeg) => {
      requireRecord(feedback, label);
      knownKeys(feedback, flags.concat(postLeg ? ['noRelevantChange', 'note', 'savedAt'] : ['note']), label);
      flags.forEach(key => requireBoolean(feedback, key, label));
      requireText(feedback, 'note', label, postLeg ? 500 : 300, false);
      if (postLeg) {
        requireBoolean(feedback, 'noRelevantChange', label);
        requireIso(feedback, 'savedAt', label, false);
        if (feedback.noRelevantChange && flags.some(key => feedback[key])) fail(`${label} contraditório`);
      }
    };
    const validateWorkoutSnapshot = (snapshot, session, label) => {
      requireRecord(snapshot, label);
      knownKeys(snapshot, ['revision', 'id', 'label', 'intro', 'weekday', 'workSetTotal', 'exercises'], label);
      requireId(snapshot, 'id', label, true);
      requireText(snapshot, 'revision', label, 40, false);
      requireText(snapshot, 'label', label, 120, false);
      requireText(snapshot, 'intro', label, 1000, false);
      requireNumber(snapshot, 'weekday', label, 0, 6, true, false);
      requireNumber(snapshot, 'workSetTotal', label, 0, 1000, true, false);
      if (snapshot.id !== session.workoutId || !snapshot.revision || !snapshot.label) fail(`${label} sem identidade válida`);
      if (!Array.isArray(snapshot.exercises) || !snapshot.exercises.length || snapshot.exercises.length > 100) fail(`${label} com ficha inválida`);
      requireUniqueIds(snapshot.exercises, label);
      snapshot.exercises.forEach((definition, index) => {
        const itemLabel = `${label}, definição ${index + 1}`;
        requireRecord(definition, itemLabel);
        knownKeys(definition, ['id', 'name', 'type', 'category', 'workSets', 'loadStep', 'muscles', 'restSeconds', 'warmupSets', 'warmupOptional', 'detail', 'notes', 'variants', 'defaultVariant', 'defaultSideMode', 'preferredTrackingVariant', 'videoKey', 'bracing', 'allowHighReps', 'unilateral', 'sets', 'target', 'effort', 'sideFeedback', 'prompts', 'sideModeSnapshot'], itemLabel);
        requireId(definition, 'id', itemLabel, true);
        requireText(definition, 'name', itemLabel, 200, false);
        if (!definition.name || !['strength', 'mobility'].includes(definition.type) || !SIDE_MODES.has(definition.sideModeSnapshot)) fail(`${itemLabel} incompleta`);
        ['warmupOptional', 'bracing', 'allowHighReps', 'unilateral', 'sideFeedback'].forEach(key => requireBoolean(definition, key, itemLabel));
        ['workSets', 'sets', 'warmupSets'].forEach(key => requireNumber(definition, key, itemLabel, 0, 64, true, false));
        requireNumber(definition, 'loadStep', itemLabel, 0.01, 1000, false, false);
        requireNumber(definition, 'restSeconds', itemLabel, 0, 1800, false, false);
        requireEnum(definition, 'category', ['upper_compound', 'squat_press', 'accessory', 'deadlift'], itemLabel, false);
        requireEnum(definition, 'defaultSideMode', [...SIDE_MODES], itemLabel, false);
        ['defaultVariant', 'preferredTrackingVariant', 'videoKey'].forEach(key => requireId(definition, key, itemLabel, false));
        ['detail', 'target', 'effort'].forEach(key => requireText(definition, key, itemLabel, 1000, false));
        ['notes', 'prompts'].forEach(key => {
          if (definition[key] == null) return;
          if (!Array.isArray(definition[key]) || definition[key].length > 20 || definition[key].some(text => typeof text !== 'string' || cleanText(text, 2000) !== text)) fail(`${itemLabel}.${key} inválido`);
        });
        if (definition.type === 'strength') {
          if (!Number.isInteger(definition.workSets) || definition.workSets < 1
            || !['upper_compound', 'squat_press', 'accessory', 'deadlift'].includes(definition.category)
            || !Number.isFinite(definition.restSeconds) || definition.restSeconds < 0
            || !Number.isInteger(definition.warmupSets) || definition.warmupSets < 0) fail(`${itemLabel} sem prescrição de força completa`);
          if (!Array.isArray(definition.variants) || definition.variants.length > 30) fail(`${itemLabel} com variantes inválidas`);
          requireUniqueIds(definition.variants, itemLabel);
          definition.variants.forEach(variant => {
            requireRecord(variant, itemLabel);
            knownKeys(variant, ['id', 'label', 'videoKey', 'sideMode', 'requiresUnilateralSupport'], itemLabel);
            requireId(variant, 'id', itemLabel, true);
            requireText(variant, 'label', itemLabel, 200, false);
            requireId(variant, 'videoKey', itemLabel, false);
            requireEnum(variant, 'sideMode', [...SIDE_MODES], itemLabel, false);
            requireBoolean(variant, 'requiresUnilateralSupport', itemLabel);
          });
          if (definition.defaultVariant && !definition.variants.some(variant => variant.id === definition.defaultVariant)) fail(`${itemLabel} com variante padrão inexistente`);
          requireRecord(definition.muscles, itemLabel);
          knownKeys(definition.muscles, ['primary', 'secondary'], itemLabel);
          ['primary', 'secondary'].forEach(key => {
            if (!Array.isArray(definition.muscles[key]) || definition.muscles[key].length > 20 || definition.muscles[key].some(id => typeof id !== 'string' || cleanId(id, '') !== id)) fail(`${itemLabel} com grupos musculares inválidos`);
          });
        } else if (definition.sideModeSnapshot !== 'bilateral' || !Number.isInteger(definition.sets) || definition.sets < 1 || !definition.target) fail(`${itemLabel} com prescrição de mobilidade inválida`);
      });
      return snapshot;
    };
    const validateSession = (session, label) => {
      requireRecord(session, label);
      knownKeys(session, ['id', 'workoutId', 'plannedDate', 'actualDate', 'week', 'status', 'startedAt', 'pausedAt', 'pausedSeconds', 'completedAt', 'durationSeconds', 'rescheduledFrom', 'note', 'cardioId', 'exercises', 'createdAt', 'updatedAt'].concat(snapshotSchema ? ['workoutSnapshot', 'postLegCheck'] : []), label);
      requireId(session, 'id', label, true);
      requireId(session, 'workoutId', label, true);
      if ((!snapshotSchema && !legacyWorkout(session.workoutId)) || !validDate(session.plannedDate)) fail(`${label} inválida`);
      requireDate(session, 'plannedDate', label, true);
      requireDate(session, 'actualDate', label, false);
      requireNumber(session, 'week', label, 1, 8, true, false);
      requireEnum(session, 'status', [...SESSION_STATUSES], label, false);
      requireIso(session, 'startedAt', label, false);
      requireIso(session, 'pausedAt', label, false);
      requireNumber(session, 'pausedSeconds', label, 0, 10000000, false, false);
      requireIso(session, 'completedAt', label, false);
      requireNumber(session, 'durationSeconds', label, 0, 10000000, false, false);
      requireDate(session, 'rescheduledFrom', label, false);
      requireText(session, 'note', label, 500, false);
      requireId(session, 'cardioId', label, false);
      requireIso(session, 'createdAt', label, true);
      requireIso(session, 'updatedAt', label, true);
      if (!Array.isArray(session.exercises)) fail(`${label} sem lista válida de exercícios`);
      if (session.exercises.length > 100) fail(`${label} com mais de 100 registros de exercício`);
      requireUniqueIds(session.exercises, `${label}, exercícios`);
      const workout = snapshotSchema ? validateWorkoutSnapshot(session.workoutSnapshot, session, `${label}, retrato da ficha`) : legacyWorkout(session.workoutId);
      if (snapshotSchema && session.postLegCheck != null) validateFlags(session.postLegCheck, POST_LEG_CHECK_FLAGS, `${label}, relato após pernas`, true);
      const expectedLogs = workout.exercises.flatMap(exercise => (snapshotSchema ? exercise.sideModeSnapshot === 'unilateral' : exercise.unilateral)
        ? [`${exercise.id}|left`, `${exercise.id}|right`]
        : [`${exercise.id}|bilateral`]).sort();
      const actualLogs = session.exercises.map(exercise => `${exercise.exerciseId}|${exercise.side}`).sort();
      if (actualLogs.length !== expectedLogs.length || actualLogs.some((key, index) => key !== expectedLogs[index])) {
        fail(`${label} com exercícios, lados ou cardinalidade incompatíveis com ${workout.label}`);
      }
      session.exercises.forEach((exercise, exerciseIndex) => {
        const exerciseLabel = `${label}, exercício ${exerciseIndex + 1}`;
        requireRecord(exercise, exerciseLabel);
        knownKeys(exercise, ['id', 'exerciseId', 'variationId', 'machineId', 'side', 'highRepPreference', 'completed', 'skipped', 'feeling', 'feedback', 'mobilityFeedback', 'prescriptionSnapshot', 'sets'].concat(snapshotSchema ? ['sideModeSnapshot', 'executionFeedback'] : []), exerciseLabel);
        requireId(exercise, 'id', exerciseLabel, true);
        requireId(exercise, 'exerciseId', exerciseLabel, true);
        requireId(exercise, 'variationId', exerciseLabel, false);
        const definition = workout.exercises.find(item => item.id === exercise.exerciseId);
        if (!definition) fail(`${exerciseLabel} não pertence ao treino ${workout.label}`);
        const variants = Array.isArray(definition.variants) ? definition.variants : [];
        if (exercise.variationId && !variants.some(variant => variant.id === exercise.variationId)) {
          fail(`${exerciseLabel}.variationId não pertence ao exercício ${definition.name}`);
        }
        requireText(exercise, 'machineId', exerciseLabel, 80, false);
        requireEnum(exercise, 'side', ['left', 'right', 'bilateral'], exerciseLabel, false);
        if (snapshotSchema) {
          if (exercise.sideModeSnapshot !== definition.sideModeSnapshot) fail(`${exerciseLabel} com modo diferente do retrato da sessão`);
          if (exercise.executionFeedback != null) validateFlags(exercise.executionFeedback, EXECUTION_FEEDBACK_FLAGS, `${exerciseLabel}, execução`, false);
        }
        ['highRepPreference', 'completed', 'skipped'].forEach(key => requireBoolean(exercise, key, exerciseLabel));
        requireEnum(exercise, 'feeling', [...VALID_FEELINGS], exerciseLabel, true);
        requireText(exercise, 'feedback', exerciseLabel, 300, false);
        if (exercise.mobilityFeedback != null) validateMobilityFeedback(exercise.mobilityFeedback, `${exerciseLabel}, feedback de mobilidade`);
        if (exercise.prescriptionSnapshot != null) validatePrescription(exercise.prescriptionSnapshot, `${exerciseLabel}, prescrição`);
        if (!Array.isArray(exercise.sets)) fail(`${exerciseLabel} sem lista válida de séries`);
        requireUniqueIds(exercise.sets, `${exerciseLabel}, séries`);
        exercise.sets.forEach((set, setIndex) => validateSet(set, `${exerciseLabel}, série ${setIndex + 1}`));
      });
    };

    const settingsKeys = ['mode', 'sound', 'vibration', 'largeText', 'keepAwake', 'autoStartRest', 'videoMode', 'defaultWeek', 'vacuumFrequency', 'vacuumRepetitions', 'vacuumDuration', 'vacuumPosition'];
    if (Number(value.schemaVersion) >= 12) settingsKeys.push('equipmentLoadSteps');
    if (snapshotSchema) settingsKeys.push('sideTracking');
    knownKeys(value.settings, settingsKeys, 'configurações');
    if (snapshotSchema) {
      requireRecord(value.settings.sideTracking, 'acompanhamento dos lados');
      knownKeys(value.settings.sideTracking, ['enabled', 'affectedSide'], 'acompanhamento dos lados');
      requireBoolean(value.settings.sideTracking, 'enabled', 'acompanhamento dos lados');
      requireEnum(value.settings.sideTracking, 'affectedSide', ['right', 'left', 'unspecified'], 'acompanhamento dos lados', false);
    }
    requireEnum(value.settings, 'mode', ['calendar', 'sequence'], 'configurações', false);
    ['sound', 'vibration', 'largeText', 'keepAwake', 'autoStartRest'].forEach(key => requireBoolean(value.settings, key, 'configurações'));
    requireEnum(value.settings, 'videoMode', ['external', 'inline', 'ask'], 'configurações', false);
    requireNumber(value.settings, 'defaultWeek', 'configurações', 1, 8, true, false);
    requireNumber(value.settings, 'vacuumFrequency', 'configurações', 1, 7, true, false);
    requireNumber(value.settings, 'vacuumRepetitions', 'configurações', 1, 10, true, false);
    requireNumber(value.settings, 'vacuumDuration', 'configurações', 5, 120, false, false);
    requireEnum(value.settings, 'vacuumPosition', ['lying', 'all_fours', 'seated', 'standing'], 'configurações', false);
    if (Number(value.schemaVersion) >= 12) {
      if (!Array.isArray(value.settings.equipmentLoadSteps)) fail('configurações.equipmentLoadSteps em formato inválido');
      if (value.settings.equipmentLoadSteps.length > MAX_EQUIPMENT_LOAD_STEPS) fail(`configurações.equipmentLoadSteps excede ${MAX_EQUIPMENT_LOAD_STEPS} registros`);
      const loadStepKeys = new Set();
      value.settings.equipmentLoadSteps.forEach((item, index) => {
        const label = `configuração de degrau ${index + 1}`;
        requireRecord(item, label);
        knownKeys(item, ['exerciseId', 'variationId', 'machineId', 'step', 'updatedAt'], label);
        requireId(item, 'exerciseId', label, true);
        requireId(item, 'variationId', label, false);
        if (!isKnownEquipment(item.exerciseId, item.variationId, snapshotDefinitions(value))) fail(`${label}.exerciseId ou variationId não pertence a uma ficha conhecida`);
        requireText(item, 'machineId', label, 80, false);
        requireNumber(item, 'step', label, 0.01, 1000, false, false);
        if (Number(numericString(item.step, {max: 1000, decimals: 2})) !== Number(item.step)) fail(`${label}.step precisa ter no máximo duas casas decimais`);
        requireIso(item, 'updatedAt', label, true);
        const key = equipmentLoadStepKey(item.exerciseId, item.variationId, item.machineId);
        if (loadStepKeys.has(key)) fail(`${label} duplicada para a mesma configuração de aparelho`);
        loadStepKeys.add(key);
      });
    }
    knownKeys(value.cycle, ['id', 'startedAt', 'currentWeek', 'status'], 'ciclo atual');
    requireId(value.cycle, 'id', 'ciclo atual', true);
    requireIso(value.cycle, 'startedAt', 'ciclo atual', true);
    requireNumber(value.cycle, 'currentWeek', 'ciclo atual', 1, 8, true, false);
    requireEnum(value.cycle, 'status', ['active', 'archived'], 'ciclo atual', false);
    const allStoredSessions = value.sessions.concat(value.archives.flatMap(archive => Array.isArray(archive && archive.sessions) ? archive.sessions : []));
    requireUniqueIds(allStoredSessions, 'sessões atuais e arquivadas');
    requireUniqueIds(value.cardio, 'caminhadas');
    requireUniqueIds(value.homeRoutines, 'rotinas em casa');
    requireUniqueIds(value.measurements, 'medições');
    requireUniqueIds(value.progressionDecisions, 'decisões de progressão');
    requireUniqueIds(value.legacyCycles, 'ciclos legados');
    requireUniqueIds(value.archives, 'ciclos arquivados');
    value.sessions.forEach((session, index) => validateSession(session, `sessão ${index + 1}`));
    value.cardio.forEach((item, index) => {
      const label = `caminhada ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['id', 'date', 'startTime', 'durationMinutes', 'distanceKm', 'pace', 'effort', 'status', 'discomfort', 'legDayFlags', 'note', 'relatedSessionId', 'savedAt'], label);
      requireId(item, 'id', label, true);
      requireDate(item, 'date', label, true);
      if (hasOwn(item, 'startTime') && item.startTime !== '' && (typeof item.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(item.startTime))) fail(`${label}.startTime em formato inválido`);
      requireNumber(item, 'durationMinutes', label, 0, 1440, false, false);
      requireNumericText(item, 'distanceKm', label, entry => numericString(entry, {max: 500, decimals: 2}));
      requireText(item, 'pace', label, 30, false);
      requireNumber(item, 'effort', label, 0, 10, false, false);
      requireEnum(item, 'status', ['normal', 'shorter', 'interrupted', 'not_recovery', 'not_pain', 'not_unplanned'], label, false);
      requireText(item, 'discomfort', label, 300, false);
      if (item.legDayFlags != null) {
        requireRecord(item.legDayFlags, `${label}, sinais de pernas`);
        knownKeys(item.legDayFlags, ['fatigue', 'rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop'], `${label}, sinais de pernas`);
        ['fatigue', 'rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop'].forEach(key => requireBoolean(item.legDayFlags, key, `${label}, sinais de pernas`));
      }
      requireText(item, 'note', label, 500, false);
      requireId(item, 'relatedSessionId', label, false);
      requireIso(item, 'savedAt', label, true);
      if (!normalizeCardio(item, index)) fail(`caminhada ${index + 1} inválida`);
    });
    value.homeRoutines.forEach((item, index) => {
      const label = `rotina em casa ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['id', 'date', 'time', 'position', 'durationSeconds', 'repetitions', 'ease', 'note', 'savedAt'], label);
      requireId(item, 'id', label, true);
      requireDate(item, 'date', label, true);
      if (hasOwn(item, 'time') && item.time !== '' && (typeof item.time !== 'string' || !/^\d{2}:\d{2}$/.test(item.time))) fail(`${label}.time em formato inválido`);
      requireEnum(item, 'position', ['lying', 'all_fours', 'seated', 'standing'], label, false);
      requireNumber(item, 'durationSeconds', label, 1, 300, false, false);
      requireNumber(item, 'repetitions', label, 1, 20, false, false);
      requireNumber(item, 'ease', label, 0, 10, false, false);
      requireText(item, 'note', label, 500, false);
      requireIso(item, 'savedAt', label, true);
      if (!normalizeHomeRoutine(item, index)) fail(`rotina em casa ${index + 1} inválida`);
    });
    value.measurements.forEach((item, index) => {
      const label = `medição ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['id', 'date', ...MEASUREMENT_FIELDS, 'arm', 'thigh', 'quality', 'note', 'measuredAt', 'savedAt'], label);
      requireId(item, 'id', label, true);
      requireDate(item, 'date', label, true);
      [...MEASUREMENT_FIELDS, 'arm', 'thigh'].forEach(key => requireNumericText(item, key, label, entry => numericString(entry, {max: 500, decimals: 2})));
      if (item.quality != null) {
        requireRecord(item.quality, `${label}, qualidade`);
        knownKeys(item.quality, ['derivedFields', 'directFields', 'warnings'], `${label}, qualidade`);
        ['derivedFields', 'directFields', 'warnings'].forEach(field => {
          if (!Array.isArray(item.quality[field])) fail(`${label}, qualidade.${field} em formato inválido`);
        });
        ['derivedFields', 'directFields'].forEach(field => {
          if (item.quality[field].some(entry => typeof entry !== 'string' || !MEASUREMENT_FIELDS.includes(entry))) fail(`${label}, qualidade.${field} contém item inválido`);
        });
        item.quality.warnings.forEach((entry, warningIndex) => {
          if (typeof entry !== 'string' || cleanText(entry, 120) !== entry) fail(`${label}, qualidade.warnings ${warningIndex + 1} inválido`);
        });
      }
      requireText(item, 'note', label, 300, false);
      requireIso(item, 'measuredAt', label, false);
      requireIso(item, 'savedAt', label, false);
      if (!normalizeMeasurement(item, index)) fail(`medição ${index + 1} inválida`);
    });
    value.progressionDecisions.forEach((item, index) => {
      const label = `decisão de progressão ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['id', 'sessionId', 'exerciseId', 'seriesKey', 'date', 'recommendation', 'message', 'load', 'result', 'rir', 'decision', 'nextLoad', 'savedAt'].concat(snapshotSchema ? ['side', 'variationId', 'machineId'] : []), label);
      if (snapshotSchema) {
        requireEnum(item, 'side', ['left', 'right', 'bilateral'], label, true);
        requireId(item, 'variationId', label, false);
        requireText(item, 'machineId', label, 80, false);
      }
      requireId(item, 'id', label, true);
      requireId(item, 'sessionId', label, false);
      requireId(item, 'exerciseId', label, false);
      requireText(item, 'seriesKey', label, 300, false);
      requireDate(item, 'date', label, false);
      requireEnum(item, 'recommendation', ['increase', 'maintain', 'review', 'none'], label, false);
      requireText(item, 'message', label, 500, false);
      requireNumericText(item, 'load', label, entry => numericString(entry, {max: 5000, decimals: 2}));
      requireText(item, 'result', label, 200, false);
      requireText(item, 'rir', label, 100, false);
      requireEnum(item, 'decision', ['pending', 'accepted', 'maintained', 'rejected'], label, false);
      requireNumericText(item, 'nextLoad', label, entry => numericString(entry, {max: 5000, decimals: 2}));
      requireIso(item, 'savedAt', label, true);
    });
    value.legacyCycles.forEach((item, index) => {
      const label = `ciclo legado ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['id', 'sourceSchema', 'label', 'importedAt', 'sourceStartedAt', 'sessionMeta', 'records'], label);
      requireId(item, 'id', label, true);
      requireNumber(item, 'sourceSchema', label, 1, 10, true, false);
      requireText(item, 'label', label, 120, false);
      requireIso(item, 'importedAt', label, true);
      requireIso(item, 'sourceStartedAt', label, false);
      if (!Array.isArray(item.sessionMeta) || item.sessionMeta.length > 1000) fail(`${label} com metadados inválidos`);
      if (!Array.isArray(item.records) || item.records.length > 50000) fail(`${label} com registros inválidos`);
      item.sessionMeta.forEach((meta, metaIndex) => {
        const metaLabel = `${label}, metadado ${metaIndex + 1}`;
        requireRecord(meta, metaLabel);
        knownKeys(meta, ['id', 'week', 'occurrence', 'legacyWorkoutId', 'startedAt', 'completedAt', 'manualCompleted'], metaLabel);
        requireId(meta, 'id', metaLabel, true);
        requireNumber(meta, 'week', metaLabel, 1, 8, true, false);
        requireEnum(meta, 'occurrence', [1, 2], metaLabel, false);
        requireEnum(meta, 'legacyWorkoutId', ['a', 'b', 'c'], metaLabel, true);
        requireIso(meta, 'startedAt', metaLabel, false);
        requireIso(meta, 'completedAt', metaLabel, false);
        requireBoolean(meta, 'manualCompleted', metaLabel);
      });
      item.records.forEach((record, recordIndex) => {
        const recordLabel = `${label}, registro ${recordIndex + 1}`;
        requireRecord(record, recordLabel);
        knownKeys(record, ['id', 'week', 'occurrence', 'legacyWorkoutId', 'legacyExerciseId', 'canonicalId', 'legacy', 'variationId', 'equipmentKey', 'mappingStatus', 'done', 'feeling', 'feedback', 'sets'], recordLabel);
        requireId(record, 'id', recordLabel, true);
        requireNumber(record, 'week', recordLabel, 1, 8, true, false);
        requireEnum(record, 'occurrence', [1, 2], recordLabel, false);
        requireEnum(record, 'legacyWorkoutId', ['a', 'b', 'c'], recordLabel, true);
        requireId(record, 'legacyExerciseId', recordLabel, true);
        requireId(record, 'canonicalId', recordLabel, false);
        if (record.canonicalId && !Data.CATALOG[record.canonicalId]) fail(`${recordLabel}.canonicalId desconhecido`);
        requireBoolean(record, 'legacy', recordLabel);
        requireId(record, 'variationId', recordLabel, false);
        requireText(record, 'equipmentKey', recordLabel, 200, false);
        requireEnum(record, 'mappingStatus', ['mapped', 'ambiguous', 'unmapped'], recordLabel, false);
        requireBoolean(record, 'done', recordLabel);
        requireEnum(record, 'feeling', [...VALID_FEELINGS], recordLabel, true);
        requireText(record, 'feedback', recordLabel, 300, false);
        if (!Array.isArray(record.sets) || record.sets.length > MAX_SERIES_PER_EXERCISE) fail(`${recordLabel} com séries inválidas`);
        record.sets.forEach((set, setIndex) => validateSet(set, `${recordLabel}, série ${setIndex + 1}`));
      });
    });
    value.archives.forEach((archive, archiveIndex) => {
      const label = `ciclo arquivado ${archiveIndex + 1}`;
      requireRecord(archive, label);
      knownKeys(archive, ['id', 'archivedAt', 'cycle', 'sessions'], label);
      if (!isRecord(archive.cycle) || !Array.isArray(archive.sessions)) fail(`ciclo arquivado ${archiveIndex + 1} inválido`);
      requireId(archive, 'id', label, true);
      requireIso(archive, 'archivedAt', label, true);
      knownKeys(archive.cycle, ['id', 'startedAt', 'currentWeek', 'status'], `${label}, ciclo`);
      requireId(archive.cycle, 'id', `${label}, ciclo`, true);
      requireIso(archive.cycle, 'startedAt', `${label}, ciclo`, true);
      requireNumber(archive.cycle, 'currentWeek', `${label}, ciclo`, 1, 8, true, false);
      requireEnum(archive.cycle, 'status', ['active', 'archived'], `${label}, ciclo`, false);
      archive.sessions.forEach((session, sessionIndex) => validateSession(session, `ciclo arquivado ${archiveIndex + 1}, sessão ${sessionIndex + 1}`));
    });
    value.migrationLog.forEach((item, index) => {
      const label = `registro de migração ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['at', 'from', 'to', 'summary'], label);
      requireIso(item, 'at', label, true);
      requireNumber(item, 'from', label, 0, 1000, false, false);
      requireNumber(item, 'to', label, 0, 1000, false, false);
      requireText(item, 'summary', label, 500, false);
    });
    value.quarantine.forEach((item, index) => {
      const label = `registro de quarentena ${index + 1}`;
      requireRecord(item, label);
      knownKeys(item, ['at', 'reason', 'raw'], label);
      requireIso(item, 'at', label, true);
      requireText(item, 'reason', label, 500, false);
      requireText(item, 'raw', label, 5000, true);
    });
    return value;
  }

  function assertCurrentStateStructure(raw) {
    const value = assertSafeParsed(raw);
    if (value.app !== APP_ID) throw new Error('Este documento não pertence ao Treino Hard.');
    if (Number(value.schemaVersion) !== SCHEMA_VERSION) throw new Error('O documento local não está no esquema atual e precisa ser migrado.');
    const unexpected = Object.keys(value).filter(key => !TOP_LEVEL_STATE_FIELDS.has(key));
    if (unexpected.length) throw new Error(`O documento local contém campos inesperados: ${unexpected.slice(0, 5).join(', ')}.`);
    if (!isRecord(value.settings) || !isRecord(value.cycle)) throw new Error('O documento local tem configurações ou ciclo inválidos.');
    if (!Number.isInteger(value.revision) || value.revision < 0) throw new Error('O documento local tem revisão inválida.');
    if (!validIso(value.createdAt) || !validIso(value.updatedAt)) throw new Error('O documento local tem datas de criação ou atualização inválidas.');
    Object.keys(STATE_LIMITS).forEach(field => {
      if (!Array.isArray(value[field])) throw new Error(`O documento local tem o campo ${field} em formato inválido.`);
    });
    assertStateLimits(value);
    assertCurrentCollectionIntegrity(value);
    return value;
  }

  function normalizeSideFeedback(raw) {
    const value = isRecord(raw) ? raw : {};
    const allowed = ['stiffness', 'pain', 'range_limit', 'support_difficulty'];
    const output = {};
    ['left', 'right'].forEach(side => {
      const source = isRecord(value[side]) ? value[side] : {};
      output[side] = Object.fromEntries(allowed.map(key => [key, source[key] === true]));
    });
    output.note = cleanText(value.note, 300);
    return output;
  }

  function normalizeExecutionFeedback(raw) {
    if (raw == null) return null;
    const value = isRecord(raw) ? raw : {};
    const output = Object.fromEntries(EXECUTION_FEEDBACK_FLAGS.map(key => [key, value[key] === true]));
    output.note = cleanText(value.note, 300);
    return output;
  }

  function normalizePostLegCheck(raw) {
    if (raw == null) return null;
    const value = isRecord(raw) ? raw : {};
    const output = Object.fromEntries(POST_LEG_CHECK_FLAGS.map(key => [key, value[key] === true]));
    const hasAdverseFlag = POST_LEG_CHECK_FLAGS.some(key => output[key]);
    output.noRelevantChange = value.noRelevantChange === true && !hasAdverseFlag;
    output.note = cleanText(value.note, 500);
    output.savedAt = validIso(value.savedAt);
    return output;
  }

  function orderedSides(settings) {
    const tracking = settings && isRecord(settings.sideTracking) ? settings.sideTracking : {};
    if (tracking.enabled !== false && ['right', 'left'].includes(tracking.affectedSide)) {
      return tracking.affectedSide === 'right' ? ['right', 'left'] : ['left', 'right'];
    }
    return ['right', 'left'];
  }

  function normalizePrescriptionSnapshot(raw) {
    const value = isRecord(raw) ? raw : {};
    const categories = ['upper_compound', 'squat_press', 'accessory', 'deadlift', 'mobility'];
    const min = Math.max(0, Math.min(1000, Number(value.min == null ? value.repMin : value.min) || 0));
    const max = Math.max(min, Math.min(1000, Number(value.max == null ? value.repMax : value.max) || 0));
    const rirMin = value.rirMin == null || value.rirMin === '' ? null : Math.max(0, Math.min(5, Number(value.rirMin) || 0));
    const rirMax = value.rirMax == null || value.rirMax === '' ? null : Math.max(rirMin == null ? 0 : rirMin, Math.min(5, Number(value.rirMax) || 0));
    return {
      category: categories.includes(value.category) ? value.category : 'accessory',
      sets: Math.max(0, Math.min(MAX_SERIES_PER_EXERCISE, Number(value.sets == null ? value.workSets : value.sets) || 0)),
      min,
      max,
      label: cleanText(value.label, 50) || (min && max ? `${min}–${max}` : ''),
      rirMin,
      rirMax,
      restSeconds: Math.max(0, Math.min(1800, Number(value.restSeconds == null ? value.restSec : value.restSeconds) || 0)),
      deload: value.deload === true
    };
  }

  function normalizeExerciseLog(raw, index, schemaVersion = SCHEMA_VERSION) {
    const value = isRecord(raw) ? raw : {};
    const exerciseId = cleanId(value.exerciseId, `unknown-${index + 1}`);
    const feeling = VALID_FEELINGS.has(value.feeling) ? value.feeling : '';
    const output = {
      id: cleanId(value.id, uid('exercise')),
      exerciseId,
      variationId: cleanId(value.variationId, ''),
      machineId: cleanText(value.machineId, 80),
      side: ['left', 'right', 'bilateral'].includes(value.side) ? value.side : 'bilateral',
      highRepPreference: value.highRepPreference === true,
      completed: value.completed === true,
      skipped: value.skipped === true,
      feeling,
      feedback: cleanText(value.feedback, 300),
      mobilityFeedback: normalizeSideFeedback(value.mobilityFeedback),
      prescriptionSnapshot: normalizePrescriptionSnapshot(value.prescriptionSnapshot),
      sets: Array.isArray(value.sets) ? value.sets.slice(0, MAX_SERIES_PER_EXERCISE).map(normalizeSet) : []
    };
    if (schemaVersion >= 13) {
      output.sideModeSnapshot = SIDE_MODES.has(value.sideModeSnapshot) ? value.sideModeSnapshot : (['left', 'right'].includes(output.side) ? 'unilateral' : 'bilateral');
      output.executionFeedback = normalizeExecutionFeedback(value.executionFeedback);
    }
    return output;
  }

  function normalizeSession(raw, index, schemaVersion = SCHEMA_VERSION) {
    const value = isRecord(raw) ? raw : {};
    const workoutId = schemaVersion >= 13 && isRecord(value.workoutSnapshot) && value.workoutSnapshot.id === value.workoutId
      ? cleanId(value.workoutId, '') : (Data.WORKOUT_BY_ID[value.workoutId] ? value.workoutId : '');
    const status = SESSION_STATUSES.has(value.status) ? value.status : 'planned';
    const plannedDate = validDate(value.plannedDate);
    if (!workoutId || !plannedDate) return null;
    const output = {
      id: cleanId(value.id, uid('session')),
      workoutId,
      plannedDate,
      actualDate: validDate(value.actualDate),
      week: Math.max(1, Math.min(8, Number(value.week) || 1)),
      status,
      startedAt: validIso(value.startedAt),
      pausedAt: validIso(value.pausedAt),
      pausedSeconds: Math.max(0, Math.min(10000000, Number(value.pausedSeconds) || 0)),
      completedAt: validIso(value.completedAt),
      durationSeconds: Math.max(0, Math.min(10000000, Number(value.durationSeconds) || 0)),
      rescheduledFrom: validDate(value.rescheduledFrom),
      note: cleanText(value.note, 500),
      cardioId: cleanId(value.cardioId, ''),
      exercises: Array.isArray(value.exercises) ? value.exercises.slice(0, 100).map((log, position) => normalizeExerciseLog(log, position, schemaVersion)) : [],
      createdAt: validIso(value.createdAt) || new Date().toISOString(),
      updatedAt: validIso(value.updatedAt) || new Date().toISOString()
    };
    if (schemaVersion >= 13) {
      output.workoutSnapshot = isRecord(value.workoutSnapshot) ? deepClone(value.workoutSnapshot) : null;
      output.postLegCheck = normalizePostLegCheck(value.postLegCheck);
    }
    return output;
  }

  function normalizeCardio(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const date = validDate(value.date);
    if (!date) return null;
    const statuses = new Set(['normal', 'shorter', 'interrupted', 'not_recovery', 'not_pain', 'not_unplanned']);
    return {
      id: cleanId(value.id, `cardio-${index + 1}`),
      date,
      startTime: /^\d{2}:\d{2}$/.test(String(value.startTime || '')) ? value.startTime : '',
      durationMinutes: Math.max(0, Math.min(1440, Number(value.durationMinutes) || 0)),
      distanceKm: numericString(value.distanceKm, {max: 500, decimals: 2}),
      pace: cleanText(value.pace, 30),
      effort: Math.max(0, Math.min(10, Number(value.effort) || 0)),
      status: statuses.has(value.status) ? value.status : 'normal',
      discomfort: cleanText(value.discomfort, 300),
      legDayFlags: {
        fatigue: value.legDayFlags && value.legDayFlags.fatigue === true,
        rightCalfPain: value.legDayFlags && value.legDayFlags.rightCalfPain === true,
        gaitChange: value.legDayFlags && value.legDayFlags.gaitChange === true,
        kneePain: value.legDayFlags && value.legDayFlags.kneePain === true,
        anklePain: value.legDayFlags && value.legDayFlags.anklePain === true,
        performanceDrop: value.legDayFlags && value.legDayFlags.performanceDrop === true
      },
      note: cleanText(value.note, 500),
      relatedSessionId: cleanId(value.relatedSessionId, ''),
      savedAt: validIso(value.savedAt) || new Date().toISOString()
    };
  }

  function normalizeHomeRoutine(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const date = validDate(value.date);
    if (!date) return null;
    return {
      id: cleanId(value.id, `home-${index + 1}`),
      date,
      time: /^\d{2}:\d{2}$/.test(String(value.time || '')) ? value.time : '',
      position: ['lying', 'all_fours', 'seated', 'standing'].includes(value.position) ? value.position : 'lying',
      durationSeconds: Math.max(1, Math.min(300, Number(value.durationSeconds) || 15)),
      repetitions: Math.max(1, Math.min(20, Number(value.repetitions) || 2)),
      ease: Math.max(0, Math.min(10, Number(value.ease) || 0)),
      note: cleanText(value.note, 500),
      savedAt: validIso(value.savedAt) || new Date().toISOString()
    };
  }

  const MEASUREMENT_FIELDS = Object.freeze([
    'weight', 'height', 'inseam', 'neck', 'shoulderWidth', 'chest', 'waist', 'abdomen', 'hip',
    'armLeft', 'armRight', 'forearmLeft', 'forearmRight', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight'
  ]);

  function normalizeMeasurement(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const date = validDate(value.date);
    if (!date) return null;
    const output = {id: cleanId(value.id, `measurement-${index + 1}`), date};
    MEASUREMENT_FIELDS.forEach(field => {
      const clean = numericString(value[field], {max: 500, decimals: 2});
      if (clean && Number(clean) > 0) output[field] = clean;
    });
    const oldArm = numericString(value.arm, {max: 500, decimals: 2});
    const oldThigh = numericString(value.thigh, {max: 500, decimals: 2});
    if (oldArm) {
      output.armLeft = output.armLeft || oldArm;
      output.armRight = output.armRight || oldArm;
    }
    if (oldThigh) {
      output.thighLeft = output.thighLeft || oldThigh;
      output.thighRight = output.thighRight || oldThigh;
    }
    if (!MEASUREMENT_FIELDS.some(field => output[field])) return null;
    const suppliedQuality = isRecord(value.quality) ? value.quality : {};
    const derivedFields = Array.isArray(suppliedQuality.derivedFields) ? suppliedQuality.derivedFields.filter(field => MEASUREMENT_FIELDS.includes(field)) : [];
    if (oldArm) derivedFields.push('armLeft', 'armRight');
    if (oldThigh) derivedFields.push('thighLeft', 'thighRight');
    output.quality = {
      derivedFields: [...new Set(derivedFields)],
      directFields: MEASUREMENT_FIELDS.filter(field => output[field] && !derivedFields.includes(field)),
      warnings: [...new Set((Array.isArray(suppliedQuality.warnings) ? suppliedQuality.warnings : []).map(item => cleanText(item, 120)).filter(Boolean)
        .concat(oldArm ? ['legacy_single_arm_copied_to_both_sides'] : [])
        .concat(oldThigh ? ['legacy_single_thigh_copied_to_both_sides'] : []))]
    };
    output.note = cleanText(value.note, 300);
    output.measuredAt = validIso(value.measuredAt);
    output.savedAt = validIso(value.savedAt);
    return output;
  }

  function normalizeProgressionDecision(raw, index, schemaVersion = SCHEMA_VERSION) {
    const value = isRecord(raw) ? raw : {};
    const output = {
      id: cleanId(value.id, `progression-${index + 1}`),
      sessionId: cleanId(value.sessionId, ''),
      exerciseId: cleanId(value.exerciseId, ''),
      seriesKey: cleanText(value.seriesKey, 300),
      date: validDate(value.date),
      recommendation: ['increase', 'maintain', 'review', 'none'].includes(value.recommendation) ? value.recommendation : 'none',
      message: cleanText(value.message, 500),
      load: numericString(value.load, {max: 5000, decimals: 2}),
      result: cleanText(value.result, 200),
      rir: cleanText(value.rir, 100),
      decision: ['pending', 'accepted', 'maintained', 'rejected'].includes(value.decision) ? value.decision : 'pending',
      nextLoad: numericString(value.nextLoad, {max: 5000, decimals: 2}),
      savedAt: validIso(value.savedAt) || new Date().toISOString()
    };
    if (schemaVersion >= 13) {
      output.side = ['left', 'right', 'bilateral'].includes(value.side) ? value.side : '';
      output.variationId = cleanId(value.variationId, '');
      output.machineId = cleanText(value.machineId, 80);
    }
    return output;
  }

  function normalizeLegacyCycle(raw, index) {
    const value = isRecord(raw) ? raw : {};
    return {
      id: cleanId(value.id, `legacy-${index + 1}`),
      sourceSchema: Math.max(1, Math.min(10, Number(value.sourceSchema) || 9)),
      label: cleanText(value.label, 120) || 'Ciclo legado',
      importedAt: validIso(value.importedAt) || new Date().toISOString(),
      sourceStartedAt: validIso(value.sourceStartedAt),
      sessionMeta: Array.isArray(value.sessionMeta) ? value.sessionMeta.slice(0, 1000).map((item, metaIndex) => {
        const meta = isRecord(item) ? item : {};
        return {
          id: cleanId(meta.id, `legacy-meta-${metaIndex + 1}`),
          week: Math.max(1, Math.min(8, Number(meta.week) || 1)),
          occurrence: [1, 2].includes(Number(meta.occurrence)) ? Number(meta.occurrence) : 1,
          legacyWorkoutId: ['a', 'b', 'c'].includes(meta.legacyWorkoutId) ? meta.legacyWorkoutId : '',
          startedAt: validIso(meta.startedAt),
          completedAt: validIso(meta.completedAt),
          manualCompleted: meta.manualCompleted === true
        };
      }) : [],
      records: Array.isArray(value.records) ? value.records.slice(0, 50000).map((record, recordIndex) => {
        const entry = isRecord(record) ? record : {};
        return {
          id: cleanId(entry.id, `legacy-record-${recordIndex + 1}`),
          week: Math.max(1, Math.min(8, Number(entry.week) || 1)),
          occurrence: [1, 2].includes(Number(entry.occurrence)) ? Number(entry.occurrence) : 1,
          legacyWorkoutId: ['a', 'b', 'c'].includes(entry.legacyWorkoutId) ? entry.legacyWorkoutId : '',
          legacyExerciseId: cleanId(entry.legacyExerciseId, 'unknown'),
          canonicalId: Data.CATALOG[entry.canonicalId] ? entry.canonicalId : '',
          legacy: entry.legacy !== false,
          variationId: cleanId(entry.variationId, ''),
          equipmentKey: cleanText(entry.equipmentKey, 200),
          mappingStatus: ['mapped', 'ambiguous', 'unmapped'].includes(entry.mappingStatus) ? entry.mappingStatus : (entry.canonicalId ? 'mapped' : 'unmapped'),
          done: entry.done === true,
          feeling: VALID_FEELINGS.has(entry.feeling) ? entry.feeling : '',
          feedback: cleanText(entry.feedback, 300),
          sets: Array.isArray(entry.sets) ? entry.sets.slice(0, MAX_SERIES_PER_EXERCISE).map((set, setIndex) => normalizeSet({type: 'work', load: set.load == null ? set.kg : set.load, reps: set.reps}, setIndex)) : []
        };
      }) : []
    };
  }

  function normalizeCycle(raw) {
    const value = isRecord(raw) ? raw : {};
    return {
      id: cleanId(value.id, uid('cycle')),
      startedAt: validIso(value.startedAt) || new Date().toISOString(),
      currentWeek: Math.max(1, Math.min(8, Number(value.currentWeek) || 1)),
      status: value.status === 'archived' ? 'archived' : 'active'
    };
  }

  function normalizeState(raw, schemaVersion = SCHEMA_VERSION) {
    const value = isRecord(raw) ? raw : {};
    assertStateLimits(value);
    const fallback = defaultState(value.createdAt);
    const sessions = Array.isArray(value.sessions) ? value.sessions.slice(0, MAX_SESSIONS).map((session, index) => normalizeSession(session, index, schemaVersion)).filter(Boolean) : [];
    const measurements = [];
    (Array.isArray(value.measurements) ? value.measurements : []).slice(0, 2000).forEach((item, index) => {
      const normalized = normalizeMeasurement(item, index);
      if (normalized) measurements.push(normalized);
    });
    return {
      schemaVersion,
      app: APP_ID,
      revision: Math.max(0, Number(value.revision) || 0),
      createdAt: validIso(value.createdAt) || fallback.createdAt,
      updatedAt: validIso(value.updatedAt) || fallback.updatedAt,
      settings: normalizeSettings(value.settings, schemaVersion, snapshotDefinitions(value)),
      cycle: normalizeCycle(value.cycle),
      sessions,
      cardio: (Array.isArray(value.cardio) ? value.cardio : []).slice(0, 5000).map(normalizeCardio).filter(Boolean),
      homeRoutines: (Array.isArray(value.homeRoutines) ? value.homeRoutines : []).slice(0, 5000).map(normalizeHomeRoutine).filter(Boolean),
      measurements: measurements.sort((a, b) => a.date.localeCompare(b.date) || String(a.measuredAt || a.savedAt || a.id).localeCompare(String(b.measuredAt || b.savedAt || b.id))),
      progressionDecisions: (Array.isArray(value.progressionDecisions) ? value.progressionDecisions : []).slice(0, 10000).map((decision, index) => normalizeProgressionDecision(decision, index, schemaVersion)),
      legacyCycles: (Array.isArray(value.legacyCycles) ? value.legacyCycles : []).slice(0, 100).map(normalizeLegacyCycle),
      archives: Array.isArray(value.archives) ? value.archives.slice(0, 100).map(item => ({
        id: cleanId(item && item.id, uid('archive')),
        archivedAt: validIso(item && item.archivedAt) || new Date().toISOString(),
        cycle: normalizeCycle(item && item.cycle),
        sessions: Array.isArray(item && item.sessions) ? item.sessions.slice(0, MAX_SESSIONS).map((session, index) => normalizeSession(session, index, schemaVersion)).filter(Boolean) : []
      })) : [],
      migrationLog: Array.isArray(value.migrationLog) ? value.migrationLog.slice(-200).map(item => ({
        at: validIso(item && item.at) || new Date().toISOString(),
        from: Math.max(0, Number(item && item.from) || 0),
        to: Math.max(0, Number(item && item.to) || SCHEMA_VERSION),
        summary: cleanText(item && item.summary, 500)
      })) : [],
      quarantine: Array.isArray(value.quarantine) ? value.quarantine.slice(-20).map(item => ({
        at: validIso(item && item.at) || new Date().toISOString(),
        reason: cleanText(item && item.reason, 500),
        raw: cleanMultiline(item && item.raw, 5000)
      })) : []
    };
  }

  function validateNewStateEnvelope(payload) {
    assertSafeParsed(payload);
    if (payload.app !== APP_ID) throw new Error('Este arquivo não pertence ao Treino Hard.');
    const declaredVersion = Number(payload.schemaVersion);
    if (declaredVersion > SCHEMA_VERSION) throw new Error('O backup foi criado por uma versão mais nova do aplicativo.');
    const source = isRecord(payload.state) ? payload.state : payload;
    const unexpected = Object.keys(source).filter(key => !TOP_LEVEL_STATE_FIELDS.has(key) && !['exportedAt', 'format'].includes(key));
    if (Number(payload.schemaVersion) >= 11 && unexpected.length) throw new Error(`Campos inesperados no backup: ${unexpected.slice(0, 5).join(', ')}.`);
    if (Number(payload.schemaVersion) >= 11) {
      if (source.app !== APP_ID || Number(source.schemaVersion) !== declaredVersion) {
        throw new Error('O estado interno do backup não corresponde ao aplicativo ou esquema declarado.');
      }
      if (!isRecord(source.settings) || !isRecord(source.cycle)) throw new Error('O backup tem configurações ou ciclo em formato inválido.');
      if (!Number.isInteger(source.revision) || source.revision < 0 || !validIso(source.createdAt) || !validIso(source.updatedAt)) throw new Error('O backup tem revisão ou datas inválidas.');
      Object.keys(STATE_LIMITS).forEach(field => {
        if (!Array.isArray(source[field])) throw new Error(`O backup tem o campo ${field} em formato inválido.`);
      });
      assertStateLimits(source);
      assertCurrentCollectionIntegrity(source);
    }
    return source;
  }

  function legacyWorkoutForId(exerciseId) {
    if (exerciseId.startsWith('a_')) return 'a';
    if (exerciseId.startsWith('b_')) return 'b';
    if (exerciseId.startsWith('c_')) return 'c';
    return '';
  }

  function migrateLegacyData(data, schemaVersion, sourceStartedAt, meta, sourceKey) {
    const records = [];
    const sessionMeta = [];
    const source = isRecord(data) ? data : {};
    const metaSource = isRecord(meta) ? meta : {};
    const originKey = cleanText(sourceKey || sourceStartedAt || 'current', 160) || 'current';
    for (let week = 1; week <= 8; week += 1) {
      const weekSource = isRecord(source[week]) ? source[week] : {};
      const hasOccurrences = isRecord(weekSource[1]) || isRecord(weekSource[2]);
      for (let occurrence = 1; occurrence <= 2; occurrence += 1) {
        const bucket = hasOccurrences ? weekSource[occurrence] : (occurrence === 1 ? weekSource : {});
        if (!isRecord(bucket)) continue;
        Object.keys(bucket).forEach(exerciseId => {
          if (FORBIDDEN_KEYS.has(exerciseId)) return;
          const entry = isRecord(bucket[exerciseId]) ? bucket[exerciseId] : {};
          const canonicalId = Data.LEGACY_ALIASES[exerciseId] || '';
          const variant = cleanId(entry.variant, '');
          const ambiguous = exerciseId === 'a_remada_smith' || exerciseId === 'a_remada_unilateral' || exerciseId === 'c_flexor_sentado';
          const locator = ['schema', schemaVersion || 9, 'origin', originKey, 'week', week, 'occurrence', occurrence, 'exercise', exerciseId];
          records.push({
            id: stableId('legacy-record', locator),
            week,
            occurrence,
            legacyWorkoutId: legacyWorkoutForId(exerciseId),
            legacyExerciseId: cleanId(exerciseId, 'unknown'),
            canonicalId: ambiguous ? '' : canonicalId,
            legacy: true,
            variationId: variant,
            equipmentKey: `legacy:${cleanId(exerciseId, 'unknown')}:${variant || 'unspecified'}`,
            mappingStatus: ambiguous ? 'ambiguous' : (canonicalId ? 'mapped' : 'unmapped'),
            done: entry.done === true,
            feeling: VALID_FEELINGS.has(entry.feeling) ? entry.feeling : '',
            feedback: cleanText(entry.feedback, 300),
            sets: Array.isArray(entry.sets) ? entry.sets.slice(0, MAX_SERIES_PER_EXERCISE).map((set, index) => normalizeSet({type: 'work', load: set && set.kg, reps: set && set.reps}, index)) : []
          });
        });
        const metaWeek = isRecord(metaSource[week]) ? metaSource[week] : {};
        const metaOccurrence = isRecord(metaWeek[occurrence]) ? metaWeek[occurrence] : {};
        ['a', 'b', 'c'].forEach(legacyWorkoutId => {
          const entry = isRecord(metaOccurrence[legacyWorkoutId]) ? metaOccurrence[legacyWorkoutId] : null;
          if (!entry) return;
          const startedAt = validIso(entry.startedAt);
          const completedAt = validIso(entry.completedAt);
          if (!startedAt && !completedAt && entry.manualCompleted !== true) return;
          sessionMeta.push({
            id: stableId('legacy-meta', [schemaVersion || 9, originKey, week, occurrence, legacyWorkoutId]),
            week,
            occurrence,
            legacyWorkoutId,
            startedAt,
            completedAt,
            manualCompleted: entry.manualCompleted === true
          });
        });
      }
    }
    return normalizeLegacyCycle({
      id: stableId('legacy-cycle', [schemaVersion || 9, originKey, sourceStartedAt || '', records.map(record => record.id).join('|')]),
      sourceSchema: schemaVersion || 9,
      label: 'Ciclo importado da versão ABC',
      importedAt: new Date().toISOString(),
      sourceStartedAt,
      sessionMeta,
      records
    }, 0);
  }

  function migrate9To10(payload) {
    const state = defaultState();
    const currentSourceKey = `current:${payload.cycleId || payload.cycleStartedAt || 'primary'}`;
    const legacy = migrateLegacyData(payload.data || payload, Number(payload.schemaVersion) || 9, payload.cycleStartedAt, payload.meta, currentSourceKey);
    if (legacy.records.length || legacy.sessionMeta.length) state.legacyCycles.push(legacy);
    (Array.isArray(payload.archives) ? payload.archives : []).forEach((archive, archiveIndex) => {
      if (!isRecord(archive)) return;
      const archiveSourceKey = `archive:${archive.id || archiveIndex}:${archive.startedAt || ''}`;
      const archivedLegacy = migrateLegacyData(archive.data, Number(payload.schemaVersion) || 9, archive.startedAt, archive.meta, archiveSourceKey);
      if (!archivedLegacy.records.length && !archivedLegacy.sessionMeta.length) return;
      archivedLegacy.id = stableId('legacy-archive', [archive.id || archiveIndex, archive.startedAt || '', archivedLegacy.records.map(record => record.id).join('|')]);
      archivedLegacy.label = `Ciclo legado arquivado ${archiveIndex + 1}`;
      state.legacyCycles.push(archivedLegacy);
    });
    state.measurements = (Array.isArray(payload.measurements) ? payload.measurements : []).map(normalizeMeasurement).filter(Boolean);
    state.settings = normalizeSettings(payload.settings, 10);
    state.migrationLog.push({at: new Date().toISOString(), from: Number(payload.schemaVersion) || 9, to: 10, summary: `${legacy.records.length} registros ABC preservados como ciclo legado.`});
    return Object.assign(state, {schemaVersion: 10});
  }

  function migrate10To11(state10) {
    const migrated = Object.assign({}, state10, {
      schemaVersion: 11,
      progressionDecisions: Array.isArray(state10.progressionDecisions) ? state10.progressionDecisions : [],
      quarantine: Array.isArray(state10.quarantine) ? state10.quarantine : [],
      migrationLog: (Array.isArray(state10.migrationLog) ? state10.migrationLog : []).concat({
        at: new Date().toISOString(),
        from: 10,
        to: 11,
        summary: 'Adicionados histórico de progressão, quarentena e chaves explícitas de equipamento.'
      })
    });
    return normalizeState(migrated, 11);
  }

  function migrate11To12(state11) {
    const migrated = Object.assign({}, state11, {
      schemaVersion: 12,
      settings: Object.assign({}, state11.settings, {equipmentLoadSteps: []}),
      migrationLog: (Array.isArray(state11.migrationLog) ? state11.migrationLog : []).concat({
        at: new Date().toISOString(),
        from: 11,
        to: 12,
        summary: 'Adicionados degraus de carga configuráveis por exercício, variação e aparelho.'
      })
    });
    return normalizeState(migrated, 12);
  }

  function legacyWorkout(workoutId) {
    if (!Array.isArray(LEGACY_WORKOUTS)) throw new Error('A ficha histórica necessária à migração não foi carregada. Nenhum dado foi alterado.');
    return LEGACY_WORKOUTS.find(workout => workout.id === workoutId) || null;
  }

  function workoutSnapshot(workout, logs, revision) {
    const snapshot = deepClone(workout);
    snapshot.revision = revision || Data.WORKOUT_REVISION;
    snapshot.exercises.forEach(exercise => {
      const recorded = logs.filter(log => log.exerciseId === exercise.id);
      exercise.sideModeSnapshot = recorded.some(log => ['left', 'right'].includes(log.side)) ? 'unilateral' : 'bilateral';
    });
    return snapshot;
  }

  function sessionWorkout(session) {
    return session && isRecord(session.workoutSnapshot) ? session.workoutSnapshot : null;
  }

  function sessionExercise(session, exerciseId) {
    const workout = sessionWorkout(session);
    return workout && workout.exercises.find(exercise => exercise.id === exerciseId) || null;
  }

  function migrate12To13(state12) {
    // Validate against the frozen v12 catalog before adding anything. In
    // particular, a standing curl recorded bilaterally stays ONE historical log.
    validateNewStateEnvelope(state12);
    const migrated = deepClone(state12);
    const sessions = migrated.sessions.concat(migrated.archives.flatMap(archive => archive.sessions));
    sessions.forEach(session => {
      session.workoutSnapshot = workoutSnapshot(legacyWorkout(session.workoutId), session.exercises, '3.5.1');
      session.postLegCheck = null;
      session.exercises.forEach(log => {
        log.sideModeSnapshot = ['left', 'right'].includes(log.side) ? 'unilateral' : 'bilateral';
        log.executionFeedback = null;
      });
    });
    migrated.progressionDecisions.forEach(decision => {
      const session = sessions.find(item => item.id === decision.sessionId);
      const candidates = session ? session.exercises.filter(log => log.exerciseId === decision.exerciseId
        && [log.prescriptionSnapshot && log.prescriptionSnapshot.label, log.prescriptionSnapshot && `${log.prescriptionSnapshot.min}-${log.prescriptionSnapshot.max}`]
          .some(range => comparableSeriesKey(log.exerciseId, log.variationId, log.machineId, log.side, range) === decision.seriesKey)) : [];
      const log = candidates.length === 1 ? candidates[0] : null;
      decision.side = log ? log.side : '';
      decision.variationId = log ? log.variationId : '';
      decision.machineId = log ? log.machineId : '';
    });
    migrated.schemaVersion = 13;
    migrated.settings.sideTracking = {enabled: true, affectedSide: 'right'};
    migrated.migrationLog.push({at: new Date().toISOString(), from: 12, to: 13, summary: 'Ficha e modo de execução preservados por sessão; acompanhamento e feedback independentes por lado adicionados sem dividir registros antigos.'});
    const normalized = normalizeState(migrated);
    assertCurrentStateStructure(normalized);
    return normalized;
  }

  function migratePayload(payload) {
    assertSafeParsed(payload);
    if (payload.app && payload.app !== APP_ID) throw new Error('Este arquivo não pertence ao Treino Hard.');
    const declared = Object.prototype.hasOwnProperty.call(payload, 'schemaVersion');
    const version = declared ? Number(payload.schemaVersion) : 1;
    if (!Number.isInteger(version) || version < 1) throw new Error('O documento declara um esquema inválido; nada foi migrado.');
    if (version > SCHEMA_VERSION) throw new Error('O backup foi criado por uma versão mais nova do aplicativo.');
    if (version < 10 && (Object.prototype.hasOwnProperty.call(payload, 'sessions') || Object.prototype.hasOwnProperty.call(payload, 'state'))) throw new Error('O formato de sessões não corresponde ao esquema declarado; nada foi migrado.');
    if (version === 13) return normalizeState(validateNewStateEnvelope(payload));
    if (version === 12) return migrate12To13(validateNewStateEnvelope(payload));
    if (version === 11) return migrate12To13(migrate11To12(validateNewStateEnvelope(payload)));
    if (version === 10 && (isRecord(payload.state) || Array.isArray(payload.sessions))) {
      return migrate12To13(migrate11To12(migrate10To11(isRecord(payload.state) ? payload.state : payload)));
    }
    return migrate12To13(migrate11To12(migrate10To11(migrate9To10(payload))));
  }

  function importPreview(payload) {
    const state = migratePayload(payload);
    const legacyRecords = state.legacyCycles.reduce((sum, cycle) => sum + cycle.records.length, 0);
    const recognizedLegacy = state.legacyCycles.reduce((sum, cycle) => sum + cycle.records.filter(record => record.canonicalId).length, 0);
    return {
      version: Math.max(1, Number(payload.schemaVersion) || 1),
      sessions: state.sessions.length,
      exercises: state.sessions.reduce((sum, session) => sum + session.exercises.length, 0),
      recognizedLegacy,
      legacyRecords,
      incompatible: legacyRecords - recognizedLegacy,
      measurements: state.measurements.length,
      cycles: state.legacyCycles.length + state.archives.length + 1,
      settings: Object.keys(state.settings).length,
      state
    };
  }

  // The selected variant determines cardinality for NEW execution. Historical
  // logs are never reconstructed through this helper during migration.
  function createExerciseLogs(exercise, week, options = {}) {
    const settings = normalizeSettings(options.settings);
    const variationId = options.variationId == null ? Data.preferredVariantFor(exercise, settings.sideTracking.enabled) : options.variationId;
    const mode = SIDE_MODES.has(options.sideMode) ? options.sideMode : Data.sideModeFor(exercise, variationId);
    if (exercise.type === 'strength' && mode === 'unilateral') {
      return orderedSides(settings).map(side => {
        const log = createExerciseLog(exercise, week, {variationId, sideMode: mode});
        log.side = side;
        return log;
      });
    }
    return [createExerciseLog(exercise, week, {variationId, sideMode: 'bilateral'})];
  }

  function createExerciseLog(exercise, week, options = {}) {
    if (exercise.type === 'mobility') {
      return normalizeExerciseLog({
        id: uid('exercise'),
        exerciseId: exercise.id,
        completed: false,
        mobilityFeedback: {},
        prescriptionSnapshot: {
          category: 'mobility', sets: exercise.sets, label: exercise.target, restSeconds: 0, deload: false
        }
      }, 0);
    }
    const prescription = Data.prescriptionFor(exercise, week, false);
    const sets = [];
    for (let index = 0; index < (exercise.warmupSets || 0); index += 1) {
      sets.push(normalizeSet({id: uid('set'), type: 'warmup', index, nextRestSeconds: 0}, index));
    }
    for (let index = 0; index < prescription.sets; index += 1) {
      sets.push(normalizeSet({id: uid('set'), type: 'work', index, nextRestSeconds: exercise.restSeconds}, index));
    }
    return normalizeExerciseLog({
      id: uid('exercise'),
      exerciseId: exercise.id,
      variationId: options.variationId == null ? (exercise.defaultVariant || '') : options.variationId,
      side: 'bilateral',
      prescriptionSnapshot: {
        category: exercise.category,
        sets: prescription.sets,
        min: prescription.min,
        max: prescription.max,
        label: prescription.label,
        rirMin: prescription.rirMin,
        rirMax: prescription.rirMax,
        restSeconds: exercise.restSeconds,
        deload: prescription.deload
      },
      sets,
      sideModeSnapshot: options.sideMode || Data.sideModeFor(exercise, options.variationId || exercise.defaultVariant)
    }, 0);
  }

  function createSession(workoutId, plannedDate, week, settings) {
    const workout = Data.WORKOUT_BY_ID[workoutId];
    const date = validDate(plannedDate);
    if (!workout || !date) throw new Error('Treino ou data inválidos.');
    const timestamp = new Date().toISOString();
    const logs = workout.exercises.flatMap(exercise => createExerciseLogs(exercise, week, {settings}));
    return normalizeSession({
      id: uid('session'),
      workoutId,
      plannedDate: date,
      week: Math.max(1, Math.min(8, Number(week) || 1)),
      status: 'planned',
      exercises: logs,
      workoutSnapshot: workoutSnapshot(workout, logs),
      createdAt: timestamp,
      updatedAt: timestamp
    }, 0);
  }

  function hasExerciseExecutionData(log) {
    if (!log) return false;
    const flags = log.executionFeedback;
    const mobility = log.mobilityFeedback;
    return Boolean(log.completed || log.skipped || log.feeling || log.feedback
      || (flags && (flags.note || EXECUTION_FEEDBACK_FLAGS.some(key => flags[key])))
      || (mobility && (mobility.note || ['left', 'right'].some(side => mobility[side] && Object.values(mobility[side]).some(Boolean))))
      || (Array.isArray(log.sets) && log.sets.some(set => set.load || set.reps || set.rir || set.status || set.note || set.completedAt)));
  }

  function changeExerciseVariant(session, logId, variantId, settings, options = {}) {
    const log = session.exercises.find(item => item.id === logId);
    const exercise = log && sessionExercise(session, log.exerciseId);
    if (!exercise || !Array.isArray(exercise.variants)) return {changed: false, blocked: true, message: 'Exercício não encontrado na ficha desta sessão.'};
    if (['completed', 'partial', 'cancelled', 'skipped', 'rescheduled'].includes(session.status)) return {changed: false, blocked: true, message: 'Reabra a sessão antes de alterar sua execução.'};
    const variant = exercise.variants.find(item => item.id === variantId);
    if (!variant) return {changed: false, blocked: true, message: 'Esta variação não pertence à ficha da sessão.'};
    if (log.variationId === variantId) return {changed: false};
    const mode = Data.sideModeFor(exercise, variantId);
    const group = session.exercises.filter(item => item.exerciseId === log.exerciseId);
    const structural = mode !== log.sideModeSnapshot;
    if (structural && group.some(hasExerciseExecutionData)) return {changed: false, blocked: true, message: 'Já existem registros neste exercício. Não é possível transformar um registro bilateral em dois lados, ou juntar os lados. Use a nova variação em outra sessão.'};
    // A same-mode change concerns only the selected log: distinct machines on
    // right/left remain valid, just as in historical unilateral row sessions.
    if (!structural) {
      if (hasExerciseExecutionData(log) && !options.confirmed) return {changed: false, requiresConfirmation: true, message: 'Há dados registrados. Confirme se pertencem à nova variação; cargas de variações diferentes não são equivalentes.'};
      log.variationId = variantId;
      return {changed: true};
    }
    const machines = new Set(group.map(item => item.machineId));
    const preferences = new Set(group.map(item => item.highRepPreference));
    if (mode === 'bilateral' && (machines.size > 1 || preferences.size > 1)) return {changed: false, blocked: true, message: 'Os lados têm configurações diferentes. Iguale o aparelho e a preferência de faixa antes de juntar registros vazios.'};
    const replacements = createExerciseLogs(exercise, session.week, {variationId: variantId, sideMode: mode, settings});
    replacements.forEach(replacement => {
      replacement.machineId = log.machineId;
      replacement.highRepPreference = log.highRepPreference;
      if (replacement.highRepPreference) replacement.prescriptionSnapshot = normalizePrescriptionSnapshot(Object.assign({}, replacement.prescriptionSnapshot, Data.prescriptionFor(exercise, session.week, true)));
    });
    const index = session.exercises.findIndex(item => item.exerciseId === log.exerciseId);
    session.exercises = session.exercises.filter(item => item.exerciseId !== log.exerciseId);
    session.exercises.splice(index, 0, ...replacements);
    exercise.sideModeSnapshot = mode;
    return {changed: true};
  }

  function replaceSessionPrescription(session, week, settings) {
    if (!sessionWorkout(session) || session.status !== 'planned' || session.exercises.some(hasExerciseExecutionData)) return false;
    const nextWeek = Math.max(1, Math.min(8, Number(week) || 1));
    session.exercises = session.exercises.map(previous => {
      const exercise = sessionExercise(session, previous.exerciseId);
      const next = createExerciseLog(exercise, nextWeek, {variationId: previous.variationId, sideMode: previous.sideModeSnapshot});
      next.id = previous.id;
      next.side = previous.side;
      next.machineId = previous.machineId;
      next.highRepPreference = previous.highRepPreference;
      if (exercise.type === 'strength' && next.highRepPreference) next.prescriptionSnapshot = normalizePrescriptionSnapshot(Object.assign({}, next.prescriptionSnapshot, Data.prescriptionFor(exercise, nextWeek, true)));
      return next;
    });
    session.week = nextWeek;
    return true;
  }

  // Sessões planejadas guardam um retrato da ficha para proteger o histórico.
  // Uma sessão ainda planejada não deve prender a semana futura a uma ficha
  // antiga. Durante a fase de testes autorizada pelo usuário, até campos já
  // preenchidos nesses planos são descartados ao mudar a revisão da ficha.
  // Sessões iniciadas ou terminais continuam protegidas.
  function refreshEmptyPlannedSession(session, settings) {
    const currentWorkout = session && Data.WORKOUT_BY_ID[session.workoutId];
    if (!currentWorkout || session.status !== 'planned') return false;
    const currentRevision = session.workoutSnapshot && session.workoutSnapshot.revision;
    if (currentRevision === Data.WORKOUT_REVISION) return false;
    const previousLogs = session.exercises.slice();
    const refreshed = createSession(session.workoutId, session.plannedDate, session.week, settings);
    refreshed.exercises = currentWorkout.exercises.flatMap(exercise => {
      const previous = previousLogs.filter(log => log.exerciseId === exercise.id);
      const previousVariation = previous[0] && previous[0].variationId;
      const variationId = Array.isArray(exercise.variants) && exercise.variants.some(variant => variant.id === previousVariation)
        ? previousVariation
        : undefined;
      const logs = createExerciseLogs(exercise, session.week, {settings, variationId});
      logs.forEach(log => {
        const old = previous.find(item => item.side === log.side) || previous[0];
        if (!old) return;
        log.id = old.id;
        log.machineId = old.machineId;
        log.highRepPreference = old.highRepPreference;
        if (log.highRepPreference && exercise.type === 'strength') {
          log.prescriptionSnapshot = normalizePrescriptionSnapshot(Object.assign({}, log.prescriptionSnapshot, Data.prescriptionFor(exercise, session.week, true)));
        }
      });
      return logs;
    });
    refreshed.workoutSnapshot = workoutSnapshot(currentWorkout, refreshed.exercises);
    Object.assign(session, refreshed, {
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  function createRescheduledSession(session, plannedDate, week, settings) {
    const date = validDate(plannedDate);
    if (!date || !sessionWorkout(session)) throw new Error('Data ou ficha da sessão inválida.');
    const copy = deepClone(session);
    const timestamp = new Date().toISOString();
    Object.assign(copy, {id: uid('session'), plannedDate: date, actualDate: '', status: 'planned', startedAt: '', pausedAt: '', pausedSeconds: 0, completedAt: '', durationSeconds: 0, rescheduledFrom: session.plannedDate, note: '', cardioId: '', postLegCheck: null, createdAt: timestamp, updatedAt: timestamp});
    copy.exercises = session.exercises.map(log => {
      const next = createExerciseLog(sessionExercise(session, log.exerciseId), week, {variationId: log.variationId, sideMode: log.sideModeSnapshot});
      Object.assign(next, {side: log.side, machineId: log.machineId, highRepPreference: log.highRepPreference});
      return next;
    });
    replaceSessionPrescription(copy, week, settings);
    return copy;
  }

  // Identidade da carga: mesmo exercício, mesma variação, mesma máquina, mesmo
  // lado. Deliberadamente SEM a faixa de repetições — a periodização troca a
  // faixa a cada duas semanas e isso não transforma o aparelho em outro. É esta
  // chave que responde "quanto eu levantei aqui da última vez".
  function loadHistoryKey(exerciseId, variationId, machineId, side) {
    return [
      cleanId(exerciseId, 'unknown'),
      cleanId(variationId, 'default') || 'default',
      cleanText(machineId, 80).toLocaleLowerCase('pt-BR') || 'machine-unspecified',
      ['left', 'right', 'bilateral'].includes(side) ? side : 'bilateral'
    ].join('|');
  }

  // Identidade da série comparável: a chave da carga MAIS a faixa prescrita.
  // Serve para agrupar decisões de progressão e séries históricas equivalentes,
  // onde a faixa faz parte do que está sendo comparado.
  function comparableSeriesKey(exerciseId, variationId, machineId, side, repRange) {
    return [
      loadHistoryKey(exerciseId, variationId, machineId, side),
      cleanText(repRange, 30) || 'range-unspecified'
    ].join('|');
  }

  function loadStepFor(exercise, configuredStep) {
    const override = Number(configuredStep);
    if (Number.isFinite(override) && override > 0 && override <= 1000) return Number(override.toFixed(2));
    const step = Number(exercise && exercise.loadStep);
    return Number.isFinite(step) && step > 0 ? step : 5;
  }

  function configuredLoadStep(settings, exercise, exerciseLog) {
    const entries = settings && Array.isArray(settings.equipmentLoadSteps) ? settings.equipmentLoadSteps : [];
    const key = equipmentLoadStepKey(
      exercise && exercise.id,
      exerciseLog && exerciseLog.variationId,
      exerciseLog && exerciseLog.machineId
    );
    const entry = entries.find(item => equipmentLoadStepKey(item.exerciseId, item.variationId, item.machineId) === key);
    return loadStepFor(exercise, entry && entry.step);
  }

  function muscleVolumeRows() {
    return Object.values(Data.MUSCLE_GROUPS).map(group => ({
      id: group.id,
      label: group.label,
      direct: 0,
      secondary: 0
    }));
  }

  function addMuscleSets(rows, exercise, count) {
    if (!exercise || !exercise.muscles || !Number.isFinite(count) || count <= 0) return;
    const byId = Object.fromEntries(rows.map(row => [row.id, row]));
    exercise.muscles.primary.forEach(id => { if (byId[id]) byId[id].direct += count; });
    exercise.muscles.secondary.forEach(id => { if (byId[id]) byId[id].secondary += count; });
  }

  function roundedSetCount(value) {
    return Number(Number(value || 0).toFixed(2));
  }

  function plannedMuscleVolume(week) {
    const rows = muscleVolumeRows();
    Data.WORKOUTS.forEach(workout => workout.exercises.forEach(exercise => {
      if (exercise.type !== 'strength') return;
      const prescription = Data.prescriptionFor(exercise, week, false);
      addMuscleSets(rows, exercise, Number(prescription.sets) || 0);
    }));
    return rows.map(row => Object.assign(row, {
      direct: roundedSetCount(row.direct),
      secondary: roundedSetCount(row.secondary)
    }));
  }

  function recordedMuscleVolume(sessions, week) {
    const rows = muscleVolumeRows();
    (Array.isArray(sessions) ? sessions : [])
      .filter(session => ['completed', 'partial'].includes(session && session.status)
        && (!week || Number(session.week) === Number(week)))
      .forEach(session => {
        const grouped = new Map();
        (Array.isArray(session.exercises) ? session.exercises : []).forEach(log => {
          if (!grouped.has(log.exerciseId)) grouped.set(log.exerciseId, []);
          grouped.get(log.exerciseId).push(log);
        });
        grouped.forEach((logs, exerciseId) => {
          const exercise = sessionExercise(session, exerciseId);
          if (!exercise || exercise.type !== 'strength') return;
          const counts = logs.map(log => (Array.isArray(log.sets) ? log.sets : [])
            .filter(set => set.type === 'work' && set.status === 'completed' && isSetConfirmed(set)).length);
          const equivalentSets = exercise.sideModeSnapshot === 'unilateral'
            ? counts.reduce((sum, count) => sum + count, 0) / Math.max(1, counts.length)
            : (counts[0] || 0);
          addMuscleSets(rows, exercise, equivalentSets);
        });
      });
    return rows.map(row => Object.assign(row, {
      direct: roundedSetCount(row.direct),
      secondary: roundedSetCount(row.secondary)
    }));
  }

  // Próximo degrau REAL acima da carga usada. Nunca devolve um valor
  // intermediário que o aparelho não tem: com degrau de 5 kg, 40 vira 45 e
  // 42 vira 45, jamais 42,5.
  function nextLoadSuggestion(load, step) {
    const current = Number(load);
    const rawIncrement = Number(step);
    const increment = Number.isFinite(rawIncrement) && rawIncrement > 0 ? rawIncrement : 5;
    if (!Number.isFinite(current) || current <= 0) return null;
    let candidate = Math.ceil(current / increment) * increment;
    const tolerance = Math.max(1, Math.abs(current), Math.abs(candidate)) * 1e-10;
    if (candidate <= current + tolerance) candidate += increment;
    const next = candidate;
    return Number(next.toFixed(2));
  }

  function formatLoad(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toLocaleString('pt-BR', {maximumFractionDigits: 2});
  }

  function rirNumber(value) {
    if (value == null || value === '') return null;
    if (value === '5+') return 5;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 5 ? number : null;
  }

  function doubleProgressionRecommendation(exercise, exerciseLog, week, configuredStep) {
    if (!exercise || exercise.type !== 'strength' || !exerciseLog) return {code: 'none', message: 'Sem recomendação disponível.'};
    const stored = normalizePrescriptionSnapshot(exerciseLog.prescriptionSnapshot);
    const prescription = stored.sets > 0 && stored.min > 0 && stored.max >= stored.min
      ? stored
      : Data.prescriptionFor(exercise, week, exerciseLog.highRepPreference);
    if (prescription.deload) return {code: 'none', message: 'Semana de deload: não sugerimos aumento de carga.'};
    if (['pain', 'awkward', 'replace'].includes(exerciseLog.feeling)
      || (exerciseLog.executionFeedback && EXECUTION_FEEDBACK_FLAGS.some(key => exerciseLog.executionFeedback[key]))) {
      return {code: 'review', message: 'Há relato de desconforto, dificuldade de execução ou pedido de substituição neste registro. Revise antes de considerar aumento.'};
    }
    const workSets = exerciseLog.sets.filter(set => set.type === 'work').slice(0, prescription.sets);
    if (workSets.length < prescription.sets) return {code: 'review', message: 'Faltam séries de trabalho para uma recomendação comparável.'};
    if (workSets.some(set => ['pain', 'bad_technique', 'excessive_load', 'interrupted'].includes(set.status))) {
      return {code: 'review', message: 'Houve dor, técnica inadequada, carga excessiva ou interrupção. Revise a execução antes de pensar em aumentar.'};
    }
    if (workSets.some(set => set.status !== 'completed' || !set.reps || !isSetConfirmed(set))) return {code: 'review', message: 'Conclua e confirme todas as séries de trabalho antes de avaliar a progressão.'};
    const reps = workSets.map(set => Number(set.reps));
    const rirs = workSets.map(set => rirNumber(set.rir));
    if (rirs.some(value => value == null)) return {code: 'review', message: 'RIR não informado. O resultado foi salvo, mas não é seguro sugerir aumento somente pelas repetições.'};
    const rirWithinTarget = rirs.every(value => value >= prescription.rirMin && value <= prescription.rirMax);
    if (reps.every(value => value >= prescription.max) && rirWithinTarget) {
      const step = loadStepFor(exercise, configuredStep);
      const loads = workSets.map(set => Number(set.load) || 0);
      const uniform = loads.every(value => value > 0 && value === loads[0]);
      const nextLoad = uniform ? nextLoadSuggestion(loads[0], step) : null;
      return {
        code: 'increase',
        step,
        baseLoad: uniform ? loads[0] : null,
        nextLoad,
        message: nextLoad
          ? `Topo da faixa atingido com ${formatLoad(loads[0])} kg. Considere testar ${formatLoad(nextLoad)} kg na próxima execução comparável — é o degrau de ${formatLoad(step)} kg presumido para este equipamento. A carga nunca é alterada automaticamente.`
          : `Topo da faixa atingido. As séries usaram cargas diferentes, então não há um número único a sugerir: suba um degrau de ${formatLoad(step)} kg em cada série na próxima execução comparável. A carga nunca é alterada automaticamente.`
      };
    }
    if (reps.every(value => value >= prescription.min) && reps.every(value => value <= prescription.max) && rirWithinTarget) {
      return {code: 'maintain', message: 'Resultado dentro da faixa e do RIR planejado. Mantenha a carga na próxima execução comparável.'};
    }
    if (reps.some(value => value < prescription.min)) {
      return {code: 'review', message: 'Houve série abaixo do limite inferior. Verifique carga, RIR, descanso, técnica e dor; o app não reduzirá a carga automaticamente.'};
    }
    return {code: 'maintain', message: 'Mantenha a carga e busque consolidar a faixa com a técnica planejada.'};
  }

  function workoutVolume(workout) {
    return workout.exercises.filter(exercise => exercise.type === 'strength').reduce((sum, exercise) => sum + exercise.workSets, 0);
  }

  function sessionProgressionRecommendation(exercise, log, session, settings, allSessions, cardio) {
    const base = doubleProgressionRecommendation(exercise, log, session.week, configuredLoadStep(settings, exercise, log));
    if (!exercise || exercise.type !== 'strength' || !session.workoutId.startsWith('legs_') || base.code === 'none') return base;
    const check = session.postLegCheck;
    const adverseCheck = check && POST_LEG_CHECK_FLAGS.some(key => check[key]);
    // Never use the other side's execution or unrelated dates as a proxy.
    // A session-level gait/pain report instead qualifies all leg suggestions
    // from that session; its attribution is shown explicitly in the UI.
    const relatedCardio = (Array.isArray(cardio) ? cardio : []).filter(item => item.relatedSessionId === session.id);
    const adverseCardio = relatedCardio.some(item => item.status === 'not_pain' || item.discomfort
      || (item.legDayFlags && ['rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop'].some(key => item.legDayFlags[key])));
    if (adverseCheck || adverseCardio) return {code: 'review', message: 'O relato após este treino de pernas ou a caminhada vinculada indicou desconforto ou mudança de controle. Revise a situação antes de considerar aumento; isso não é um diagnóstico.'};
    return base;
  }

  function csvCell(value) {
    let text = String(value == null ? '' : value).replace(/[\r\n\t]/g, ' ');
    if (/^[=+\-@]/.test(text) || /^[\uFF1D\uFF0B\uFF0D\uFF20]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildBackup(state) {
    assertCurrentStateStructure(state);
    const normalized = normalizeState(state);
    return {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      format: 'treino-hard-backup',
      exportedAt: new Date().toISOString(),
      state: normalized
    };
  }

  function touchState(state) {
    assertCurrentStateStructure(state);
    const normalized = normalizeState(state);
    normalized.revision += 1;
    normalized.updatedAt = new Date().toISOString();
    return normalized;
  }

  // ---------------------------------------------------------------------------
  // Backup criptografado por senha.
  //
  // Formato versionado, sempre com primitivas da Web Crypto API:
  //   PBKDF2-HMAC-SHA-256 → chave AES-GCM de 256 bits, salt e IV aleatórios.
  // O cabeçalho entra como dado autenticado adicional, de modo que alterar
  // salt, IV, número de iterações ou versão invalida a autenticação.
  // A senha nunca é gravada, registrada nem incluída no arquivo.
  // ---------------------------------------------------------------------------

  const ENCRYPTED_FORMAT = 'treino-hard-encrypted-backup';
  const ENCRYPTED_FORMAT_VERSION = 1;
  // OWASP recomenda 600 mil iterações para PBKDF2-HMAC-SHA-256. No ambiente
  // de referência (Chrome/Node em 09/08/2026), esta derivação levou em média
  // 107 ms; o custo permanece aceitável para uma exportação/importação manual.
  // A leitura continua aceitando envelopes v1 legítimos com fatores anteriores.
  const PBKDF2_ITERATIONS = 600000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const MIN_PASSWORD_LENGTH = 8;
  const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function bytesToBase64(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let output = '';
    for (let index = 0; index < input.length; index += 3) {
      const first = input[index];
      const second = input[index + 1];
      const third = input[index + 2];
      output += BASE64_ALPHABET[first >> 2];
      output += BASE64_ALPHABET[((first & 3) << 4) | ((second === undefined ? 0 : second) >> 4)];
      output += second === undefined ? '=' : BASE64_ALPHABET[((second & 15) << 2) | ((third === undefined ? 0 : third) >> 6)];
      output += third === undefined ? '=' : BASE64_ALPHABET[third & 63];
    }
    return output;
  }

  function base64ToBytes(text) {
    const clean = String(text == null ? '' : text).replace(/\s+/g, '');
    if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('Conteúdo codificado inválido.');
    const size = (clean.length / 4) * 3 - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
    const output = new Uint8Array(size);
    let cursor = 0;
    for (let index = 0; index < clean.length; index += 4) {
      let value = 0;
      for (let offset = 0; offset < 4; offset += 1) {
        const character = clean[index + offset];
        value = (value << 6) | (character === '=' ? 0 : BASE64_ALPHABET.indexOf(character));
      }
      const triple = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
      for (const byte of triple) {
        if (cursor < size) output[cursor] = byte;
        cursor += 1;
      }
    }
    return output;
  }

  function subtleCrypto() {
    const cryptoObject = global.crypto;
    if (!cryptoObject || !cryptoObject.subtle || typeof cryptoObject.getRandomValues !== 'function') {
      throw new Error('Este navegador não oferece a Web Crypto API necessária para o backup criptografado. Use o backup JSON comum.');
    }
    return cryptoObject;
  }

  function encryptedHeader(salt, iv, iterations) {
    return {
      app: APP_ID,
      format: ENCRYPTED_FORMAT,
      formatVersion: ENCRYPTED_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt)},
      cipher: {name: 'AES-GCM', length: 256, tagBits: 128, iv: bytesToBase64(iv)}
    };
  }

  // Representação canônica e estável do cabeçalho, usada como AAD.
  function headerAad(header) {
    return new TextEncoder().encode([
      header.app, header.format, header.formatVersion, header.schemaVersion,
      header.kdf.name, header.kdf.hash, header.kdf.iterations, header.kdf.salt,
      header.cipher.name, header.cipher.length, header.cipher.tagBits, header.cipher.iv
    ].join('|'));
  }

  async function deriveBackupKey(cryptoObject, password, salt, iterations) {
    const material = await cryptoObject.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return cryptoObject.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations, hash: 'SHA-256'},
      material,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    );
  }

  function assertPassword(password) {
    const text = typeof password === 'string' ? password : '';
    if (text.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    return text;
  }

  function isEncryptedBackup(value) {
    return isRecord(value) && value.format === ENCRYPTED_FORMAT && isRecord(value.kdf) && isRecord(value.cipher) && typeof value.ciphertext === 'string';
  }

  async function encryptBackup(state, password) {
    const secret = assertPassword(password);
    const cryptoObject = subtleCrypto();
    const salt = cryptoObject.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = cryptoObject.getRandomValues(new Uint8Array(IV_BYTES));
    const header = encryptedHeader(salt, iv, PBKDF2_ITERATIONS);
    const key = await deriveBackupKey(cryptoObject, secret, salt, PBKDF2_ITERATIONS);
    const plaintext = new TextEncoder().encode(JSON.stringify(buildBackup(state)));
    const ciphertext = await cryptoObject.subtle.encrypt(
      {name: 'AES-GCM', iv, tagLength: 128, additionalData: headerAad(header)},
      key,
      plaintext
    );
    return Object.assign({}, header, {createdAt: new Date().toISOString(), ciphertext: bytesToBase64(new Uint8Array(ciphertext))});
  }

  async function decryptBackup(document, password) {
    if (!isRecord(document) || !isRecord(document.kdf) || !isRecord(document.cipher) || typeof document.ciphertext !== 'string') {
      throw new Error('Este arquivo não é um backup criptografado do Treino Hard.');
    }
    if (document.app !== APP_ID) throw new Error('Este arquivo não pertence ao Treino Hard.');
    if (document.format !== ENCRYPTED_FORMAT) throw new Error('O formato do backup criptografado não é reconhecido por esta versão.');
    if (!Number.isInteger(document.formatVersion) || document.formatVersion !== ENCRYPTED_FORMAT_VERSION) {
      throw new Error('A versão do formato criptografado não é suportada por este aplicativo.');
    }
    if (!Number.isInteger(document.schemaVersion) || document.schemaVersion < 11 || document.schemaVersion > SCHEMA_VERSION) {
      throw new Error('O esquema externo do backup criptografado não é suportado por este aplicativo.');
    }
    if (document.kdf.name !== 'PBKDF2' || document.kdf.hash !== 'SHA-256') throw new Error('Derivação de chave não suportada.');
    if (document.cipher.name !== 'AES-GCM') throw new Error('Cifra não suportada.');
    if (!Number.isInteger(document.cipher.length) || document.cipher.length !== 256) throw new Error('Comprimento de chave da cifra não suportado.');
    if (!Number.isInteger(document.cipher.tagBits) || document.cipher.tagBits !== 128) throw new Error('Tamanho da tag de autenticação não suportado.');
    const secret = typeof password === 'string' ? password : '';
    if (!secret) throw new Error('Informe a senha do backup.');
    const iterations = document.kdf.iterations;
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 5000000) throw new Error('Número de iterações fora do intervalo aceito.');
    if (typeof document.kdf.salt !== 'string') throw new Error('Salt do backup com codificação inválida.');
    if (typeof document.cipher.iv !== 'string') throw new Error('Vetor de inicialização do backup com codificação inválida.');
    const cryptoObject = subtleCrypto();
    const salt = base64ToBytes(document.kdf.salt);
    const iv = base64ToBytes(document.cipher.iv);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw new Error('Salt ou vetor de inicialização com tamanho inválido.');
    const key = await deriveBackupKey(cryptoObject, secret, salt, iterations);
    let plaintext;
    try {
      plaintext = await cryptoObject.subtle.decrypt(
        // Os campos acima foram validados estritamente. Usar o próprio cabeçalho
        // recebido garante que qualquer alteração nos metadados aceitos também
        // invalide a autenticação, sem mudar o AAD dos backups v1 já emitidos.
        {name: 'AES-GCM', iv, tagLength: document.cipher.tagBits, additionalData: headerAad(document)},
        key,
        base64ToBytes(document.ciphertext)
      );
    } catch (error) {
      throw new Error('Senha incorreta ou arquivo adulterado. Nada foi alterado.');
    }
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch (error) {
      throw new Error('O conteúdo interno do backup criptografado não é JSON válido.');
    }
    assertSafeParsed(parsed);
    if (parsed.app !== document.app || parsed.schemaVersion !== document.schemaVersion) throw new Error('O conteúdo interno não corresponde ao esquema autenticado do backup.');
    return parsed;
  }

  global.THFCore = Object.freeze({
    APP_ID,
    APP_VERSION,
    SCHEMA_VERSION,
    MAX_IMPORT_BYTES,
    MAX_SESSIONS,
    MAX_SERIES_PER_EXERCISE,
    MAX_EQUIPMENT_LOAD_STEPS,
    STATE_LIMITS,
    SESSION_STATUSES,
    SET_STATUSES,
    VALID_RIR,
    EXECUTION_FEEDBACK_FLAGS,
    POST_LEG_CHECK_FLAGS,
    MEASUREMENT_FIELDS,
    isRecord,
    hasForbiddenKey,
    assertSafeParsed,
    cleanText,
    cleanMultiline,
    cleanId,
    validIso,
    validDate,
    localDateKey,
    numericString,
    integerString,
    uid,
    stableId,
    deepClone,
    normalizeSettings,
    normalizeEquipmentLoadSteps,
    defaultState,
    normalizeSet,
    isSetConfirmed,
    assertStateLimits,
    assertCurrentStateStructure,
    normalizeExerciseLog,
    normalizeExecutionFeedback,
    normalizePostLegCheck,
    orderedSides,
    normalizePrescriptionSnapshot,
    normalizeSession,
    normalizeCardio,
    normalizeHomeRoutine,
    normalizeMeasurement,
    normalizeState,
    validateNewStateEnvelope,
    migrateLegacyData,
    migrate9To10,
    migrate10To11,
    migrate11To12,
    migrate12To13,
    migratePayload,
    importPreview,
    createExerciseLog,
    createExerciseLogs,
    createSession,
    sessionWorkout,
    sessionExercise,
    hasExerciseExecutionData,
    changeExerciseVariant,
    replaceSessionPrescription,
    refreshEmptyPlannedSession,
    createRescheduledSession,
    comparableSeriesKey,
    loadHistoryKey,
    equipmentLoadStepKey,
    loadStepFor,
    configuredLoadStep,
    nextLoadSuggestion,
    formatLoad,
    rirNumber,
    doubleProgressionRecommendation,
    sessionProgressionRecommendation,
    plannedMuscleVolume,
    recordedMuscleVolume,
    workoutVolume,
    csvCell,
    buildBackup,
    touchState,
    ENCRYPTED_FORMAT,
    ENCRYPTED_FORMAT_VERSION,
    PBKDF2_ITERATIONS,
    MIN_PASSWORD_LENGTH,
    bytesToBase64,
    base64ToBytes,
    isEncryptedBackup,
    encryptBackup,
    decryptBackup
  });
})(globalThis);
