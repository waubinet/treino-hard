# Curadoria de vídeos

Gerado a partir de `js/workouts.js` em 2026-08-09. **Não edite a tabela à mão**:
ela é derivada do catálogo e travada pelos testes de inventário.

## Como ler

- **estado**: `accepted` (conteúdo técnico aprovado), `pending` (não revisado ou
  sem segurança suficiente), `rejected` (conferido e incompatível).
- **classificação**: `technical_guide` explica execução, ajustes ou erros;
  `objective_demo` mostra a execução sem ensinar em profundidade;
  `visual_reference` serve como reconhecimento do movimento.
- **disponibilidade**: `available` toca dentro do app; `external_only` existe mas
  o proprietário bloqueia incorporação (IFrame Player API, erro 101/150);
  `removed_or_private` corresponde ao erro 100; `unknown` é sem candidato.
- **embed**: resultado do teste real com o IFrame Player API.

Disponibilidade e qualidade são independentes. Um vídeo `accepted` com
`external_only` é um estado válido: o conteúdo foi aprovado e o cartão abre
direto no YouTube, sem oferecer prévia interna.

## Verificação de 2026-08-09

31 identificadores únicos sondados com o IFrame Player API: **29 available**,
**2 external_only** (erro 150), **0 removed_or_private**.

`4L5nBs8Eq7g` (agachamento livre) e `2s6jU4I5gy4` (posterior de coxa) haviam sido
rebaixados para `pending` com base apenas no `oEmbed 401`. A sonda mostrou erro
150 — bloqueio de incorporação, não ausência do vídeo. Ambos voltaram a
`accepted` com `availability: external_only`.

## Catálogo

