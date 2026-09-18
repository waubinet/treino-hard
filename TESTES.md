# Plano e evidências de teste

## Rodada 3.6.3 / esquema 13 — 2026-09-17

Gate local concluído: **124/124** testes de lógica/dados e **60/60** cenários em Chrome aprovados. O inventário tem 46 entradas e **46 aprovadas**, todas em pt-BR, com origem brasileira verificada e chave resolvida para cada execução possível da ficha. Reutilizações não exatas são identificadas por `coverageScope: foundation` e aparecem na interface como **Guia do movimento-base**, junto da limitação específica. A revisão visual automatizada confirmou versão 3.6.3, cache `treino-hard-v3.6.3`, quatro capturas, recarga offline e zero erros.

## Rodada 3.6.2 / esquema 13 — 2026-09-17

Gate local concluído: **124/124** testes de lógica/dados e **60/60** cenários em Chrome aprovados, além da revisão visual automatizada com quatro capturas, cache `treino-hard-v3.6.2`, recarga offline e zero erros de página/console. O teste real do IFrame Player API confirmou estado 1 para `YJ4kGE3eemY` e `QyvIEdEHzHc`; `yj3CnWaoIRI` respondeu erro 150 e foi corretamente classificado como `external_only`. Inventário atual: 46 entradas, 24 aprovadas e 22 pendentes.

## Rodada 3.6.1 / esquema 13 — 2026-09-17

Gate local concluído: **124/124** testes de lógica/dados e **60/60** cenários em Chrome aprovados. A rodada comprovou 20 séries em Empurrar A/B, 16 em Puxar A/B, três séries na corda e três séries por lado na remada unilateral, além da reconstrução dos planos de teste ainda não iniciados. Revisão visual local, cache `treino-hard-v3.6.1`, migração, backup e recarga offline passaram sem erros.

## Rodada 3.6.0 / esquema 13 — 2026-09-17

Gate local e publicação pública concluídos.

- Núcleo, medidas e lateralidade: **124/124 aprovados**.
- Chrome/Playwright: **60/60 aprovados** em uma única execução final, 0 falhas, em 367.705,480 ms.
- Cobertura dirigida da correção atual: planos futuros vazios recebem a revisão atual da ficha, com aquecimento e séries corrigidos, sem remodelar sessão iniciada, parcial, concluída ou qualquer exercício com execução.
- Ficha validada naquela rodada: exercícios bilaterais de força em máquina usavam três séries efetivas; a remada unilateral ainda mantinha duas séries por lado e o deload limitava a duas.
- Revisão visual automatizada e inspeção das quatro capturas: desktop de medidas, leg press móvel, medidas móveis e mobilidade, sem erro de página/console.
- Migração física 12 → 13: documento, recuperação e backup preservados após recargas; apenas o plano futuro completamente vazio é atualizado para `3.6.0-r2`.
- Núcleo: `node --test tests/app.test.cjs tests/measurements-sides.test.cjs tests/laterality.test.cjs`.
- Navegador: `node --test --test-concurrency=1 tests/browser.test.cjs`, com o `NODE_PATH` abaixo.
- GitHub Pages confirmou como `built` o commit `99a5c67d4629b3e72ce2d898bef30a3ce812bc08`.
- Smoke público com cache-busting confirmou versão 3.6.0, esquema 13, cache `treino-hard-v3.6.0`, migração, backup, recarga offline e zero erros de página/console.

## Estado da versão 3.5.1

Validado localmente e publicado em **2026-08-31**, esquema persistido **12**,
cache `treino-hard-v3.5.1`. O commit funcional
`6834706a33236ecedacb27524aad204ed238ad74` foi integrado em `main`, recebeu
status `built` no GitHub Pages e passou no smoke público com cache-busting.

Resultados do gate local:

- sintaxe de `js/workouts.js`, `js/core.js`, `js/storage.js`,
  `js/measurements.js`, `js/app.js`, `sw.js` e do teste de navegador: **aprovada**;
