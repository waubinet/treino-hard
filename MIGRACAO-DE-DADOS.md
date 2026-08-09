# Migração de dados — esquema 11

## Escopo e fonte

Este documento descreve o comportamento atualmente codificado em `js/core.js` e `js/storage.js`. A validação completa em navegador, incluindo ida e volta com backups reais, ainda está pendente e não é presumida aqui.

O aplicativo novo usa:

- aplicativo: `treino-hard-fofo`;
- esquema de documento: **11**;
- banco preferencial: IndexedDB `treino-hard-v3`, versão 1;
- fallback: `localStorage` na chave `treinohard_document_v11`;
- limite declarado de importação: 5 MiB (`MAX_IMPORT_BYTES`), cuja aplicação pela interface deve ser testada;
- até 5.000 sessões e até 64 séries por exercício após normalização.

IndexedDB e `localStorage` são armazenamento do navegador, não criptografia. Os dados podem ser acessados por pessoas com acesso ao mesmo perfil do aparelho. Backups devem ser guardados em local seguro. Referências: [MDN — IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) e [OWASP — HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## Formato do backup novo

O envelope produzido por `THFCore.buildBackup` é:

```text
app: "treino-hard-fofo"
schemaVersion: 11
format: "treino-hard-backup"
exportedAt: data ISO
state: documento normalizado
```

O documento em `state` contém somente os campos autorizados:

```text
schemaVersion, app, revision, createdAt, updatedAt, settings, cycle,
sessions, cardio, homeRoutines, measurements, progressionDecisions,
legacyCycles, archives, migrationLog, quarantine
```

Um exemplo fictício e importável está em `exemplo-backup-v11.json`.

## Fluxo versionado

```text
esquema 1–9/legado → migrate9To10 → esquema 10 → migrate10To11 → esquema 11
```

### Esquema 9 ou anterior para 10

1. Um documento 11 vazio é criado.
2. Os registros ABC antigos, organizados por semana e primeira/segunda ocorrência, são convertidos em um `legacyCycle`.
3. O registro legado mantém semana, ocorrência, ID antigo, variação antiga, séries, marcação de feito, sensação e feedback.
4. Um alias conhecido pode preencher `canonicalId`; IDs sem correspondência segura permanecem legados.
5. `a_remada_smith`, `a_remada_unilateral` e `c_flexor_sentado` são tratados como ambíguos, sem correspondência canônica automática. O registro recebe `mappingStatus: "ambiguous"` e não é encaixado à força.
6. A chave de comparação legada inclui o ID e a variação antiga, evitando misturar equipamentos à força.
7. Medidas e ajustes passam por normalização.
8. Metadados antigos de início/conclusão da sessão são preservados em `sessionMeta`, inclusive a conclusão manual quando disponível.
9. Cada ciclo arquivado antigo é convertido em outro `legacyCycle`, com rótulo próprio e IDs estáveis.
10. O log registra quantos registros ABC do ciclo corrente foram preservados.

### Esquema 10 para 11

1. O número do esquema passa a 11.
2. São garantidos os arrays `progressionDecisions` e `quarantine`.
3. O log registra a adição do histórico de progressão, da quarentena e de chaves explícitas de equipamento.
4. Todo o estado é normalizado novamente.

## Chaves locais legadas detectadas

`js/storage.js` procura as seguintes chaves:

| Campo lógico | Chave antiga |
|---|---|
| dados | `jovilite_data` |
| metadados de sessão | `jovilite_session_meta` |
| ciclos arquivados | `jovilite_cycle_archives` |
| início do ciclo | `jovilite_cycle_started` |
| medidas | `jovilite_body_measurements` |
| ajustes | `jovilite_settings` |
| semana | `jovilite_week` |
| ocorrência/sessão | `jovilite_session` |
| aba | `jovilite_tab` |
| cópias automáticas | `jovilite_auto_backups` |
| recuperação | `jovilite_recovery` |

Antes da migração automática, a origem bruta é destinada à área de recuperação (`migrationRecovery` no IndexedDB, `treinohard_recovery_v11` no fallback). Até três cópias automáticas antigas são convertidas e importadas no store novo de backups; uma cópia que não puder ser convertida permanece na recuperação bruta e gera mensagem de erro. O comportamento real precisa ser testado com um perfil de navegador que contenha essas chaves.

## Aliases canônicos implementados

A tabela abaixo mostra o alias candidato configurado. A regra de ambiguidade tem precedência: `a_remada_unilateral` e `c_flexor_sentado` continuam sem `canonicalId` automático durante a migração, mesmo aparecendo na tabela.

| ID antigo | ID canônico |
|---|---|
| `a_puxada_supinada` | `pulldown_supinated` |
| `a_puxada_neutra` | `pulldown_neutral` |
| `a_remada_sentada` | `seated_row_triangle` |
| `a_remada_unilateral` | `unilateral_row_machine` |
| `a_crucifixo_inv` | `reverse_fly_machine` |
| `a_biceps_martelo` | `hammer_curl_standing` |
| `a_rosca_barra_w` | `ez_bar_curl` |
| `b_crossover` | `cable_crossover` |
| `b_crucifixo_aparelho` | `machine_fly` |
| `b_desenv_maquina` | `shoulder_press_machine` |
| `b_elev_lateral` | `lateral_raise_dumbbell` |
| `b_triceps_testa` | `triceps_skull_dumbbell` |
| `b_triceps_pulley` | `triceps_rope` |
| `c_agach_smith` | `squat` |
| `c_terra_barra` | `deadlift_barbell` |
| `c_leg_press` | `leg_press_45` |
| `c_extensor` | `leg_extension` |
| `c_flexor_sentado` | `leg_curl` |
| `c_panturrilha_pe` | `calf_standing_or_leg_press` |
| `c_panturrilha_sentado` | `calf_seated` |

IDs listados em `LEGACY_ONLY_IDS` permanecem históricos. Eles não são apagados nem encaixados artificialmente em um exercício atual.

## Validação e normalização

O código atual prevê:

- rejeição de JSON cuja raiz não seja um objeto;
- rejeição de `__proto__`, `prototype` e `constructor`, inclusive em profundidade;
- limite de profundidade de 20 níveis;
- rejeição de backup de outro aplicativo;
- rejeição de esquema futuro;
- whitelist de campos de topo para esquema 11;
- limites de tamanho e quantidade nos arrays e textos normalizados;
- datas e horários validados;
- enumerações fechadas para status de sessão, série, RIR e sensação;
- neutralização de células CSV iniciadas por `=`, `+`, `-`, `@` e equivalentes full-width;
- separação comparável por exercício, variação, máquina, lado e faixa de repetições.

Essas propriedades estão presentes no código, mas o resultado de testes automatizados e em navegador deve ser registrado em `TESTES.md` antes da liberação.

## Gravação, conflito e desfazer

- No IndexedDB, o documento, snapshots, cópias automáticas e itens de recuperação ficam em stores separados.
- No fallback, a gravação usa uma chave de staging, relê e confere esquema/revisão antes de substituir o documento principal.
- A revisão do documento é comparada para reduzir sobrescrita entre abas; divergência gera `REVISION_CONFLICT`.
- Antes de restaurar uma cópia automática, o código cria snapshot.
- Há no máximo três cópias automáticas locais na implementação atual.

## Validações que impedem declarar a migração concluída

A implementação atual contém conversão explícita de metadados de sessão, ciclos arquivados e até três cópias automáticas legadas. Isso corrige a lacuna identificada durante a leitura inicial, mas ainda não substitui a prova com dados reais. Estão pendentes:

- teste com backup real do esquema 9;
- teste direto de esquema 10;
- importação de esquema 11 exportado pelo próprio app;
- esquema futuro sem qualquer gravação destrutiva;
- arquivo malicioso e arquivo acima do limite;
- dado corrompido e exportação da recuperação;
- snapshot e desfazer após falha;
- fallback quando IndexedDB não abre;
- conflito entre duas abas;
- prova de que cargas de máquinas diferentes não se misturam em gráficos.
