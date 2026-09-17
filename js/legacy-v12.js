(function initSchema12Workouts(global) {
  'use strict';

  // Frozen definitions from app 3.5.1 / schema 12, commit bcef68ea252bad5a71e7ef4e92bfedcb01bfa5c1.
  // Migration must preserve the historical cardinality, including standing leg
  // curls that were still represented by ONE bilateral log in that schema.
  // Do not update this catalog when the current workout changes.
  const workouts = [
  {
    "id": "push_a",
    "label": "Empurrar A",
    "weekday": 1,
    "workSetTotal": 17,
    "intro": "Peito, ombros e tríceps — maior exposição semanal.",
    "exercises": [
      {
        "id": "chest_press_machine",
        "name": "Supino reto na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": [
            "shoulders",
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 3,
        "warmupOptional": true,
        "detail": "Máquina horizontal ou convergente",
        "notes": [
          "Escolhido pela praticidade e pelo controle ao treinar sozinho. Isso não significa que máquinas sejam universalmente menos lesivas."
        ],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "chest_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "incline_press_machine",
        "name": "Supino inclinado na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": [
            "shoulders",
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Máquina inclinada, seletorizada ou articulada",
        "notes": [
          "Mantenha este exercício separado do supino reto; as cargas não são equivalentes."
        ],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "incline_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "cable_crossover",
        "name": "Crossover na polia",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Polias ajustadas à trajetória escolhida",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "cable_crossover",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "shoulder_press_machine",
        "name": "Desenvolvimento na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": [
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "shoulder_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "lateral_raise_dumbbell",
        "name": "Elevação lateral com halteres",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "lateral_raise_dumbbell",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      },
      {
        "id": "triceps_skull_dumbbell",
        "name": "Tríceps testa com halteres",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "triceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "triceps_skull_dumbbell",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "triceps_rope",
        "name": "Tríceps na polia com corda",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "triceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "triceps_rope",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      }
    ]
  },
  {
    "id": "pull_a",
    "label": "Puxar A",
    "weekday": 2,
    "workSetTotal": 15,
    "intro": "Costas, deltoide posterior e bíceps.",
    "exercises": [
      {
        "id": "pulldown_supinated",
        "name": "Puxada frontal com pegada supinada",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 2,
        "warmupOptional": true,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "pulldown_supinated",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "seated_row_triangle",
        "name": "Remada sentada com triângulo",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps",
            "shoulders"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "cable_triangle",
            "label": "Cabo com triângulo",
            "videoKey": "seated_row_triangle"
          },
          {
            "id": "machine_supported",
            "label": "Máquina com apoio",
            "videoKey": "seated_row_supported"
          }
        ],
        "defaultVariant": "cable_triangle",
        "videoKey": "seated_row_triangle",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "unilateral_row_machine",
        "name": "Remada unilateral na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps",
            "shoulders"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Duas séries por lado; o volume planejado da ficha conta o exercício uma vez.",
        "notes": [],
        "variants": [
          {
            "id": "machine_left_right",
            "label": "Máquina — lados separados"
          },
          {
            "id": "plate_loaded",
            "label": "Articulada com anilhas"
          }
        ],
        "defaultVariant": "machine_left_right",
        "videoKey": "unilateral_row_machine",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": true
      },
      {
        "id": "reverse_fly_machine",
        "name": "Crucifixo invertido no aparelho",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": [
            "back"
          ]
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "reverse_fly_machine",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      },
      {
        "id": "ez_bar_curl",
        "name": "Rosca direta com barra W",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2.5,
        "muscles": {
          "primary": [
            "biceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "ez_bar_curl",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "hammer_curl_standing",
        "name": "Rosca martelo em pé",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "biceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "hammer_curl_standing",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      }
    ]
  },
  {
    "id": "legs_a",
    "label": "Pernas A",
    "weekday": 3,
    "workSetTotal": 14,
    "intro": "Mobilidade original, agachamento e trabalho de pernas.",
    "exercises": [
      {
        "id": "mob_adductor_butterfly",
        "name": "Alongamento de adutores em borboleta",
        "type": "mobility",
        "sets": 2,
        "target": "20–30 segundos",
        "effort": "6–7/10",
        "videoKey": "mob_adductor_butterfly",
        "sideFeedback": true
      },
      {
        "id": "mob_hip_butterfly",
        "name": "Mobilidade de quadril em borboleta",
        "type": "mobility",
        "sets": 2,
        "target": "15 repetições",
        "videoKey": "mob_hip_butterfly",
        "sideFeedback": true
      },
      {
        "id": "mob_hamstring_seated",
        "name": "Alongamento de posterior da coxa sentado",
        "type": "mobility",
        "sets": 2,
        "target": "20–30 segundos",
        "effort": "6–7/10",
        "videoKey": "mob_hamstring_seated",
        "sideFeedback": true
      },
      {
        "id": "mob_ankle",
        "name": "Mobilidade de tornozelo",
        "type": "mobility",
        "sets": 2,
        "target": "10 repetições",
        "videoKey": "mob_ankle",
        "sideFeedback": true,
        "prompts": [
          "Panturrilha direita",
          "Tornozelo direito"
        ]
      },
      {
        "id": "squat",
        "name": "Agachamento",
        "type": "strength",
        "category": "squat_press",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "quadriceps",
            "glutes"
          ],
          "secondary": [
            "hamstrings"
          ]
        },
        "restSeconds": 150,
        "warmupSets": 3,
        "warmupOptional": true,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "free_barbell",
            "label": "Livre com barra",
            "videoKey": "squat_free_barbell"
          },
          {
            "id": "smith",
            "label": "Smith",
            "videoKey": "squat_smith"
          }
        ],
        "defaultVariant": "smith",
        "videoKey": "squat",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_press_45",
        "name": "Leg press 45°",
        "type": "strength",
        "category": "squat_press",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "quadriceps",
            "glutes"
          ],
          "secondary": [
            "hamstrings"
          ]
        },
        "restSeconds": 150,
        "warmupSets": 1,
        "warmupOptional": true,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "machine_unspecified",
            "label": "Máquina atual"
          }
        ],
        "defaultVariant": "machine_unspecified",
        "videoKey": "leg_press_45",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_extension",
        "name": "Cadeira extensora",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "quadriceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "machine_unspecified",
            "label": "Máquina atual"
          }
        ],
        "defaultVariant": "machine_unspecified",
        "videoKey": "leg_extension",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_curl",
        "name": "Flexora",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "hamstrings"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "seated",
            "label": "Sentada",
            "videoKey": "leg_curl_seated"
          },
          {
            "id": "lying",
            "label": "Deitada",
            "videoKey": "leg_curl_lying"
          },
          {
            "id": "standing_unilateral",
            "label": "Em pé unilateral",
            "videoKey": "leg_curl_standing_unilateral"
          }
        ],
        "defaultVariant": "seated",
        "videoKey": "leg_curl",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "calf_standing_or_leg_press",
        "name": "Panturrilha em pé ou no leg press",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "calves"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "standing_machine",
            "label": "Em pé na máquina",
            "videoKey": "calf_standing"
          },
          {
            "id": "leg_press_45",
            "label": "No leg press 45°",
            "videoKey": "calf_leg_press"
          }
        ],
        "defaultVariant": "leg_press_45",
        "videoKey": "calf_standing_or_leg_press",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      }
    ]
  },
  {
    "id": "push_b",
    "label": "Empurrar B",
    "weekday": 4,
    "workSetTotal": 15,
    "intro": "Segunda exposição de empurrar com volume reduzido.",
    "exercises": [
      {
        "id": "chest_press_machine",
        "name": "Supino reto na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": [
            "shoulders",
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": true,
        "detail": "Máquina horizontal ou convergente",
        "notes": [
          "Escolhido pela praticidade e pelo controle ao treinar sozinho. Isso não significa que máquinas sejam universalmente menos lesivas."
        ],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "chest_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "incline_press_machine",
        "name": "Supino inclinado na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": [
            "shoulders",
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Máquina inclinada, seletorizada ou articulada",
        "notes": [
          "Mantenha este exercício separado do supino reto; as cargas não são equivalentes."
        ],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "incline_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "machine_fly",
        "name": "Crucifixo no aparelho",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "chest"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Peck deck ou aparelho equivalente",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "machine_fly",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "shoulder_press_machine",
        "name": "Desenvolvimento na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": [
            "triceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "shoulder_press_machine",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "lateral_raise_dumbbell",
        "name": "Elevação lateral com halteres",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "lateral_raise_dumbbell",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      },
      {
        "id": "triceps_overhead",
        "name": "Tríceps testa ou extensão acima da cabeça",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "triceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Escolha registrada por execução; as cargas das duas opções não são comparadas entre si.",
        "notes": [],
        "variants": [
          {
            "id": "overhead",
            "label": "Extensão acima da cabeça",
            "videoKey": "triceps_overhead"
          },
          {
            "id": "skull_crusher",
            "label": "Tríceps testa com halteres",
            "videoKey": "triceps_skull_dumbbell"
          }
        ],
        "defaultVariant": "overhead",
        "videoKey": "triceps_overhead",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "triceps_rope",
        "name": "Tríceps na polia com corda",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "triceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "triceps_rope",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      }
    ]
  },
  {
    "id": "pull_b",
    "label": "Puxar B",
    "weekday": 5,
    "workSetTotal": 14,
    "intro": "Segunda exposição de puxar com pegada e remada selecionáveis.",
    "exercises": [
      {
        "id": "pulldown_neutral",
        "name": "Puxada frontal com pegada neutra",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "pulldown_neutral",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "row_machine_choice",
        "name": "Remada sentada ou articulada",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps",
            "shoulders"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "seated_cable_triangle",
            "label": "Sentada no cabo",
            "videoKey": "seated_row_triangle"
          },
          {
            "id": "articulated_supported",
            "label": "Articulada com apoio torácico",
            "videoKey": "row_articulated_supported"
          },
          {
            "id": "articulated_unsupported",
            "label": "Articulada sem apoio torácico",
            "videoKey": "row_articulated_unsupported"
          }
        ],
        "defaultVariant": "seated_cable_triangle",
        "videoKey": "row_machine_choice",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "unilateral_row_machine",
        "name": "Remada unilateral na máquina",
        "type": "strength",
        "category": "upper_compound",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "back"
          ],
          "secondary": [
            "biceps",
            "shoulders"
          ]
        },
        "restSeconds": 120,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "Duas séries por lado; o volume planejado da ficha conta o exercício uma vez.",
        "notes": [],
        "variants": [
          {
            "id": "machine_left_right",
            "label": "Máquina — lados separados"
          },
          {
            "id": "plate_loaded",
            "label": "Articulada com anilhas"
          }
        ],
        "defaultVariant": "machine_left_right",
        "videoKey": "unilateral_row_machine",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": true
      },
      {
        "id": "reverse_fly_machine",
        "name": "Crucifixo invertido no aparelho",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "shoulders"
          ],
          "secondary": [
            "back"
          ]
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "reverse_fly_machine",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      },
      {
        "id": "ez_bar_curl",
        "name": "Rosca direta com barra W",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2.5,
        "muscles": {
          "primary": [
            "biceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "ez_bar_curl",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "hammer_curl_standing",
        "name": "Rosca martelo em pé",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 2,
        "muscles": {
          "primary": [
            "biceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "hammer_curl_standing",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      }
    ]
  },
  {
    "id": "legs_b",
    "label": "Pernas B",
    "weekday": 6,
    "workSetTotal": 14,
    "intro": "Mobilidade original, levantamento terra e trabalho de pernas.",
    "exercises": [
      {
        "id": "mob_adductor_butterfly",
        "name": "Alongamento de adutores em borboleta",
        "type": "mobility",
        "sets": 2,
        "target": "20–30 segundos",
        "effort": "6–7/10",
        "videoKey": "mob_adductor_butterfly",
        "sideFeedback": true
      },
      {
        "id": "mob_hip_butterfly",
        "name": "Mobilidade de quadril em borboleta",
        "type": "mobility",
        "sets": 2,
        "target": "15 repetições",
        "videoKey": "mob_hip_butterfly",
        "sideFeedback": true
      },
      {
        "id": "mob_hamstring_seated",
        "name": "Alongamento de posterior da coxa sentado",
        "type": "mobility",
        "sets": 2,
        "target": "20–30 segundos",
        "effort": "6–7/10",
        "videoKey": "mob_hamstring_seated",
        "sideFeedback": true
      },
      {
        "id": "mob_ankle",
        "name": "Mobilidade de tornozelo",
        "type": "mobility",
        "sets": 2,
        "target": "10 repetições",
        "videoKey": "mob_ankle",
        "sideFeedback": true,
        "prompts": [
          "Panturrilha direita",
          "Tornozelo direito"
        ]
      },
      {
        "id": "deadlift_barbell",
        "name": "Levantamento terra com barra",
        "type": "strength",
        "category": "deadlift",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "glutes",
            "hamstrings",
            "back"
          ],
          "secondary": [
            "quadriceps"
          ]
        },
        "restSeconds": 180,
        "warmupSets": 3,
        "warmupOptional": true,
        "detail": "",
        "notes": [
          "Não buscar falha muscular. Preserve no mínimo 2 RIR na semana mais pesada."
        ],
        "variants": [],
        "defaultVariant": "",
        "videoKey": "deadlift_barbell",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_press_45",
        "name": "Leg press 45°",
        "type": "strength",
        "category": "squat_press",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "quadriceps",
            "glutes"
          ],
          "secondary": [
            "hamstrings"
          ]
        },
        "restSeconds": 150,
        "warmupSets": 1,
        "warmupOptional": true,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "machine_unspecified",
            "label": "Máquina atual"
          }
        ],
        "defaultVariant": "machine_unspecified",
        "videoKey": "leg_press_45",
        "bracing": true,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_curl",
        "name": "Flexora",
        "type": "strength",
        "category": "accessory",
        "workSets": 4,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "hamstrings"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "seated",
            "label": "Sentada",
            "videoKey": "leg_curl_seated"
          },
          {
            "id": "lying",
            "label": "Deitada",
            "videoKey": "leg_curl_lying"
          },
          {
            "id": "standing_unilateral",
            "label": "Em pé unilateral",
            "videoKey": "leg_curl_standing_unilateral"
          }
        ],
        "defaultVariant": "seated",
        "videoKey": "leg_curl",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "leg_extension",
        "name": "Cadeira extensora",
        "type": "strength",
        "category": "accessory",
        "workSets": 2,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "quadriceps"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "machine_unspecified",
            "label": "Máquina atual"
          }
        ],
        "defaultVariant": "machine_unspecified",
        "videoKey": "leg_extension",
        "bracing": false,
        "allowHighReps": false,
        "unilateral": false
      },
      {
        "id": "calf_seated",
        "name": "Panturrilha sentada",
        "type": "strength",
        "category": "accessory",
        "workSets": 3,
        "loadStep": 5,
        "muscles": {
          "primary": [
            "calves"
          ],
          "secondary": []
        },
        "restSeconds": 90,
        "warmupSets": 0,
        "warmupOptional": false,
        "detail": "",
        "notes": [],
        "variants": [
          {
            "id": "seated_machine",
            "label": "Máquina sentada"
          }
        ],
        "defaultVariant": "seated_machine",
        "videoKey": "calf_seated",
        "bracing": false,
        "allowHighReps": true,
        "unilateral": false
      }
    ]
  }
];
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  global.THFSchema12Workouts = freeze(workouts);
})(globalThis);
