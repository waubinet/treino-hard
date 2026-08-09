(function initWorkoutCatalog(global) {
  'use strict';

  const DAY_WORKOUT = Object.freeze({
    1: 'push_a',
    2: 'pull_a',
    3: 'legs_a',
    4: 'push_b',
    5: 'pull_b',
    6: 'legs_b'
  });

  const WEEK_LABELS = Object.freeze({1: 'S1', 2: 'S2', 3: 'S3', 4: 'S4', 5: 'S5', 6: 'S6', 7: 'S7', 8: 'DL'});

  const MOBILITY_SEQUENCE = Object.freeze([
    {
      id: 'mob_adductor_butterfly',
      name: 'Alongamento de adutores em borboleta',
      type: 'mobility',
      sets: 2,
      target: '20–30 segundos',
      effort: '6–7/10',
      videoKey: 'mob_adductor_butterfly',
      sideFeedback: true
    },
    {
      id: 'mob_hip_butterfly',
      name: 'Mobilidade de quadril em borboleta',
      type: 'mobility',
      sets: 2,
      target: '15 repetições',
      videoKey: 'mob_hip_butterfly',
      sideFeedback: true
    },
    {
      id: 'mob_hamstring_seated',
      name: 'Alongamento de posterior da coxa sentado',
      type: 'mobility',
      sets: 2,
      target: '20–30 segundos',
      effort: '6–7/10',
      videoKey: 'mob_hamstring_seated',
      sideFeedback: true
    },
    {
      id: 'mob_ankle',
      name: 'Mobilidade de tornozelo',
      type: 'mobility',
      sets: 2,
      target: '10 repetições',
      videoKey: 'mob_ankle',
      sideFeedback: true,
      prompts: ['Panturrilha direita', 'Tornozelo direito']
    }
  ]);

  const BRACING_TEXT = 'Antes da repetição, organize a respiração e contraia a parede abdominal em todas as direções para estabilizar o tronco. Mantenha a contração durante a parte mais exigente do movimento e reorganize a respiração quando necessário.';

  function strength(id, name, category, sets, options) {
    const config = options || {};
    return Object.freeze({
      id,
      name,
      type: 'strength',
      category,
      workSets: sets,
      restSeconds: config.restSeconds || (category === 'accessory' ? 90 : 120),
      warmupSets: config.warmupSets || 0,
      warmupOptional: Boolean(config.warmupOptional),
      detail: config.detail || '',
      notes: Object.freeze(config.notes || []),
      variants: Object.freeze(config.variants || []),
      defaultVariant: config.defaultVariant || '',
      videoKey: config.videoKey || id,
      bracing: Boolean(config.bracing),
      allowHighReps: Boolean(config.allowHighReps),
      // Exercício executado lado a lado: a ficha prescreve as séries POR LADO,
      // mas contabiliza o volume uma única vez.
      unilateral: Boolean(config.unilateral)
    });
  }

  const CATALOG = Object.freeze({
    chest_press_machine: strength('chest_press_machine', 'Supino reto na máquina', 'upper_compound', 3, {
      restSeconds: 120,
      warmupSets: 3,
      warmupOptional: true,
      bracing: true,
      detail: 'Máquina horizontal ou convergente',
      notes: ['Escolhido pela praticidade e pelo controle ao treinar sozinho. Isso não significa que máquinas sejam universalmente menos lesivas.']
    }),
    incline_press_machine: strength('incline_press_machine', 'Supino inclinado na máquina', 'upper_compound', 3, {
      restSeconds: 120,
      bracing: true,
      detail: 'Máquina inclinada, seletorizada ou articulada',
      notes: ['Mantenha este exercício separado do supino reto; as cargas não são equivalentes.']
    }),
    cable_crossover: strength('cable_crossover', 'Crossover na polia', 'accessory', 2, {
      restSeconds: 90,
      detail: 'Polias ajustadas à trajetória escolhida'
    }),
    machine_fly: strength('machine_fly', 'Crucifixo no aparelho', 'accessory', 2, {
      restSeconds: 90,
      detail: 'Peck deck ou aparelho equivalente'
    }),
    shoulder_press_machine: strength('shoulder_press_machine', 'Desenvolvimento na máquina', 'upper_compound', 2, {
      restSeconds: 120,
      bracing: true
    }),
    lateral_raise_dumbbell: strength('lateral_raise_dumbbell', 'Elevação lateral com halteres', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true
    }),
    triceps_skull_dumbbell: strength('triceps_skull_dumbbell', 'Tríceps testa com halteres', 'accessory', 2, {
      restSeconds: 90
    }),
    triceps_overhead: strength('triceps_overhead', 'Tríceps testa ou extensão acima da cabeça', 'accessory', 2, {
      restSeconds: 90,
      detail: 'Escolha registrada por execução; as cargas das duas opções não são comparadas entre si.',
      variants: [
        {id: 'overhead', label: 'Extensão acima da cabeça', videoKey: 'triceps_overhead'},
        {id: 'skull_crusher', label: 'Tríceps testa com halteres', videoKey: 'triceps_skull_dumbbell'}
      ],
      defaultVariant: 'overhead'
    }),
    triceps_rope: strength('triceps_rope', 'Tríceps na polia com corda', 'accessory', 2, {
      restSeconds: 90
    }),
    pulldown_supinated: strength('pulldown_supinated', 'Puxada frontal com pegada supinada', 'upper_compound', 3, {
      restSeconds: 120,
      warmupSets: 2,
      warmupOptional: true
    }),
    pulldown_neutral: strength('pulldown_neutral', 'Puxada frontal com pegada neutra', 'upper_compound', 3, {
      restSeconds: 120
    }),
    seated_row_triangle: strength('seated_row_triangle', 'Remada sentada com triângulo', 'upper_compound', 3, {
      restSeconds: 120,
      bracing: true,
      variants: [
        {id: 'cable_triangle', label: 'Cabo com triângulo'},
        {id: 'machine_supported', label: 'Máquina com apoio'}
      ],
      defaultVariant: 'cable_triangle'
    }),
    unilateral_row_machine: strength('unilateral_row_machine', 'Remada unilateral na máquina', 'upper_compound', 2, {
      restSeconds: 120,
      unilateral: true,
      detail: 'Duas séries por lado; o volume planejado da ficha conta o exercício uma vez.',
      variants: [
        {id: 'machine_left_right', label: 'Máquina — lados separados'},
        {id: 'plate_loaded', label: 'Articulada com anilhas'}
      ],
      defaultVariant: 'machine_left_right'
    }),
    row_machine_choice: strength('row_machine_choice', 'Remada sentada ou articulada', 'upper_compound', 3, {
      restSeconds: 120,
      bracing: true,
      variants: [
        {id: 'seated_cable_triangle', label: 'Sentada no cabo'},
        {id: 'articulated_supported', label: 'Articulada com apoio torácico'},
        {id: 'articulated_unsupported', label: 'Articulada sem apoio torácico'}
      ],
      defaultVariant: 'seated_cable_triangle'
    }),
    reverse_fly_machine: strength('reverse_fly_machine', 'Crucifixo invertido no aparelho', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true
    }),
    ez_bar_curl: strength('ez_bar_curl', 'Rosca direta com barra W', 'accessory', 2, {
      restSeconds: 90
    }),
    hammer_curl_standing: strength('hammer_curl_standing', 'Rosca martelo em pé', 'accessory', 2, {
      restSeconds: 90
    }),
    squat: strength('squat', 'Agachamento', 'squat_press', 3, {
      restSeconds: 150,
      warmupSets: 3,
      warmupOptional: true,
      bracing: true,
      variants: [
        {id: 'free_barbell', label: 'Livre com barra', videoKey: 'squat_free_barbell'},
        {id: 'smith', label: 'Smith', videoKey: 'squat_smith'}
      ],
      defaultVariant: 'smith'
    }),
    leg_press_45: strength('leg_press_45', 'Leg press 45°', 'squat_press', 3, {
      restSeconds: 150,
      warmupSets: 1,
      warmupOptional: true,
      bracing: true,
      variants: [{id: 'machine_unspecified', label: 'Máquina atual'}],
      defaultVariant: 'machine_unspecified'
    }),
    leg_extension: strength('leg_extension', 'Cadeira extensora', 'accessory', 2, {
      restSeconds: 90,
      variants: [{id: 'machine_unspecified', label: 'Máquina atual'}],
      defaultVariant: 'machine_unspecified'
    }),
    leg_curl: strength('leg_curl', 'Flexora', 'accessory', 3, {
      restSeconds: 90,
      variants: [
        {id: 'seated', label: 'Sentada', videoKey: 'leg_curl_seated'},
        {id: 'lying', label: 'Deitada', videoKey: 'leg_curl_lying'},
        {id: 'standing_unilateral', label: 'Em pé unilateral', videoKey: 'leg_curl_standing_unilateral'}
      ],
      defaultVariant: 'seated'
    }),
    calf_standing_or_leg_press: strength('calf_standing_or_leg_press', 'Panturrilha em pé ou no leg press', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true,
      variants: [
        {id: 'standing_machine', label: 'Em pé na máquina', videoKey: 'calf_standing'},
        {id: 'leg_press_45', label: 'No leg press 45°', videoKey: 'calf_leg_press'}
      ],
      defaultVariant: 'leg_press_45'
    }),
    deadlift_barbell: strength('deadlift_barbell', 'Levantamento terra com barra', 'deadlift', 2, {
      restSeconds: 180,
      warmupSets: 3,
      warmupOptional: true,
      bracing: true,
      notes: ['Não buscar falha muscular. Preserve no mínimo 2 RIR na semana mais pesada.']
    }),
    calf_seated: strength('calf_seated', 'Panturrilha sentada', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true,
      variants: [{id: 'seated_machine', label: 'Máquina sentada'}],
      defaultVariant: 'seated_machine'
    })
  });

  function copyExercise(id, overrides) {
    return Object.freeze(Object.assign({}, CATALOG[id], overrides || {}));
  }

  function legsExercises(second) {
    const strengthExercises = second
      ? [
          copyExercise('deadlift_barbell'),
          copyExercise('leg_press_45'),
          copyExercise('leg_curl', {workSets: 4}),
          copyExercise('leg_extension'),
          copyExercise('calf_seated')
        ]
      : [
          copyExercise('squat'),
          copyExercise('leg_press_45'),
          copyExercise('leg_extension'),
          copyExercise('leg_curl'),
          copyExercise('calf_standing_or_leg_press')
        ];
    return Object.freeze(MOBILITY_SEQUENCE.concat(strengthExercises));
  }

  const WORKOUTS = Object.freeze([
    Object.freeze({
      id: 'push_a',
      label: 'Empurrar A',
      weekday: 1,
      workSetTotal: 17,
      intro: 'Peito, ombros e tríceps — maior exposição semanal.',
      exercises: Object.freeze([
        copyExercise('chest_press_machine'),
        copyExercise('incline_press_machine'),
        copyExercise('cable_crossover'),
        copyExercise('shoulder_press_machine'),
        copyExercise('lateral_raise_dumbbell'),
        copyExercise('triceps_skull_dumbbell'),
        copyExercise('triceps_rope')
      ])
    }),
    Object.freeze({
      id: 'pull_a',
      label: 'Puxar A',
      weekday: 2,
      workSetTotal: 15,
      intro: 'Costas, deltoide posterior e bíceps.',
      exercises: Object.freeze([
        copyExercise('pulldown_supinated'),
        copyExercise('seated_row_triangle'),
        copyExercise('unilateral_row_machine'),
        copyExercise('reverse_fly_machine'),
        copyExercise('ez_bar_curl'),
        copyExercise('hammer_curl_standing')
      ])
    }),
    Object.freeze({
      id: 'legs_a',
      label: 'Pernas A',
      weekday: 3,
      workSetTotal: 14,
      intro: 'Mobilidade original, agachamento e trabalho de pernas.',
      exercises: legsExercises(false)
    }),
    Object.freeze({
      id: 'push_b',
      label: 'Empurrar B',
      weekday: 4,
      workSetTotal: 15,
      intro: 'Segunda exposição de empurrar com volume reduzido.',
      exercises: Object.freeze([
        copyExercise('chest_press_machine', {workSets: 2, warmupSets: 0}),
        copyExercise('incline_press_machine', {workSets: 2}),
        copyExercise('machine_fly'),
        copyExercise('shoulder_press_machine'),
        copyExercise('lateral_raise_dumbbell'),
        copyExercise('triceps_overhead'),
        copyExercise('triceps_rope')
      ])
    }),
    Object.freeze({
      id: 'pull_b',
      label: 'Puxar B',
      weekday: 5,
      workSetTotal: 14,
      intro: 'Segunda exposição de puxar com pegada e remada selecionáveis.',
      exercises: Object.freeze([
        copyExercise('pulldown_neutral'),
        copyExercise('row_machine_choice'),
        copyExercise('unilateral_row_machine'),
        copyExercise('reverse_fly_machine', {workSets: 2}),
        copyExercise('ez_bar_curl'),
        copyExercise('hammer_curl_standing')
      ])
    }),
    Object.freeze({
      id: 'legs_b',
      label: 'Pernas B',
      weekday: 6,
      workSetTotal: 14,
      intro: 'Mobilidade original, levantamento terra e trabalho de pernas.',
      exercises: legsExercises(true)
    })
  ]);

  const WORKOUT_BY_ID = Object.freeze(Object.fromEntries(WORKOUTS.map(workout => [workout.id, workout])));

  const LEGACY_ALIASES = Object.freeze({
    a_puxada_supinada: 'pulldown_supinated',
    a_puxada_neutra: 'pulldown_neutral',
    a_remada_sentada: 'seated_row_triangle',
    a_crucifixo_inv: 'reverse_fly_machine',
    a_biceps_martelo: 'hammer_curl_standing',
    a_rosca_barra_w: 'ez_bar_curl',
    b_crossover: 'cable_crossover',
    b_crucifixo_aparelho: 'machine_fly',
    b_desenv_maquina: 'shoulder_press_machine',
    b_elev_lateral: 'lateral_raise_dumbbell',
    b_triceps_testa: 'triceps_skull_dumbbell',
    b_triceps_pulley: 'triceps_rope',
    c_agach_smith: 'squat',
    c_terra_barra: 'deadlift_barbell',
    c_leg_press: 'leg_press_45',
    c_extensor: 'leg_extension',
    c_panturrilha_pe: 'calf_standing_or_leg_press',
    c_panturrilha_sentado: 'calf_seated'
  });

  const LEGACY_ONLY_IDS = Object.freeze([
    'a_abs_curto',
    'a_alonga_dorsal',
    'a_alonga_peitoral',
    'a_pulldown',
    'a_remada_smith',
    'b_alonga_dorsal',
    'b_rot_ombro',
    'b_supino_barra',
    'b_supino_inclinado',
    'c_alonga_adutor',
    'c_mob_quadril',
    'c_alonga_posterior',
    'c_mob_tornozelo',
    'c_flexor_deitado'
  ]);

  const VIDEOS = Object.freeze({
    chest_press_machine: {exerciseId: 'chest_press_machine', status: 'pending', classification: 'pending', exactMatch: false},
    incline_press_machine: {exerciseId: 'incline_press_machine', status: 'pending', classification: 'pending', exactMatch: false},
    cable_crossover: {exerciseId: 'cable_crossover', status: 'pending', classification: 'pending', exactMatch: false},
    machine_fly: {exerciseId: 'machine_fly', status: 'pending', classification: 'pending', exactMatch: false},
    shoulder_press_machine: {exerciseId: 'shoulder_press_machine', status: 'pending', classification: 'pending', exactMatch: false},
    lateral_raise_dumbbell: {exerciseId: 'lateral_raise_dumbbell', status: 'pending', classification: 'pending', exactMatch: false},
    triceps_skull_dumbbell: {exerciseId: 'triceps_skull_dumbbell', status: 'pending', classification: 'pending', exactMatch: false},
    triceps_overhead: {exerciseId: 'triceps_overhead', status: 'pending', classification: 'pending', exactMatch: false},
    triceps_rope: {exerciseId: 'triceps_rope', status: 'pending', classification: 'pending', exactMatch: false},
    pulldown_supinated: {exerciseId: 'pulldown_supinated', status: 'pending', classification: 'pending', exactMatch: false},
    pulldown_neutral: {exerciseId: 'pulldown_neutral', status: 'pending', classification: 'pending', exactMatch: false},
    seated_row_triangle: {exerciseId: 'seated_row_triangle', status: 'pending', classification: 'pending', exactMatch: false},
    unilateral_row_machine: {exerciseId: 'unilateral_row_machine', status: 'pending', classification: 'pending', exactMatch: false},
    row_machine_choice: {exerciseId: 'row_machine_choice', status: 'pending', classification: 'pending', exactMatch: false},
    reverse_fly_machine: {exerciseId: 'reverse_fly_machine', status: 'pending', classification: 'pending', exactMatch: false},
    ez_bar_curl: {exerciseId: 'ez_bar_curl', status: 'pending', classification: 'pending', exactMatch: false},
    hammer_curl_standing: {exerciseId: 'hammer_curl_standing', status: 'pending', classification: 'pending', exactMatch: false},
    squat_free_barbell: {exerciseId: 'squat', variationId: 'free_barbell', status: 'pending', classification: 'pending', exactMatch: false},
    squat_smith: {exerciseId: 'squat', variationId: 'smith', status: 'pending', classification: 'pending', exactMatch: false},
    leg_press_45: {exerciseId: 'leg_press_45', status: 'pending', classification: 'pending', exactMatch: false},
    leg_extension: {exerciseId: 'leg_extension', status: 'pending', classification: 'pending', exactMatch: false},
    leg_curl_seated: {exerciseId: 'leg_curl', variationId: 'seated', status: 'pending', classification: 'pending', exactMatch: false},
    leg_curl_lying: {exerciseId: 'leg_curl', variationId: 'lying', status: 'pending', classification: 'pending', exactMatch: false},
    leg_curl_standing_unilateral: {exerciseId: 'leg_curl', variationId: 'standing_unilateral', status: 'pending', classification: 'pending', exactMatch: false},
    calf_standing: {exerciseId: 'calf_standing_or_leg_press', variationId: 'standing_machine', status: 'pending', classification: 'pending', exactMatch: false},
    calf_leg_press: {exerciseId: 'calf_standing_or_leg_press', variationId: 'leg_press_45', status: 'pending', classification: 'pending', exactMatch: false},
    deadlift_barbell: {exerciseId: 'deadlift_barbell', status: 'pending', classification: 'pending', exactMatch: false},
    calf_seated: {exerciseId: 'calf_seated', status: 'pending', classification: 'pending', exactMatch: false},
    mob_adductor_butterfly: {exerciseId: 'mob_adductor_butterfly', status: 'pending', classification: 'pending', exactMatch: false},
    mob_hip_butterfly: {exerciseId: 'mob_hip_butterfly', status: 'pending', classification: 'pending', exactMatch: false},
    mob_hamstring_seated: {exerciseId: 'mob_hamstring_seated', status: 'pending', classification: 'pending', exactMatch: false},
    mob_ankle: {exerciseId: 'mob_ankle', status: 'pending', classification: 'pending', exactMatch: false},
    bracing: {exerciseId: 'bracing', status: 'pending', classification: 'pending', exactMatch: false},
    vacuum: {exerciseId: 'vacuum', status: 'pending', classification: 'pending', exactMatch: false}
  });

  function prescriptionFor(exercise, week, highRepPreference) {
    const currentWeek = Math.max(1, Math.min(8, Number(week) || 1));
    if (exercise.type === 'mobility') {
      return {sets: exercise.sets, label: exercise.target, rirMin: null, rirMax: null, deload: false};
    }
    if (exercise.category === 'deadlift') {
      const deadlift = {
        1: [2, 6, 8, 3, 3],
        2: [2, 6, 8, 2, 3],
        3: [2, 6, 8, 2, 2],
        4: [2, 6, 8, 2, 2],
        5: [2, 5, 7, 2, 2],
        6: [2, 5, 7, 2, 2],
        7: [2, 4, 6, 2, 3],
        8: [1, 6, 8, 4, 5]
      }[currentWeek];
      return {sets: deadlift[0], min: deadlift[1], max: deadlift[2], label: `${deadlift[1]}–${deadlift[2]}`, rirMin: deadlift[3], rirMax: deadlift[4], deload: currentWeek === 8, optionalDeloadRemoval: currentWeek === 8};
    }
    let min;
    let max;
    let rirMin;
    let rirMax;
    let sets = exercise.workSets;
    if (exercise.category === 'upper_compound') {
      const values = {
        1: [12, 15, 3, 3], 2: [12, 15, 2, 2], 3: [10, 12, 2, 2], 4: [10, 12, 1, 2],
        5: [8, 10, 2, 2], 6: [8, 10, 1, 2], 7: [6, 8, 1, 2], 8: [8, 12, 4, 5]
      }[currentWeek];
      [min, max, rirMin, rirMax] = values;
    } else if (exercise.category === 'squat_press') {
      const values = {
        1: [12, 15, 3, 3], 2: [12, 15, 2, 2], 3: [10, 12, 2, 2], 4: [10, 12, 1, 2],
        5: [8, 10, 2, 2], 6: [8, 10, 1, 2], 7: [8, 10, 1, 2], 8: [10, 12, 4, 5]
      }[currentWeek];
      [min, max, rirMin, rirMax] = values;
    } else {
      const values = {
        1: [12, 15, 3, 3], 2: [12, 15, 2, 2], 3: [10, 12, 2, 2], 4: [10, 12, 1, 2],
        5: [10, 12, 2, 2], 6: [10, 12, 1, 2], 7: [8, 12, 1, 2], 8: [10, 15, 4, 5]
      }[currentWeek];
      [min, max, rirMin, rirMax] = values;
      // Faixa alta opcional da ficha para elevação lateral, crucifixo invertido
      // e panturrilhas: 12–20 repetições.
      if (highRepPreference && exercise.allowHighReps && currentWeek !== 8) {
        min = 12;
        max = 20;
      }
    }
    if (currentWeek === 8) sets = Math.min(2, exercise.workSets);
    return {sets, min, max, label: `${min}–${max}`, rirMin, rirMax, deload: currentWeek === 8};
  }

  function workoutForDate(value) {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return DAY_WORKOUT[date.getDay()] || '';
  }

  function findExercise(workoutId, exerciseId) {
    const workout = WORKOUT_BY_ID[workoutId];
    return workout ? workout.exercises.find(exercise => exercise.id === exerciseId) || null : null;
  }

  global.THFData = Object.freeze({
    DAY_WORKOUT,
    WEEK_LABELS,
    MOBILITY_SEQUENCE,
    BRACING_TEXT,
    CATALOG,
    WORKOUTS,
    WORKOUT_BY_ID,
    LEGACY_ALIASES,
    LEGACY_ONLY_IDS,
    VIDEOS,
    prescriptionFor,
    workoutForDate,
    findExercise
  });
})(globalThis);
