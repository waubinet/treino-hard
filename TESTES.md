# Plano e evidências de teste

## Rodada 3.6.10 / esquema 13 — 2026-10-23

Gate aprovado: **156/156** testes de lógica/dados/cache e **67/67** cenários em Chrome, sem falhas, cancelamentos ou ignorados. Suíte completa em 391.157 ms. Publicação e smoke público aprovados.

- **156/156** testes de lógica/dados/cache aprovados. Duas regressões novas cobrem as opções, vínculos de vídeo, unidade da carga, chaves separadas e manutenção de séries/aquecimento.
- Cenário novo em Chrome aprovado: as duas opções nos supinos de Empurrar A/B, máquina como padrão, troca para barra/halteres, vídeo correspondente, recorte e persistência após reload; sem overflow global em 320/390/1280. Três cenários dirigidos adicionais (atualização física, degrau e faixa) passaram antes da última seleção de vídeo.
- Reprodução real e inspeção individual dos dois IDs finais confirmadas; fonte/limites em `REVISAO-VIDEOS-2026-10-23.md`. Um candidato anterior foi descartado por cartela incorreta e o teste dirigido foi repetido após selecionar BlueFit.
- Inventário executado: 49 associações, 42 vídeos únicos, 44 correspondências de execução e 5 guias-base. WORKOUT_REVISION/APP_VERSION/cache 3.6.10; esquema permanece 13.
- Sessões planejadas recebem a ficha nova pelo refresh existente. Sessões iniciadas/encerradas mantêm a ficha anterior; para conferir num treino de teste antigo, iniciar um novo ciclo pela opção já existente, sem migração adicional criada nesta rodada.
- Sintaxe de todos os scripts/testes e `git diff --check` aprovados. Sete capturas desktop/móvel inspecionadas, incluindo reto com barra e inclinado com halteres; versão/cache 3.6.10, onze registros de vídeo, recorte da barra 0:02–0:24, seleção das alternativas no cartão e ausência de overflow global em 320/390/1280 confirmados. Migração de quatro sessões fictícias, backup, autosave sem blur e reload offline passaram, zero erros de página/console.
- Publicação funcional confirmada: Pages `built` para `a0ccc7ec6982da5d874a6d144c565cb0ebe8cf80`. Smoke público em `https://waubinet.github.io/treino-hard/?v=a0ccc7e` passou: versão/ficha/cache 3.6.10, esquema 13, onze registros de vídeo com IDs/recortes esperados, seletores de barra/halteres no cartão, migração de quatro sessões fictícias, backup, autosave sem blur, responsividade, reload offline e zero erros de página/console.
- Testes com dados fictícios; iPhone físico, leitor de tela e instalação nativa continuam não verificados. A verificação de reprodução real foi feita separadamente dos testes de integração.

## Rodada 3.6.9 / esquema 13 — 2026-10-23

Gate local final aprovado: **154/154** testes de lógica/dados/cache e **66/66** cenários em Chrome, zero falhas, cancelamentos ou ignorados. Suíte completa de navegador em 397.330 ms. Publicação e smoke público aprovados.

- Lógica/dados/cache: **154/154** aprovados. Sintaxe de todos os scripts/testes e `git diff --check` aprovados.
- Quatro novos IDs inspecionados individualmente e com reprodução real confirmada pelo IFrame Player API (estado 1): `m4ky4df0t4Y`, `MhUzkSK2Slk`, `VFd1fO_H7do`, `rXAP7YQF6ps`. Fontes e limites em `REVISAO-VIDEOS-2026-10-23.md`.
- Cenário dirigido de integração: nove associações, incluindo panturrilhas, borboleta, remada e vacuum, abrem ID e recorte corretos. Novo cenário de sessão anterior com `plate_loaded`, carga 45 e snapshot sem a chave nova comprova acesso à curadoria atual sem alterar snapshot ou registros. Ambos aprovados; YouTube interceptado nesses testes, sem alegar reprodução real a partir deles.
- A primeira execução completa foi interrompida após detectar leitura prematura no teste de arquivamento. O teste esperava qualquer revisão posterior e podia capturar o autosave antes de concluir o reset; agora aguarda também o fechamento do modal, que só ocorre após persistência do reset. Repetição dirigida e repetição completa passaram.
- Revisão visual: cinco capturas desktop/móvel inspecionadas, incluindo o novo cartão de remada com anilhas. Larguras 320/390/1280 sem overflow global; quatro sessões fictícias preservadas pela migração, backup, autosave sem blur, cache `treino-hard-v3.6.9` e recarga offline aprovados; zero erros de página/console. O smoke confere nove entradas de vídeo, seus recortes e o vínculo da variante com anilhas.
- Inventário executado: 47 associações, 40 vídeos únicos, 42 correspondências de execução e 5 guias-base. Prescrição, padrão de máquina, esquema e identidades históricas preservados.
- Limites: testes com dados fictícios, sem acessar o perfil pessoal. iPhone físico, leitor de tela real e instalação nativa não executados.
- Publicação funcional confirmada: Pages `built` para `679ee27c6a6ffc83e6c2b19dcdad7d51bda55a07`. Smoke público em `https://waubinet.github.io/treino-hard/?v=679ee27` aprovou versão 3.6.9, esquema 13, cache correto, nove registros de vídeo com IDs/recortes esperados e o vínculo `plate_loaded`. Migração de quatro sessões fictícias, backup, autosave sem blur, responsividade, recarga offline e zero erros de página/console confirmados.
- Orientação reafirmada pelo usuário nesta rodada: o app ainda não está em uso; dados atuais são de teste. Preservação desse histórico não deve ser prioridade de desenvolvimento, sem dispensar correção básica do salvamento futuro.

