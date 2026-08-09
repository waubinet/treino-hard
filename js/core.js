(function initCore(global) {
  'use strict';

  const Data = global.THFData;
  const APP_ID = 'treino-hard-fofo';
  // Versão do aplicativo: muda a cada publicação funcional.
  // O esquema persistido só muda quando o formato gravado realmente muda.
  const APP_VERSION = '3.2.0';
  const SCHEMA_VERSION = 11;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const MAX_SESSIONS = 5000;
  const MAX_SERIES_PER_EXERCISE = 64;
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

  function normalizeSettings(raw) {
    const value = isRecord(raw) ? raw : {};
    const vacuumFrequency = Math.max(1, Math.min(7, Number(value.vacuumFrequency) || 3));
    const vacuumRepetitions = Math.max(1, Math.min(10, Number(value.vacuumRepetitions) || 2));
    const vacuumDuration = Math.max(5, Math.min(120, Number(value.vacuumDuration) || 15));
    return {
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

  function assertCurrentStateStructure(raw) {
    const value = assertSafeParsed(raw);
    if (value.app !== APP_ID) throw new Error('Este documento não pertence ao Treino Hard.');
    if (Number(value.schemaVersion) !== SCHEMA_VERSION) throw new Error('O documento local não está no esquema atual e precisa ser migrado.');
    if (!isRecord(value.settings) || !isRecord(value.cycle)) throw new Error('O documento local tem configurações ou ciclo inválidos.');
    Object.keys(STATE_LIMITS).forEach(field => {
      if (!Array.isArray(value[field])) throw new Error(`O documento local tem o campo ${field} em formato inválido.`);
    });
    assertStateLimits(value);
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

  function normalizeExerciseLog(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const exerciseId = cleanId(value.exerciseId, `unknown-${index + 1}`);
    const feeling = VALID_FEELINGS.has(value.feeling) ? value.feeling : '';
    return {
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
  }

  function normalizeSession(raw, index) {
    const value = isRecord(raw) ? raw : {};
    const workoutId = Data.WORKOUT_BY_ID[value.workoutId] ? value.workoutId : '';
    const status = SESSION_STATUSES.has(value.status) ? value.status : 'planned';
    const plannedDate = validDate(value.plannedDate);
    if (!workoutId || !plannedDate) return null;
    return {
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
      exercises: Array.isArray(value.exercises) ? value.exercises.slice(0, 100).map(normalizeExerciseLog) : [],
      createdAt: validIso(value.createdAt) || new Date().toISOString(),
      updatedAt: validIso(value.updatedAt) || new Date().toISOString()
    };
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

  function normalizeProgressionDecision(raw, index) {
    const value = isRecord(raw) ? raw : {};
    return {
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

  function normalizeState(raw) {
    const value = isRecord(raw) ? raw : {};
    assertStateLimits(value);
    const fallback = defaultState(value.createdAt);
    const sessions = Array.isArray(value.sessions) ? value.sessions.slice(0, MAX_SESSIONS).map(normalizeSession).filter(Boolean) : [];
    const measurements = [];
    (Array.isArray(value.measurements) ? value.measurements : []).slice(0, 2000).forEach((item, index) => {
      const normalized = normalizeMeasurement(item, index);
      if (normalized) measurements.push(normalized);
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      app: APP_ID,
      revision: Math.max(0, Number(value.revision) || 0),
      createdAt: validIso(value.createdAt) || fallback.createdAt,
      updatedAt: validIso(value.updatedAt) || fallback.updatedAt,
      settings: normalizeSettings(value.settings),
      cycle: normalizeCycle(value.cycle),
      sessions,
      cardio: (Array.isArray(value.cardio) ? value.cardio : []).slice(0, 5000).map(normalizeCardio).filter(Boolean),
      homeRoutines: (Array.isArray(value.homeRoutines) ? value.homeRoutines : []).slice(0, 5000).map(normalizeHomeRoutine).filter(Boolean),
      measurements: measurements.sort((a, b) => a.date.localeCompare(b.date) || String(a.measuredAt || a.savedAt || a.id).localeCompare(String(b.measuredAt || b.savedAt || b.id))),
      progressionDecisions: (Array.isArray(value.progressionDecisions) ? value.progressionDecisions : []).slice(0, 10000).map(normalizeProgressionDecision),
      legacyCycles: (Array.isArray(value.legacyCycles) ? value.legacyCycles : []).slice(0, 100).map(normalizeLegacyCycle),
      archives: Array.isArray(value.archives) ? value.archives.slice(0, 100).map(item => ({
        id: cleanId(item && item.id, uid('archive')),
        archivedAt: validIso(item && item.archivedAt) || new Date().toISOString(),
        cycle: normalizeCycle(item && item.cycle),
        sessions: Array.isArray(item && item.sessions) ? item.sessions.slice(0, MAX_SESSIONS).map(normalizeSession).filter(Boolean) : []
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
    if (Number(payload.schemaVersion) > SCHEMA_VERSION) throw new Error('O backup foi criado por uma versão mais nova do aplicativo.');
    const source = isRecord(payload.state) ? payload.state : payload;
    const unexpected = Object.keys(source).filter(key => !TOP_LEVEL_STATE_FIELDS.has(key) && !['exportedAt', 'format'].includes(key));
    if (Number(payload.schemaVersion) >= 11 && unexpected.length) throw new Error(`Campos inesperados no backup: ${unexpected.slice(0, 5).join(', ')}.`);
    if (Number(payload.schemaVersion) >= 11) {
      if (!isRecord(source.settings) || !isRecord(source.cycle)) throw new Error('O backup tem configurações ou ciclo em formato inválido.');
      Object.keys(STATE_LIMITS).forEach(field => {
        if (!Array.isArray(source[field])) throw new Error(`O backup tem o campo ${field} em formato inválido.`);
      });
      assertStateLimits(source);
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
    state.settings = normalizeSettings(payload.settings);
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
    return normalizeState(migrated);
  }

  function migratePayload(payload) {
    assertSafeParsed(payload);
    if (payload.app && payload.app !== APP_ID) throw new Error('Este arquivo não pertence ao Treino Hard.');
    const version = Math.max(1, Number(payload.schemaVersion) || 1);
    if (version > SCHEMA_VERSION) throw new Error('O backup foi criado por uma versão mais nova do aplicativo.');
    if (version >= 11) return normalizeState(validateNewStateEnvelope(payload));
    if (version === 10 && (isRecord(payload.state) || Array.isArray(payload.sessions))) return migrate10To11(isRecord(payload.state) ? payload.state : payload);
    return migrate10To11(migrate9To10(payload));
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

  // Exercícios unilaterais viram dois registros — esquerdo e direito — usando o
  // campo `side` que o esquema 11 já possui. O volume da ficha continua contando
  // o exercício uma única vez.
  function createExerciseLogs(exercise, week) {
    if (exercise.type === 'strength' && exercise.unilateral) {
      return ['left', 'right'].map(side => {
        const log = createExerciseLog(exercise, week);
        log.side = side;
        return log;
      });
    }
    return [createExerciseLog(exercise, week)];
  }

  function createExerciseLog(exercise, week) {
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
      variationId: exercise.defaultVariant || '',
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
      sets
    }, 0);
  }

  function createSession(workoutId, plannedDate, week) {
    const workout = Data.WORKOUT_BY_ID[workoutId];
    const date = validDate(plannedDate);
    if (!workout || !date) throw new Error('Treino ou data inválidos.');
    const timestamp = new Date().toISOString();
    return normalizeSession({
      id: uid('session'),
      workoutId,
      plannedDate: date,
      week: Math.max(1, Math.min(8, Number(week) || 1)),
      status: 'planned',
      exercises: workout.exercises.flatMap(exercise => createExerciseLogs(exercise, week)),
      createdAt: timestamp,
      updatedAt: timestamp
    }, 0);
  }

  function comparableSeriesKey(exerciseId, variationId, machineId, side, repRange) {
    return [
      cleanId(exerciseId, 'unknown'),
      cleanId(variationId, 'default') || 'default',
      cleanText(machineId, 80).toLocaleLowerCase('pt-BR') || 'machine-unspecified',
      ['left', 'right', 'bilateral'].includes(side) ? side : 'bilateral',
      cleanText(repRange, 30) || 'range-unspecified'
    ].join('|');
  }

  function rirNumber(value) {
    if (value == null || value === '') return null;
    if (value === '5+') return 5;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 5 ? number : null;
  }

  function doubleProgressionRecommendation(exercise, exerciseLog, week) {
    if (!exercise || exercise.type !== 'strength' || !exerciseLog) return {code: 'none', message: 'Sem recomendação disponível.'};
    const stored = normalizePrescriptionSnapshot(exerciseLog.prescriptionSnapshot);
    const prescription = stored.sets > 0 && stored.min > 0 && stored.max >= stored.min
      ? stored
      : Data.prescriptionFor(exercise, week, exerciseLog.highRepPreference);
    if (prescription.deload) return {code: 'none', message: 'Semana de deload: não sugerimos aumento de carga.'};
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
      return {code: 'increase', message: 'Topo da faixa atingido. Considere o menor aumento disponível na próxima execução comparável.'};
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

  function csvCell(value) {
    let text = String(value == null ? '' : value).replace(/[\r\n\t]/g, ' ');
    if (/^[=+\-@]/.test(text) || /^[\uFF1D\uFF0B\uFF0D\uFF20]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildBackup(state) {
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
    if (!Number.isInteger(document.schemaVersion) || document.schemaVersion !== SCHEMA_VERSION) {
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
    return assertSafeParsed(parsed);
  }

  global.THFCore = Object.freeze({
    APP_ID,
    APP_VERSION,
    SCHEMA_VERSION,
    MAX_IMPORT_BYTES,
    MAX_SESSIONS,
    MAX_SERIES_PER_EXERCISE,
    STATE_LIMITS,
    SESSION_STATUSES,
    SET_STATUSES,
    VALID_RIR,
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
    defaultState,
    normalizeSet,
    isSetConfirmed,
    assertStateLimits,
    assertCurrentStateStructure,
    normalizeExerciseLog,
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
    migratePayload,
    importPreview,
    createExerciseLog,
    createExerciseLogs,
    createSession,
    comparableSeriesKey,
    rirNumber,
    doubleProgressionRecommendation,
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