- `manifest.webmanifest`: **JSON válido**;
- `git diff --check`: **aprovado**, sem erro de whitespace;
- `node --test tests/app.test.cjs`: **82/82 aprovados**;
- `node --test tests/browser.test.cjs`: **52/52 aprovados**
  em Google Chrome real via Playwright, **0 falhas**, exit code 0;
- suíte completa de navegador: **674.259,166 ms**;
- erros de console/página aceitos: **0**;
- URL pública: **HTTP 200**, estado “Salvo neste aparelho”, versão 3.5.1,
  esquema 12, cache `treino-hard-v3.5.1` e **0 erros** no Chrome. O smoke
  rebaixou temporariamente um documento fictício para o esquema 11 e comprovou
  revisão avançada e sessões preservadas após o reload.

## Ambiente e comandos

| Item | Valor |
|---|---|
| sistema | Windows, PowerShell |
| navegador | Google Chrome local controlado pelo Playwright |
| app | estático, servido em `127.0.0.1` por porta efêmera |
| dados | IndexedDB; testes explícitos de `localStorage` e somente leitura |
| branch validada | `codex/3.5.1-mobile-migration` |
| commit-base | `a1f7d07b1a74c732b2c6e3007cddafc3833e2060` |
| commit funcional publicado | `6834706a33236ecedacb27524aad204ed238ad74` |
| URL pública | `https://waubinet.github.io/treino-hard/` |

```powershell
node --check js\workouts.js
node --check js\core.js
node --check js\storage.js
node --check js\measurements.js
node --check js\app.js
node --check sw.js
node --test --test-reporter=tap tests\app.test.cjs
$env:NODE_PATH = 'C:\Users\waubi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node --test --test-reporter=tap tests\browser.test.cjs
```

Nunca execute duas suítes Playwright ao mesmo tempo. O harness bloqueia service
workers por padrão para os testes de aplicação e os habilita explicitamente nos
casos offline/PWA, reduzindo acúmulo de sockets sem retirar a cobertura real.

## Cobertura comprovada

Os 82 testes de núcleo cobrem catálogo e ficha canônica, periodização,
progressão dupla, comparabilidade por máquina/variação/lado/faixa, migrações,
limites sem truncamento silencioso, IDs únicos, documentos corrompidos,
recuperação, staging, concorrência, snapshots, backups, criptografia,
prototype pollution, CSV, medidas, silhueta, inventário brasileiro de vídeos,
degrau configurável por aparelho e volume direto/secundário por músculo.

Os 52 cenários em Chrome cobrem:

- início, pausa, retomada, finalização parcial/completa, reabertura, cancelamento
  e remarcação, incluindo duração e pausa acumulada;
- modos calendário e sequência, semanas, deload, arquivamento e continuidade;
- carga, repetições, RIR, confirmação explícita, status, foco, rolagem,
  descanso, desfazer, histórico por máquina, degrau personalizado e séries adversas;
- caminhada, vacuum, medidas bilaterais, ciclos, volume muscular, evolução sem
  fragmentação por faixa, JSON, CSV,
  snapshots, backups comuns e criptografados;
- corrupção, importação hostil, esquema futuro, duas abas, queda de IndexedDB,
  falha de quota e ausência total de persistência em modo somente leitura;
- XSS, CSP, teclado, ARIA, contraste WCAG AA, 320–1280 px, zoom de 200%,
  texto ampliado e movimento reduzido;
- manifesto, ícones, zona maskable, funcionamento offline, atualização de cache,
  falha do service worker, migração da versão 2.2 e confirmação durável da
  atualização 3.4/esquema 11 antes do backup inicial;
- ficha canônica dos seis treinos e política de vídeo em pt-BR de criador/canal
  brasileiro com proveniência verificada.

## Limites ainda manuais

- leitor de tela real (NVDA, JAWS ou Narrador);
- instalação pelo prompt nativo `beforeinstallprompt` em perfil limpo;
- importação de um backup real do usuário, depois de guardar cópia externa;

Esses itens não são contados como aprovados pela suíte local.
