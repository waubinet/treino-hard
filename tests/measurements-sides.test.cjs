const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function bootMeasurements() {
  const context = vm.createContext({});
  const file = path.resolve(__dirname, '../js/measurements.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
  return context.THFMeasurements;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('circunferências mostram valores absolutos e diferença descritiva de 5,7%', () => {
  const measurements = bootMeasurements();
  const history = measurements.bilateralMeasurementHistory([{id: 'thigh-1', date: '2026-09-01', thighRight: '58', thighLeft: '61.5'}], 'thigh');
  const point = history.points[0];
  assert.equal(point.right, 58);
  assert.equal(point.left, 61.5);
  assert.equal(point.difference, 3.5);
  assert.equal(point.relativeDifference.toFixed(1), '5.7');
  assert.equal(point.hasDirectPair, true);
  assert.equal(history.right.delta, null);
  assert.equal(history.left.delta, null);
  assert.equal(history.pairedCount, 1);
  assert.equal('severity' in history, false);
  assert.equal('diagnosis' in history, false);
});

test('evolução ordena cronologicamente e calcula variação independente dos lados', () => {
  const measurements = bootMeasurements();
  const source = [
    {id: 'last', date: '2026-09-04', calfRight: '39.5', calfLeft: '41'},
    {id: 'first', date: '2026-09-01', calfRight: '38', calfLeft: '42'},
    {id: 'middle', date: '2026-09-02', calfRight: '39'}
  ];
  const saved = JSON.stringify(source);
  const history = measurements.bilateralMeasurementHistory(source, 'calf');
  assert.deepEqual(plain(history.points.map(point => point.id)), ['first', 'middle', 'last']);
  assert.equal(history.right.first.value, 38);
  assert.equal(history.right.latest.value, 39.5);
  assert.equal(history.right.delta, 1.5);
  assert.equal(history.left.first.value, 42);
  assert.equal(history.left.latest.value, 41);
  assert.equal(history.left.delta, -1);
  assert.equal(history.right.recordCount, 3);
  assert.equal(history.left.recordCount, 2);
  assert.equal(history.points[1].left, null);
  assert.equal(history.points[1].difference, null);
  assert.equal(history.points[1].relativeDifference, null);
  assert.equal(history.firstPair.id, 'first');
  assert.equal(history.latestPair.id, 'last');
  assert.equal(JSON.stringify(source), saved);
});

test('não combina valores de datas diferentes para inventar diferença entre lados', () => {
  const measurements = bootMeasurements();
  const history = measurements.bilateralMeasurementHistory([
    {id: 'right', date: '2026-09-01', armRight: '40'},
    {id: 'left', date: '2026-09-02', armLeft: '41'}
  ], 'arm');
  assert.equal(history.right.latest.value, 40);
  assert.equal(history.left.latest.value, 41);
  assert.equal(history.pairedCount, 0);
  assert.equal(history.latestPair, null);
  assert.equal(history.firstPair, null);
  assert.equal(history.points.every(point => point.difference === null), true);
});

test('cópias legadas não geram igualdade ou progresso fictício entre os lados', () => {
  const measurements = bootMeasurements();
  const history = measurements.bilateralMeasurementHistory([
    {id: 'legacy', date: '2026-08-01', thighRight: '60', thighLeft: '60', quality: {derivedFields: ['thighRight', 'thighLeft']}},
    {id: 'direct', date: '2026-09-01', thighRight: '58', thighLeft: '61.5', quality: {derivedFields: []}}
  ], 'thigh');
  assert.equal(history.points[0].right, 60);
  assert.equal(history.points[0].left, 60);
  assert.equal(history.points[0].rightDerived, true);
  assert.equal(history.points[0].leftDerived, true);
  assert.equal(history.points[0].difference, null);
  assert.equal(history.right.first.id, 'direct');
  assert.equal(history.left.first.id, 'direct');
  assert.equal(history.right.delta, null);
  assert.equal(history.right.recordCount, 1);
  assert.equal(history.right.derivedCount, 1);
  assert.equal(history.pairedCount, 1);
});

test('uma medida derivada não invalida o histórico direto do outro lado', () => {
  const measurements = bootMeasurements();
  const history = measurements.bilateralMeasurementHistory([
    {id: 'first', date: '2026-09-01', forearmRight: '29.5', forearmLeft: '30', quality: {derivedFields: ['forearmLeft']}},
    {id: 'second', date: '2026-09-02', forearmRight: '30', forearmLeft: '30.5'}
  ], 'forearm');
  assert.equal(history.right.delta, 0.5);
  assert.equal(history.left.delta, null);
  assert.equal(history.points[0].difference, null);
  assert.equal(history.pairedCount, 1);
});

test('mesmo dia mantém medições separadas em ordem de horário e desempate estável', () => {
  const measurements = bootMeasurements();
  const history = measurements.bilateralMeasurementHistory([
    {id: 'late', date: '2026-09-01', measuredAt: '2026-09-01T15:00:00.000Z', armRight: '40'},
    {id: 'early', date: '2026-09-01', measuredAt: '2026-09-01T08:00:00.000Z', armRight: '39'},
    {id: 'same-time-b', date: '2026-09-01', savedAt: '2026-09-01T08:00:00.000Z', armRight: '39.5'}
  ], 'arm');
  assert.deepEqual(plain(history.points.map(point => point.id)), ['early', 'same-time-b', 'late']);
  assert.equal(history.right.delta, 1);
});

test('valores ausentes ou inválidos não são convertidos em zero ou copiados', () => {
  const measurements = bootMeasurements();
  const invalidValues = ['', ' ', 0, -1, false, true, null, undefined, NaN, Infinity, 'Infinity', '40cm', '1e2', '501'];
  const records = invalidValues.map((value, index) => ({id: `invalid-${index}`, date: '2026-09-01', calfRight: value, calfLeft: '40'}));
  const history = measurements.bilateralMeasurementHistory(records, 'calf');
  assert.equal(history.points.length, invalidValues.length);
  assert.equal(history.points.every(point => point.right === null && point.left === 40 && point.difference === null), true);
  assert.equal(history.right.first, null);
  assert.equal(history.right.latest, null);
  assert.equal(history.right.recordCount, 0);
  assert.equal(history.pairedCount, 0);
});

test('aceita decimal brasileiro e mantém a diferença relativa simétrica', () => {
  const measurements = bootMeasurements();
  const records = [{id: 'point', date: '2026-09-01', thighRight: '58,0', thighLeft: '61,5'}];
  const original = measurements.bilateralMeasurementHistory(records, 'thigh').points[0];
  const swapped = measurements.bilateralMeasurementHistory([{...records[0], thighRight: '61,5', thighLeft: '58,0'}], 'thigh').points[0];
  assert.equal(original.difference, swapped.difference);
  assert.equal(original.relativeDifference, swapped.relativeDifference);
  const equal = measurements.bilateralMeasurementHistory([{date: '2026-09-01', armRight: 40, armLeft: 40}], 'arm').points[0];
  assert.equal(equal.difference, 0);
  assert.equal(equal.relativeDifference, 0);
});

test('histórico vazio, data impossível e par desconhecido têm saída explícita', () => {
  const measurements = bootMeasurements();
  assert.equal(measurements.bilateralMeasurementHistory([], 'waist'), null);
  assert.equal(measurements.bilateralMeasurementHistory([], '__proto__'), null);
  const history = measurements.bilateralMeasurementHistory([
    null,
    {date: '2026-02-30', armRight: 40},
    {date: 'data inválida', armRight: 40},
    {date: '2026-09-01', weight: 100}
  ], 'arm');
  assert.equal(history.points.length, 0);
  assert.equal(history.pairedCount, 0);
  assert.equal(history.right.delta, null);
  assert.equal(history.left.delta, null);
  assert.equal(measurements.bilateralMeasurementHistory(null, 'calf').points.length, 0);
});

test('metadados de pares mantêm chaves semânticas de direita e esquerda', () => {
  const measurements = bootMeasurements();
  assert.deepEqual(plain(Object.keys(measurements.BILATERAL_PAIRS)), ['arm', 'forearm', 'thigh', 'calf']);
  Object.values(measurements.BILATERAL_PAIRS).forEach(pair => {
    assert.equal(pair.rightKey.endsWith('Right'), true);
    assert.equal(pair.leftKey.endsWith('Left'), true);
    assert.equal(measurements.METRICS[pair.rightKey].unit, 'cm');
    assert.equal(measurements.METRICS[pair.leftKey].unit, 'cm');
    assert.equal(Object.isFrozen(pair), true);
  });
});
