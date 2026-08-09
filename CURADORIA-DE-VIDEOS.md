# Curadoria de vídeos

## Estado desta execução

Data do inventário: **2026-08-08**.

Esta etapa ainda **não é uma curadoria concluída**. Nenhum vídeo foi aberto e assistido integralmente nesta execução. Por isso:

- candidatos novos no catálogo: **34**;
- referências legadas inventariadas: **42 ocorrências, 37 IDs únicos**;
- vídeos aceitos: **0**;
- vídeos substituídos: **0**;
- vídeos rejeitados após revisão: **0**;
- vídeos pendentes: **todos**.

Até uma revisão humana individual, o aplicativo deve exibir **“Vídeo pendente de curadoria.”** e continuar funcionando sem o vídeo. É preferível não mostrar vídeo algum a associar ao exercício uma pegada, máquina, trajetória ou variação diferente.

> Os selos descrevem o conteúdo revisado e não certificam o autor.

## Critério de revisão

Cada candidato só pode sair de `pending` depois de uma pessoa:

1. abrir o vídeo e confirmar sua disponibilidade;
2. assistir à demonstração completa, e não apenas ler título, miniatura ou descrição;
3. conferir exercício, equipamento, pegada, posição, trajetória, amplitude e lateralidade;
4. verificar se há orientação técnica enganosa, promessa absoluta ou demonstração claramente degradada;
5. testar o link externo e, quando aplicável, a incorporação em `youtube-nocookie.com`;
6. registrar título, canal, duração, data, idioma, cobertura, limitações e decisão;
7. classificar o conteúdo como `technical_guide`, `objective_demo` ou `visual_reference` somente quando a revisão sustentar o rótulo.

Classificações:

- **Guia técnico (`technical_guide`)**: cobre parte relevante de ajuste, posição inicial, execução, estabilização/respiração, erros comuns, amplitude e segurança prática.
- **Demonstração objetiva (`objective_demo`)**: mostra posição, movimento, trajetória e ritmo com clareza, sem ser apresentado como aula completa.
- **Referência visual (`visual_reference`)**: serve apenas para reconhecer o movimento.
- **Pendente (`pending`)**: ainda não assistido ou sem evidência suficiente.

## Catálogo novo

Fonte do inventário: objeto `VIDEOS` em `js/workouts.js`. Os campos URL, título, canal, duração e idioma não foram preenchidos porque não foram verificados.

| Chave de vídeo | Exercício canônico | Variação/equipamento | URL/ID | Metadados | Disponibilidade/embed | Correspondência e qualidade | Decisão |
|---|---|---|---|---|---|---|---|
| `chest_press_machine` | Supino reto na máquina | máquina a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `incline_press_machine` | Supino inclinado na máquina | máquina inclinada a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `cable_crossover` | Crossover na polia | polia/trajetória a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `machine_fly` | Crucifixo no aparelho | peck deck/aparelho a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `shoulder_press_machine` | Desenvolvimento na máquina | máquina a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `lateral_raise_dumbbell` | Elevação lateral com halteres | halteres | não selecionado | não verificados | não testados | não avaliada | pendente |
| `triceps_skull_dumbbell` | Tríceps testa com halteres | halteres | não selecionado | não verificados | não testados | não avaliada | pendente |
| `triceps_overhead` | Extensão de tríceps acima da cabeça | equipamento a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `triceps_rope` | Tríceps na polia com corda | corda | não selecionado | não verificados | não testados | não avaliada | pendente |
| `pulldown_supinated` | Puxada frontal supinada | pegada supinada | não selecionado | não verificados | não testados | não avaliada | pendente |
| `pulldown_neutral` | Puxada frontal neutra | pegada neutra | não selecionado | não verificados | não testados | não avaliada | pendente |
| `seated_row_triangle` | Remada sentada com triângulo | cabo com triângulo | não selecionado | não verificados | não testados | não avaliada | pendente |
| `unilateral_row_machine` | Remada unilateral na máquina | unilateral/máquina a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `row_machine_choice` | Remada sentada ou articulada | variação selecionável | não selecionado | não verificados | não testados | não avaliada | pendente |
| `reverse_fly_machine` | Crucifixo invertido no aparelho | aparelho | não selecionado | não verificados | não testados | não avaliada | pendente |
| `ez_bar_curl` | Rosca direta com barra W | barra W | não selecionado | não verificados | não testados | não avaliada | pendente |
| `hammer_curl_standing` | Rosca martelo em pé | halteres | não selecionado | não verificados | não testados | não avaliada | pendente |
| `squat_free_barbell` | Agachamento | livre com barra | não selecionado | não verificados | não testados | não avaliada | pendente |
| `squat_smith` | Agachamento | Smith | não selecionado | não verificados | não testados | não avaliada | pendente |
| `leg_press_45` | Leg press 45° | máquina a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `leg_extension` | Cadeira extensora | máquina a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `leg_curl_seated` | Flexora | sentada | não selecionado | não verificados | não testados | não avaliada | pendente |
| `leg_curl_lying` | Flexora | deitada | não selecionado | não verificados | não testados | não avaliada | pendente |
| `leg_curl_standing_unilateral` | Flexora | em pé unilateral | não selecionado | não verificados | não testados | não avaliada | pendente |
| `calf_standing` | Panturrilha | em pé na máquina | não selecionado | não verificados | não testados | não avaliada | pendente |
| `calf_leg_press` | Panturrilha | leg press 45° | não selecionado | não verificados | não testados | não avaliada | pendente |
| `deadlift_barbell` | Levantamento terra | barra | não selecionado | não verificados | não testados | não avaliada | pendente |
| `calf_seated` | Panturrilha sentada | máquina sentada | não selecionado | não verificados | não testados | não avaliada | pendente |
| `mob_adductor_butterfly` | Alongamento de adutores | borboleta | não selecionado | não verificados | não testados | não avaliada | pendente |
| `mob_hip_butterfly` | Mobilidade de quadril | borboleta | não selecionado | não verificados | não testados | não avaliada | pendente |
| `mob_hamstring_seated` | Alongamento de posterior | sentado | não selecionado | não verificados | não testados | não avaliada | pendente |
| `mob_ankle` | Mobilidade de tornozelo | lado/apoio a confirmar | não selecionado | não verificados | não testados | não avaliada | pendente |
| `bracing` | Bracing | orientação técnica, não exercício | não selecionado | não verificados | não testados | não avaliada | pendente |
| `vacuum` | Vacuum | rotina em casa/posição selecionável | não selecionado | não verificados | não testados | não avaliada | pendente |

