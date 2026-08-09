(function initMeasurements(global) {
  'use strict';

  const METRICS = Object.freeze({
    weight: {label: 'Peso', short: 'Peso', unit: 'kg', group: 'base', example: '110,5'},
    height: {label: 'Altura', short: 'Altura', unit: 'cm', group: 'base', example: '175'},
    inseam: {label: 'Altura do entrepernas', short: 'Entrepernas', unit: 'cm', group: 'base', example: '82'},
    neck: {label: 'Circunferência do pescoço', short: 'Pescoço', unit: 'cm', group: 'torso', example: '42'},
    shoulderWidth: {label: 'Largura dos ombros', short: 'Ombros', unit: 'cm', group: 'torso', example: '46'},
    chest: {label: 'Peitoral', short: 'Peitoral', unit: 'cm', group: 'torso', example: '110'},
    waist: {label: 'Cintura', short: 'Cintura', unit: 'cm', group: 'torso', example: '100'},
    abdomen: {label: 'Abdômen no umbigo', short: 'Abdômen', unit: 'cm', group: 'torso', example: '108'},
    hip: {label: 'Quadril', short: 'Quadril', unit: 'cm', group: 'torso', example: '112'},
    armLeft: {label: 'Braço esquerdo', short: 'Braço E', unit: 'cm', group: 'limbs', example: '40'},
    armRight: {label: 'Braço direito', short: 'Braço D', unit: 'cm', group: 'limbs', example: '40'},
    forearmLeft: {label: 'Antebraço esquerdo', short: 'Antebraço E', unit: 'cm', group: 'limbs', example: '32'},
    forearmRight: {label: 'Antebraço direito', short: 'Antebraço D', unit: 'cm', group: 'limbs', example: '32'},
    thighLeft: {label: 'Coxa esquerda', short: 'Coxa E', unit: 'cm', group: 'limbs', example: '62'},
    thighRight: {label: 'Coxa direita', short: 'Coxa D', unit: 'cm', group: 'limbs', example: '62'},
    calfLeft: {label: 'Panturrilha esquerda', short: 'Panturrilha E', unit: 'cm', group: 'limbs', example: '40'},
    calfRight: {label: 'Panturrilha direita', short: 'Panturrilha D', unit: 'cm', group: 'limbs', example: '40'}
  });

  const MODEL_KEYS = Object.freeze(Object.keys(METRICS).filter(key => key !== 'weight'));

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ellipseBreadth(circumference, depthRatio) {
    const value = Number(circumference);
    if (!value) return 0;
    const ratio = clamp(Number(depthRatio) || 0.75, 0.55, 1);
    const a = 0.5;
    const b = ratio * 0.5;
    const unitPerimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    return value / unitPerimeter;
  }

  function bodyGeometry(item) {
    const measured = key => Number(item && item[key]) || 0;
    const height = measured('height');
    const stature = height || 175;
    const top = 16;
    const sole = 624;
    const visualHeight = sole - top;
    const pxPerCm = visualHeight / stature;
    const torsoValues = ['chest', 'waist', 'abdomen', 'hip'].map(measured).filter(Boolean);
    const neutralCirc = torsoValues.length ? torsoValues.reduce((sum, value) => sum + value, 0) / torsoValues.length : stature * 0.59;
    const breadth = (key, ratio, min, max) => clamp(ellipseBreadth(measured(key) || neutralCirc, ratio) * pxPerCm, min, max);
    const limb = (key, fallback, ratio, min, max) => {
      const circumference = measured(key) || measured(fallback) || stature * ratio;
      return clamp((circumference / Math.PI) * pxPerCm, min, max);
    };
    const chest = breadth('chest', 0.72, 84, 158);
    const waist = breadth('waist', 0.76, 72, 154);
    const abdomen = breadth('abdomen', 0.82, 74, 164);
    const hip = breadth('hip', 0.78, 86, 166);
    const shoulder = clamp(measured('shoulderWidth') ? measured('shoulderWidth') * pxPerCm : Math.max(chest * 1.12, stature * 0.235 * pxPerCm), 104, 174);
    const neck = clamp(measured('neck') ? ellipseBreadth(measured('neck'), 0.84) * pxPerCm : shoulder * 0.34, 34, 62);
    const inseamCm = clamp(measured('inseam') || stature * 0.47, stature * 0.4, stature * 0.55);
    const crotch = sole - inseamCm * pxPerCm;
    const headH = clamp(stature * 0.13 * pxPerCm, 70, 84);
    const headW = clamp(stature * 0.083 * pxPerCm, 46, 58);
    const neckTop = top + headH * 0.82;
    const neckBase = top + headH + 14;
    const torsoSpan = Math.max(190, crotch - neckBase);
    const shoulderY = neckBase + torsoSpan * 0.08;
    const chestY = neckBase + torsoSpan * 0.3;
    const waistY = neckBase + torsoSpan * 0.59;
    const abdomenY = neckBase + torsoSpan * 0.73;
    const hipY = neckBase + torsoSpan * 0.88;
    const armEnd = Math.min(crotch + visualHeight * 0.095, shoulderY + visualHeight * 0.44);
    const elbowY = shoulderY + (armEnd - shoulderY) * 0.46;
    const wristY = shoulderY + (armEnd - shoulderY) * 0.82;
    const kneeY = crotch + (sole - crotch) * 0.49;
    const ankleY = sole - 27;
    return {
      height,
      stature,
      scaleMode: height ? 'height' : 'relative',
      pxPerCm,
      top,
      sole,
      crotch,
      neckTop,
      neckBase,
      shoulderY,
      chestY,
      waistY,
      abdomenY,
      hipY,
      elbowY,
      wristY,
      armEnd,
      kneeY,
      ankleY,
      headH,
      headW,
      neck,
      shoulder,
      chest,
      waist,
      abdomen,
      hip,
      armLeft: limb('armLeft', 'armRight', 0.22, 20, 50),
      armRight: limb('armRight', 'armLeft', 0.22, 20, 50),
      forearmLeft: limb('forearmLeft', 'forearmRight', 0.17, 16, 40),
      forearmRight: limb('forearmRight', 'forearmLeft', 0.17, 16, 40),
      thighLeft: limb('thighLeft', 'thighRight', 0.34, 30, 70),
      thighRight: limb('thighRight', 'thighLeft', 0.34, 30, 70),
      calfLeft: limb('calfLeft', 'calfRight', 0.22, 20, 50),
      calfRight: limb('calfRight', 'calfLeft', 0.22, 20, 50),
      directCount: MODEL_KEYS.filter(key => measured(key)).length
    };
  }

  function silhouettePaths(item) {
    const g = bodyGeometry(item);
    const cx = 200;
    const chest = g.chest / 2;
    const waist = g.waist / 2;
    const abdomen = g.abdomen / 2;
    const hip = g.hip / 2;
    const shoulder = g.shoulder / 2;
    const neck = g.neck / 2;
    const point = (side, offset) => cx + side * offset;
    const head = `M ${cx} ${g.top} C ${cx - g.headW * 0.48} ${g.top} ${cx - g.headW * 0.56} ${g.top + g.headH * 0.35} ${cx - g.headW * 0.46} ${g.top + g.headH * 0.62} C ${cx - g.headW * 0.36} ${g.top + g.headH * 0.9} ${cx - g.headW * 0.18} ${g.top + g.headH} ${cx} ${g.top + g.headH} C ${cx + g.headW * 0.18} ${g.top + g.headH} ${cx + g.headW * 0.36} ${g.top + g.headH * 0.9} ${cx + g.headW * 0.46} ${g.top + g.headH * 0.62} C ${cx + g.headW * 0.56} ${g.top + g.headH * 0.35} ${cx + g.headW * 0.48} ${g.top} ${cx} ${g.top} Z`;
    const neckPath = `M ${cx - neck * 0.78} ${g.top + g.headH * 0.78} Q ${cx - neck} ${g.neckTop} ${cx - neck} ${g.neckBase} L ${cx + neck} ${g.neckBase} Q ${cx + neck} ${g.neckTop} ${cx + neck * 0.78} ${g.top + g.headH * 0.78} Z`;
    const torso = `M ${cx - neck} ${g.neckBase} C ${cx - shoulder * 0.48} ${g.shoulderY - 13} ${cx - shoulder} ${g.shoulderY - 3} ${cx - shoulder} ${g.shoulderY + 7} C ${cx - chest} ${g.chestY - 24} ${cx - chest} ${g.chestY + 4} ${cx - waist} ${g.waistY} C ${cx - waist} ${g.waistY + 17} ${cx - abdomen} ${g.abdomenY - 15} ${cx - abdomen} ${g.abdomenY} C ${cx - abdomen} ${g.abdomenY + 18} ${cx - hip} ${g.hipY - 10} ${cx - hip} ${g.hipY + 4} Q ${cx - hip * 0.88} ${g.crotch - 17} ${cx - g.thighLeft * 0.24} ${g.crotch} Q ${cx} ${g.crotch + 15} ${cx + g.thighRight * 0.24} ${g.crotch} Q ${cx + hip * 0.88} ${g.crotch - 17} ${cx + hip} ${g.hipY + 4} C ${cx + hip} ${g.hipY - 10} ${cx + abdomen} ${g.abdomenY + 18} ${cx + abdomen} ${g.abdomenY} C ${cx + abdomen} ${g.abdomenY - 15} ${cx + waist} ${g.waistY + 17} ${cx + waist} ${g.waistY} C ${cx + chest} ${g.chestY + 4} ${cx + chest} ${g.chestY - 24} ${cx + shoulder} ${g.shoulderY + 7} C ${cx + shoulder} ${g.shoulderY - 3} ${cx + shoulder * 0.48} ${g.shoulderY - 13} ${cx + neck} ${g.neckBase} Z`;
    const arm = (side, upperWidth, forearmWidth) => {
      const shoulderOffset = shoulder * 0.93;
      const elbowOffset = shoulder + 13;
      const wristOffset = shoulder + 21;
      const handOffset = shoulder + 20;
      const elbowWidth = Math.max(forearmWidth * 0.82, upperWidth * 0.58);
      const wristWidth = forearmWidth * 0.52;
      const handWidth = Math.max(wristWidth * 1.28, 10);
      return `M ${point(side, shoulderOffset + upperWidth * 0.48)} ${g.shoulderY + 2} C ${point(side, shoulderOffset + upperWidth * 0.55)} ${g.shoulderY + 36} ${point(side, elbowOffset + elbowWidth * 0.52)} ${g.elbowY - 18} ${point(side, elbowOffset + elbowWidth * 0.5)} ${g.elbowY} C ${point(side, wristOffset + forearmWidth * 0.52)} ${g.elbowY + 25} ${point(side, wristOffset + wristWidth * 0.5)} ${g.wristY - 10} ${point(side, wristOffset + wristWidth * 0.5)} ${g.wristY} C ${point(side, handOffset + handWidth * 0.55)} ${g.wristY + 15} ${point(side, handOffset + handWidth * 0.45)} ${g.armEnd - 8} ${point(side, handOffset)} ${g.armEnd} C ${point(side, handOffset - handWidth * 0.45)} ${g.armEnd - 8} ${point(side, handOffset - handWidth * 0.58)} ${g.wristY + 22} ${point(side, wristOffset - wristWidth * 0.5)} ${g.wristY} C ${point(side, wristOffset - forearmWidth * 0.48)} ${g.wristY - 12} ${point(side, elbowOffset - elbowWidth * 0.48)} ${g.elbowY + 22} ${point(side, elbowOffset - elbowWidth * 0.5)} ${g.elbowY} C ${point(side, shoulderOffset - upperWidth * 0.46)} ${g.elbowY - 18} ${point(side, shoulderOffset - upperWidth * 0.5)} ${g.shoulderY + 38} ${point(side, shoulderOffset - upperWidth * 0.42)} ${g.shoulderY + 2} Z`;
    };
    const leg = (side, thighWidth, calfWidth) => {
      const hipOffset = hip * 0.48;
      const kneeOffset = hip * 0.34;
      const ankleOffset = hip * 0.3;
      const kneeWidth = Math.max(calfWidth * 0.72, thighWidth * 0.52);
      const ankleWidth = calfWidth * 0.43;
      return `M ${point(side, hipOffset + thighWidth * 0.5)} ${g.hipY + 5} C ${point(side, hipOffset + thighWidth * 0.52)} ${g.crotch + 28} ${point(side, kneeOffset + kneeWidth * 0.55)} ${g.kneeY - 24} ${point(side, kneeOffset + kneeWidth * 0.5)} ${g.kneeY} C ${point(side, kneeOffset + calfWidth * 0.54)} ${g.kneeY + 22} ${point(side, ankleOffset + ankleWidth * 0.55)} ${g.ankleY - 22} ${point(side, ankleOffset + ankleWidth * 0.5)} ${g.ankleY} L ${point(side, ankleOffset - ankleWidth * 0.5)} ${g.ankleY} C ${point(side, ankleOffset - ankleWidth * 0.55)} ${g.ankleY - 22} ${point(side, kneeOffset - calfWidth * 0.48)} ${g.kneeY + 22} ${point(side, kneeOffset - kneeWidth * 0.5)} ${g.kneeY} C ${point(side, kneeOffset - kneeWidth * 0.5)} ${g.kneeY - 24} ${point(side, hipOffset - thighWidth * 0.47)} ${g.crotch + 28} ${point(side, hipOffset - thighWidth * 0.45)} ${g.hipY + 5} Z`;
    };
    const foot = side => {
      const ankleOffset = hip * 0.3;
      const ankleWidth = (side < 0 ? g.calfLeft : g.calfRight) * 0.43;
      const toeOffset = ankleOffset + 18;
      return `M ${point(side, ankleOffset + ankleWidth * 0.48)} ${g.ankleY - 2} C ${point(side, ankleOffset + ankleWidth * 0.55)} ${g.ankleY + 10} ${point(side, toeOffset + 12)} ${g.sole - 14} ${point(side, toeOffset + 12)} ${g.sole - 8} Q ${point(side, toeOffset + 8)} ${g.sole + 2} ${point(side, toeOffset - 7)} ${g.sole} Q ${point(side, ankleOffset - ankleWidth * 0.5)} ${g.sole - 3} ${point(side, ankleOffset - ankleWidth * 0.5)} ${g.sole - 10} L ${point(side, ankleOffset - ankleWidth * 0.5)} ${g.ankleY - 2} Z`;
    };
    return {
      geometry: g,
      mass: [head, neckPath, torso],
      limbs: [arm(-1, g.armLeft, g.forearmLeft), arm(1, g.armRight, g.forearmRight), leg(-1, g.thighLeft, g.calfLeft), leg(1, g.thighRight, g.calfRight), foot(-1), foot(1)]
    };
  }

  function svgElement(name, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function appendShape(group, paths, className) {
    paths.forEach(pathData => group.appendChild(svgElement('path', {d: pathData, class: className})));
  }

  function createSilhouetteSvg(current, previous) {
    const svg = svgElement('svg', {viewBox: '0 0 400 640', role: 'img', 'aria-label': `Silhueta comparativa aproximada de ${current.date || 'medição atual'}`});
    svg.classList.add('body-map-svg');
    svg.appendChild(svgElement('line', {x1: 200, y1: 10, x2: 200, y2: 628, class: 'body-center-line'}));
    const render = (item, className) => {
      if (!item) return;
      const paths = silhouettePaths(item);
      const group = svgElement('g', {class: className});
      appendShape(group, paths.mass, 'body-mass');
      appendShape(group, paths.limbs, 'body-limb');
      svg.appendChild(group);
    };
    if (previous) render(previous, 'body-previous');
    render(current, 'body-current');
    return svg;
  }

  global.THFMeasurements = Object.freeze({
    METRICS,
    MODEL_KEYS,
    clamp,
    ellipseBreadth,
    bodyGeometry,
    silhouettePaths,
    createSilhouetteSvg
  });
})(globalThis);