## Rodada 3.6.8 / esquema 13 — 2026-10-23

Gate local final aprovado: **154/154** testes de lógica/dados/cache e **65/65** cenários em Chrome, zero falhas, cancelamentos ou ignorados. Suíte completa de navegador em 530.759 ms. Dois cenários dirigidos de variantes/integração também passaram antes da execução completa.

- Novos conteúdos: leg press 45° unilateral (1:55–2:45), vacuum em pé (2:18–2:33) e quatro apoios (2:34–2:47). Origem e inspeção individual registradas em `REVISAO-VIDEOS-2026-10-23.md`.
- Reprodução real, independente dos testes simulados: `ausscKK91R8`, `TU9XSn6TYxs`, `fSQ5LGWfnYU` e `7HcK7fmYJP0` chegaram ao estado 1, sem erro, no IFrame Player API em localhost, host `youtube-nocookie.com`.
- Novo cenário de integração: três variantes unilaterais e duas posições de vacuum abrem o ID e recorte corretos dentro do app; preferência interna respeitada. O YouTube é interceptado nesse teste, portanto ele não é prova de reprodução real.
- Inventário conferido no código: 46 associações, 36 vídeos únicos, 38 correspondências exatas e 8 guias-base. Vacuum sentado continua aproximação: ajoelhado sobre os calcanhares não equivale a cadeira.
- Revisão visual: quatro capturas desktop/móvel inspecionadas; larguras 320/390/1280 sem overflow global. Migração preservou quatro sessões fictícias e backup; autosave sem blur, cache `treino-hard-v3.6.8` e recarga offline passaram, com zero erros de página/console. Smoke também confere os cinco registros de vídeo alterados.
- Sintaxe dos scripts/testes e `git diff --check`: aprovados. Nenhuma mudança de prescrição, esquema ou identidades de histórico. Continuam pendentes testes em iPhone físico, leitor de tela real e instalação nativa.
- Publicação funcional confirmada: Pages `built` para `c81ad5f53a8eddb15663b41cd9f74970b67b11d7`. Smoke público em `https://waubinet.github.io/treino-hard/?v=c81ad5f` passou: versão 3.6.8, esquema 13, cache correto, cinco entradas de vídeo com IDs/recortes/incorporação esperados, quatro sessões fictícias migradas, backup, autosave sem blur, recarga offline e zero erros de página/console.

## Rodada 3.6.7 / esquema 13 — 2026-10-23

- 154/154 testes de lógica/dados/cache aprovados; sintaxe e diff check aprovados.
- Suíte completa do navegador: 63/64 passaram em 539.401 ms. A única falha era a expectativa antiga de guia bilateral na extensora unilateral, que passou a ter demonstração específica. Atualizada somente essa expectativa, mantendo a exigência de ressalva no leg press bilateral; repetição dirigida do cenário passou (1/1, 8.274 ms). Nenhuma falha funcional remanescente nos cenários verificados.
- Demonstração de extensora unilateral do Foco30Dias inspecionada em 5, 15 e 22 segundos; origem e limitações em `REVISAO-VIDEOS-2026-10-23.md`. Abre externamente; incorporação ainda não confirmada.
- Revisão visual local: quatro capturas inspecionadas, larguras 320/390/1280 sem overflow global; versão 3.6.7, esquema 13, quatro sessões fictícias migradas, backup, autosave sem blur, cache `treino-hard-v3.6.7`, recarga offline e zero erros de página/console.
- Publicação confirmada: Pages `built` para `9c23869b06e4ed93fe6ee74a49c304b21643ba66`. Smoke público em `https://waubinet.github.io/treino-hard/?v=9c23869` confirmou versão 3.6.7, esquema 13, cache correto, quatro sessões fictícias migradas, backup, autosave sem blur e reload offline, sem erros de página/console.

## Rodada 3.6.6 / esquema 13 — 2026-10-23