## Inventário legado

Fonte: `index.html` preservado no `HEAD` anterior à reforma, objetos `YT` e `FLEX_LIST`. Esta tabela registra os links encontrados; ela **não recomenda nem aprova** nenhum deles. Comentários antigos do código também não constituem revisão.

| Associação legada | ID do YouTube | URL | Estado |
|---|---|---|---|
| `a_puxada_supinada` | `zg1MSZR-y4Y` | https://www.youtube.com/watch?v=zg1MSZR-y4Y | pendente; não assistido |
| `a_remada_unilateral` | `Prevu525iYQ` | https://www.youtube.com/watch?v=Prevu525iYQ | pendente; não assistido |
| `a_puxada_neutra` | `vUu_4jBxM1c` | https://www.youtube.com/watch?v=vUu_4jBxM1c | pendente; não assistido |
| `a_remada_sentada` | `HZPqEGzrLRg` | https://www.youtube.com/watch?v=HZPqEGzrLRg | pendente; não assistido |
| `a_pulldown` | `QTQABcLosXk` | https://www.youtube.com/watch?v=QTQABcLosXk | pendente; não assistido |
| `a_crucifixo_inv` | `eo4O-BvfjRk` | https://www.youtube.com/watch?v=eo4O-BvfjRk | pendente; não assistido |
| `a_biceps_martelo` | `YrZ0qzBi-kk` | https://www.youtube.com/watch?v=YrZ0qzBi-kk | pendente; não assistido |
| `a_rosca_barra_w` | `V6UEDzY51gY` | https://www.youtube.com/watch?v=V6UEDzY51gY | pendente; não assistido |
| `b_supino_barra` | `9Cy3ngopGRk` | https://www.youtube.com/watch?v=9Cy3ngopGRk | pendente; exercício legado, não usar no card de máquina |
| `b_supino_inclinado_halteres` | `3dnLfE3mB1I` | https://www.youtube.com/watch?v=3dnLfE3mB1I | pendente; variação não padrão |
| `b_supino_inclinado_maquina` | `lTDvD97_e3g` | https://www.youtube.com/watch?v=lTDvD97_e3g | pendente; não assistido |
| `b_supino_inclinado_smith` | `WP1VLAt8hbM` | https://www.youtube.com/watch?v=WP1VLAt8hbM | pendente; variação não padrão |
| `b_crossover` | `jqTlJt3JXzQ` | https://www.youtube.com/watch?v=jqTlJt3JXzQ | pendente; não assistido |
| `b_crucifixo_aparelho` | `zEcIgGm7fxU` | https://www.youtube.com/watch?v=zEcIgGm7fxU | pendente; não assistido |
| `b_desenv_maquina` | `Xd5bgkvYdfk` | https://www.youtube.com/watch?v=Xd5bgkvYdfk | pendente; não assistido |
| `b_elev_lateral` | `jannLx4RxKo` | https://www.youtube.com/watch?v=jannLx4RxKo | pendente; não assistido |
| `b_triceps_testa` | `VakpIeaaeXA` | https://www.youtube.com/watch?v=VakpIeaaeXA | pendente; não assistido |
| `b_triceps_pulley` | `7le1JRUUagM` | https://www.youtube.com/watch?v=7le1JRUUagM | pendente; não assistido |
| `c_agach_smith` | `uDBQtlCLQ0Y` | https://www.youtube.com/watch?v=uDBQtlCLQ0Y | pendente; não assistido |
| `c_agach_livre` | `4L5nBs8Eq7g` | https://www.youtube.com/watch?v=4L5nBs8Eq7g | pendente; não assistido |
| `c_terra_barra` | `3otpFrCvjLw` | https://www.youtube.com/watch?v=3otpFrCvjLw | pendente; não assistido |
| `c_leg_press` | `waAxlYvtCcI` | https://www.youtube.com/watch?v=waAxlYvtCcI | pendente; não assistido |
| `c_extensor` | `Svq2T3L9oKo` | https://www.youtube.com/watch?v=Svq2T3L9oKo | pendente; não assistido |
| `c_flexor_sentado` | `T--10UN1jKs` | https://www.youtube.com/watch?v=T--10UN1jKs | pendente; comentário legado indica possível divergência de variação, não verificada |
| `c_flexor_deitado` | `vXPbKrYIEaQ` | https://www.youtube.com/watch?v=vXPbKrYIEaQ | pendente; comentário legado indica possível exercício incorreto, não reutilizar sem revisão |
| `c_panturrilha_pe` | `F7_8z_7Kwks` | https://www.youtube.com/watch?v=F7_8z_7Kwks | pendente; não assistido |
| `c_panturrilha_sentado` | `zHJE3HPEP84` | https://www.youtube.com/watch?v=zHJE3HPEP84 | pendente; não assistido |
| `a_alonga_dorsal` | `eVmGZVPhjV0` | https://www.youtube.com/watch?v=eVmGZVPhjV0 | pendente; não assistido |
| `a_alonga_peitoral` | `6Be-s3RwVp4` | https://www.youtube.com/watch?v=6Be-s3RwVp4 | pendente; não assistido |
| `b_alonga_dorsal` | `eVmGZVPhjV0` | https://www.youtube.com/watch?v=eVmGZVPhjV0 | referência duplicada; pendente |
| `c_alonga_adutor` | `imijpudAW7s` | https://www.youtube.com/watch?v=imijpudAW7s | pendente; não assistido |
| `c_mob_quadril` | `R6zbYBwgioc` | https://www.youtube.com/watch?v=R6zbYBwgioc | pendente; não assistido |
| `c_alonga_posterior` | `x861NmGgbpQ` | https://www.youtube.com/watch?v=x861NmGgbpQ | pendente; não assistido |
| `c_mob_tornozelo` | `3pprN9t_P1o` | https://www.youtube.com/watch?v=3pprN9t_P1o | pendente; não assistido |
| `FLEX_LIST: Dorsais` | `eVmGZVPhjV0` | https://www.youtube.com/watch?v=eVmGZVPhjV0 | referência duplicada; pendente |
| `FLEX_LIST: Peitoral` | `6Be-s3RwVp4` | https://www.youtube.com/watch?v=6Be-s3RwVp4 | referência duplicada; pendente |
| `FLEX_LIST: Adutor (Borboleta)` | `imijpudAW7s` | https://www.youtube.com/watch?v=imijpudAW7s | referência duplicada; pendente |
| `FLEX_LIST: Posterior da Coxa` | `x861NmGgbpQ` | https://www.youtube.com/watch?v=x861NmGgbpQ | referência duplicada; pendente |
| `FLEX_LIST: Reto Femoral` | `nf4OOzWrcXw` | https://www.youtube.com/watch?v=nf4OOzWrcXw | pendente; não assistido |
| `FLEX_LIST: Isquiotibiais` | `bLgb6XZz2N4` | https://www.youtube.com/watch?v=bLgb6XZz2N4 | pendente; não assistido |
| `FLEX_LIST: Adutores no espaldar` | `NxbDKOYe1Hk` | https://www.youtube.com/watch?v=NxbDKOYe1Hk | pendente; não assistido |
| `FLEX_LIST: Glúteos` | `i9Ub99a97go` | https://www.youtube.com/watch?v=i9Ub99a97go | pendente; não assistido |

## Registro obrigatório para cada futura decisão

```json
{
  "exerciseId": "",
  "variationId": "",
  "url": "",
  "youtubeId": "",
  "title": "",
  "channel": "",
  "durationSeconds": null,
  "reviewDate": "",
  "language": "",
  "status": "pending",
  "classification": "pending",
  "exactMatch": false,
  "embeddable": null,
  "coverage": [],
  "limitations": []
}
```

## Fontes de referência

As fontes abaixo orientam a linguagem de esforço, volume, descanso e limitações. Elas não substituem a inspeção audiovisual de cada candidato:

- [ACSM — Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults (posição publicada em 2026)](https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/)
- [PubMed PMID 38970765 — proximidade da falha](https://pubmed.ncbi.nlm.nih.gov/38970765/)
- [PubMed PMID 39205815 — intervalos entre séries](https://pubmed.ncbi.nlm.nih.gov/39205815/)
- [W3C WAI — padrão de abas](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

