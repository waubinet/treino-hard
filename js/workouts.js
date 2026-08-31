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

  function strength(id, name, category, sets, options) {
    const config = options || {};
    return Object.freeze({
      id,
      name,
      type: 'strength',
      category,
      workSets: sets,
      loadStep: config.loadStep || LOAD_STEPS[id] || 5,
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
        {id: 'cable_triangle', label: 'Cabo com triângulo', videoKey: 'seated_row_triangle'},
        {id: 'machine_supported', label: 'Máquina com apoio', videoKey: 'seated_row_supported'}
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

  // Lista fechada: a própria entrada do vídeo não pode declarar-se brasileira
  // e ganhar reprodução. Cada ID precisa existir aqui, coincidir com o canal
  // revisado e apontar para uma prova externa específica. Conteúdo em pt-BR é
  // uma exigência separada e continua sendo conferido em reviewedVideo().
  const VERIFIED_BR_VIDEO_PROVENANCE = Object.freeze({
    '4L5nBs8Eq7g': Object.freeze({channel: 'Laércio Refundini', country: 'BR', evidenceKind: 'official_legal_page', evidenceUrl: 'https://muscleplus.com.br/politica_de_privacidade/', verifiedAt: '2026-08-13'}),
    uDBQtlCLQ0Y: Object.freeze({channel: 'Tay Training', country: 'BR', evidenceKind: 'official_professional_record', evidenceUrl: 'https://treinos-server.taytraining.com.br/api/training-sheet/file/91', verifiedAt: '2026-08-13'}),
    waAxlYvtCcI: Object.freeze({channel: 'Treino Mestre', country: 'BR', evidenceKind: 'official_creator_page', evidenceUrl: 'https://treinomestre.com.br/sobre/', verifiedAt: '2026-08-13'}),
    Svq2T3L9oKo: Object.freeze({channel: 'Gymflix', country: 'BR', channelHandle: '@GYMFLIXAcademia', evidenceKind: 'official_creator_page', evidenceUrl: 'https://gymflix.com.br/pagina-de-direcionamento/', verifiedAt: '2026-08-13'}),
    'T--10UN1jKs': Object.freeze({channel: 'FISIculturismo.com.br', country: 'BR', channelHandle: '@FISIculturismocombr', evidenceKind: 'official_creator_page', evidenceUrl: 'https://fisiculturismo.com.br/', verifiedAt: '2026-08-13'}),
    'F7_8z_7Kwks': Object.freeze({channel: 'FISIculturismo.com.br', country: 'BR', channelHandle: '@FISIculturismocombr', evidenceKind: 'official_creator_page', evidenceUrl: 'https://fisiculturismo.com.br/', verifiedAt: '2026-08-13'}),
    '3otpFrCvjLw': Object.freeze({channel: 'Comer, Treinar e Amar', country: 'BR', evidenceKind: 'independent_brazilian_source', evidenceUrl: 'https://www.ativo.com/fitness/noticias-fitness/9-canais-de-fitness-para-seguir-no-youtube/', verifiedAt: '2026-08-13'}),
    zHJE3HPEP84: Object.freeze({channel: 'Mariana Sardelli', country: 'BR', evidenceKind: 'professional_profile', evidenceUrl: 'https://www.treinar.me/mariana-sardelli', verifiedAt: '2026-08-13'}),
    imijpudAW7s: Object.freeze({channel: 'Matheus Morgavi', country: 'BR', evidenceKind: 'brazilian_federation', evidenceUrl: 'https://www.powerlifting-ipf.com.br/paginas/atletas.php', verifiedAt: '2026-08-13'}),
    '3pprN9t_P1o': Object.freeze({channel: 'Descomplicando a Musculação - NS Personal', country: 'BR', channelHandle: '@personal.natanscarton', evidenceKind: 'official_professional_registry', evidenceUrl: 'https://www.crefrs.org.br/wp-content/uploads/2026/07/NOMINATA-2024.pdf', verifiedAt: '2026-08-13'})
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
      positives: value.positives || '',
      limitations: value.limitations || '',
      decision: blockedByBrazilPolicy
        ? 'Não reproduzir: a política atual exige vídeo revisado de criador ou canal brasileiro, em português do Brasil.'
        : (value.decision || '')
    });
  }

  const VIDEOS = Object.freeze({
    chest_press_machine: reviewedVideo({
      exerciseId: 'chest_press_machine', status: 'pending', classification: 'pending', youtubeId: 'YVbiDGkZyx0',
      title: 'Life Fitness Signature Series Chest Press Instructions', channel: 'Life Fitness / Hammer Strength', duration: '1:28', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra ajuste, posição inicial e trajetória da máquina horizontal.', limitations: 'Não representa todas as máquinas convergentes aceitas pelo cartão.', decision: 'Manter pendente até a máquina executada ser identificada.'
    }),
    incline_press_machine: reviewedVideo({
      exerciseId: 'incline_press_machine', status: 'pending', classification: 'pending', youtubeId: 'xwK8Wd5F0Hk',
      title: 'Hammer Strength Plate-Loaded Incline Press Instructions', channel: 'Life Fitness / Hammer Strength', duration: '4:38', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Demonstra setup e trajetória da versão articulada carregada por anilhas.', limitations: 'Não corresponde à variante seletorizada também permitida pelo cartão.', decision: 'Manter pendente até a máquina executada ser identificada.'
    }),
    cable_crossover: reviewedVideo({
      exerciseId: 'cable_crossover', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'XY6JrX1wyxk',
      title: 'How to do a Cable Crossover | Proper Form & Technique', channel: 'NASM', duration: '0:23', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Polias, base, arco dos braços e encontro das mãos ficam visíveis.', limitations: 'Muito curto; não cobre ajustes e erros com profundidade.', decision: 'Aprovar somente como demonstração objetiva.'
    }),
    machine_fly: reviewedVideo({
      exerciseId: 'machine_fly', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'ON8kg47QpOY', startSeconds: 48,
      title: 'Life Fitness Optima Series Pectoral Fly Rear Delt Instructions', channel: 'Life Fitness / Hammer Strength', duration: '2:19', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Fonte do fabricante; mostra ajuste e execução do peck deck.', limitations: 'O mesmo vídeo também ensina a configuração de deltóide posterior e usa um modelo específico.', decision: 'Aprovar como guia técnico com início no trecho do peitoral.'
    }),
    shoulder_press_machine: reviewedVideo({
      exerciseId: 'shoulder_press_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'ef-hOkkRuY0',
      title: 'Life Fitness Signature Series Shoulder Press Instructions', channel: 'Life Fitness / Hammer Strength', duration: '1:30', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra banco, pegadores, posição inferior e trajetória guiada.', limitations: 'A regulagem depende do modelo da academia.', decision: 'Aprovar como guia técnico para desenvolvimento na máquina.'
    }),
    lateral_raise_dumbbell: reviewedVideo({
      exerciseId: 'lateral_raise_dumbbell', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'XPPfnSEATJA',
      title: 'How to do a Dumbbell Lateral Raise', channel: 'NASM', duration: '0:18', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Postura frontal, halteres e amplitude até a altura dos ombros ficam claros.', limitations: 'Curto demais para explicar escolha de carga, ritmo e compensações.', decision: 'Aprovar como demonstração objetiva.'
    }),
    triceps_skull_dumbbell: reviewedVideo({
      exerciseId: 'triceps_skull_dumbbell', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'jPjhQ2hsAds',
      title: 'Dumbbell Skullcrusher', channel: 'Renaissance Periodization', duration: '0:12', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Banco, dois halteres, flexão e extensão dos cotovelos aparecem em enquadramento lateral.', limitations: 'Não há explicação de setup ou erros; a amplitude individual pode variar.', decision: 'Aprovar somente como demonstração objetiva.'
    }),
    triceps_overhead: reviewedVideo({
      availability: 'unknown', embedCompatible: null,
      exerciseId: 'triceps_overhead', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09',
      limitations: 'O exercício não informa se é feito no cabo, com corda, halter ou máquina.', decision: 'Pedir a escolha do equipamento antes de associar um vídeo.'
    }),
    triceps_rope: reviewedVideo({
      exerciseId: 'triceps_rope', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'GdQYdpo_iI0',
      title: 'PWR Play Cable Rope Triceps Pushdown Training', channel: 'Life Fitness Training', duration: '0:18', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Polia alta, corda, cotovelos próximos ao tronco e extensão completa ficam visíveis.', limitations: 'É uma demonstração curta em equipamento específico.', decision: 'Aprovar como demonstração objetiva.'
    }),
    pulldown_supinated: reviewedVideo({
      exerciseId: 'pulldown_supinated', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: '6WeUXN7dQWg',
      title: 'Underhand Lat Pulldown', channel: 'NYU Abu Dhabi Wellness', duration: '0:32', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Pegada realmente supinada, posição sentada, extensão e puxada ao alto do peito ficam claras.', limitations: 'Breve; não cobre ajuste do apoio de coxas nem erros em profundidade.', decision: 'Aprovar como demonstração objetiva.'
    }),
    pulldown_neutral: reviewedVideo({
      exerciseId: 'pulldown_neutral', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'KgZqDuNx7rI',
      title: 'The BEST way to Perform the Neutral Grip Lat Pulldown | Form Tutorial', channel: 'Physique Development', duration: '4:54', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Explica amplitude, setup, direção dos cotovelos e erros com pegadores neutros.', limitations: 'Usa alças neutras independentes; a largura pode diferir do acessório existente na academia.', decision: 'Aprovar como guia técnico da pegada neutra, registrando a limitação do acessório.'
    }),
    seated_row_triangle: reviewedVideo({
      exerciseId: 'seated_row_triangle', variationId: 'cable_triangle', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '7BkgqzC6WsM', startSeconds: 132,
      title: 'How to PROPERLY Seated Cable Row (DO THIS NOW)', channel: 'Colossus Fitness', duration: '5:06', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra triângulo, posição inicial, remada e explicação de erros.', limitations: 'O vídeo é longo e contém divulgação; o trecho relevante começa perto de 2:12.', decision: 'Aprovar como guia técnico para a variante no cabo com triângulo.'
    }),
    seated_row_supported: reviewedVideo({exerciseId: 'seated_row_triangle', variationId: 'machine_supported', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09', decision: 'Aguardando vídeo exato da máquina com apoio.'}),
    unilateral_row_machine: reviewedVideo({exerciseId: 'unilateral_row_machine', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09', decision: 'As duas variantes exigem demonstrações próprias.'}),
    row_machine_choice: reviewedVideo({exerciseId: 'row_machine_choice', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09', decision: 'A chave genérica foi substituída por chaves específicas de cada variante.'}),
    row_articulated_supported: reviewedVideo({exerciseId: 'row_machine_choice', variationId: 'articulated_supported', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09'}),
    row_articulated_unsupported: reviewedVideo({exerciseId: 'row_machine_choice', variationId: 'articulated_unsupported', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09'}),
    reverse_fly_machine: reviewedVideo({
      exerciseId: 'reverse_fly_machine', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'ON8kg47QpOY', startSeconds: 97,
      title: 'Life Fitness Optima Series Pectoral Fly Rear Delt Instructions', channel: 'Life Fitness / Hammer Strength', duration: '2:19', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Fonte do fabricante; mostra a inversão do banco, pegada e abertura para deltóide posterior.', limitations: 'Modelo específico e vídeo compartilhado com peitoral.', decision: 'Aprovar como guia técnico com início no trecho do deltóide posterior.'
    }),
    ez_bar_curl: reviewedVideo({exerciseId: 'ez_bar_curl', status: 'pending', classification: 'pending', exactMatch: false}),
    hammer_curl_standing: reviewedVideo({exerciseId: 'hammer_curl_standing', status: 'pending', classification: 'pending', exactMatch: false}),
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
      exerciseId: 'leg_curl', variationId: 'seated', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'YLJJJYOfSfc',
      title: 'Life Fitness Signature Series Seated Leg Curl Instructions', channel: 'Life Fitness / Hammer Strength', duration: '2:01', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Fonte do fabricante; mostra banco, trava de coxa, rolete e flexão.', limitations: 'Inglês e modelo específico.', decision: 'Aprovar como guia técnico.'
    }),
    leg_curl_lying: reviewedVideo({
      exerciseId: 'leg_curl', variationId: 'lying', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'Dq5y4WEcqqo',
      title: 'How to Use a Lying Leg Curl | Proper Form & Technique | NASM', channel: 'NASM', duration: '0:21', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Posição prona, rolete e trajetória até cerca de 90 graus ficam claros.', limitations: 'Curto; não detalha regulagens e erros.', decision: 'Aprovar como demonstração objetiva.'
    }),
    leg_curl_standing_unilateral: reviewedVideo({
      exerciseId: 'leg_curl', variationId: 'standing_unilateral', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'T--10UN1jKs',
      title: 'Flexora em Pé Unilateral na Máquina', channel: 'FISIculturismo.com.br', duration: '1:29', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://fisiculturismo.com.br/', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Máquina unilateral em pé, apoio anterior e flexão ficam visíveis.', limitations: 'Cobertura limitada de ajustes e modelo específico.', decision: 'Aprovar como demonstração objetiva.'
    }),
    calf_standing: reviewedVideo({
      exerciseId: 'calf_standing_or_leg_press', variationId: 'standing_machine', status: 'accepted', classification: 'visual_reference', exactMatch: true, youtubeId: 'Dvu8WJRUGTQ',
      title: 'Cybex Standing Calf', channel: 'UKCampusRec', duration: '0:58', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra máquina dedicada, apoio nos ombros, antepé e movimento.', limitations: 'Baixa resolução, fonte não oficial e quase sem instrução de ajuste.', decision: 'Aprovar somente como referência visual.'
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
      exerciseId: 'mob_hip_butterfly', status: 'pending', classification: 'pending', exactMatch: false, youtubeId: '2uj6sgyAUc4',
      title: 'Seated Leg butterfly exercise for Hip mobility', channel: 'Health Q', duration: '0:32', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'É dinâmico e demonstra abertura e fechamento dos joelhos.', limitations: 'Usa cadeira, difere da borboleta no chão e quase não ensina setup.', decision: 'Manter pendente até encontrar guia melhor e exatamente compatível.'
    }),
    mob_hamstring_seated: reviewedVideo({
      exerciseId: 'mob_hamstring_seated', status: 'accepted', classification: 'visual_reference', exactMatch: true, youtubeId: '2s6jU4I5gy4',
      title: 'Alongamento dos posteriores de coxa sentado', channel: 'Cinesio Pro', duration: '0:13', language: 'pt-BR', reviewedAt: '2026-08-09', availability: 'external_only', embedCompatible: false,
      positives: 'Movimento bilateral isolado e claramente visível.', limitations: 'Muito curto, flexiona bastante o tronco e pode ser desconfortável com barriga grande.', decision: 'Aprovado; o proprietário bloqueia incorporação (erro 150), então o cartão abre direto no YouTube.'
    }),
    mob_ankle: reviewedVideo({
      exerciseId: 'mob_ankle', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: '3pprN9t_P1o',
      title: 'Mobilidade de Tornozelo - Joelho na Parede', channel: 'Descomplicando a Musculação - NS Personal', duration: '1:35', language: 'pt-BR', creatorCountry: 'BR', originEvidence: 'https://editora.unifip.edu.br/repositoriounifip/article/view/1990', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Mostra base, calcanhar apoiado e joelho avançando em direção à parede.', limitations: 'Distância da parede e amplitude precisam ser individualizadas.', decision: 'Aprovar como guia técnico.'
    }),
    bracing: reviewedVideo({
      exerciseId: 'bracing', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'ZFiosv9_vis',
      title: 'Squat Pillar #2 | Breathing & Bracing | JTSstrength.com', channel: 'Juggernaut Training Systems', duration: '7:38', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true,
      positives: 'Ensina pressão circunferencial em 360 graus aplicada ao agachamento.', limitations: 'Longo, em inglês e específico ao agachamento; dublagem automática não é garantida no embed.', decision: 'Aprovar como guia técnico.'
    }),
    vacuum: reviewedVideo({exerciseId: 'vacuum', status: 'pending', classification: 'pending', exactMatch: false, reviewedAt: '2026-08-09', limitations: 'Um vídeo genérico não cobre as quatro posições do app.', decision: 'Usar associação por posição.'}),
    vacuum_standing: reviewedVideo({exerciseId: 'vacuum', variationId: 'standing', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'lvwTkY7l_-s', title: 'Demonstrating the Hypopressive abdominal vacuum technique used in low pressure fitness exercises.', channel: 'ACTIVCORE', duration: '1:13', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true, positives: 'Expiração, abertura costal e retração abdominal ficam visíveis.', limitations: 'Não cobre as demais posições ou contraindicações.', decision: 'Aprovar para a posição em pé.'}),
    vacuum_all_fours: reviewedVideo({exerciseId: 'vacuum', variationId: 'all_fours', status: 'accepted', classification: 'objective_demo', exactMatch: true, youtubeId: 'vPQNERJUBlk', title: 'How to do a tummy vacuum', channel: 'Rehab My Patient', duration: '0:35', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true, positives: 'Mostra apoios, coluna neutra e retração abdominal.', limitations: 'Muito curto.', decision: 'Aprovar para quatro apoios.'}),
    vacuum_lying: reviewedVideo({exerciseId: 'vacuum', variationId: 'lying', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'GSEA3-ThqXA', title: 'Supine Stomach Vacuums', channel: 'CCEDseminars', duration: '2:55', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true, positives: 'Mostra posição supina com joelhos flexionados e progressões.', limitations: 'Vídeo antigo e fonte educacional pequena.', decision: 'Aprovar com ressalva para a posição deitada.'}),
    vacuum_seated: reviewedVideo({exerciseId: 'vacuum', variationId: 'seated', status: 'accepted', classification: 'technical_guide', exactMatch: true, youtubeId: 'UNKe4LL8cKc', title: 'How to Perform a Vacuum in a Seated Position', channel: 'The Daily Stretch', duration: '2:45', language: 'en', reviewedAt: '2026-08-09', availability: 'available', embedCompatible: true, positives: 'Mostra cadeira, pés, postura e contração/relaxamento.', limitations: 'Canal pequeno, sem credencial institucional claramente verificável.', decision: 'Aprovar com ressalva para a posição sentada.'})
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
    VERIFIED_BR_VIDEO_PROVENANCE,
    VIDEOS,
    verifiedBrazilianProvenance,
    prescriptionFor,
    workoutForDate,
    findExercise
  });
})(globalThis);