- Gate final: **154/154** testes de lógica/dados/cache e **64/64** cenários em Chrome, 0 falhas, 0 ignorados; suíte de navegador em 538.954 ms.
- A primeira execução teve 63/64, com timeout no aviso de atualização da 2.2. O teste fechava o último cliente antigo antes de exigir worker em espera; o navegador podia ativá-lo automaticamente. Mantido um cliente antigo aberto, a execução completa passou, incluindo atualização confirmada e preservação do histórico.
- Vídeo específico de panturrilha unilateral em pé na máquina integrado; origem brasileira conferida no canal atual e inspeção visual documentada em `REVISAO-VIDEOS-2026-10-23.md`. Abre no YouTube; incorporação ainda não confirmada.
- Inventário executável: 46 associações, 33 vídeos únicos, 34 correspondências exatas e 12 guias de movimento-base.
- Sintaxe dos scripts e testes e `git diff --check`: aprovados. Revisão visual: quatro capturas desktop/móvel inspecionadas; larguras 320/390/1280 sem overflow global; migração preservou quatro sessões fictícias e backup; autosave sem blur e reload offline passaram, cache `treino-hard-v3.6.6`, zero erros de página/console.
- Não foi reproduzido novo defeito funcional nos cenários auditados. Isso não substitui testes em iPhone físico, leitor de tela ou instalação nativa, que seguem pendentes.
- Publicação confirmada: commit funcional `f76ee385297d07dd162d9d54c3eb9ff8f06cac9c` com status `built` no Pages. Smoke em `https://waubinet.github.io/treino-hard/?v=f76ee38` passou: versão 3.6.6, esquema 13, cache correto, quatro sessões fictícias preservadas pela migração, backup, autosave sem blur, reload offline e zero erros de página/console.

## Rodada 3.6.5 / esquema 13 — 2026-09-21

Gate local concluído: **154/154** testes de lógica/dados/cache e **64/64** cenários em Chrome (443.283 ms), nenhuma falha, cancelamento ou teste ignorado.

- Sintaxe dos JavaScripts e testes, JSON do manifesto e `git diff --check`: aprovados.
- Quatro regressões novas de navegador: carga 37 salva sem blur e mantida após reload; gravação lenta não confirma edição posterior; falha conserva texto e permite tentar novamente; ocultar a página antecipa salvamento de observação.
- Trinta testes do service worker: resposta HTTP válida preservada quando cache falha por quota/indisponibilidade; fallback da versão atual; erros HTTP mantidos sem cache; instalação incompleta rejeitada; remoção apenas dos caches antigos do app.
- Suíte completa: persistência, concorrência, backups, importações hostis, migrações físicas 11/12 → 13, histórico, lados, progressão, acessibilidade automatizada, vídeos, atualização e offline.
- `tests/visual-review.cjs`: quatro capturas desktop/móvel inspecionadas; larguras 320/390/1280 sem overflow global; migração preservou quatro sessões fictícias e backup; autosave sem blur confirmado; cache `treino-hard-v3.6.5`; reload offline; zero erros de página/console.
- Reprodução real: `s20MPQbKIHQ`, `Prevu525iYQ` e `6OTssJK_sVU` chegaram ao estado 1 no IFrame Player API em Chrome isolado, em 2026-09-21. Isso corrige sua disponibilidade incorporada, não constitui nova revisão visual integral de todo o catálogo.
- Comandos: `node --test tests/app.test.cjs tests/measurements-sides.test.cjs tests/laterality.test.cjs tests/service-worker.test.cjs`; `node --test --test-concurrency=1 --test-reporter=tap tests/browser.test.cjs`; `node tests/visual-review.cjs`.
- Limites: iPhone físico, leitor de tela real e instalação nativa ainda não verificados. As 13 associações classificadas como movimento-base continuam aproximações explícitas. Nenhum dado pessoal foi usado nos testes.

Publicação funcional: commit `a04d99ade864537cdd562d1c0d9a42aee0e24b1d`, confirmado como `built` pelo GitHub Pages em 2026-09-21. O smoke em `https://waubinet.github.io/treino-hard/?v=a04d99a` confirmou versão 3.6.5, esquema 13, cache `treino-hard-v3.6.5`, quatro sessões fictícias preservadas pela migração, backup, carga 37 mantida após reload sem blur, funcionamento offline e zero erros de página/console. Nenhum dado do perfil pessoal do navegador foi acessado.

## Rodada 3.6.4 / esquema 13 — 2026-09-18

Gate local concluído: **124/124** testes de lógica/dados e **60/60** cenários em Chrome aprovados. A rodada corrige quatro associações aproximadas, metadados/recortes de quatro vídeos e o deslocamento de cartões sob a navegação fixa móvel, sem alterar a ficha ou os registros persistidos. O catálogo continua com 46/46 entradas aprovadas e proveniência brasileira fechada. A revisão visual automatizada confirmou versão 3.6.4, cache `treino-hard-v3.6.4`, quatro capturas, recarga offline e zero erros.

Publicação funcional: commit `879e9b992f475b382d29e9ef397ff31fb533b1d1`, confirmado como `built` pelo GitHub Pages. O smoke público com cache-busting confirmou versão 3.6.4, esquema 13, cache correto, migração, backup, funcionamento offline e zero erros de página/console.

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