| chave | exercício | variação | estado | classificação | disponibilidade | embed | ID | título | canal | duração | idioma | revisão | recorte |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bracing | bracing | — | accepted | technical_guide | available | sim | ZFiosv9_vis | Squat Pillar #2 / Breathing & Bracing / JTSstrength. | Juggernaut Training Systems | 7:38 | en | 2026-08-09 | — |
| cable_crossover | cable_crossover | — | accepted | objective_demo | available | sim | XY6JrX1wyxk | How to do a Cable Crossover / Proper Form & Techniqu | NASM | 0:23 | en | 2026-08-09 | — |
| calf_leg_press | calf_standing_or_leg_press | leg_press_45 | accepted | objective_demo | available | sim | F7_8z_7Kwks | Panturrilha no Leg Press 45º | FISIculturismo.com.br | 2:15 | pt-BR | 2026-08-09 | — |
| calf_seated | calf_seated | — | accepted | objective_demo | available | sim | zHJE3HPEP84 | Panturrilha Sentado Solear - Execução Exercício | Mariana Sardelli | 0:35 | pt-BR | 2026-08-09 | — |
| calf_standing | calf_standing_or_leg_press | standing_machine | accepted | visual_reference | available | sim | Dvu8WJRUGTQ | Cybex Standing Calf | UKCampusRec | 0:58 | en | 2026-08-09 | — |
| chest_press_machine | chest_press_machine | — | pending | pending | available | sim | YVbiDGkZyx0 | Life Fitness Signature Series Chest Press Instructio | Life Fitness / Hammer Strength | 1:28 | en | 2026-08-09 | — |
| deadlift_barbell | deadlift_barbell | — | accepted | technical_guide | available | sim | 3otpFrCvjLw | EXECUÇÃO CORRETA DE DEAD LIFT (LEVANTAMENTO TERRA) | Comer, Treinar e Amar | 3:48 | pt-BR | 2026-08-09 | — |
| ez_bar_curl | ez_bar_curl | — | pending | pending | unknown | — | — | — | — | — | — | — | — |
| hammer_curl_standing | hammer_curl_standing | — | pending | pending | unknown | — | — | — | — | — | — | — | — |
| incline_press_machine | incline_press_machine | — | pending | pending | available | sim | xwK8Wd5F0Hk | Hammer Strength Plate-Loaded Incline Press Instructi | Life Fitness / Hammer Strength | 4:38 | en | 2026-08-09 | — |
| lateral_raise_dumbbell | lateral_raise_dumbbell | — | accepted | objective_demo | available | sim | XPPfnSEATJA | How to do a Dumbbell Lateral Raise | NASM | 0:18 | en | 2026-08-09 | — |
| leg_curl_lying | leg_curl | lying | accepted | objective_demo | available | sim | Dq5y4WEcqqo | How to Use a Lying Leg Curl / Proper Form & Techniqu | NASM | 0:21 | en | 2026-08-09 | — |
| leg_curl_seated | leg_curl | seated | accepted | technical_guide | available | sim | YLJJJYOfSfc | Life Fitness Signature Series Seated Leg Curl Instru | Life Fitness / Hammer Strength | 2:01 | en | 2026-08-09 | — |
| leg_curl_standing_unilateral | leg_curl | standing_unilateral | accepted | objective_demo | available | sim | T--10UN1jKs | Flexora em Pé Unilateral na Máquina | FISIculturismo.com.br | 1:29 | pt-BR | 2026-08-09 | — |
| leg_extension | leg_extension | — | accepted | technical_guide | available | sim | Svq2T3L9oKo | CADEIRA EXTENSORA - COMO EXECUTAR DE FORMA CORRETA | Gymflix | 2:49 | pt-BR | 2026-08-09 | — |
| leg_press_45 | leg_press_45 | — | accepted | objective_demo | available | sim | waAxlYvtCcI | Exercício Leg Press 45° - Execução Correta | Treino Mestre | 0:56 | pt-BR | 2026-08-09 | — |
| machine_fly | machine_fly | — | accepted | technical_guide | available | sim | ON8kg47QpOY | Life Fitness Optima Series Pectoral Fly Rear Delt In | Life Fitness / Hammer Strength | 2:19 | en | 2026-08-09 | 48s |
| mob_adductor_butterfly | mob_adductor_butterfly | — | accepted | objective_demo | available | sim | imijpudAW7s | Como fazer alongamento borboleta - Adutores - Matheu | Matheus Morgavi | 1:07 | pt-BR | 2026-08-09 | — |
| mob_ankle | mob_ankle | — | accepted | technical_guide | available | sim | 3pprN9t_P1o | Mobilidade de Tornozelo - Joelho na Parede | Descomplicando a Musculação - NS Personal | 1:35 | pt-BR | 2026-08-09 | — |
| mob_hamstring_seated | mob_hamstring_seated | — | accepted | visual_reference | external_only | não | 2s6jU4I5gy4 | Alongamento dos posteriores de coxa sentado | Cinesio Pro | 0:13 | pt-BR | 2026-08-09 | — |
| mob_hip_butterfly | mob_hip_butterfly | — | pending | pending | available | sim | 2uj6sgyAUc4 | Seated Leg butterfly exercise for Hip mobility | Health Q | 0:32 | en | 2026-08-09 | — |
| pulldown_neutral | pulldown_neutral | — | accepted | technical_guide | available | sim | KgZqDuNx7rI | The BEST way to Perform the Neutral Grip Lat Pulldow | Physique Development | 4:54 | en | 2026-08-09 | — |
| pulldown_supinated | pulldown_supinated | — | accepted | objective_demo | available | sim | 6WeUXN7dQWg | Underhand Lat Pulldown | NYU Abu Dhabi Wellness | 0:32 | en | 2026-08-09 | — |
| reverse_fly_machine | reverse_fly_machine | — | accepted | technical_guide | available | sim | ON8kg47QpOY | Life Fitness Optima Series Pectoral Fly Rear Delt In | Life Fitness / Hammer Strength | 2:19 | en | 2026-08-09 | 97s |
| row_articulated_supported | row_machine_choice | articulated_supported | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| row_articulated_unsupported | row_machine_choice | articulated_unsupported | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| row_machine_choice | row_machine_choice | — | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| seated_row_supported | seated_row_triangle | machine_supported | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| seated_row_triangle | seated_row_triangle | cable_triangle | accepted | technical_guide | available | sim | 7BkgqzC6WsM | How to PROPERLY Seated Cable Row (DO THIS NOW) | Colossus Fitness | 5:06 | en | 2026-08-09 | 132s |
| shoulder_press_machine | shoulder_press_machine | — | accepted | technical_guide | available | sim | ef-hOkkRuY0 | Life Fitness Signature Series Shoulder Press Instruc | Life Fitness / Hammer Strength | 1:30 | en | 2026-08-09 | — |
| squat_free_barbell | squat | free_barbell | accepted | technical_guide | external_only | não | 4L5nBs8Eq7g | 3 Passos Para Fazer o Agachamento Livre PERFEITO (O  | Laércio Refundini | 7:05 | pt-BR | 2026-08-09 | — |
| squat_smith | squat | smith | accepted | technical_guide | available | sim | uDBQtlCLQ0Y | AGACHAMENTO SMITH - O passo a passo completo | Tay Training | 8:03 | pt-BR | 2026-08-09 | — |
| triceps_overhead | triceps_overhead | — | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| triceps_rope | triceps_rope | — | accepted | objective_demo | available | sim | GdQYdpo_iI0 | PWR Play Cable Rope Triceps Pushdown Training | Life Fitness Training | 0:18 | en | 2026-08-09 | — |
| triceps_skull_dumbbell | triceps_skull_dumbbell | — | accepted | objective_demo | available | sim | jPjhQ2hsAds | Dumbbell Skullcrusher | Renaissance Periodization | 0:12 | en | 2026-08-09 | — |
| unilateral_row_machine | unilateral_row_machine | — | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| vacuum | vacuum | — | pending | pending | unknown | — | — | — | — | — | — | 2026-08-09 | — |
| vacuum_all_fours | vacuum | all_fours | accepted | objective_demo | available | sim | vPQNERJUBlk | How to do a tummy vacuum | Rehab My Patient | 0:35 | en | 2026-08-09 | — |
| vacuum_lying | vacuum | lying | accepted | technical_guide | available | sim | GSEA3-ThqXA | Supine Stomach Vacuums | CCEDseminars | 2:55 | en | 2026-08-09 | — |
| vacuum_seated | vacuum | seated | accepted | technical_guide | available | sim | UNKe4LL8cKc | How to Perform a Vacuum in a Seated Position | The Daily Stretch | 2:45 | en | 2026-08-09 | — |
| vacuum_standing | vacuum | standing | accepted | technical_guide | available | sim | lvwTkY7l_-s | Demonstrating the Hypopressive abdominal vacuum tech | ACTIVCORE | 1:13 | en | 2026-08-09 | — |

## Pendentes

Os itens com estado `pending` não foram assistidos nesta rodada. Nenhum vídeo é
aprovado por título, miniatura, descrição ou reputação do canal: a aprovação
exige assistir à demonstração e conferir exercício, equipamento, pegada, posição,
trajetória, amplitude e lateralidade.

## Reaproveitamento de vídeo

`ON8kg47QpOY` atende `machine_fly` (recorte em 48 s) e `reverse_fly_machine`
(recorte em 97 s): é o vídeo do fabricante da mesma máquina. O recorte é aplicado
no link externo (`t=`) e no embed (`start=`), e o teste de inventário proíbe
reaproveitar um identificador sem recortes distintos e documentados.
