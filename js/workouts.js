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

  const SIDE_MODES = Object.freeze({
    BILATERAL: 'bilateral',
    UNILATERAL: 'unilateral'
  });

  // Identifica a ficha que originou o retrato persistido de uma sessão. A
  // versão fica separada do esquema de armazenamento porque a ficha pode
  // evoluir sem exigir, por si só, uma migração de todos os documentos.
  const WORKOUT_REVISION = '3.6.1';

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

  // Menor degrau de carga que o equipamento realmente oferece. É uma PRESUNÇÃO
  // sobre a academia, não uma medição: existe só para que a sugestão de aumento
  // caia em um valor que existe no aparelho, nunca no meio de dois pinos. O app
  // nunca altera carga sozinho, então errar o degrau não corrompe registro
  // nenhum — só torna a sugestão menos útil.
  const LOAD_STEPS = Object.freeze({
    lateral_raise_dumbbell: 2,
    triceps_skull_dumbbell: 2,
    triceps_overhead: 2,
    hammer_curl_standing: 2,
    ez_bar_curl: 2.5
  });

  // Taxonomia editorial para apresentar volume por grupo muscular. "Primário"
  // alimenta a contagem de séries diretas; "secundário" aparece separado e
  // nunca é convertido automaticamente em meia série. Um exercício composto
  // pode contar como série direta para mais de um grupo, portanto a soma das
  // linhas não representa o total de séries distintas da ficha.
  const MUSCLE_GROUPS = Object.freeze({
    chest: Object.freeze({id: 'chest', label: 'Peito'}),
    back: Object.freeze({id: 'back', label: 'Costas'}),
    shoulders: Object.freeze({id: 'shoulders', label: 'Ombros'}),
    triceps: Object.freeze({id: 'triceps', label: 'Tríceps'}),
    biceps: Object.freeze({id: 'biceps', label: 'Bíceps'}),
    quadriceps: Object.freeze({id: 'quadriceps', label: 'Quadríceps'}),
    hamstrings: Object.freeze({id: 'hamstrings', label: 'Posteriores de coxa'}),
    glutes: Object.freeze({id: 'glutes', label: 'Glúteos'}),
    calves: Object.freeze({id: 'calves', label: 'Panturrilhas'})
  });

  const MUSCLE_TARGETS = Object.freeze({
    chest_press_machine: {primary: ['chest'], secondary: ['shoulders', 'triceps']},
    incline_press_machine: {primary: ['chest'], secondary: ['shoulders', 'triceps']},
    cable_crossover: {primary: ['chest'], secondary: []},
    machine_fly: {primary: ['chest'], secondary: []},
    shoulder_press_machine: {primary: ['shoulders'], secondary: ['triceps']},
    lateral_raise_dumbbell: {primary: ['shoulders'], secondary: []},
    triceps_skull_dumbbell: {primary: ['triceps'], secondary: []},
    triceps_overhead: {primary: ['triceps'], secondary: []},
    triceps_rope: {primary: ['triceps'], secondary: []},
    pulldown_supinated: {primary: ['back'], secondary: ['biceps']},
    pulldown_neutral: {primary: ['back'], secondary: ['biceps']},
    seated_row_triangle: {primary: ['back'], secondary: ['biceps', 'shoulders']},
    unilateral_row_machine: {primary: ['back'], secondary: ['biceps', 'shoulders']},
    row_machine_choice: {primary: ['back'], secondary: ['biceps', 'shoulders']},
    reverse_fly_machine: {primary: ['shoulders'], secondary: ['back']},
    ez_bar_curl: {primary: ['biceps'], secondary: []},
    hammer_curl_standing: {primary: ['biceps'], secondary: []},
    squat: {primary: ['quadriceps', 'glutes'], secondary: ['hamstrings']},
    leg_press_45: {primary: ['quadriceps', 'glutes'], secondary: ['hamstrings']},
    leg_extension: {primary: ['quadriceps'], secondary: []},
    leg_curl: {primary: ['hamstrings'], secondary: []},
    calf_standing_or_leg_press: {primary: ['calves'], secondary: []},
    deadlift_barbell: {primary: ['glutes', 'hamstrings', 'back'], secondary: ['quadriceps']},
    calf_seated: {primary: ['calves'], secondary: []}
  });

  function strength(id, name, category, sets, options) {
    const config = options || {};
    const muscles = MUSCLE_TARGETS[id] || {primary: [], secondary: []};
    // `unilateral` é aceito apenas para que definições antigas materializadas
    // por esta função não mudem silenciosamente de sentido. O catálogo novo e
    // seus consumidores usam exclusivamente `defaultSideMode` e o modo da
    // variante escolhida.
    const legacySideMode = config.unilateral ? SIDE_MODES.UNILATERAL : SIDE_MODES.BILATERAL;
    const defaultSideMode = Object.values(SIDE_MODES).includes(config.defaultSideMode)
      ? config.defaultSideMode
      : legacySideMode;
    const variants = Object.freeze((config.variants || []).map(variant => Object.freeze(Object.assign({}, variant, {
      sideMode: Object.values(SIDE_MODES).includes(variant.sideMode) ? variant.sideMode : defaultSideMode
    }))));
    const preferredTrackingVariant = variants.some(variant => variant.id === config.preferredTrackingVariant)
      ? config.preferredTrackingVariant
      : '';
    return Object.freeze({
      id,
      name,
      type: 'strength',
      category,
      workSets: sets,
      loadStep: config.loadStep || LOAD_STEPS[id] || 5,
      muscles: Object.freeze({
        primary: Object.freeze(muscles.primary.slice()),
        secondary: Object.freeze(muscles.secondary.slice())
      }),
      restSeconds: config.restSeconds || (category === 'accessory' ? 90 : 120),
      warmupSets: config.warmupSets || 0,
      warmupOptional: Boolean(config.warmupOptional),
      detail: config.detail || '',
      notes: Object.freeze(config.notes || []),
      variants,
      defaultVariant: config.defaultVariant || '',
      defaultSideMode,
      preferredTrackingVariant,
      videoKey: config.videoKey || id,
      bracing: Boolean(config.bracing),
      allowHighReps: Boolean(config.allowHighReps)
    });
  }

  function sideModeFor(exercise, variationId) {
    if (!exercise || exercise.type !== 'strength') return SIDE_MODES.BILATERAL;
    const variant = Array.isArray(exercise.variants)
      ? exercise.variants.find(item => item.id === variationId)
      : null;
    if (variant && Object.values(SIDE_MODES).includes(variant.sideMode)) return variant.sideMode;
    if (Object.values(SIDE_MODES).includes(exercise.defaultSideMode)) return exercise.defaultSideMode;
    return exercise.unilateral ? SIDE_MODES.UNILATERAL : SIDE_MODES.BILATERAL;
  }

  function preferredVariantFor(exercise, trackingEnabled) {
    if (!exercise || !Array.isArray(exercise.variants)) return '';
    if (trackingEnabled && exercise.preferredTrackingVariant
      && exercise.variants.some(variant => variant.id === exercise.preferredTrackingVariant)) {
      return exercise.preferredTrackingVariant;
    }
    return exercise.variants.some(variant => variant.id === exercise.defaultVariant)
      ? exercise.defaultVariant
      : (exercise.variants[0] ? exercise.variants[0].id : '');
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
    machine_fly: strength('machine_fly', 'Voador (peck deck)', 'accessory', 3, {
      restSeconds: 90,
      detail: 'Voador com pegadores nas mãos, sem apoio nos antebraços',
      notes: ['Modelo confirmado por foto em 2026-09-07. O vídeo de apoio deve mostrar o crucifixo com pegadores, não o peck deck com almofadas nos antebraços.']
    }),
    shoulder_press_machine: strength('shoulder_press_machine', 'Desenvolvimento na máquina', 'upper_compound', 3, {
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
    triceps_rope: strength('triceps_rope', 'Tríceps na polia com corda', 'accessory', 3, {
      restSeconds: 90
    }),
    pulldown_supinated: strength('pulldown_supinated', 'Puxada frontal com pegada supinada', 'upper_compound', 3, {
      restSeconds: 120,
      warmupSets: 2,
      warmupOptional: true
    }),
    pulldown_neutral: strength('pulldown_neutral', 'Puxada frontal com pegada neutra', 'upper_compound', 3, {
      restSeconds: 120,
      warmupSets: 2,
      warmupOptional: true
    }),
    seated_row_triangle: strength('seated_row_triangle', 'Remada sentada com triângulo', 'upper_compound', 3, {
      restSeconds: 120,
      bracing: true,
      variants: [
        {id: 'cable_triangle', label: 'Cabo com triângulo', videoKey: 'seated_row_triangle'},
        {id: 'machine_supported', label: 'Máquina com apoio', videoKey: 'seated_row_supported'}
      ],
      defaultVariant: 'cable_triangle'
    }),
    unilateral_row_machine: strength('unilateral_row_machine', 'Remada unilateral na máquina', 'upper_compound', 3, {
      restSeconds: 120,
      defaultSideMode: SIDE_MODES.UNILATERAL,
      detail: 'Três séries por lado; o volume planejado da ficha conta o exercício uma vez.',
      variants: [
        {id: 'machine_left_right', label: 'Máquina — lados separados', sideMode: SIDE_MODES.UNILATERAL},
        {id: 'plate_loaded', label: 'Articulada com anilhas', sideMode: SIDE_MODES.UNILATERAL}
      ],
      defaultVariant: 'machine_left_right'
    }),
    row_machine_choice: strength('row_machine_choice', 'Remada sentada ou articulada', 'upper_compound', 3, {
      restSeconds: 120,
      bracing: true,
      variants: [
        {id: 'seated_cable_triangle', label: 'Sentada no cabo', videoKey: 'seated_row_triangle'},
        {id: 'articulated_supported', label: 'Articulada com apoio torácico', videoKey: 'row_articulated_supported'},
        {id: 'articulated_unsupported', label: 'Articulada sem apoio torácico', videoKey: 'row_articulated_unsupported'}
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
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'free_barbell', label: 'Livre com barra', videoKey: 'squat_free_barbell', sideMode: SIDE_MODES.BILATERAL},
        {id: 'smith', label: 'Smith', videoKey: 'squat_smith', sideMode: SIDE_MODES.BILATERAL}
      ],
      defaultVariant: 'smith'
    }),
    leg_press_45: strength('leg_press_45', 'Leg press 45°', 'squat_press', 3, {
      restSeconds: 150,
      warmupSets: 1,
      warmupOptional: true,
      bracing: true,
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'machine_unspecified', label: 'Máquina atual — bilateral', sideMode: SIDE_MODES.BILATERAL},
        {id: 'machine_unilateral', label: 'Máquina atual — unilateral (se o aparelho permitir)', sideMode: SIDE_MODES.UNILATERAL, videoKey: 'leg_press_45_unilateral', requiresUnilateralSupport: true}
      ],
      defaultVariant: 'machine_unspecified',
      preferredTrackingVariant: 'machine_unilateral'
    }),
    leg_extension: strength('leg_extension', 'Cadeira extensora', 'accessory', 3, {
      restSeconds: 90,
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'machine_unspecified', label: 'Máquina atual — bilateral', sideMode: SIDE_MODES.BILATERAL},
        {id: 'machine_unilateral', label: 'Máquina atual — unilateral (se o aparelho permitir)', sideMode: SIDE_MODES.UNILATERAL, videoKey: 'leg_extension_unilateral', requiresUnilateralSupport: true}
      ],
      defaultVariant: 'machine_unspecified',
      preferredTrackingVariant: 'machine_unilateral'
    }),
    leg_curl: strength('leg_curl', 'Flexora', 'accessory', 3, {
      restSeconds: 90,
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'seated', label: 'Sentada', videoKey: 'leg_curl_seated', sideMode: SIDE_MODES.BILATERAL},
        {id: 'lying', label: 'Deitada', videoKey: 'leg_curl_lying', sideMode: SIDE_MODES.BILATERAL},
        {id: 'standing_unilateral', label: 'Em pé unilateral', videoKey: 'leg_curl_standing_unilateral', sideMode: SIDE_MODES.UNILATERAL}
      ],
      defaultVariant: 'seated'
    }),
    calf_standing_or_leg_press: strength('calf_standing_or_leg_press', 'Panturrilha em pé ou no leg press', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true,
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'standing_machine', label: 'Em pé na máquina — bilateral', videoKey: 'calf_standing', sideMode: SIDE_MODES.BILATERAL},
        {id: 'leg_press_45', label: 'No leg press 45° — bilateral', videoKey: 'calf_leg_press', sideMode: SIDE_MODES.BILATERAL},
        {id: 'standing_machine_unilateral', label: 'Em pé na máquina — unilateral (se o aparelho permitir)', videoKey: 'calf_standing_unilateral', sideMode: SIDE_MODES.UNILATERAL, requiresUnilateralSupport: true},
        {id: 'leg_press_45_unilateral', label: 'No leg press 45° — unilateral (se o aparelho permitir)', videoKey: 'calf_leg_press_unilateral', sideMode: SIDE_MODES.UNILATERAL, requiresUnilateralSupport: true}
      ],
      defaultVariant: 'leg_press_45'
    }),
    deadlift_barbell: strength('deadlift_barbell', 'Levantamento terra com barra', 'deadlift', 2, {
      restSeconds: 180,
      warmupSets: 3,
      warmupOptional: true,
      bracing: true,
      defaultSideMode: SIDE_MODES.BILATERAL,
      notes: ['Não buscar falha muscular. Preserve no mínimo 2 RIR na semana mais pesada.']
    }),
    calf_seated: strength('calf_seated', 'Panturrilha sentada', 'accessory', 3, {
      restSeconds: 90,
      allowHighReps: true,
      defaultSideMode: SIDE_MODES.BILATERAL,
      variants: [
        {id: 'seated_machine', label: 'Máquina sentada — bilateral', sideMode: SIDE_MODES.BILATERAL},
        {id: 'seated_machine_unilateral', label: 'Máquina sentada — unilateral (se o aparelho permitir)', videoKey: 'calf_seated_unilateral', sideMode: SIDE_MODES.UNILATERAL, requiresUnilateralSupport: true}
      ],
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
      workSetTotal: 20,
      intro: 'Peito, ombros e tríceps — maior exposição semanal.',
      exercises: Object.freeze([
        copyExercise('chest_press_machine'),
        copyExercise('incline_press_machine'),
        copyExercise('machine_fly'),
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
      workSetTotal: 16,
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
      workSetTotal: 15,
      intro: 'Mobilidade original, agachamento e trabalho de pernas.',
      exercises: legsExercises(false)
    }),
    Object.freeze({
      id: 'push_b',
      label: 'Empurrar B',
      weekday: 4,
      workSetTotal: 20,
      intro: 'Segunda exposição de empurrar com volume reduzido.',
      exercises: Object.freeze([
        copyExercise('chest_press_machine'),
        copyExercise('incline_press_machine'),
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
      workSetTotal: 16,
      intro: 'Segunda exposição de puxar com pegada e remada selecionáveis.',
      exercises: Object.freeze([
        copyExercise('pulldown_neutral'),
        copyExercise('row_machine_choice'),
        copyExercise('unilateral_row_machine'),
        copyExercise('reverse_fly_machine'),
        copyExercise('ez_bar_curl'),
        copyExercise('hammer_curl_standing')
      ])
    }),
    Object.freeze({
      id: 'legs_b',
      label: 'Pernas B',
      weekday: 6,
      workSetTotal: 15,
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

  // Lista fechada: a própria entrada do vídeo não pode declarar-se brasileira
  // e ganhar reprodução. Cada ID precisa existir aqui, coincidir com o canal
  // revisado e apontar para uma prova externa específica. Conteúdo em pt-BR é
  // uma exigência separada e continua sendo conferido em reviewedVideo().
  const VERIFIED_BR_VIDEO_PROVENANCE = Object.freeze({
    'Q8TqfD8E7BU': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    'dTqDKC0D6P4': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    'pJM_rHhluK8': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    '2-ULaRrQa7c': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    Zss6E3VU6X0: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    'SbAykzCE-xk': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-16'}),
    IwWvZ0rlNXs: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-07'}),
    '0qkQy8V2FC0': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-07'}),
    FzCnfD0gOXo: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-07'}),
    '4L5nBs8Eq7g': Object.freeze({channel: 'Laércio Refundini', country: 'BR', evidenceKind: 'official_legal_page', evidenceUrl: 'https://muscleplus.com.br/politica_de_privacidade/', verifiedAt: '2026-08-13'}),
    uDBQtlCLQ0Y: Object.freeze({channel: 'Tay Training', country: 'BR', evidenceKind: 'official_professional_record', evidenceUrl: 'https://treinos-server.taytraining.com.br/api/training-sheet/file/91', verifiedAt: '2026-08-13'}),
    waAxlYvtCcI: Object.freeze({channel: 'Treino Mestre', country: 'BR', evidenceKind: 'official_creator_page', evidenceUrl: 'https://treinomestre.com.br/sobre/', verifiedAt: '2026-08-13'}),
    Svq2T3L9oKo: Object.freeze({channel: 'Gymflix', country: 'BR', channelHandle: '@GYMFLIXAcademia', evidenceKind: 'official_creator_page', evidenceUrl: 'https://gymflix.com.br/pagina-de-direcionamento/', verifiedAt: '2026-08-13'}),
    'T--10UN1jKs': Object.freeze({channel: 'FISIculturismo.com.br', country: 'BR', channelHandle: '@FISIculturismocombr', evidenceKind: 'official_creator_page', evidenceUrl: 'https://fisiculturismo.com.br/', verifiedAt: '2026-08-13'}),
    'F7_8z_7Kwks': Object.freeze({channel: 'FISIculturismo.com.br', country: 'BR', channelHandle: '@FISIculturismocombr', evidenceKind: 'official_creator_page', evidenceUrl: 'https://fisiculturismo.com.br/', verifiedAt: '2026-08-13'}),
    '3otpFrCvjLw': Object.freeze({channel: 'Comer, Treinar e Amar', country: 'BR', evidenceKind: 'independent_brazilian_source', evidenceUrl: 'https://www.ativo.com/fitness/noticias-fitness/9-canais-de-fitness-para-seguir-no-youtube/', verifiedAt: '2026-08-13'}),
    zHJE3HPEP84: Object.freeze({channel: 'Mariana Sardelli', country: 'BR', evidenceKind: 'professional_profile', evidenceUrl: 'https://www.treinar.me/mariana-sardelli', verifiedAt: '2026-08-13'}),
    imijpudAW7s: Object.freeze({channel: 'Matheus Morgavi', country: 'BR', evidenceKind: 'brazilian_federation', evidenceUrl: 'https://www.powerlifting-ipf.com.br/paginas/atletas.php', verifiedAt: '2026-08-13'}),
    '3pprN9t_P1o': Object.freeze({channel: 'Descomplicando a Musculação - NS Personal', country: 'BR', channelHandle: '@personal.natanscarton', evidenceKind: 'official_professional_registry', evidenceUrl: 'https://www.crefrs.org.br/wp-content/uploads/2026/07/NOMINATA-2024.pdf', verifiedAt: '2026-08-13'}),
    yj3CnWaoIRI: Object.freeze({channel: 'Laércio Refundini', country: 'BR', channelHandle: '@laerciorefundini', evidenceKind: 'official_creator_page', evidenceUrl: 'https://muscleplus.com.br/', verifiedAt: '2026-09-17'}),
    YJ4kGE3eemY: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'}),
    QyvIEdEHzHc: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,jqTlJt3JXzQ: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,EuQAfhXBEvs: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,HpWWreyaBN0: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,'824pMjvGXgc': Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,KUt5agoqlRA: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,qvdiga5sQvQ: Object.freeze({channel: 'Leandro Twin', country: 'BR', channelHandle: '@LeandroTwin', evidenceKind: 'official_professional_record', evidenceUrl: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf', verifiedAt: '2026-09-17'})
    ,'wjlX-5DTjBQ': Object.freeze({channel: 'Laércio Refundini - Cortes', country: 'BR', channelHandle: '@LaercioRefundiniResponde', evidenceKind: 'official_creator_page', evidenceUrl: 'https://muscleplus.com.br/', verifiedAt: '2026-09-18'})
    ,'2s6jU4I5gy4': Object.freeze({channel: 'Cinesio Pro', country: 'BR', channelHandle: '@cinesiopro9502', evidenceKind: 'official_creator_channel', evidenceUrl: 'https://www.youtube.com/@cinesiopro9502/about', verifiedAt: '2026-09-18'})
    ,s20MPQbKIHQ: Object.freeze({channel: 'LELEO MONTEIRO', country: 'BR', channelHandle: '@musclemindchanel', evidenceKind: 'official_creator_channel', evidenceUrl: 'https://www.youtube.com/@musclemindchanel/about', verifiedAt: '2026-09-18'})
    ,'6OTssJK_sVU': Object.freeze({channel: 'Will Detilli', country: 'BR', channelHandle: '@mesamaromba', evidenceKind: 'official_creator_channel', evidenceUrl: 'https://www.youtube.com/@mesamaromba/about', verifiedAt: '2026-09-18'})
    ,Prevu525iYQ: Object.freeze({channel: 'Danilo Heraclio', country: 'BR', channelHandle: '@daniloheracliofitness', evidenceKind: 'official_creator_channel', evidenceUrl: 'https://www.youtube.com/@daniloheracliofitness/about', verifiedAt: '2026-09-18'})
  });

  function verifiedBrazilianProvenance(value) {
    const proof = VERIFIED_BR_VIDEO_PROVENANCE[value.youtubeId || ''];
    return proof
      && proof.country === 'BR'
      && proof.channel === value.channel
      && /^https:\/\//.test(proof.evidenceUrl)
      ? proof
      : null;
  }

  function reviewedVideo(config) {
    const value = config || {};
    const youtubeId = value.youtubeId || '';
    const declaredStatus = value.status || 'pending';
    const provenance = verifiedBrazilianProvenance(value);
    const brazilianSource = Boolean(provenance) && value.language === 'pt-BR';
    // Regra de produto: somente uma demonstração de criador/canal brasileiro,
    // em português do Brasil e com origem documentada pode ser reproduzida.
    // A trava é central para que uma futura entrada não burle a política por
    // engano; candidatos estrangeiros continuam inventariados, mas pendentes.
    const blockedByBrazilPolicy = declaredStatus === 'accepted' && !brazilianSource;
    return Object.freeze({
      exerciseId: value.exerciseId || '',
      variationId: value.variationId || '',
      status: blockedByBrazilPolicy ? 'pending' : declaredStatus,
      classification: blockedByBrazilPolicy ? 'pending' : (value.classification || 'pending'),
      coverageScope: blockedByBrazilPolicy ? 'pending' : (value.coverageScope || 'exact'),
      exactMatch: blockedByBrazilPolicy ? false : value.exactMatch === true,
      youtubeId,
      url: value.url || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : ''),
      title: value.title || '',
      channel: value.channel || '',
      duration: value.duration || '',
      language: value.language || '',
      creatorCountry: provenance ? provenance.country : (value.creatorCountry || ''),
      youtubeChannelHandle: provenance && provenance.channelHandle ? provenance.channelHandle : '',
      originEvidence: provenance ? provenance.evidenceUrl : (value.originEvidence || ''),
      originEvidenceKind: provenance ? provenance.evidenceKind : '',
      originVerifiedAt: provenance ? provenance.verifiedAt : '',
      blockedByBrazilPolicy,
      reviewedAt: value.reviewedAt || '',
      // available = toca no app; external_only = existe mas o dono bloqueia
      // incorporação (erro 101/150); removed_or_private = erro 100;
      // unknown = sem candidato ou sem verificação.
      availability: value.availability || 'unknown',
      embedCompatible: value.embedCompatible === true ? true : value.embedCompatible === false ? false : null,
      startSeconds: Math.max(0, Math.floor(Number(value.startSeconds) || 0)),
      endSeconds: Math.max(0, Math.floor(Number(value.endSeconds) || 0)),
      positives: value.positives || '',
      limitations: value.limitations || '',
      decision: blockedByBrazilPolicy
        ? 'Não reproduzir: a política atual exige vídeo revisado de criador ou canal brasileiro, em português do Brasil.'
        : (value.decision || '')
    });
  }

  const VIDEOS = Object.freeze({
    leg_press_45_unilateral: reviewedVideo({exerciseId: 'leg_press_45', variationId: 'machine_unilateral', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'waAxlYvtCcI', title: 'Exercício Leg Press 45° - Execução Correta', channel: 'Treino Mestre', duration: '0:56', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra o ajuste, o apoio do tronco e a trajetória do leg press 45°.', limitations: 'O vídeo é bilateral. Na opção unilateral, só use um lado se a máquina permitir e sem girar a pelve.', decision: 'Exibir como guia do movimento-base, sem afirmar que demonstra a execução unilateral.'}),
    leg_extension_unilateral: reviewedVideo({exerciseId: 'leg_extension', variationId: 'machine_unilateral', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'Svq2T3L9oKo', title: 'CADEIRA EXTENSORA - COMO EXECUTAR DE FORMA CORRETA', channel: 'Gymflix', duration: '2:49', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra os ajustes, o eixo do joelho, o rolete e a extensão na cadeira.', limitations: 'A demonstração é bilateral; a execução com uma perna depende de aparelho compatível e controle de pelve.', decision: 'Exibir como guia do movimento-base da cadeira extensora.'}),
    calf_standing_unilateral: reviewedVideo({exerciseId: 'calf_standing_or_leg_press', variationId: 'standing_machine_unilateral', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: '824pMjvGXgc', title: 'Como fazer panturrilha em pé', channel: 'Leandro Twin', duration: '2:38', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Inspeção visual confirmou apoio dos ombros, antepés na plataforma e flexão plantar em máquina.', limitations: 'O vídeo demonstra a versão bilateral; a opção unilateral exige máquina estável e apoio próprio.', decision: 'Exibir como guia do movimento-base da panturrilha em pé.'}),
    calf_leg_press_unilateral: reviewedVideo({exerciseId: 'calf_standing_or_leg_press', variationId: 'leg_press_45_unilateral', status: 'accepted', classification: 'objective_demo', coverageScope: 'foundation', exactMatch: false, youtubeId: 'F7_8z_7Kwks', title: 'Panturrilha no Leg Press 45º', channel: 'FISIculturismo.com.br', duration: '2:15', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra posicionamento do antepé e amplitude da panturrilha no leg press 45°.', limitations: 'A demonstração é bilateral; unilateral só em máquina compatível e sem desalinhamento.', decision: 'Exibir como guia do movimento-base no leg press.'}),
    calf_seated_unilateral: reviewedVideo({exerciseId: 'calf_seated', variationId: 'seated_machine_unilateral', status: 'accepted', classification: 'objective_demo', coverageScope: 'foundation', exactMatch: false, youtubeId: 'zHJE3HPEP84', title: 'Panturrilha Sentado Solear - Execução Exercício', channel: 'Mariana Sardelli', duration: '0:35', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra apoio sobre a coxa, antepé na plataforma e amplitude na máquina sentada.', limitations: 'A demonstração é bilateral; a opção unilateral depende do desenho da máquina.', decision: 'Exibir como guia do movimento-base da panturrilha sentada.'}),
    chest_press_machine: reviewedVideo({
      exerciseId: 'chest_press_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'yj3CnWaoIRI', startSeconds: 125,
      title: 'TÉCNICA PESADA: SUPINO MÁQUINA', channel: 'Laércio Refundini', duration: '5:44', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'external_only', embedCompatible: false,
      positives: 'Inspeção visual no trecho a partir de 2:05: execução bilateral sentada, encosto, pegadores na altura do peito e trajetória horizontal em máquina seletorizada. Canal brasileiro oficial confirmado.', limitations: 'A marca e a regulagem do banco podem diferir do aparelho da academia; o vídeo também discute técnica de intensidade, que não altera a periodização do app. O proprietário bloqueia incorporação (erro 150).', decision: 'Aprovar como guia do supino reto na máquina e abrir no YouTube, no trecho da demonstração técnica.'
    }),
    incline_press_machine: reviewedVideo({
      exerciseId: 'incline_press_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 's20MPQbKIHQ',
      title: 'SUPINO INCLINADO MÁQUINA: como fazer corretamente - EXECUÇÃO', channel: 'LELEO MONTEIRO', duration: '1:28', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual confirmou banco inclinado, apoio do tronco, pegadores e execução bilateral na máquina específica de supino inclinado. Reprodução incorporada confirmada pela IFrame Player API em 2026-09-21 (estado 1).', limitations: 'A regulagem, os pegadores e a curva de resistência variam entre modelos; ajuste o banco sem elevar os ombros.', decision: 'Aprovar como correspondência direta; reprodução interna e abertura no YouTube disponíveis conforme a preferência do usuário.'
    }),
    cable_crossover: reviewedVideo({
      exerciseId: 'cable_crossover', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'jqTlJt3JXzQ',
      title: 'Como fazer cross over', channel: 'Leandro Twin', duration: '2:25', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'Mostra polias, base estável, arco dos braços e encontro das mãos.', limitations: 'Altura das polias e amplitude precisam respeitar o equipamento e o conforto do ombro.', decision: 'Aprovar a demonstração brasileira do crossover.'
    }),
    machine_fly: reviewedVideo({
      exerciseId: 'machine_fly', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'FzCnfD0gOXo', startSeconds: 85,
      title: 'Como fazer peck deck ou crucifixo na máquina', channel: 'Leandro Twin', duration: '2:22', language: 'pt-BR', reviewedAt: '2026-09-07', availability: 'available', embedCompatible: true,
      originEvidence: 'https://www.leandrotwin.com.br/assessoria/arquivos/lista-de-videos-de-exercicios.pdf',
      positives: 'Trecho de crucifixo com pegadores inspecionado: banco com encosto, mãos nos pegadores, braços abrindo e fechando bilateralmente. Origem profissional brasileira documentada e player incorporado retornou estado 1 (reproduzindo).',
      limitations: 'O início mostra peck deck com apoio nos antebraços; abrir em 1:25 para o modelo com pegadores. Marca e regulagens não são idênticas às da foto.',
      decision: 'Aprovar o trecho do crucifixo com pegadores, correspondente ao tipo de aparelho confirmado pelo usuário, sem converter a aula em prescrição de carga.'
    }),
    shoulder_press_machine: reviewedVideo({
      exerciseId: 'shoulder_press_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'EuQAfhXBEvs', startSeconds: 88, endSeconds: 130,
      title: 'Como fazer desenvolvimento', channel: 'Leandro Twin', duration: '3:45', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual em 1:28–2:10 confirmou banco, pegadores, posição inicial e trajetória do desenvolvimento guiado na máquina.', limitations: 'O vídeo completo também apresenta versões com barra; o cartão abre diretamente no trecho da máquina. Banco, amplitude e pegadores variam entre modelos.', decision: 'Aprovar somente o recorte específico do desenvolvimento na máquina.'
    }),
    lateral_raise_dumbbell: reviewedVideo({
      exerciseId: 'lateral_raise_dumbbell', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'IwWvZ0rlNXs', endSeconds: 55,
      title: 'Como fazer elevação lateral', channel: 'Leandro Twin', duration: '3:01', language: 'pt-BR', reviewedAt: '2026-09-07', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual do trecho inicial: execução em pé com dois halteres, elevação lateral e posição dos cotovelos. Player incorporado confirmou estado 1.', limitations: 'Usar somente os primeiros 55 segundos; depois a aula apresenta outras posições, incluindo banco inclinado, que não substituem a ficha.', decision: 'Aprovar o recorte inicial como demonstração da elevação lateral em pé.'
    }),
    triceps_skull_dumbbell: reviewedVideo({
      exerciseId: 'triceps_skull_dumbbell', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'SbAykzCE-xk',
      title: 'Como fazer rosca testa halteres', channel: 'Leandro Twin', duration: '1:58', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Revisão visual: deitado no banco, dois halteres, flexão e extensão dos cotovelos com pegada neutra; demonstração bilateral. IFrame Player API confirmou reprodução (estado 1).', limitations: 'A amplitude e a posição dos braços precisam respeitar o conforto individual; não é orientação de carga.', decision: 'Aprovar para tríceps testa com halteres, inclusive a opção testa de Empurrar B.'
    }),
    triceps_overhead: reviewedVideo({
      exerciseId: 'triceps_overhead', variationId: 'overhead', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'YJ4kGE3eemY', startSeconds: 16, endSeconds: 46,
      title: 'Como fazer rosca francesa', channel: 'Leandro Twin', duration: '3:06', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual em 0:16–0:46: sentado, um halter segurado com as duas mãos acima da cabeça e flexão/extensão dos cotovelos. O trecho identifica e demonstra a rosca francesa.', limitations: 'Este vídeo representa a opção com halter; se o usuário escolher cabo, corda ou máquina, a geometria e as regulagens não são equivalentes.', decision: 'Aprovar exclusivamente para a variação “extensão acima da cabeça” com halter; o testa continua com vídeo próprio.'
    }),
    triceps_rope: reviewedVideo({
      exerciseId: 'triceps_rope', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'dTqDKC0D6P4', startSeconds: 72, endSeconds: 90,
      title: 'Como fazer tríceps pulley bilateral — corda', channel: 'Leandro Twin', duration: '2:25', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual em 1:12, 1:18 e 1:23: polia alta, corda, braços junto ao tronco e extensão bilateral. Reprodução incorporada confirmou estado 1.', limitations: 'Recorte 1:12–1:30. O vídeo completo também mostra barras; no YouTube externo respeite o trecho indicado.', decision: 'Aprovar somente o trecho com corda, sem trocar o acessório prescrito.'
    }),
    pulldown_supinated: reviewedVideo({
      exerciseId: 'pulldown_supinated', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'pJM_rHhluK8', startSeconds: 81, endSeconds: 100,
      title: 'Como fazer puxada vertical — pegada supinada', channel: 'Leandro Twin', duration: '2:43', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Revisão visual em 1:21 e 1:37: pegada supinada identificada na tela, barra à frente e execução bilateral sentada. Player incorporado confirmou estado 1.', limitations: 'Recorte 1:21–1:40. O vídeo completo também apresenta outras pegadas; no YouTube externo respeite o trecho indicado.', decision: 'Aprovar somente o recorte supinado, separado da pegada neutra.'
    }),
    pulldown_neutral: reviewedVideo({
      exerciseId: 'pulldown_neutral', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'pJM_rHhluK8', startSeconds: 114, endSeconds: 140,
      title: 'Como fazer puxada vertical — pegada neutra com triângulo', channel: 'Leandro Twin', duration: '2:43', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Revisão visual em 1:54 e 2:10: acessório triângulo, palmas voltadas uma para a outra e puxada bilateral sentada. Player incorporado confirmou estado 1.', limitations: 'Recorte 1:54–2:20, com triângulo fechado. Não representa pegadores neutros largos ou independentes; no YouTube externo respeite o trecho indicado.', decision: 'Aprovar o recorte com triângulo, sem usar a demonstração supinada neste cartão.'
    }),
    seated_row_triangle: reviewedVideo({
      exerciseId: 'seated_row_triangle', variationId: 'cable_triangle', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'HpWWreyaBN0',
      title: 'Como fazer remada cross', channel: 'Leandro Twin', duration: '2:18', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'Mostra execução sentada no cabo, acessório fechado e trajetória horizontal.', limitations: 'O formato do pegador e a distância do banco podem variar.', decision: 'Aprovar como guia brasileiro da remada sentada no cabo.'
    }),
    seated_row_supported: reviewedVideo({exerciseId: 'seated_row_triangle', variationId: 'machine_supported', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'QyvIEdEHzHc', startSeconds: 18, endSeconds: 52, title: 'Como fazer remada máquina', channel: 'Leandro Twin', duration: '1:51', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Inspeção visual em 0:18–0:52: banco, apoio peitoral, regulagem do ponto inicial e pegadas da remada bilateral aparecem com clareza.', limitations: 'O trecho usa máquina articulada com apoio no peito; regulagem, pegadores e curva de resistência variam entre modelos.', decision: 'Aprovar para a alternativa de remada sentada em máquina com apoio, sem usar como guia da versão no cabo.'}),
    unilateral_row_machine: reviewedVideo({exerciseId: 'unilateral_row_machine', status: 'accepted', classification: 'objective_demo', coverageScope: 'foundation', exactMatch: false, youtubeId: 'Prevu525iYQ', title: 'Execute melhor a Remada Unilateral na Máquina', channel: 'Danilo Heraclio', duration: '0:31', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true, positives: 'Inspeção visual confirmou execução sentada unilateral, apoio peitoral, braço livre apoiado e trajetória de puxada em máquina. Reprodução incorporada confirmada pela IFrame Player API em 2026-09-21 (estado 1).', limitations: 'A máquina demonstrada é seletorizada; a geometria e os pegadores da alternativa com anilhas podem ser diferentes.', decision: 'Exibir como guia do padrão unilateral, com reprodução interna disponível e diferença entre modelos explícita.'}),
    row_machine_choice: reviewedVideo({exerciseId: 'row_machine_choice', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'QyvIEdEHzHc', title: 'Como fazer remada máquina', channel: 'Leandro Twin', duration: '1:51', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra regulagem e trajetória de uma remada articulada em máquina.', limitations: 'Use a variante selecionada no cartão; o vídeo não representa todos os modelos de remada.', decision: 'Manter como guia-base para compatibilidade com registros antigos.'}),
    row_articulated_supported: reviewedVideo({exerciseId: 'row_machine_choice', variationId: 'articulated_supported', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'QyvIEdEHzHc', startSeconds: 78, endSeconds: 101, title: 'Como fazer remada máquina', channel: 'Leandro Twin', duration: '1:51', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Inspeção visual em 1:18–1:41: execução bilateral na remada articulada, peito apoiado e trajetória dos cotovelos visíveis de frente.', limitations: 'Recorte específico da execução com apoio. Não representa a remada articulada sem apoio nem a execução unilateral.', decision: 'Aprovar o recorte para a opção articulada com apoio; manter as demais variantes pendentes.'}),
    row_articulated_unsupported: reviewedVideo({exerciseId: 'row_machine_choice', variationId: 'articulated_unsupported', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'QyvIEdEHzHc', title: 'Como fazer remada máquina', channel: 'Leandro Twin', duration: '1:51', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Mostra o padrão de puxada horizontal e a trajetória dos cotovelos na máquina.', limitations: 'A demonstração tem apoio peitoral; a variante sem apoio exige estabilização do tronco e não deve copiar o balanço.', decision: 'Exibir somente como guia do movimento-base, com a diferença de apoio destacada.'}),
    reverse_fly_machine: reviewedVideo({
      exerciseId: 'reverse_fly_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'wjlX-5DTjBQ',
      title: 'Como fazer o Voador Inverso na Máquina (APRENDA EM 1 MINUTO)', channel: 'Laércio Refundini - Cortes', duration: '1:09', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'Demonstra banco voltado para o aparelho, pegadores e abertura dos braços para deltoide posterior.', limitations: 'O modelo e a regulagem do banco variam entre academias.', decision: 'Aprovar como guia brasileiro do crucifixo invertido no aparelho.'
    }),
    ez_bar_curl: reviewedVideo({exerciseId: 'ez_bar_curl', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'Q8TqfD8E7BU', startSeconds: 60, endSeconds: 72, title: 'Como fazer rosca direta — barra W', channel: 'Leandro Twin', duration: '2:50', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true, positives: 'Inspeção visual em 1:01, 1:06 e 1:08: em pé, barra W visível e flexão bilateral dos cotovelos. IFrame Player API confirmou estado 1.', limitations: 'Recorte 1:00–1:12. O vídeo também apresenta barra reta e halteres; não usar as outras variantes como demonstração deste cartão.', decision: 'Aprovar o trecho específico da barra W como demonstração curta.'}),
    hammer_curl_standing: reviewedVideo({exerciseId: 'hammer_curl_standing', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: '0qkQy8V2FC0', endSeconds: 25, title: 'Como fazer rosca martelo', channel: 'Leandro Twin', duration: '1:57', language: 'pt-BR', reviewedAt: '2026-09-07', availability: 'available', embedCompatible: true, positives: 'Trecho inicial inspecionado: em pé, dois halteres e pegada neutra. Reprodução incorporada confirmou estado 1.', limitations: 'Usar somente os primeiros 25 segundos. A parte seguinte mostra execução sentada e outras variações fora deste cartão.', decision: 'Aprovar apenas a demonstração inicial em pé, sem alterar a posição prescrita.'}),
    squat_free_barbell: reviewedVideo({
      exerciseId: 'squat', variationId: 'free_barbell', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '4L5nBs8Eq7g',
      title: '3 Passos Para Fazer o Agachamento Livre PERFEITO (O Guia Mais Completo)', channel: 'Laércio Refundini', duration: '7:05', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://muscleplus.com.br/politica_de_privacidade/', reviewedAt: '2026-08-09', availability: 'external_only', embedCompatible: false,
      positives: 'Mostra rack, posição da barra, pegada, base, descida e fundo.', limitations: 'Base, posição da barra e profundidade dependem da antropometria e mobilidade.', decision: 'Aprovado como guia técnico; o proprietário bloqueia incorporação (erro 150), então o cartão abre direto no YouTube.'
    }),
    squat_smith: reviewedVideo({
      exerciseId: 'squat', variationId: 'smith', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'uDBQtlCLQ0Y',
      title: 'AGACHAMENTO SMITH - O passo a passo completo', channel: 'Tay Training', duration: '8:03', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://apps.apple.com/br/app/tay-training/id1667613209', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra entrada, destravamento, pés, descida e retorno.', limitations: 'O Smith residencial demonstrado pode ter geometria diferente da academia.', decision: 'Aprovar como guia técnico.'
    }),
    leg_press_45: reviewedVideo({
      exerciseId: 'leg_press_45', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'waAxlYvtCcI',
      title: 'Exercício Leg Press 45° - Execução Correta', channel: 'Treino Mestre', duration: '0:56', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://treinomestre.com.br/sobre/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Trenó 45°, apoio do tronco, pés e posição inferior ficam claros.', limitations: 'Não cobre travas, regulagem e profundidade individual em detalhe.', decision: 'Aprovar como demonstração objetiva.'
    }),
    leg_extension: reviewedVideo({
      exerciseId: 'leg_extension', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'Svq2T3L9oKo',
      title: 'CADEIRA EXTENSORA - COMO EXECUTAR DE FORMA CORRETA', channel: 'Gymflix', duration: '2:49', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://gymflix.com.br/pagina-de-direcionamento/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra encosto, eixo do joelho, rolete e extensão.', limitations: 'Eixos e regulagens variam por modelo.', decision: 'Aprovar como guia técnico.'
    }),
    leg_curl_seated: reviewedVideo({
      exerciseId: 'leg_curl', variationId: 'seated', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'Zss6E3VU6X0',
      title: 'Como fazer cadeira flexora', channel: 'Leandro Twin', duration: '1:47', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Revisão visual: sentado, trava das coxas, apoio do rolete, pernas estendidas e flexionadas bilateralmente. IFrame Player API confirmou reprodução (estado 1).', limitations: 'Regulagens e eixo variam entre marcas. Não representa flexora em pé ou unilateral.', decision: 'Aprovar exclusivamente para a variação sentada bilateral.'
    }),
    leg_curl_lying: reviewedVideo({
      exerciseId: 'leg_curl', variationId: 'lying', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '2-ULaRrQa7c',
      title: 'Como fazer mesa flexora', channel: 'Leandro Twin', duration: '2:09', language: 'pt-BR', reviewedAt: '2026-09-16', availability: 'available', embedCompatible: true,
      positives: 'Revisão visual: mesa flexora, posição deitada de barriga para baixo, apoio frontal e flexão bilateral com rolete nas pernas. IFrame Player API confirmou reprodução (estado 1).', limitations: 'Modelo específico de mesa; não serve para flexora sentada nem em pé.', decision: 'Aprovar para a variação deitada bilateral.'
    }),
    leg_curl_standing_unilateral: reviewedVideo({
      exerciseId: 'leg_curl', variationId: 'standing_unilateral', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'T--10UN1jKs',
      title: 'Flexora em Pé Unilateral na Máquina', channel: 'FISIculturismo.com.br', duration: '1:29', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://fisiculturismo.com.br/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Máquina unilateral em pé, apoio anterior e flexão ficam visíveis.', limitations: 'Cobertura limitada de ajustes e modelo específico.', decision: 'Aprovar como demonstração objetiva.'
    }),
    calf_standing: reviewedVideo({
      exerciseId: 'calf_standing_or_leg_press', variationId: 'standing_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '824pMjvGXgc',
      title: 'Como fazer panturrilha em pé', channel: 'Leandro Twin', duration: '2:38', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true,
      positives: 'Inspeção visual confirmou apoio dos ombros, antepés na plataforma e flexão plantar bilateral em máquina.', limitations: 'A regulagem e a plataforma variam por modelo.', decision: 'Aprovar como guia brasileiro da panturrilha em pé.'
    }),
    calf_leg_press: reviewedVideo({
      exerciseId: 'calf_standing_or_leg_press', variationId: 'leg_press_45', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'F7_8z_7Kwks',
      title: 'Panturrilha no Leg Press 45º', channel: 'FISIculturismo.com.br', duration: '2:15', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://fisiculturismo.com.br/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra antepés na borda, calcanhares livres e amplitude.', limitations: 'Não cobre totalmente travas, joelhos e amplitude individual.', decision: 'Aprovar como demonstração objetiva.'
    }),
    deadlift_barbell: reviewedVideo({
      exerciseId: 'deadlift_barbell', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '3otpFrCvjLw',
      title: 'EXECUÇÃO CORRETA DE DEAD LIFT (LEVANTAMENTO TERRA)', channel: 'Comer, Treinar e Amar', duration: '3:48', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://www.ativo.com/fitness/noticias-fitness/9-canais-de-fitness-para-seguir-no-youtube/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra setup no chão, mãos, pernas, quadril e puxada até a posição ereta.', limitations: 'A altura inicial do quadril depende da antropometria; bracing permanece conteúdo separado.', decision: 'Aprovar como guia técnico.'
    }),
    calf_seated: reviewedVideo({
      exerciseId: 'calf_seated', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'zHJE3HPEP84',
      title: 'Panturrilha Sentado Solear - Execução Exercício', channel: 'Mariana Sardelli', duration: '0:35', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://www.treinar.me/mariana-sardelli', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Máquina sentada, apoio sobre as coxas, antepés e movimento ficam visíveis.', limitations: 'Não detalha ajuste, trava ou amplitude individual.', decision: 'Aprovar como demonstração objetiva.'
    }),
    mob_adductor_butterfly: reviewedVideo({
      exerciseId: 'mob_adductor_butterfly', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'imijpudAW7s',
      title: 'Como fazer alongamento borboleta - Adutores - Matheus Morgavi', channel: 'Matheus Morgavi', duration: '1:07', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://br.linkedin.com/in/matheusmorgavi', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Solas juntas, joelhos abertos e posições de tronco ficam claras.', limitations: 'Inclinação grande do tronco pode ser desconfortável com barriga grande.', decision: 'Aprovar como demonstração objetiva.'
    }),
    mob_hip_butterfly: reviewedVideo({
      exerciseId: 'mob_hip_butterfly', status: 'accepted', classification: 'objective_demo', coverageScope: 'foundation', exactMatch: false, youtubeId: 'imijpudAW7s',
      title: 'Como fazer alongamento borboleta - Adutores - Matheus Morgavi', channel: 'Matheus Morgavi', duration: '1:07', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true,
      positives: 'Mostra solas juntas, abertura dos joelhos e postura da borboleta no chão.', limitations: 'O vídeo é um alongamento estático; no cartão de mobilidade, faça apenas o movimento leve indicado, sem forçar a inclinação do tronco.', decision: 'Exibir como guia da posição-base da borboleta.'
    }),
    mob_hamstring_seated: reviewedVideo({
      exerciseId: 'mob_hamstring_seated', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: '2s6jU4I5gy4',
      title: 'Alongamento dos posteriores de coxa sentado', channel: 'Cinesio Pro', duration: '0:13', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'external_only', embedCompatible: false,
      positives: 'Inspeção visual confirmou posição sentada no chão, pernas estendidas e inclinação controlada do tronco.', limitations: 'Vídeo muito curto e sem explicação detalhada; incline apenas até onde a barriga e a lombar permitirem, sem dor. O proprietário não permite reprodução incorporada.', decision: 'Aprovar a demonstração exata e abrir no YouTube.'
    }),
    mob_ankle: reviewedVideo({
      exerciseId: 'mob_ankle', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '3pprN9t_P1o',
      title: 'Mobilidade de Tornozelo - Joelho na Parede', channel: 'Descomplicando a Musculação - NS Personal', duration: '1:35', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://editora.unifip.edu.br/repositoriounifip/article/view/1990', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra base, calcanhar apoiado e joelho avançando em direção à parede.', limitations: 'Distância da parede e amplitude precisam ser individualizadas.', decision: 'Aprovar como guia técnico.'
    }),
    bracing: reviewedVideo({
      exerciseId: 'bracing', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '6OTssJK_sVU', startSeconds: 163, endSeconds: 289,
      title: 'A Técnica Secreta do “Abdomen de Ferro” (abdominal bracing)', channel: 'Will Detilli', duration: '6:52', language: 'pt-BR', reviewedAt: '2026-09-18', availability: 'available', embedCompatible: true,
      positives: 'O trecho 2:43–4:49 explica especificamente o bracing, a expansão da parede abdominal e a estabilização do tronco. Reprodução incorporada confirmada pela IFrame Player API em 2026-09-21 (estado 1).', limitations: 'O vídeo contém introdução e comparações fora do trecho; use o recorte como orientação técnica, não como avaliação clínica.', decision: 'Aprovar o recorte específico; reprodução interna e abertura no YouTube disponíveis conforme a preferência do usuário.'
    }),
    vacuum: reviewedVideo({exerciseId: 'vacuum', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'qvdiga5sQvQ', title: 'Como fazer vácuo de estômago', channel: 'Leandro Twin', duration: '2:08', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Explica a expiração e a retração abdominal do vacuum.', limitations: 'A demonstração visual principal é deitada; a postura escolhida no app pode ser diferente.', decision: 'Manter como guia-base para registros antigos.'}),
    vacuum_standing: reviewedVideo({exerciseId: 'vacuum', variationId: 'standing', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'qvdiga5sQvQ', title: 'Como fazer vácuo de estômago', channel: 'Leandro Twin', duration: '2:08', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Explica a expiração e a retração abdominal que formam o vacuum.', limitations: 'A demonstração principal é deitada; em pé, mantenha apoio e não prenda a respiração além do confortável.', decision: 'Exibir como guia do método, não como cópia exata da posição em pé.'}),
    vacuum_all_fours: reviewedVideo({exerciseId: 'vacuum', variationId: 'all_fours', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'qvdiga5sQvQ', title: 'Como fazer vácuo de estômago', channel: 'Leandro Twin', duration: '2:08', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Explica a expiração e a retração abdominal que formam o vacuum.', limitations: 'A demonstração principal é deitada; em quatro apoios, mantenha coluna neutra e use a instrução do cartão.', decision: 'Exibir como guia do método, não como cópia exata da posição.'}),
    vacuum_lying: reviewedVideo({exerciseId: 'vacuum', variationId: 'lying', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'qvdiga5sQvQ', title: 'Como fazer vácuo de estômago', channel: 'Leandro Twin', duration: '2:08', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Inspeção visual confirmou execução deitada com joelhos flexionados, expiração e retração abdominal.', limitations: 'Interrompa se houver tontura ou desconforto; não transforme o vídeo em prescrição clínica.', decision: 'Aprovar para a posição deitada.'}),
    vacuum_seated: reviewedVideo({exerciseId: 'vacuum', variationId: 'seated', status: 'accepted', classification: 'technical_guide', coverageScope: 'foundation', exactMatch: false, youtubeId: 'qvdiga5sQvQ', title: 'Como fazer vácuo de estômago', channel: 'Leandro Twin', duration: '2:08', language: 'pt-BR', reviewedAt: '2026-09-17', availability: 'available', embedCompatible: true, positives: 'Explica a expiração e a retração abdominal que formam o vacuum.', limitations: 'A demonstração principal é deitada; sentado, mantenha pés apoiados e tronco estável conforme o cartão.', decision: 'Exibir como guia do método, não como cópia exata da posição sentada.'})
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
    SIDE_MODES,
    WORKOUT_REVISION,
    DAY_WORKOUT,
    WEEK_LABELS,
    MOBILITY_SEQUENCE,
    BRACING_TEXT,
    MUSCLE_GROUPS,
    MUSCLE_TARGETS,
    CATALOG,
    WORKOUTS,
    WORKOUT_BY_ID,
    LEGACY_ALIASES,
    LEGACY_ONLY_IDS,
    VERIFIED_BR_VIDEO_PROVENANCE,
    VIDEOS,
    verifiedBrazilianProvenance,
    sideModeFor,
    preferredVariantFor,
    prescriptionFor,
    workoutForDate,
    findExercise
  });
})(globalThis);
